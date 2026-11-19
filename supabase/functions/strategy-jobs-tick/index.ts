// Acompanha a fila da estratégia (strategy_jobs). Chamado pelo pg_cron a cada minuto.
// Sem login de propósito: só processa a fila e é idempotente. Etapas:
// drafting (lote do rascunho) -> reviewing (lote da revisão) -> done (estratégia salva como rascunho, status 'draft').
// Se a revisão falhar, salva o rascunho sem revisão. Uma nova tentativa por etapa quando o formato vem errado.
import { adminClient, json } from "../_shared/common.ts";
import { extractStrategy, MODEL, readBatch, RETRY_NOTE, strategyParams, submitBatch } from "../_shared/strategy-core.ts";

const MAX_AGE_H = 26; // lote do Claude expira em 24 h

Deno.serve(async () => {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return json({ error: "sem ANTHROPIC_API_KEY" }, 500);
  const db = adminClient();
  const now = () => new Date().toISOString();
  const report = { checked: 0, advanced: 0, saved: 0, failed: 0 };

  // Pedido que ficou na fila sem lote (o envio inicial falhou): manda o rascunho agora
  const { data: queued } = await db.from("strategy_jobs").select("id, system_prompt, user_prompt").eq("status", "queued")
    .is("batch_id", null).lt("created_at", new Date(Date.now() - 60_000).toISOString()).limit(5);
  for (const q of queued ?? []) {
    try {
      const id = await submitBatch(apiKey, `draft-${q.id}`, strategyParams(q.system_prompt, q.user_prompt, "high"));
      await db.from("strategy_jobs").update({ status: "drafting", batch_id: id, attempts: 1, updated_at: now() }).eq("id", q.id);
    } catch (e) { console.error("fila", q.id, e); }
  }

  const { data: jobs } = await db.from("strategy_jobs").select("*").in("status", ["drafting", "reviewing"])
    .order("created_at", { ascending: true }).limit(20);

  for (const job of jobs ?? []) {
    report.checked++;
    try {
      if (Date.now() - new Date(job.created_at).getTime() > MAX_AGE_H * 3600_000) {
        await db.from("strategy_jobs").update({ status: "error", error: "O pedido passou de 24 h sem resposta.", updated_at: now() }).eq("id", job.id);
        report.failed++; continue;
      }
      if (!job.batch_id) continue;
      const r = await readBatch(apiKey, job.batch_id);
      if (!r.done) continue;
      const content = r.error ? null : extractStrategy(r.message);

      if (job.status === "drafting") {
        if (!content) {
          if (job.attempts < 2) {
            const id = await submitBatch(apiKey, `draft-${job.id}-2`, strategyParams(job.system_prompt, job.user_prompt + RETRY_NOTE, "high"));
            await db.from("strategy_jobs").update({ batch_id: id, attempts: job.attempts + 1, updated_at: now() }).eq("id", job.id);
          } else {
            await db.from("strategy_jobs").update({ status: "error", error: r.error ?? "O Claude não devolveu a estratégia no formato certo.", updated_at: now() }).eq("id", job.id);
            report.failed++;
          }
          continue;
        }
        const reviewMsg = `${job.user_prompt}\n\nESTRATÉGIA PARA REVISAR (JSON):\n${JSON.stringify(content, null, 2)}`;
        const id = await submitBatch(apiKey, `review-${job.id}`, strategyParams(job.review_system_prompt, reviewMsg, "medium"));
        await db.from("strategy_jobs").update({ status: "reviewing", draft: content, batch_id: id, attempts: 1, updated_at: now() }).eq("id", job.id);
        report.advanced++;
        continue;
      }

      // reviewing
      if (!content && job.attempts < 2) {
        const reviewMsg = `${job.user_prompt}\n\nESTRATÉGIA PARA REVISAR (JSON):\n${JSON.stringify(job.draft, null, 2)}${RETRY_NOTE}`;
        const id = await submitBatch(apiKey, `review-${job.id}-2`, strategyParams(job.review_system_prompt, reviewMsg, "medium"));
        await db.from("strategy_jobs").update({ batch_id: id, attempts: job.attempts + 1, updated_at: now() }).eq("id", job.id);
        continue;
      }
      const finalContent = content ?? job.draft;
      const { data: last } = await db.from("client_strategies").select("version").eq("client_id", job.client_id)
        .order("version", { ascending: false }).limit(1).maybeSingle();
      const { data: saved, error } = await db.from("client_strategies").insert({
        client_id: job.client_id,
        agency_id: job.agency_id,
        version: (last?.version ?? 0) + 1,
        status: "draft",
        content: finalContent,
        model: `${r.message?.model ?? MODEL}${content ? " + revisão" : " (sem revisão)"}`,
        created_by: job.created_by,
      }).select("id").single();
      if (error || !saved) throw new Error("erro ao salvar a estratégia");
      await db.from("strategy_jobs").update({ status: "done", strategy_id: saved.id, error: content ? null : (r.error ?? "revisão fora do formato"), updated_at: now() }).eq("id", job.id);
      report.saved++;
    } catch (e) {
      console.error("job", job.id, e);
      await db.from("strategy_jobs").update({ error: String(e), updated_at: now() }).eq("id", job.id);
    }
  }
  return json(report);
});
