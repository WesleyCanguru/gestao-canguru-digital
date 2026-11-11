// Lê um PDF com o Claude e devolve os dados estruturados. Só a equipe da agência do cliente pode chamar.
// body: { kind: 'calendario' | 'temas' | 'trafego', client_id, pdf_base64, year?, month? }
// Não grava nada: a tela recebe o resultado e salva (posts, theme_items ou clients.traffic_strategy_data).
import { adminClient, corsHeaders, json, userClient } from "../_shared/common.ts";

const MODEL = "claude-sonnet-5-5";
const FORMATOS = ["Carrossel", "Estático", "Reels", "Repost"];

const str = { type: "string" };
const strArr = { type: "array", items: { type: "string" } };

const KINDS: Record<string, { tool: any; prompt: (b: any) => string }> = {
  calendario: {
    tool: {
      name: "salvar_publicacoes",
      description: "Salva todas as publicações do calendário editorial.",
      input_schema: {
        type: "object",
        properties: {
          publicacoes: {
            type: "array",
            items: {
              type: "object",
              properties: {
                date: { type: "string", description: "Data no formato YYYY-MM-DD" },
                theme: { type: "string", description: "Tema central da publicação (texto completo)" },
                type: { type: "string", enum: FORMATOS },
                bullets: { ...strArr, description: "Cada direcionamento/bullet da publicação" },
                platforms: { type: "array", items: { type: "string", enum: ["Instagram", "LinkedIn"] } },
              },
              required: ["date", "theme", "type", "bullets", "platforms"],
            },
          },
        },
        required: ["publicacoes"],
      },
    },
    prompt: (b) =>
      "Este PDF é um calendário editorial. Extraia TODAS as publicações, sem pular nenhuma." +
      (b.year && b.month ? ` Se a data não trouxer o ano ou o mês, considere ${String(b.month).padStart(2, "0")}/${b.year}.` : "") +
      " Mapeie o formato para Carrossel, Estático, Reels ou Repost (o mais próximo). Se a plataforma não estiver no documento, use Instagram." +
      " Copie o texto do documento sem inventar.",
  },
  temas: {
    tool: {
      name: "salvar_temas",
      description: "Salva todos os temas encontrados no documento.",
      input_schema: {
        type: "object",
        properties: {
          temas: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string", description: "Título curto do tema" },
                description: { type: "string", description: "Contexto, tópicos e direcionamentos do tema" },
                format: { type: "string", enum: FORMATOS },
                reference_links: { ...strArr, description: "URLs de referência citadas para este tema; vazio se não houver" },
              },
              required: ["title", "description", "format", "reference_links"],
            },
          },
        },
        required: ["temas"],
      },
    },
    prompt: () =>
      "Este PDF é um banco de temas ou planejamento de conteúdo. Extraia TODOS os temas e ideias de publicação." +
      " Mapeie o formato para Carrossel, Estático, Reels ou Repost; se não houver, use Estático. Não invente links.",
  },
  trafego: {
    tool: {
      name: "salvar_estrategia",
      description: "Salva a estratégia de tráfego pago estruturada para o painel.",
      input_schema: {
        type: "object",
        properties: {
          kpis: {
            type: "object",
            properties: { monthlyBudget: str, budgetDetails: str, priorityGoal: str, goalDetails: str, averageTicket: str, ticketDetails: str },
            required: ["monthlyBudget", "budgetDetails", "priorityGoal", "goalDetails", "averageTicket", "ticketDetails"],
          },
          strategicDecision: {
            type: "object",
            properties: {
              title: str,
              items: { type: "array", items: { type: "object", properties: { title: str, description: str, color: { type: "string", enum: ["brand-dark", "green-500"] } }, required: ["title", "description", "color"] } },
            },
            required: ["title", "items"],
          },
          campaignStructure: {
            type: "object",
            properties: {
              title: str,
              sets: {
                type: "array",
                items: {
                  type: "object",
                  properties: { id: str, name: str, destination: str, destinationUrl: str, audience: str, keywords: strArr, preFilledMessage: str },
                  required: ["id", "name", "destination", "destinationUrl", "audience", "keywords", "preFilledMessage"],
                },
              },
            },
            required: ["title", "sets"],
          },
          phase2: {
            type: "object",
            properties: {
              title: str, description: str,
              campaigns: { type: "array", items: { type: "object", properties: { title: str, areas: str, budget: str }, required: ["title", "areas", "budget"] } },
            },
            required: ["title", "description", "campaigns"],
          },
          alert: { type: "object", properties: { title: str, message: str }, required: ["title", "message"] },
        },
        required: ["kpis", "strategicDecision", "campaignStructure", "phase2", "alert"],
      },
    },
    prompt: () =>
      "Este PDF é uma estratégia de tráfego pago. Extraia as informações para o painel: verba (ex.: R$ 600, R$ 25/dia), meta prioritária, ticket médio," +
      " decisões estratégicas, conjuntos de campanha, fase 2 e o alerta principal. Use texto vazio quando o documento não trouxer a informação. Não invente números.",
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const caller = userClient(req);
    const { data: who } = await caller.auth.getUser();
    if (!who?.user || who.user.is_anonymous) return json({ error: "Faça login." }, 401);

    const body = await req.json();
    const spec = KINDS[body.kind];
    if (!spec) return json({ error: "Tipo de importação inválido." }, 400);
    const pdf = typeof body.pdf_base64 === "string" ? body.pdf_base64 : "";
    if (!pdf) return json({ error: "Envie o PDF." }, 400);
    if (pdf.length > 14_000_000) return json({ error: "PDF grande demais (máx. ~10 MB)." }, 400);

    // Só a equipe ativa da agência do cliente.
    const admin = adminClient();
    const { data: client } = await admin.from("clients").select("id, agency_id").eq("id", String(body.client_id || "")).maybeSingle();
    if (!client) return json({ error: "Cliente não encontrado." }, 404);
    const { data: staff } = await admin.from("agency_members").select("id").eq("user_id", who.user.id).eq("agency_id", client.agency_id).eq("is_active", true).limit(1);
    if (!staff?.length) return json({ error: "Sem permissão para importar para este cliente." }, 403);

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) return json({ error: "Chave do Claude não configurada (ANTHROPIC_API_KEY)." }, 500);

    const content = [
      { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdf } },
      { type: "text", text: `${spec.prompt(body)}\n\nResponda chamando a ferramenta ${spec.tool.name}, sem texto fora dela.` },
    ];

    let result: any = null;
    for (let tentativa = 0; tentativa < 2 && !result; tentativa++) {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model: MODEL, max_tokens: 16000, tools: [spec.tool], tool_choice: { type: "auto" }, messages: [{ role: "user", content }] }),
      });
      const out = await resp.json();
      if (!resp.ok) { console.error(out); return json({ error: `Claude: ${out?.error?.message ?? "erro"}` }, 502); }
      result = (out.content ?? []).find((c: { type: string; name?: string }) => c.type === "tool_use" && c.name === spec.tool.name)?.input ?? null;
    }
    if (!result) return json({ error: "O Claude não conseguiu ler o PDF. Tente de novo." }, 502);
    return json({ ok: true, data: result });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message ?? "Erro inesperado." }, 500);
  }
});
