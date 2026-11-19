// Núcleo da estratégia de tráfego: ferramenta de saída, prompts (Raio-X + playbook + data) e chamadas em lote.
// Usado por generate-strategy (cria o pedido) e strategy-jobs-tick (acompanha o lote e salva).
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { getOrRunXray } from "./xray-store.ts";

export const MODEL = "claude-opus-5-5";

export const STRATEGY_TOOL = {
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

/** Confere o formato: listas precisam ser listas e nada de marcação de ferramenta vazando no texto. */
export const isValidStrategy = (c: any) => {
  if (!c || typeof c !== "object" || typeof c.resumo !== "string" || !c.resumo.trim()) return false;
  for (const k of ["publicos", "campanhas"]) if (!Array.isArray(c[k]) || c[k].length === 0) return false;
  for (const k of ["metricas", "cronograma", "precisamos_do_cliente", "pontos_em_aberto"]) if (c[k] != null && !Array.isArray(c[k])) return false;
  if (c.investimento != null && typeof c.investimento !== "object") return false;
  return !/<\/?parameter|<\/?invoke|antml:/.test(JSON.stringify(c));
};

/** Raio-X sem os detalhes brutos, para caber bem no contexto. */
const xrayForPrompt = (d: any) => {
  if (!d) return null;
  const site = d.site ? { ...d.site, tracking: { ...d.site.tracking, where_found: { gtm: d.site.tracking?.where_found?.gtm } } } : null;
  return { coletado_em: d.collected_at, site_informado: d.website, site, instagram: d.instagram ?? null, velocidade: d.speed ?? null, erros: d.errors, observacoes: d.notes };
};

/** Monta os prompts do rascunho e da revisão. Roda (ou reaproveita) o Raio-X do cliente. */
export async function buildStrategyPrompts(admin: SupabaseClient, client: any, userId: string | null, extra: string, refreshXray = false) {
  const clientId = client.id;
  const [{ data: agency }, { data: briefings }, { data: access }, { data: previous }, { data: playbookRows }] = await Promise.all([
    admin.from("agencies").select("name").eq("id", client.agency_id).maybeSingle(),
    admin.from("client_briefings").select("briefing_type, responses, is_completed").eq("client_id", clientId),
    admin.from("client_platform_access").select("platform, situation, status").eq("client_id", clientId),
    admin.from("client_strategies").select("version, status, client_feedback, content").eq("client_id", clientId)
      .order("version", { ascending: false }).limit(1),
    admin.from("agent_playbooks").select("slug, agency_id, content").like("slug", "trafego-pago%"),
  ]);

  // Playbook geral + complemento da agência, se existir
  const playbook = (playbookRows ?? [])
    .filter((r: any) => r.agency_id == null || r.agency_id === client.agency_id)
    .sort((a: any, b: any) => (a.agency_id == null ? -1 : 1) - (b.agency_id == null ? -1 : 1))
    .map((r: any) => r.content).join("\n\n");

  let audit: any = null;
  try {
    audit = await getOrRunXray(admin, client, userId, { force: refreshXray });
  } catch (e) {
    console.error("raio-x falhou", e);
    audit = { id: null, data: { errors: ["O Raio-X falhou nesta geração. Não invente o que não foi medido."] } };
  }

  const trafego = (briefings ?? []).find((b: any) => b.briefing_type === "trafego_pago");
  const english = client.agency_id === 7;
  const tsd = client.traffic_strategy_data ?? {};
  const last = previous?.[0];
  const lang: string = ["pt", "en", "es"].includes(tsd.language) ? tsd.language : (english ? "en" : "pt");
  const tz = english ? "America/New_York" : "America/Sao_Paulo";
  const today = new Intl.DateTimeFormat("pt-BR", { timeZone: tz, weekday: "long", day: "2-digit", month: "long", year: "numeric" }).format(new Date());

  const context = {
    hoje: today,
    fuso: tz,
    empresa: client.name,
    responsavel: client.responsible,
    segmento: client.segment,
    moeda: client.currency || (english ? "USD" : "BRL"),
    site: tsd.website_url ?? null,
    instagram: client.instagram ?? tsd.instagram_url ?? null,
    raio_x: xrayForPrompt(audit?.data),
    cadastro: tsd.onboarding_briefing ?? null,
    briefing_de_trafego: trafego?.responses ?? null,
    briefing_de_trafego_respondido: !!trafego?.is_completed,
    outros_briefings: (briefings ?? []).filter((b: any) => b.briefing_type !== "trafego_pago" && b.briefing_type !== "onboarding")
      .map((b: any) => ({ tipo: b.briefing_type, respostas: b.responses })),
    acessos: access ?? [],
    estrategia_anterior: last ? { versao: last.version, status: last.status, feedback_do_cliente: last.client_feedback, conteudo: last.content } : null,
  };

  const langLine = lang === "en" ? "Write every field in English." : lang === "es" ? "Escribe todos los campos en español neutro (latinoamericano)." : "Escreva em português do Brasil.";
  const playbookBlock = playbook || "(playbook não encontrado no banco: siga boas práticas e avise em pontos_em_aberto)";

  const system = [
    `Você é o estrategista de tráfego pago sênior da agência ${agency?.name ?? ""}. Tráfego pago é o serviço principal da agência: a estratégia precisa ser a melhor que o cliente já viu, específica para o negócio dele e pronta para executar.`,
    "Siga o playbook da casa abaixo. Ele vale mais do que qualquer hábito seu.",
    "Use juntos: o raio_x (fatos medidos do site, das tags, das páginas e do Instagram), o cadastro, o briefing de tráfego e os outros briefings. Quando o cadastro contradiz o raio_x, o raio_x vence e a contradição vira pergunta em pontos_em_aberto.",
    "Dedique a maior parte do raciocínio ao público: quem compra de verdade, quem decide junto, quem não é público e se existe um nicho com vantagem.",
    "Se o raio_x não tiver site, Instagram ou velocidade, diga isso em pontos_em_aberto e não invente o que não foi medido.",
    "Se o briefing de tráfego não foi respondido, registre em pontos_em_aberto quais respostas fazem falta.",
    "Se houver estratégia anterior com feedback do cliente, corrija o que ele pediu.",
    "Se a equipe mandou um pedido de ajuste (instruções que começam com AJUSTE) e existe estratégia anterior, parta dela: mantenha tudo o que não foi citado e mude só o que foi pedido.",
    "Entregue o resultado chamando a ferramenta salvar_estrategia uma única vez, sem texto antes ou depois.",
    langLine,
    english ? "O cliente é atendido nos Estados Unidos: use valores em USD." : "",
    "",
    "PLAYBOOK DA CASA:",
    playbookBlock,
  ].join("\n");

  const reviewSystem = [
    `Você é o revisor de estratégias de tráfego pago da agência ${agency?.name ?? ""}. Nenhuma estratégia sai sem passar por você.`,
    "Confira a estratégia contra o raio_x, os briefings e cada item do checklist do revisor no fim do playbook.",
    "Corrija tudo o que estiver errado ou fraco e devolva a estratégia COMPLETA corrigida chamando salvar_estrategia. Mantenha o que está bom.",
    "No fim de pontos_em_aberto, acrescente até 5 itens começando com \"Revisor:\" dizendo as principais correções que você fez. Se não precisou corrigir nada, acrescente \"Revisor: sem correções\".",
    langLine,
    "",
    "PLAYBOOK DA CASA:",
    playbookBlock,
  ].join("\n");

  const userMsg = `Dados do cliente (JSON):\n${JSON.stringify(context, null, 2)}` +
    (extra ? `\n\nInstruções ou anotações da equipe (por exemplo, resumo da reunião):\n${extra}` : "");

  return { system, reviewSystem, userMsg, auditId: audit?.id ?? null, baseVersion: last?.version ?? 0 };
}

const headers = (apiKey: string) => ({ "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" });

/** Parâmetros de uma chamada que precisa terminar chamando salvar_estrategia. */
export const strategyParams = (system: string, userText: string, effort: "medium" | "high") => ({
  model: MODEL,
  max_tokens: 32000,
  system,
  tools: [STRATEGY_TOOL],
  tool_choice: { type: "auto" }, // Opus 5.5 recusa tool_choice forçado
  output_config: { effort },
  messages: [{ role: "user", content: userText }],
});

/** Envia um lote com um pedido só. Devolve o id do lote. */
export async function submitBatch(apiKey: string, customId: string, params: Record<string, unknown>): Promise<string> {
  const r = await fetch("https://api.anthropic.com/v1/messages/batches", {
    method: "POST", headers: headers(apiKey),
    body: JSON.stringify({ requests: [{ custom_id: customId, params }] }),
  });
  const j = await r.json();
  if (!r.ok || !j.id) throw new Error(`lote recusado: ${j?.error?.message ?? r.status}`);
  return j.id as string;
}

/** Consulta o lote. Se terminou, devolve a mensagem (ou o erro). */
export async function readBatch(apiKey: string, batchId: string): Promise<{ done: boolean; message?: any; error?: string }> {
  const r = await fetch(`https://api.anthropic.com/v1/messages/batches/${batchId}`, { headers: headers(apiKey) });
  const j = await r.json();
  if (!r.ok) return { done: false, error: `consulta do lote: ${j?.error?.message ?? r.status}` };
  if (j.processing_status !== "ended") return { done: false };
  if (!j.results_url) return { done: true, error: "lote terminou sem resultado" };
  const res = await fetch(j.results_url, { headers: headers(apiKey) });
  const text = await res.text();
  const line = text.split("\n").find((l) => l.trim());
  if (!line) return { done: true, error: "resultado vazio" };
  const item = JSON.parse(line);
  if (item.result?.type !== "succeeded") return { done: true, error: `pedido ${item.result?.type ?? "falhou"}: ${item.result?.error?.error?.message ?? item.result?.error?.message ?? ""}` };
  return { done: true, message: item.result.message };
}

/** Tira a estratégia da resposta (ferramenta ou, plano B, JSON no texto). */
export function extractStrategy(message: any): any | null {
  if (!message || message.stop_reason === "refusal") return null;
  let candidate = (message.content ?? []).find((c: any) => c.type === "tool_use")?.input ?? null;
  if (!candidate) {
    const t = (message.content ?? []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n");
    const m = t.match(/\{[\s\S]*\}/);
    try { candidate = m ? JSON.parse(m[0]) : null; } catch { candidate = null; }
  }
  return isValidStrategy(candidate) ? candidate : null;
}

export const RETRY_NOTE = "\n\nIMPORTANTE: responda chamando a ferramenta salvar_estrategia com a estratégia completa, sem texto fora dela.";
