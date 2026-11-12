// Guias da Bolsa (Operação › Guias). Só a equipe da agência pode chamar.
// action 'revise':  { guide_id, instructions }  o Claude aplica o pedido; a versão anterior vai para guide_versions.
// action 'restore': { guide_id, version_id }    volta uma versão guardada (a atual também vai para o histórico).
// action 'create':  { agency_id, title, audience, language, services?, brief }  o Claude escreve um guia novo (sem imagens).
import { adminClient, corsHeaders, json, userClient } from "../_shared/common.ts";

const MODEL = "claude-sonnet-5-5";
const str = (v: unknown, max = 500) => (typeof v === "string" ? v.trim().slice(0, max) : "");

const image = { type: "object", properties: { src: { type: "string" }, alt: { type: "string" }, frame: { type: "string", enum: ["phone", "browser"] } }, required: ["src", "alt", "frame"] };
const TOOL = {
  name: "salvar_guia",
  description: "Salva o guia completo, já com as mudanças.",
  input_schema: {
    type: "object",
    properties: {
      hero: { type: "object", properties: { eyebrow: { type: "string" }, title: { type: "string" }, text: { type: "string" } }, required: ["eyebrow", "title", "text"] },
      steps: { type: "array", items: { type: "object", properties: { title: { type: "string" }, who: { type: "string" }, tone: { type: "string", enum: ["cliente", "equipe", "socio"] } }, required: ["title", "who", "tone"] } },
      sections: {
        type: "array",
        items: {
          type: "object",
          properties: {
            kind: { type: "string", enum: ["section", "note"] },
            who: { type: "string" }, tone: { type: "string", enum: ["cliente", "equipe", "socio"] },
            layout: { type: "string", enum: ["image-right", "image-left", "stack"] },
            dark: { type: "boolean" },
            title: { type: "string" }, text: { type: "string" },
            bullets: { type: "array", items: { type: "string" } },
            cards: { type: "array", items: { type: "object", properties: { title: { type: "string" }, text: { type: "string" } }, required: ["title", "text"] } },
            images: { type: "array", items: image },
          },
          required: ["title"],
        },
      },
    },
    required: ["hero", "sections"],
  },
};

const STYLE = `Regras de escrita: português do Brasil (ou o idioma pedido), frases curtas e diretas, sem jargão, sem travessão, sem exageros.
Fale do que a Bolsa faz de verdade; não invente funções. Mantenha o que não foi pedido para mudar exatamente como está.
Imagens: use só as imagens que já existem no guia (mesmo src); pode tirar, trocar de ordem ou mudar o texto alternativo, nunca criar src novo.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    const caller = userClient(req);
    const { data: who } = await caller.auth.getUser();
    if (!who?.user || who.user.is_anonymous) return json({ error: "Faça login." }, 401);
    const admin = adminClient();
    const body = await req.json();
    const action = ["revise", "restore", "create"].includes(body.action) ? body.action : "";
    if (!action) return json({ error: "Ação desconhecida." }, 400);

    let guide: Record<string, any> | null = null;
    let agencyId: number;
    if (action === "create") agencyId = Number(body.agency_id);
    else {
      const { data } = await admin.from("guides").select("*").eq("id", String(body.guide_id || "")).maybeSingle();
      if (!data) return json({ error: "Guia não encontrado." }, 404);
      guide = data; agencyId = data.agency_id;
    }
    const { data: isStaff } = await caller.rpc("i_am_staff_of", { p_agency: agencyId });
    if (!isStaff) return json({ error: "Sem acesso a esta agência." }, 403);

    const keepHistory = (instructions: string | null) =>
      admin.from("guide_versions").insert({ guide_id: guide!.id, version: guide!.version, content: guide!.content, instructions, created_by: who.user.id });

    if (action === "restore") {
      const { data: v } = await admin.from("guide_versions").select("*").eq("id", String(body.version_id || "")).eq("guide_id", guide!.id).maybeSingle();
      if (!v) return json({ error: "Versão não encontrada." }, 404);
      await keepHistory(`Antes de voltar para a versão ${v.version}`);
      const { data, error } = await admin.from("guides").update({ content: v.content, version: guide!.version + 1, updated_at: new Date().toISOString() }).eq("id", guide!.id).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true, guide: data });
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) return json({ error: "Chave do Claude não configurada." }, 500);

    let prompt: string;
    if (action === "revise") {
      const instructions = str(body.instructions, 4000);
      if (!instructions) return json({ error: "Escreva o que mudar." }, 400);
      prompt = `Este é um guia da Bolsa (sistema da agência), em JSON:\n${JSON.stringify(guide!.content)}\n\nMUDANÇA PEDIDA PELA EQUIPE:\n${instructions}\n\n${STYLE}\nDevolva o guia inteiro, já com a mudança, chamando a ferramenta salvar_guia.`;
    } else {
      const brief = str(body.brief, 6000);
      if (!brief || !str(body.title, 120)) return json({ error: "Dê um título e diga o que o guia deve explicar." }, 400);
      const lang = ["pt", "en", "es"].includes(body.language) ? body.language : "pt";
      prompt = `Escreva um guia da Bolsa (sistema da agência de marketing) chamado "${str(body.title, 120)}", no idioma ${lang === "en" ? "inglês" : lang === "es" ? "espanhol" : "português do Brasil"}.
Público: ${body.audience === "socio" ? "sócios da agência" : body.audience === "equipe" ? "equipe da agência" : "cliente da agência"}. Serviços: ${(Array.isArray(body.services) ? body.services : []).join(", ") || "não informado"}.
O que o guia deve explicar:\n${brief}\n\n${STYLE}\nSem imagens por enquanto (images vazio). Chame a ferramenta salvar_guia.`;
    }

    let result: any = null;
    for (let i = 0; i < 2 && !result; i++) {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model: MODEL, max_tokens: 12000, tools: [TOOL], tool_choice: { type: "auto" }, messages: [{ role: "user", content: prompt }] }),
      });
      const out = await r.json();
      if (!r.ok) { console.error(out); return json({ error: `Claude: ${out?.error?.message ?? "erro"}` }, 502); }
      result = (out.content ?? []).find((c: { type: string; name?: string }) => c.type === "tool_use" && c.name === TOOL.name)?.input ?? null;
    }
    if (!result) return json({ error: "O Claude não devolveu o guia. Tente de novo." }, 502);

    // Nunca deixa entrar imagem que não existia
    const known = new Set<string>();
    for (const s of guide?.content?.sections ?? []) for (const im of s.images ?? []) known.add(im.src);
    for (const s of result.sections ?? []) s.images = (s.images ?? []).filter((im: any) => known.has(im?.src));

    if (action === "revise") {
      await keepHistory(str(body.instructions, 4000));
      const { data, error } = await admin.from("guides").update({ content: result, version: guide!.version + 1, updated_at: new Date().toISOString() }).eq("id", guide!.id).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true, guide: data });
    }

    const base = str(body.title, 60).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "guia";
    let slug = base.length >= 3 ? base : `guia-${base}`;
    const { data: taken } = await admin.from("guides").select("id").eq("slug", slug).maybeSingle();
    if (taken) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
    const { data, error } = await admin.from("guides").insert({
      agency_id: agencyId, slug, title: str(body.title, 120),
      audience: ["socio", "cliente", "equipe"].includes(body.audience) ? body.audience : "cliente",
      language: ["pt", "en", "es"].includes(body.language) ? body.language : "pt",
      services: Array.isArray(body.services) ? body.services.slice(0, 10).map((s: unknown) => str(s, 40)) : [],
      content: result, created_by: who.user.id,
    }).select().single();
    if (error) return json({ error: error.message }, 400);
    return json({ ok: true, guide: data });
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message ?? "Erro inesperado." }, 500);
  }
});
