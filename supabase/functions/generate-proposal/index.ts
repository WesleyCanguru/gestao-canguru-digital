// Gera (ou ajusta) uma proposta comercial com o Claude, a partir do que foi conversado na reunião.
// Só a equipe da agência pode chamar. Cria/atualiza a linha em proposals.
//
// FLUXO NOVO (v6): reunião -> resumo para aprovar (status 'summary') -> aprovar -> rascunho da página (status 'draft') -> publicar.
// action 'summarize': { agency_id, prospect_name, notes, whatsapp?, currency?, language?, monthly_value?, setup_value?, pdf_base64?, source?, source_ref? }
//   cria a proposta como "Resumo para aprovar" (summary). Com source_ref repetido, devolve a que já existe.
// action 'revise_summary': { proposal_id, instructions }  reescreve o resumo com a instrução da equipe.
// action 'approve_summary': { proposal_id, summary? }  aprova o resumo (opcionalmente editado) e gera a página (vira 'draft').
//
// AÇÕES QUE JÁ EXISTIAM (sem mudança de comportamento):
// action 'create': { agency_id, prospect_name, whatsapp?, currency?, language?, notes?, pdf_base64?, monthly_value?, setup_value? }  gera a página direto
// action 'revise': { proposal_id, instructions }
//   rascunho: atualiza a própria proposta (a versão anterior vai para proposal_versions).
//   publicada: o ajuste fica em draft_content; o link continua com a versão atual até 'publish_draft'.
// action 'publish_draft': { proposal_id }  publica o ajuste pendente (versão anterior vai para o histórico)
// action 'discard_draft': { proposal_id }  descarta o ajuste pendente
// action 'restore': { proposal_id, version_id }  volta uma versão do histórico (publicada: vira ajuste pendente)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const adminClient = () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });
const userClient = (req: Request) => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
});

const MODEL = "claude-sonnet-5-5";
const ACTIONS = ["create", "revise", "publish_draft", "discard_draft", "restore", "summarize", "revise_summary", "approve_summary"];

const TOOL = {
  name: "salvar_proposta",
  description: "Salva a proposta comercial estruturada.",
  input_schema: {
    type: "object",
    properties: {
      titulo: { type: "string", description: "Título curto do que está sendo proposto, ex.: Tráfego pago + Instagram" },
      abertura: { type: "string", description: "2 a 3 frases, falando direto com o cliente, sobre o que vamos fazer juntos." },
      o_que_entendemos: { type: "array", items: { type: "string" }, description: "O que entendemos do negócio e do momento do cliente, 3 a 5 itens." },
      objetivos: { type: "array", items: { type: "string" }, description: "Resultados que o cliente quer, em linguagem dele." },
      servicos: {
        type: "array",
        items: { type: "object", properties: { nome: { type: "string" }, descricao: { type: "string" }, entregas: { type: "array", items: { type: "string" } } }, required: ["nome", "descricao", "entregas"] },
      },
      etapas: {
        type: "array",
        items: { type: "object", properties: { fase: { type: "string" }, prazo: { type: "string" }, descricao: { type: "string" } }, required: ["fase", "prazo", "descricao"] },
      },
      planos: {
        type: "array",
        description: "1 a 3 opções de investimento. Use os valores informados pela equipe; não invente valores se a equipe passou.",
        items: {
          type: "object",
          properties: {
            nome: { type: "string" }, mensal: { type: "number" }, implantacao: { type: "number" },
            inclui: { type: "array", items: { type: "string" } }, destaque: { type: "boolean" },
          },
          required: ["nome", "mensal", "inclui"],
        },
      },
      condicoes: { type: "array", items: { type: "string" }, description: "Prazo mínimo, forma de pagamento, verba de anúncios paga direto às plataformas etc." },
      proximos_passos: { type: "array", items: { type: "string" } },
      pontos_em_aberto: { type: "array", items: { type: "string" }, description: "Dúvidas para a equipe confirmar. Não aparece para o cliente." },
    },
    required: ["titulo", "abertura", "o_que_entendemos", "objetivos", "servicos", "etapas", "planos", "condicoes", "proximos_passos", "pontos_em_aberto"],
  },
};

const pessoa = { type: "object", properties: { nome: { type: "string" }, cargo: { type: "string" }, contato: { type: "string", description: "WhatsApp ou e-mail, se apareceu." } }, required: ["nome"] };
const SUMMARY_TOOL = {
  name: "salvar_resumo",
  description: "Salva o resumo da proposta para a equipe aprovar antes de gerar a página.",
  input_schema: {
    type: "object",
    properties: {
      empresa: { type: "string", description: "Nome da empresa do cliente." },
      destinatario: { ...pessoa, description: "Para quem a proposta vai ser enviada." },
      decisor: { ...pessoa, description: "Quem decide (pode ser o mesmo destinatário). Se não ficou claro, registre em pontos_a_confirmar." },
      servico: {
        type: "object",
        properties: { nome: { type: "string", description: "Nome curto do serviço principal." }, escopo: { type: "array", items: { type: "string" }, description: "O que está incluído, 3 a 6 itens objetivos." } },
        required: ["nome", "escopo"],
      },
      investimento: {
        type: "object",
        properties: {
          implantacao: { type: ["number", "null"], description: "Valor único de implantação. null se não houver." },
          mensal: { type: ["number", "null"], description: "Mensalidade da agência. null se não houver." },
          observacao: { type: "string", description: "Forma de pagamento, verba de mídia separada etc." },
        },
        required: ["implantacao", "mensal"],
      },
      opcionais: {
        type: "array",
        items: { type: "object", properties: { nome: { type: "string" }, valor: { type: ["number", "null"] }, periodicidade: { type: "string", enum: ["unico", "mensal"] }, descricao: { type: "string" } }, required: ["nome"] },
      },
      prazo: { type: "string", description: "Prazo de implantação, início previsto e prazo mínimo de contrato, se falados." },
      validade: { type: "string", description: "Validade da proposta, ex.: 7 dias (até 23/11/2026)." },
      contexto: { type: "array", items: { type: "string" }, description: "3 a 5 pontos do que o cliente contou: momento, dores, objetivos." },
      pontos_a_confirmar: { type: "array", items: { type: "string" }, description: "O que a equipe precisa confirmar antes de enviar. Valores sugeridos (não ditos na reunião) entram aqui." },
    },
    required: ["empresa", "destinatario", "decisor", "servico", "investimento", "opcionais", "prazo", "validade", "contexto", "pontos_a_confirmar"],
  },
};

const slugify = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40) || "proposta";

/** Rede de segurança das regras de texto: sem travessão e "para" no lugar de "pra". */
const cleanText = (s: string) => s
  .replace(/(\d)\s*[—–]\s*(\d)/g, "$1 a $2")
  .replace(/\s*[—–]\s*/g, ", ").replace(/,\s*,/g, ",")
  .replace(/(?<!\p{L})(P|p)ra(?!\p{L})/gu, (_m, p) => (p === "P" ? "Para" : "para"));
const deepClean = (v: any): any =>
  typeof v === "string" ? cleanText(v) : Array.isArray(v) ? v.map(deepClean) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, deepClean(x)])) : v;

const isLaw = (...txt: unknown[]) => /advoga|advocacia|escrit[óo]rio jur[íi]dico|\bOAB\b/i.test(txt.filter(x => typeof x === "string").join(" "));
const OAB_RULE = "O cliente é escritório de advocacia: siga o Provimento 205/2021 da OAB. Marketing jurídico informativo, discreto e sóbrio. Não prometa captação de clientes, aumento de processos, volume de leads nem resultados. Não fale em mercantilização, preço de honorários ou comparação com outros escritórios. Fale em presença digital, autoridade, conteúdo informativo, organização do atendimento e relacionamento.";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    const body = await req.json();
    const action: string = ACTIONS.includes(body.action) ? body.action : "create";
    const admin = adminClient();
    const asUser = userClient(req);
    const { data: { user } } = await asUser.auth.getUser();
    if (!user) return json({ error: "Faça login." }, 401);

    let existing: Record<string, any> | null = null;
    let agencyId: number;
    if (action !== "create" && action !== "summarize") {
      const { data } = await admin.from("proposals").select("*").eq("id", String(body.proposal_id || "")).maybeSingle();
      if (!data) return json({ error: "Proposta não encontrada." }, 404);
      existing = data; agencyId = data.agency_id;
    } else {
      agencyId = Number(body.agency_id);
    }
    const { data: isStaff } = await asUser.rpc("i_am_staff_of", { p_agency: agencyId });
    if (!isStaff) return json({ error: "Sem acesso a esta agência." }, 403);

    const plansOf = (c: any) => (c?.planos ?? []).find((p: any) => p.destaque) ?? c?.planos?.[0];
    const saveHistory = (content: unknown, version: number, instructions: string | null) =>
      content ? admin.from("proposal_versions").insert({ proposal_id: existing!.id, version, content, instructions, created_by: user.id }) : Promise.resolve();
    const liveUpdate = (content: any) => {
      const plan = plansOf(content);
      return {
        content, title: content?.titulo ?? existing!.title, version: (existing!.version ?? 1) + 1,
        monthly_value: plan?.mensal ?? existing!.monthly_value, setup_value: plan?.implantacao ?? existing!.setup_value,
        draft_content: null, draft_instructions: null, draft_created_at: null, updated_at: new Date().toISOString(),
      };
    };

    if (action === "publish_draft") {
      if (!existing!.draft_content) return json({ error: "Não há ajuste para publicar." }, 400);
      await saveHistory(existing!.content, existing!.version ?? 1, null);
      const { data, error } = await admin.from("proposals").update(liveUpdate(existing!.draft_content)).eq("id", existing!.id).select("*").single();
      if (error) return json({ error: "Erro ao publicar o ajuste." }, 500);
      return json({ proposal: data });
    }
    if (action === "discard_draft") {
      const { data, error } = await admin.from("proposals").update({ draft_content: null, draft_instructions: null, draft_created_at: null }).eq("id", existing!.id).select("*").single();
      if (error) return json({ error: "Erro ao descartar." }, 500);
      return json({ proposal: data });
    }
    if (action === "restore") {
      const { data: v } = await admin.from("proposal_versions").select("*").eq("id", String(body.version_id || "")).eq("proposal_id", existing!.id).maybeSingle();
      if (!v) return json({ error: "Versão não encontrada." }, 404);
      if (existing!.status === "draft") {
        await saveHistory(existing!.content, existing!.version ?? 1, null);
        const { data, error } = await admin.from("proposals").update(liveUpdate(v.content)).eq("id", existing!.id).select("*").single();
        if (error) return json({ error: "Erro ao voltar a versão." }, 500);
        return json({ proposal: data });
      }
      const { data, error } = await admin.from("proposals").update({
        draft_content: v.content, draft_instructions: `Voltar para a versão ${v.version}`, draft_created_at: new Date().toISOString(),
      }).eq("id", existing!.id).select("*").single();
      if (error) return json({ error: "Erro ao voltar a versão." }, 500);
      return json({ proposal: data });
    }
    if ((action === "revise_summary" || action === "approve_summary") && existing!.status !== "summary") {
      return json({ error: "Esta proposta não está mais em resumo para aprovar." }, 400);
    }

    const str = (v: unknown, max = 60000) => (typeof v === "string" ? v.trim().slice(0, max) : "");

    // Idempotência da entrada automática (mesma reunião não cria dois resumos).
    const sourceRef = action === "summarize" ? str(body.source_ref, 200) || null : null;
    if (sourceRef) {
      const { data: dup } = await admin.from("proposals").select("*").eq("agency_id", agencyId).eq("source_ref", sourceRef).maybeSingle();
      if (dup) return json({ proposal: dup, duplicate: true });
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) return json({ error: "Chave do Claude não configurada (ANTHROPIC_API_KEY)." }, 500);
    const { data: agency } = await admin.from("agencies").select("name").eq("id", agencyId).maybeSingle();

    const prospect = existing?.prospect_name ?? str(body.prospect_name, 120);
    if (!prospect) return json({ error: "Informe o nome do cliente." }, 400);
    const lang = existing?.language ?? (["pt", "en", "es"].includes(body.language) ? body.language : (agencyId === 7 ? "en" : "pt"));
    const currency = existing?.currency ?? (["BRL", "USD", "EUR"].includes(body.currency) ? body.currency : (agencyId === 7 ? "USD" : "BRL"));
    const notes = existing?.meeting_notes ?? str(body.notes);
    const monthly = existing ? existing.monthly_value : (Number(body.monthly_value) || null);
    const setup = existing ? existing.setup_value : (Number(body.setup_value) || null);
    const isNew = action === "create" || action === "summarize";
    const pdf = isNew && typeof body.pdf_base64 === "string" && body.pdf_base64.length < 14_000_000 ? body.pdf_base64 : null;
    if (isNew && !notes && !pdf) return json({ error: "Cole o resumo da reunião ou envie um PDF." }, 400);
    const law = isLaw(prospect, notes, existing?.summary ? JSON.stringify(existing.summary) : "");
    const today = new Date().toISOString().slice(0, 10);

    const commonRules = [
      "Frases curtas, concretas, sem jargão, sem travessão (—). Use \"para\", nunca \"pra\".",
      "Baseie tudo no que foi conversado. Não prometa resultados (números, leads, vendas, posição no Google) que não foram combinados.",
      law ? OAB_RULE : "",
      lang === "en" ? "Write every field in English." : lang === "es" ? "Escribe todos los campos en español neutro." : "Escreva em português do Brasil.",
      `Moeda dos valores: ${currency}. Hoje é ${today}.`,
    ].filter(Boolean);

    const callClaude = async (system: string, userContent: unknown[], tool: any) => {
      userContent.push({ type: "text", text: `Responda chamando a ferramenta ${tool.name}, sem texto fora dela.` });
      let out: any = null; let result: any = null;
      // Este modelo não aceita forçar a ferramenta (tool_choice "tool"/"any"): usa "auto" e tenta de novo se vier sem a ferramenta.
      for (let tentativa = 0; tentativa < 2 && !result; tentativa++) {
        const resp = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
          body: JSON.stringify({ model: MODEL, max_tokens: 8000, system, tools: [tool], tool_choice: { type: "auto" }, messages: [{ role: "user", content: userContent }] }),
        });
        out = await resp.json();
        if (!resp.ok) { console.error(out); return { error: `Claude: ${out?.error?.message ?? "erro"}` }; }
        result = (out.content ?? []).find((c: { type: string; name?: string }) => c.type === "tool_use" && c.name === tool.name)?.input ?? null;
      }
      return { result: result ? deepClean(result) : null, model: out?.model ?? MODEL };
    };

    // ---------- RESUMO PARA APROVAR ----------
    if (action === "summarize" || action === "revise_summary") {
      const system = [
        `Você prepara o resumo de uma proposta comercial da agência ${agency?.name ?? ""} (marketing digital) para a equipe aprovar antes de escrever a página.`,
        "O resumo é interno: objetivo, sem floreio. Registre só o que foi dito; o que faltar ou for sugestão sua vai em pontos_a_confirmar.",
        "Se a equipe informou valores, use exatamente esses. Se não informou e a reunião também não, sugira valores realistas e diga em pontos_a_confirmar que são sugestão.",
        "Verba de anúncios é paga pelo cliente direto às plataformas, separada do valor da agência, a não ser que a reunião diga outra coisa.",
        "Validade padrão: 7 dias a partir de hoje, se não foi falada.",
        "Se houver resumo anterior e um pedido de ajuste, parta dele: mantenha o que não foi citado e mude só o que foi pedido.",
        ...commonRules,
      ].join("\n");
      const info = { cliente: prospect, moeda: currency, valor_mensal_informado: monthly, valor_implantacao_informado: setup, resumo_anterior: existing?.summary ?? null };
      const content: unknown[] = [];
      if (pdf) content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: pdf } });
      content.push({
        type: "text",
        text: `Dados (JSON):\n${JSON.stringify(info, null, 2)}\n\nO que foi conversado na reunião:\n${notes || "(ver o PDF anexo)"}` +
          (action === "revise_summary" ? `\n\nAJUSTE PEDIDO PELA EQUIPE:\n${str(body.instructions, 8000)}` : ""),
      });
      const r = await callClaude(system, content, SUMMARY_TOOL);
      if ("error" in r) return json({ error: r.error }, 502);
      if (!r.result?.servico) return json({ error: "O Claude não devolveu o resumo. Tente de novo." }, 502);
      const s = r.result;
      if (action === "revise_summary") {
        const { data, error } = await admin.from("proposals").update({
          summary: s, summary_instructions: str(body.instructions, 8000) || null, summary_created_at: new Date().toISOString(), model: r.model,
          monthly_value: s.investimento?.mensal ?? existing!.monthly_value, setup_value: s.investimento?.implantacao ?? existing!.setup_value,
          title: s.servico?.nome ?? existing!.title, updated_at: new Date().toISOString(),
        }).eq("id", existing!.id).select("*").single();
        if (error) return json({ error: "Erro ao salvar o resumo." }, 500);
        return json({ proposal: data });
      }
      const slug = `${slugify(prospect)}-${crypto.randomUUID().slice(0, 4)}`;
      const { data, error } = await admin.from("proposals").insert({
        slug, agency_id: agencyId, prospect_name: prospect, title: s.servico?.nome ?? null,
        whatsapp: str(body.whatsapp, 40) || null, currency, language: lang,
        monthly_value: s.investimento?.mensal ?? monthly, setup_value: s.investimento?.implantacao ?? setup,
        status: "summary", source: str(body.source, 120) || (pdf ? "PDF da reunião" : "Resumo da reunião"), source_ref: sourceRef, created_by: user.id,
        summary: s, summary_created_at: new Date().toISOString(), meeting_notes: notes || null, model: r.model,
      }).select("*").single();
      if (error) { console.error(error); return json({ error: "Erro ao salvar o resumo." }, 500); }
      return json({ proposal: data });
    }

    // ---------- PÁGINA (create / revise / approve_summary) ----------
    const approving = action === "approve_summary";
    const approvedSummary = approving ? (body.summary && typeof body.summary === "object" ? body.summary : existing!.summary) : null;
    if (approving && !approvedSummary) return json({ error: "Resumo vazio." }, 400);

    const published = action === "revise" && existing!.status !== "draft";
    const baseContent = published ? (existing!.draft_content ?? existing!.content) : existing?.content;

    const system = [
      `Você escreve propostas comerciais da agência ${agency?.name ?? ""} (marketing digital: tráfego pago, social media, sites).`,
      "Escreva para o cliente ler e decidir.",
      ...commonRules,
      "Se a equipe informou valores, use exatamente esses valores no plano principal. Se não informou, sugira valores realistas e registre em pontos_em_aberto que precisam ser confirmados.",
      "A verba de anúncios é paga pelo cliente direto às plataformas, separada do valor da agência, a não ser que a reunião diga outra coisa.",
      "Se houver proposta anterior e um pedido de ajuste, parta dela: mantenha o que não foi citado e mude só o que foi pedido.",
      approving ? [
        "Há um RESUMO APROVADO pela equipe. Ele é a fonte da verdade: serviço, escopo, valores, opcionais, prazo e validade saem dele, sem mudar nenhum número.",
        "Use um único plano (destaque true) com a implantação e a mensalidade do resumo. Opcionais entram em condicoes, um por item, no formato \"Opcional: nome, valor\".",
        "Coloque a validade da proposta e o prazo em condicoes. A abertura fala com o destinatário pelo primeiro nome.",
        "Os pontos a confirmar do resumo NÃO aparecem para o cliente; se algum ainda fizer sentido, repita em pontos_em_aberto.",
      ].join("\n") : "",
      "Entregue chamando a ferramenta salvar_proposta uma única vez.",
    ].filter(Boolean).join("\n");

    const info = {
      cliente: prospect, moeda: currency,
      valor_mensal_informado: approving ? approvedSummary.investimento?.mensal ?? null : monthly,
      valor_implantacao_informado: approving ? approvedSummary.investimento?.implantacao ?? null : setup,
      resumo_aprovado: approvedSummary,
      proposta_anterior: baseContent ?? null,
    };
    const content: unknown[] = [];
    if (pdf) content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: pdf } });
    content.push({
      type: "text",
      text: `Dados (JSON):\n${JSON.stringify(info, null, 2)}\n\nO que foi conversado na reunião:\n${notes || "(ver o PDF anexo)"}` +
        (action === "revise" ? `\n\nAJUSTE PEDIDO PELA EQUIPE:\n${str(body.instructions, 8000)}` : ""),
    });
    const r = await callClaude(system, content, TOOL);
    if ("error" in r) return json({ error: r.error }, 502);
    const result = r.result;
    if (!result?.abertura) return json({ error: "O Claude não devolveu a proposta. Tente de novo." }, 502);

    const mainPlan = (result.planos ?? []).find((p: any) => p.destaque) ?? result.planos?.[0];
    if (approving) {
      const inv = approvedSummary.investimento ?? {};
      const { data, error } = await admin.from("proposals").update({
        status: "draft", content: result, title: result.titulo, version: 1, model: r.model,
        summary: approvedSummary, summary_approved_at: new Date().toISOString(), summary_approved_by: user.id,
        monthly_value: inv.mensal ?? mainPlan?.mensal ?? existing!.monthly_value, setup_value: inv.implantacao ?? mainPlan?.implantacao ?? existing!.setup_value,
        whatsapp: existing!.whatsapp || str(approvedSummary.destinatario?.contato, 40).replace(/[^\d+]/g, "") || null,
        updated_at: new Date().toISOString(),
      }).eq("id", existing!.id).eq("status", "summary").select("*").single();
      if (error) return json({ error: "Erro ao salvar a proposta." }, 500);
      return json({ proposal: data });
    }
    if (published) {
      const { data, error } = await admin.from("proposals").update({
        draft_content: result, draft_instructions: str(body.instructions, 8000) || null, draft_created_at: new Date().toISOString(), model: r.model,
      }).eq("id", existing!.id).select("*").single();
      if (error) return json({ error: "Erro ao salvar o ajuste." }, 500);
      return json({ proposal: data, pending: true });
    }
    if (action === "revise") {
      await saveHistory(existing!.content, existing!.version ?? 1, null);
      const { data, error } = await admin.from("proposals").update({
        content: result, title: result.titulo, version: (existing!.version ?? 1) + 1, model: r.model,
        monthly_value: mainPlan?.mensal ?? existing!.monthly_value, setup_value: mainPlan?.implantacao ?? existing!.setup_value,
        updated_at: new Date().toISOString(),
      }).eq("id", existing!.id).select("*").single();
      if (error) return json({ error: "Erro ao salvar." }, 500);
      return json({ proposal: data });
    }

    const slug = `${slugify(prospect)}-${crypto.randomUUID().slice(0, 4)}`;
    const { data, error } = await admin.from("proposals").insert({
      slug, agency_id: agencyId, prospect_name: prospect, title: result.titulo,
      whatsapp: str(body.whatsapp, 40) || null, currency, language: lang,
      monthly_value: mainPlan?.mensal ?? monthly, setup_value: mainPlan?.implantacao ?? setup,
      status: "draft", source: pdf ? "PDF da reunião" : "Resumo da reunião", created_by: user.id,
      content: result, meeting_notes: notes || null, model: r.model,
    }).select("*").single();
    if (error) { console.error(error); return json({ error: "Erro ao salvar a proposta." }, 500); }
    return json({ proposal: data });
  } catch (e) {
    console.error(e);
    return json({ error: "Erro inesperado." }, 500);
  }
});
