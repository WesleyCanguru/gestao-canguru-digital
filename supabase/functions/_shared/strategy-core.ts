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
      visual: {
        type: "object",
        description: "Versão CURTA e visual para a página do cliente. Os campos acima viram o 'Ver detalhes'. Linguagem de dono de negócio, sem siglas nem IDs.",
        properties: {
          titulo: { type: "string", description: "Título da página, até 8 palavras, sem o nome do cliente. Ex.: 'Compradores reais de cruisers,'" },
          titulo_destaque: { type: "string", description: "Final do título em destaque, até 6 palavras. Ex.: 'prontos para a temporada.'" },
          subtitulo: { type: "string", description: "1 ou 2 frases curtas (máx. 40 palavras): o que vamos fazer e por quê." },
          numeros: {
            type: "array", description: "Exatamente 3 números grandes: verba mensal, resultado esperado (faixa) e quando sai o primeiro número real.",
            items: { type: "object", properties: { rotulo: { type: "string" }, valor: { type: "string", description: "Curto: 'US$ 1.500/mês', '8 a 20/mês', '14–18 dez'" }, nota: { type: "string", description: "Até 10 palavras" } }, required: ["rotulo", "valor"] },
          },
          raio_x: {
            type: "array", description: "3 a 5 cartões do diagnóstico, só com o que o raio_x mediu. Use tema 'velocidade' e 'instagram' quando houver esses dados (a página desenha o medidor com o número medido).",
            items: { type: "object", properties: {
              tema: { type: "string", enum: ["rastreamento", "velocidade", "instagram", "site", "anuncios", "outro"] },
              status: { type: "string", enum: ["critico", "melhorar", "forte"] },
              titulo: { type: "string", description: "Até 5 palavras" },
              frase: { type: "string", description: "1 frase, até 20 palavras, dizendo o efeito para o negócio" },
              detalhe: { type: "string", description: "Explicação técnica para o 'Ver detalhes' (IDs, ferramentas), até 60 palavras" },
            }, required: ["tema", "status", "titulo", "frase"] },
          },
          funil: {
            type: "array", description: "4 ou 5 etapas de como o comprador chega até a venda, na ordem. Etapas com campanha levam selo '45% da verba'; as finais levam a meta (ex.: 'meta 20–30%') ou 'no CRM'.",
            items: { type: "object", properties: { titulo: { type: "string", description: "Até 6 palavras, do ponto de vista do comprador. Ex.: 'Ele procura no Google'" }, frase: { type: "string", description: "Até 22 palavras" }, selo: { type: "string" }, destaque: { type: "boolean", description: "true nas etapas que recebem verba" } }, required: ["titulo", "frase"] },
          },
          publicos: {
            type: "array", description: "Um cartão por público, na mesma ordem de publicos.",
            items: { type: "object", properties: { icone: { type: "string", description: "1 emoji ou símbolo simples" }, titulo: { type: "string", description: "Até 6 palavras" }, frase: { type: "string", description: "Até 22 palavras" }, selo: { type: "string", description: "Plataforma e papel, até 6 palavras. Ex.: 'Google · o mais quente'" } }, required: ["titulo", "frase"] },
          },
          verba: {
            type: "array", description: "Divisão da verba mensal, uma linha por campanha. Percentuais somam 100.",
            items: { type: "object", properties: { nome: { type: "string", description: "Até 4 palavras. Ex.: 'Meta · vídeo'" }, valor: { type: "string", description: "Ex.: 'US$ 675'" }, frase: { type: "string", description: "Até 8 palavras, com o valor por dia" }, percentual: { type: "number" } }, required: ["nome", "valor", "percentual"] },
          },
          verba_alternativas: {
            type: "array", description: "Até 2 cenários se a verba for menor.",
            items: { type: "object", properties: { se: { type: "string", description: "Ex.: 'Se for US$ 1.000'" }, entao: { type: "string", description: "Até 8 palavras" } }, required: ["se", "entao"] },
          },
          cronograma: {
            type: "array", description: "4 a 5 marcos curtos.",
            items: { type: "object", properties: { quando: { type: "string", description: "Ex.: 'Semana 1 · 23–27/11'" }, titulo: { type: "string", description: "Até 3 palavras" }, frase: { type: "string", description: "Até 14 palavras" } }, required: ["quando", "titulo", "frase"] },
          },
          precisamos: {
            type: "array", description: "6 a 8 itens curtos do que o cliente precisa enviar. trava=true nos que impedem o lançamento (no máximo 3).",
            items: { type: "object", properties: { item: { type: "string", description: "Até 14 palavras" }, trava: { type: "boolean" } }, required: ["item"] },
          },
          perguntas: {
            type: "array", description: "Até 3 perguntas que o CLIENTE precisa responder antes de ligar a verba (não as dúvidas internas).",
            items: { type: "object", properties: { titulo: { type: "string", description: "A pergunta, até 10 palavras" }, frase: { type: "string", description: "Por que importa, até 18 palavras" } }, required: ["titulo", "frase"] },
          },
        },
        required: ["titulo", "subtitulo", "numeros", "raio_x", "funil", "publicos", "verba", "cronograma", "precisamos"],
      },
    },
    required: ["resumo", "objetivo_principal", "oferta", "publicos", "campanhas", "investimento", "metricas", "cronograma", "precisamos_do_cliente", "pontos_em_aberto", "visual"],
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
    "Escreva DUAS camadas. Os campos completos são para a equipe executar e para o 'Ver detalhes': profundos, específicos, com IDs, palavras-chave e números. O campo visual é o que o cliente lê primeiro: frases curtas, sem siglas nem jargão (nada de ThruPlay, CBO, GTM, lookalike), respeitando os limites de palavras de cada item. O cliente precisa entender a estratégia inteira lendo só o visual.",
    "No visual, nunca afirme o que não está nos dados (por exemplo, que um acesso já foi liberado ou que o site não tem um botão). Dúvidas vão para pontos_em_aberto ou para visual.perguntas.",
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
    "Corrija tudo o que estiver errado ou fraco e devolva a estratégia COMPLETA corrigida chamando salvar_estrategia, incluindo o campo visual. Mantenha o que está bom.",
    "Confira também o visual: está coerente com os campos completos, curto (dentro dos limites de palavras), sem jargão, e não afirma nada que os dados não mostram. Se faltar, escreva.",
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
