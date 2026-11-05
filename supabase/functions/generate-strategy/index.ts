// Gera a estratégia de tráfego pago de um cliente com o Claude, a partir do cadastro.
// Só a equipe da agência do cliente pode chamar. Salva como rascunho (status 'draft').
import { adminClient, corsHeaders, json, userClient } from "../_shared/common.ts";

const MODEL = "claude-sonnet-5-5";

const STRATEGY_TOOL = {
  name: "salvar_estrategia",
  description: "Salva a estratégia de tráfego pago estruturada para o cliente.",
  input_schema: {
    type: "object",
    properties: {
      resumo: { type: "string", description: "2 a 4 frases, em linguagem simples, dizendo o que vamos fazer e por quê." },
      objetivo_principal: { type: "string" },
      oferta: { type: "string", description: "Como a oferta será apresentada nos anúncios." },
      publicos: {
        type: "array",
        items: {
          type: "object",
          properties: {
            nome: { type: "string" },
            descricao: { type: "string" },
            segmentacao: { type: "string", description: "Interesses, palavras-chave, idade, região, públicos semelhantes etc." },
          },
          required: ["nome", "descricao", "segmentacao"],
        },
      },
      campanhas: {
        type: "array",
        items: {
          type: "object",
          properties: {
            plataforma: { type: "string", enum: ["Meta", "Google"] },
            nome: { type: "string" },
            objetivo: { type: "string" },
            publico: { type: "string" },
            criativos: { type: "string", description: "Formatos e ângulos dos anúncios." },
            percentual_verba: { type: "number", description: "Percentual da verba mensal (0 a 100)." },
          },
          required: ["plataforma", "nome", "objetivo", "publico", "criativos", "percentual_verba"],
        },
      },
      investimento: {
        type: "object",
        properties: {
          mensal_sugerido: { type: "string", description: "Valor na moeda do cliente, ex.: R$ 2.000/mês" },
          justificativa: { type: "string" },
        },
        required: ["mensal_sugerido", "justificativa"],
      },
      metricas: {
        type: "array",
        items: { type: "object", properties: { nome: { type: "string" }, meta: { type: "string" } }, required: ["nome", "meta"] },
      },
      cronograma: {
        type: "array",
        items: { type: "object", properties: { fase: { type: "string" }, prazo: { type: "string" }, entregas: { type: "string" } }, required: ["fase", "prazo", "entregas"] },
      },
      precisamos_do_cliente: { type: "array", items: { type: "string" }, description: "O que o cliente precisa enviar ou fazer (fotos, vídeos, acessos, aprovações)." },
      pontos_em_aberto: { type: "array", items: { type: "string" }, description: "Dúvidas internas para a agência confirmar. Não aparece para o cliente." },
    },
    required: ["resumo", "objetivo_principal", "oferta", "publicos", "campanhas", "investimento", "metricas", "cronograma", "precisamos_do_cliente", "pontos_em_aberto"],
  },
};

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

    const [{ data: agency }, { data: briefings }, { data: access }, { data: previous }] = await Promise.all([
      admin.from("agencies").select("name").eq("id", client.agency_id).maybeSingle(),
      admin.from("client_briefings").select("briefing_type, responses").eq("client_id", clientId),
      admin.from("client_platform_access").select("platform, situation, status").eq("client_id", clientId),
      admin.from("client_strategies").select("version, status, client_feedback, content").eq("client_id", clientId)
        .order("version", { ascending: false }).limit(1),
    ]);

    const english = client.agency_id === 7;
    const tsd = client.traffic_strategy_data ?? {};
    const last = previous?.[0];

    const context = {
      empresa: client.name,
      responsavel: client.responsible,
      segmento: client.segment,
      moeda: client.currency || (english ? "USD" : "BRL"),
      site: tsd.website_url ?? null,
      instagram: client.instagram ?? tsd.instagram_url ?? null,
      cadastro: tsd.onboarding_briefing ?? null,
      briefings: (briefings ?? []).map((b) => ({ tipo: b.briefing_type, respostas: b.responses })),
      acessos: access ?? [],
      estrategia_anterior: last ? { versao: last.version, status: last.status, feedback_do_cliente: last.client_feedback, conteudo: last.content } : null,
    };

    const system = [
      `Você é o estrategista de tráfego pago da agência ${agency?.name ?? ""}.`,
      "Monte uma estratégia de anúncios no Meta Ads e no Google Ads, prática e pronta para executar, a partir do cadastro do cliente.",
      "Seja específico para o negócio dele: públicos, palavras-chave, ângulos de criativo e divisão de verba que façam sentido para essa oferta e região.",
      "Use o investimento que o cliente indicou como referência. Se não houver, sugira um valor inicial realista e explique.",
      "Escreva para o cliente ler: frases curtas, sem jargão, sem travessão (—). Use \"para\", nunca \"pra\".",
      "Se faltar informação, faça a melhor suposição e registre a dúvida em pontos_em_aberto (isso é só para a agência).",
      "Se houver estratégia anterior com feedback do cliente, corrija o que ele pediu.",
      "Entregue o resultado chamando a ferramenta salvar_estrategia uma única vez, sem texto antes ou depois.",
      english ? "The client is in the United States: write every field in English and use USD." : "Escreva em português do Brasil.",
    ].join("\n");

    const userMsg = `Dados do cliente (JSON):\n${JSON.stringify(context, null, 2)}` +
      (extra ? `\n\nInstruções ou anotações da equipe (por exemplo, resumo da reunião):\n${extra}` : "");

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 6000,
        system,
        tools: [STRATEGY_TOOL],
        tool_choice: { type: "auto" },
        messages: [{ role: "user", content: userMsg }],
      }),
    });
    const out = await resp.json();
    if (!resp.ok) {
      console.error(out);
      const msg = out?.error?.message ?? "Erro ao chamar o Claude.";
      return json({ error: `Claude: ${msg}` }, 502);
    }
    let strategyContent = (out.content ?? []).find((c: { type: string }) => c.type === "tool_use")?.input ?? null;
    if (!strategyContent) {
      // Plano B: o modelo respondeu em texto; tenta achar o JSON
      const text = (out.content ?? []).filter((c: { type: string }) => c.type === "text").map((c: { text: string }) => c.text).join("\n");
      const m = text.match(/\{[\s\S]*\}/);
      try { strategyContent = m ? JSON.parse(m[0]) : null; } catch { strategyContent = null; }
    }
    if (!strategyContent || !strategyContent.resumo) return json({ error: "O Claude não devolveu a estratégia. Tente de novo." }, 502);

    const { data: saved, error } = await admin.from("client_strategies").insert({
      client_id: clientId,
      agency_id: client.agency_id,
      version: (last?.version ?? 0) + 1,
      status: "draft",
      content: strategyContent,
      model: out.model ?? MODEL,
      created_by: user.id,
    }).select("*").single();
    if (error) return json({ error: "Erro ao salvar a estratégia." }, 500);

    return json({ strategy: saved, usage: out.usage ?? null });
  } catch (e) {
    console.error(e);
    return json({ error: "Erro inesperado." }, 500);
  }
});
