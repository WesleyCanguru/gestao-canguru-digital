// Pede a estratégia de tráfego pago de um cliente. Não espera o Claude: roda o Raio-X, monta os prompts
// (playbook da casa + data de hoje), cria um pedido em strategy_jobs e manda o rascunho em lote.
// A função strategy-jobs-tick (a cada minuto) faz a revisão e salva a estratégia como rascunho (status 'draft').
// Só a equipe da agência do cliente pode chamar. Resposta: { job } com status 'drafting'.
import { adminClient, corsHeaders, json, userClient } from "../_shared/common.ts";
import { buildStrategyPrompts, strategyParams, submitBatch } from "../_shared/strategy-core.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const body = await req.json();
    const clientId = typeof body.client_id === "string" ? body.client_id : "";
    const extra = typeof body.instructions === "string" ? body.instructions.slice(0, 20000) : "";
    if (!clientId) return json({ error: "client_id obrigatório" }, 400);

    const admin = adminClient();
    const { data: client } = await admin.from("clients").select("*").eq("id", clientId).maybeSingle();
    if (!client) return json({ error: "Cliente não encontrado." }, 404);

    // Confere que quem chamou é da equipe da agência do cliente
    const asUser = userClient(req);
    const { data: { user } } = await asUser.auth.getUser();
    if (!user) return json({ error: "Faça login." }, 401);
    const { data: isStaff } = await asUser.rpc("i_am_staff_of", { p_agency: client.agency_id });
    if (!isStaff) return json({ error: "Sem acesso a este cliente." }, 403);

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) return json({ error: "Chave do Claude não configurada (ANTHROPIC_API_KEY)." }, 500);

    // Um pedido por vez por cliente
    const { data: open } = await admin.from("strategy_jobs").select("*").eq("client_id", clientId)
      .in("status", ["queued", "drafting", "reviewing"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (open) return json({ job: open, already_running: true });

    const p = await buildStrategyPrompts(admin, client, user.id, extra, body.refresh_xray === true);
    const { data: job, error } = await admin.from("strategy_jobs").insert({
      client_id: clientId, agency_id: client.agency_id, created_by: user.id, instructions: extra || null,
      status: "queued", system_prompt: p.system, user_prompt: p.userMsg, review_system_prompt: p.reviewSystem,
      xray_id: p.auditId, base_version: p.baseVersion,
    }).select("*").single();
    if (error || !job) return json({ error: "Erro ao criar o pedido." }, 500);

    try {
      const batchId = await submitBatch(apiKey, `draft-${job.id}`, strategyParams(p.system, p.userMsg, "high"));
      const { data: upd } = await admin.from("strategy_jobs").update({ status: "drafting", batch_id: batchId, attempts: 1, updated_at: new Date().toISOString() })
        .eq("id", job.id).select("*").single();
      return json({ job: upd ?? job });
    } catch (e) {
      console.error(e);
      await admin.from("strategy_jobs").update({ status: "error", error: String(e), updated_at: new Date().toISOString() }).eq("id", job.id);
      return json({ error: "Não foi possível enviar o pedido ao Claude. Tente de novo." }, 502);
    }
  } catch (e) {
    console.error(e);
    return json({ error: "Erro inesperado." }, 500);
  }
});
