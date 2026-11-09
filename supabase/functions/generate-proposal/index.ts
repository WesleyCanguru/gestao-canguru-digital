// Gera (ou ajusta) uma proposta comercial com o Claude, a partir do que foi conversado na reunião.
// Só a equipe da agência pode chamar. Cria/atualiza a linha em proposals como rascunho (status 'draft').
// action 'create': { agency_id, prospect_name, whatsapp?, currency?, language?, notes?, pdf_base64?, monthly_value?, setup_value? }
// action 'revise': { proposal_id, instructions }
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

const slugify = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40) || "proposta";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    const body = await req.json();
    const action = body.action === "revise" ? "revise" : "create";
    const admin = adminClient();
    const asUser = userClient(req);
    const { data: { user } } = await asUser.auth.getUser();
    if (!user) return json({ error: "Faça login." }, 401);

    let existing: Record<string, any> | null = null;
    let agencyId: number;
    if (action === "revise") {
      const { data } = await admin.from("proposals").select("*").eq("id", String(body.proposal_id || "")).maybeSingle();
      if (!data) return json({ error: "Proposta não encontrada." }, 404);
      existing = data; agencyId = data.agency_id;
    } else {
      agencyId = Number(body.agency_id);
    }
    const { data: isStaff } = await asUser.rpc("i_am_staff_of", { p_agency: agencyId });
    if (!isStaff) return json({ error: "Sem acesso a esta agência." }, 403);

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) return json({ error: "Chave do Claude não configurada (ANTHROPIC_API_KEY)." }, 500);
    const { data: agency } = await admin.from("agencies").select("name").eq("id", agencyId).maybeSingle();

    const str = (v: unknown, max = 60000) => (typeof v === "string" ? v.trim().slice(0, max) : "");
    const prospect = existing?.prospect_name ?? str(body.prospect_name, 120);
    if (!prospect) return json({ error: "Informe o nome do cliente." }, 400);
    const lang = existing?.language ?? (["pt", "en", "es"].includes(body.language) ? body.language : (agencyId === 7 ? "en" : "pt"));
    const currency = existing?.currency ?? (["BRL", "USD", "EUR"].includes(body.currency) ? body.currency : (agencyId === 7 ? "USD" : "BRL"));
    const notes = existing?.meeting_notes ?? str(body.notes);
    const monthly = existing ? existing.monthly_value : (Number(body.monthly_value) || null);
    const setup = existing ? existing.setup_value : (Number(body.setup_value) || null);
    const pdf = action === "create" && typeof body.pdf_base64 === "string" && body.pdf_base64.length < 14_000_000 ? body.pdf_base64 : null;
    if (action === "create" && !notes && !pdf) return json({ error: "Cole o resumo da reunião ou envie um PDF." }, 400);

    const system = [
      `Você escreve propostas comerciais da agência ${agency?.name ?? ""} (marketing digital: tráfego pago, social media, sites).`,
      "Escreva para o cliente ler e decidir: frases curtas, concretas, sem jargão, sem travessão (—). Use \"para\", nunca \"pra\".",
      "Baseie tudo no que foi conversado. Não prometa resultados numéricos que não foram combinados.",
      "Se a equipe informou valores, use exatamente esses valores no plano principal. Se não informou, sugira valores realistas e registre em pontos_em_aberto que precisam ser confirmados.",
      "A verba de anúncios é paga pelo cliente direto às plataformas, separada do valor da agência, a não ser que a reunião diga outra coisa.",
      "Se houver proposta anterior e um pedido de ajuste, parta dela: mantenha o que não foi citado e mude só o que foi pedido.",
      "Entregue chamando a ferramenta salvar_proposta uma única vez.",
      lang === "en" ? "Write every field in English." : lang === "es" ? "Escribe todos los campos en español neutro." : "Escreva em português do Brasil.",
      `Moeda dos valores: ${currency}.`,
    ].join("\n");

    const info = {
      cliente: prospect, moeda: currency,
      valor_mensal_informado: monthly, valor_implantacao_informado: setup,
      proposta_anterior: existing?.content ?? null,
    };
    const content: unknown[] = [];
    if (pdf) content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: pdf } });
    content.push({
      type: "text",
      text: `Dados (JSON):\n${JSON.stringify(info, null, 2)}\n\nO que foi conversado na reunião:\n${notes || "(ver o PDF anexo)"}` +
        (action === "revise" ? `\n\nAJUSTE PEDIDO PELA EQUIPE:\n${str(body.instructions, 8000)}` : ""),
    });

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: 6000, system, tools: [TOOL], tool_choice: { type: "tool", name: "salvar_proposta" }, messages: [{ role: "user", content }] }),
    });
    const out = await resp.json();
    if (!resp.ok) { console.error(out); return json({ error: `Claude: ${out?.error?.message ?? "erro"}` }, 502); }
    const result = (out.content ?? []).find((c: { type: string }) => c.type === "tool_use")?.input;
    if (!result?.abertura) return json({ error: "O Claude não devolveu a proposta. Tente de novo." }, 502);

    const mainPlan = (result.planos ?? []).find((p: any) => p.destaque) ?? result.planos?.[0];
    if (action === "revise") {
      const { data, error } = await admin.from("proposals").update({
        content: result, title: result.titulo, version: (existing!.version ?? 1) + 1, model: out.model ?? MODEL,
        monthly_value: mainPlan?.mensal ?? existing!.monthly_value, setup_value: mainPlan?.implantacao ?? existing!.setup_value,
        updated_at: new Date().toISOString(),
      }).eq("id", existing!.id).select("*").single();
      if (error) return json({ error: "Erro ao salvar." }, 500);
      return json({ proposal: data });
    }

    const base = slugify(prospect);
    const slug = `${base}-${crypto.randomUUID().slice(0, 4)}`;
    const { data, error } = await admin.from("proposals").insert({
      slug, agency_id: agencyId, prospect_name: prospect, title: result.titulo,
      whatsapp: str(body.whatsapp, 40) || null, currency, language: lang,
      monthly_value: mainPlan?.mensal ?? monthly, setup_value: mainPlan?.implantacao ?? setup,
      status: "draft", source: pdf ? "PDF da reunião" : "Resumo da reunião", created_by: user.id,
      content: result, meeting_notes: notes || null, model: out.model ?? MODEL,
    }).select("*").single();
    if (error) { console.error(error); return json({ error: "Erro ao salvar a proposta." }, 500); }
    return json({ proposal: data });
  } catch (e) {
    console.error(e);
    return json({ error: "Erro inesperado." }, 500);
  }
});
