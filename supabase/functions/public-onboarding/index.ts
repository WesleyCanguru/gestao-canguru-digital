// Auto-cadastro público de clientes (link /cadastro?agency=slug&ref=codigo).
// Salva desde o passo 1 (lead parcial) e termina criando o login do cliente
// com e-mail + senha. Nada aqui usa a chave pública do banco direto.
import { adminClient, corsHeaders, isEmail, json, normEmail, randomToken, sha256Hex, findAuthUserByEmail } from "../_shared/common.ts";

const str = (v: unknown, max = 500) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const strOrNull = (v: unknown, max = 500) => str(v, max) || null;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const admin = adminClient();
    const body = await req.json();
    const action = body.action as string;

    const loadByToken = async (clientId: string, token: string) => {
      if (!clientId || !token) return null;
      const { data } = await admin.from("clients").select("*").eq("id", clientId).single();
      if (!data) return null;
      const h = await sha256Hex(token);
      return data.registration_token_hash === h ? data : null;
    };

    if (action === "agency") {
      const { data } = await admin.from("agencies").select("id, name, slug, logo_url, primary_color, is_active, access_email, contact_whatsapp")
        .eq("slug", str(body.agency_slug, 60).toLowerCase()).eq("is_active", true).maybeSingle();
      if (!data) return json({ error: "Agência não encontrada." }, 404);
      let referrer: string | null = null;
      let referrer_info: { name: string | null; whatsapp: string | null } | null = null;
      if (body.ref) {
        const { data: m } = await admin.from("agency_members").select("display_name, contact_whatsapp")
          .eq("agency_id", data.id).eq("ref_code", str(body.ref, 60)).eq("is_active", true).maybeSingle();
        referrer = m?.display_name ?? null;
        if (m) referrer_info = { name: m.display_name ?? null, whatsapp: m.contact_whatsapp ?? null };
      }
      return json({ agency: data, referrer, referrer_info });
    }

    // Passo 1: cria o cliente como lead parcial
    if (action === "start") {
      const d = body.data ?? {};
      const { data: agency } = await admin.from("agencies").select("id, slug, primary_color")
        .eq("slug", str(body.agency_slug, 60).toLowerCase()).eq("is_active", true).maybeSingle();
      if (!agency) return json({ error: "Agência não encontrada." }, 404);
      const company = str(d.companyName, 120);
      const email = str(d.email, 160);
      if (!company || !isEmail(email)) return json({ error: "Empresa e e-mail são obrigatórios." }, 400);

      let acquiredBy: string | null = null;
      if (body.ref) {
        const { data: m } = await admin.from("agency_members").select("user_id")
          .eq("agency_id", agency.id).eq("ref_code", str(body.ref, 60)).maybeSingle();
        acquiredBy = m?.user_id ?? null;
      }

      const token = randomToken();
      const initials = company.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "CL";
      const { data: created, error } = await admin.from("clients").insert({
        name: company,
        responsible: strOrNull(d.responsible, 120),
        email: normEmail(email),
        instagram: strOrNull(d.instagram_url),
        linkedin: strOrNull(d.linkedin_url),
        tiktok: strOrNull(d.tiktok_url),
        agency_id: agency.id,
        client_status: "prospect",
        onboarding_status: "lead_parcial",
        services: ["Tráfego Pago"],
        traffic_platforms: ["meta", "google"],
        currency: agency.id === 7 ? "USD" : "BRL",
        is_active: false,
        initials,
        color: agency.primary_color || "#456da1",
        acquired_by_user_id: acquiredBy,
        acquisition_ref: strOrNull(body.ref, 60),
        registration_token_hash: await sha256Hex(token),
        traffic_strategy_data: {
          website_url: strOrNull(d.website),
          phone: strOrNull(d.phone, 40),
          instagram_url: strOrNull(d.instagram_url),
          linkedin_url: strOrNull(d.linkedin_url),
          tiktok_url: strOrNull(d.tiktok_url),
          google_business_url: strOrNull(d.google_business_url),
          created_via: "public_onboarding",
          language: ["pt", "en", "es"].includes(body.lang) ? body.lang : "pt",
          agency_slug: agency.slug,
          registration_step: 1,
        },
      }).select("id").single();
      if (error || !created) return json({ error: "Não foi possível salvar os dados." }, 400);
      // Veio do botão "Quero começar" da proposta: a proposta passa a apontar para este cliente.
      if (typeof body.proposal === "string" && /^[a-z0-9-]{3,80}$/.test(body.proposal)) {
        await admin.from("proposals").update({ client_id: created.id }).eq("slug", body.proposal).eq("agency_id", agency.id).is("client_id", null);
      }
      return json({ client_id: created.id, token });
    }

    // Etapas intermediárias: dados, negócio, acessos, aceite do contrato
    if (action === "update") {
      const c = await loadByToken(body.client_id, body.token);
      if (!c) return json({ error: "Cadastro não encontrado." }, 404);
      const step = Number(body.step) || 2;
      const tsd = { ...(c.traffic_strategy_data ?? {}), registration_step: Math.max(step, Number(c.traffic_strategy_data?.registration_step) || 0) };
      const patch: Record<string, unknown> = {};

      if (body.company) {
        const d = body.company;
        const company = str(d.companyName, 120);
        if (company) patch.name = company;
        if (str(d.responsible, 120)) patch.responsible = str(d.responsible, 120);
        if (isEmail(str(d.email, 160))) patch.email = normEmail(str(d.email, 160));
        patch.instagram = strOrNull(d.instagram_url);
        Object.assign(tsd, {
          website_url: strOrNull(d.website), phone: strOrNull(d.phone, 40),
          instagram_url: strOrNull(d.instagram_url), google_business_url: strOrNull(d.google_business_url),
        });
      }

      if (["pt", "en", "es"].includes(body.lang)) tsd.language = body.lang;

      if (body.business) {
        const b = body.business;
        const marked: string[] = Array.isArray(b.services) ? b.services.slice(0, 10).map((x: unknown) => str(x, 40)) : [];
        const REAL = ["Tráfego Pago", "Social Media", "Website", "Identidade Visual", "E-mail Marketing", "Fotos com IA"];
        const realServices = marked.filter((x) => REAL.includes(x));
        tsd.servicos_marcados = marked;
        if (realServices.length) patch.services = realServices;
        // Briefings complementares: só o que o cadastro não cobre (tráfego e público já vieram daqui)
        const EXTRA: Record<string, string[]> = {
          "Social Media": ["persona", "tom_voz", "posicionamento", "conteudo_bastidores"],
          "Website": ["site"],
          "Identidade Visual": ["persona", "posicionamento"],
          "E-mail Marketing": ["tom_voz"],
        };
        const types = [...new Set(realServices.flatMap((x) => EXTRA[x] ?? []))];
        patch.features_settings = { ...(c.features_settings ?? {}), active_briefing_types: types };
        const briefing = {
          oferta: str(b.offer, 2000), ticket_medio: str(b.ticket, 100), objetivo: str(b.objective, 120),
          regiao: str(b.region, 300), publico: str(b.audience, 1500),
          faixas_etarias: Array.isArray(b.ageRanges) ? b.ageRanges.slice(0, 10).map((x: unknown) => str(x, 20)) : [],
          diferencial: str(b.differentiator, 1500), concorrentes: str(b.competitors, 1500),
          investimento_mensal: str(b.budget, 80), ja_anunciou: str(b.advertisedBefore, 80),
          historico: str(b.history, 2000), canal_de_venda: str(b.salesChannel, 300), observacoes: str(b.notes, 2000),
          servicos: marked,
        };
        Object.assign(tsd, {
          onboarding_briefing: briefing,
          target_age_ranges: briefing.faixas_etarias,
          target_location: briefing.regiao || null,
          target_interests: briefing.publico || null,
        });
        const { data: existing } = await admin.from("client_briefings").select("id")
          .eq("client_id", c.id).eq("briefing_type", "onboarding").maybeSingle();
        const row = { responses: briefing, is_completed: true, completed_at: new Date().toISOString() };
        if (existing) await admin.from("client_briefings").update(row).eq("id", existing.id);
        else await admin.from("client_briefings").insert({ client_id: c.id, agency_id: c.agency_id, briefing_type: "onboarding", ...row });
      }

      // Formato antigo do formulário (mantido enquanto a versão anterior estiver no ar)
      if (body.briefing) {
        const b = body.briefing;
        const onboarding_briefing = {
          nicho: str(b.niche), objetivo: str(b.objective),
          target_age_ranges: Array.isArray(b.targetAgeRanges) ? b.targetAgeRanges.slice(0, 10).map((x: unknown) => str(x, 20)) : [],
          target_location: str(b.targetLocation), target_interests: str(b.targetInterests, 1000),
          concorrentes: str(b.competitors, 1000), diferencial: str(b.differentiator, 1000), observacoes: str(b.notes, 2000),
        };
        Object.assign(tsd, { onboarding_briefing });
        await admin.from("client_briefings").insert({
          client_id: c.id, agency_id: c.agency_id, briefing_type: "onboarding",
          responses: onboarding_briefing, is_completed: true, completed_at: new Date().toISOString(),
        });
      }

      if (body.access && typeof body.access === "object") {
        for (const platform of ["meta", "google"]) {
          const a = body.access[platform];
          if (!a || typeof a !== "object") continue;
          const situation = ["has_account", "needs_account"].includes(a.situation) ? a.situation : "unknown";
          const status = ["pending", "client_done", "help", "agency_creating"].includes(a.status) ? a.status : "pending";
          const { data: cur } = await admin.from("client_platform_access").select("status")
            .eq("client_id", c.id).eq("platform", platform).maybeSingle();
          await admin.from("client_platform_access").upsert({
            client_id: c.id, agency_id: c.agency_id, platform, situation,
            status: cur?.status === "verified" ? "verified" : status,
            account_ref: strOrNull(a.account_ref, 80), contact_email: strOrNull(a.contact_email, 160), updated_at: new Date().toISOString(),
          }, { onConflict: "client_id,platform" });
        }
      }

      if (body.contract_accepted) {
        tsd.contract_accepted_at = new Date().toISOString();
        patch.onboarding_status = "em_andamento";
      }

      patch.traffic_strategy_data = tsd;
      const { error } = await admin.from("clients").update(patch).eq("id", c.id);
      if (error) return json({ error: "Erro ao salvar." }, 400);
      return json({ ok: true });
    }

    // Passo final: cria login (e-mail + senha) e vincula ao cliente
    if (action === "finish") {
      const c = await loadByToken(body.client_id, body.token);
      if (!c) return json({ error: "Cadastro não encontrado." }, 404);
      const password = body.password;
      if (typeof password !== "string" || password.length < 8) return json({ error: "A senha precisa ter pelo menos 8 caracteres." }, 400);
      const email = normEmail(c.email);

      let user = await findAuthUserByEmail(admin, email);
      if (user) {
        const { data: link } = await admin.from("client_members").select("id").eq("user_id", user.id).eq("client_id", c.id).maybeSingle();
        if (!link) return json({ error: "Este e-mail já tem login na plataforma. Fale com a agência para vincular este cadastro." }, 409);
      } else {
        const { data: created, error } = await admin.auth.admin.createUser({
          email, password, email_confirm: true, user_metadata: { name: c.responsible ?? c.name },
        });
        if (error || !created.user) return json({ error: error?.message ?? "Erro ao criar login." }, 400);
        user = created.user;
        await admin.from("client_members").insert({
          user_id: user.id, client_id: c.id, agency_id: c.agency_id,
          display_name: c.responsible, email,
        });
      }

      const tsd = { ...(c.traffic_strategy_data ?? {}), registration_step: 5 };
      await admin.from("clients").update({
        onboarding_status: "concluido",
        onboarding_completed_at: new Date().toISOString(),
        // Sem briefings complementares, o portal não precisa travar em briefings
        onboarding_completed: !((c.features_settings?.active_briefing_types ?? []).length),
        registration_token_hash: null,
        traffic_strategy_data: tsd,
      }).eq("id", c.id);

      return json({ ok: true, email });
    }

    return json({ error: "Ação desconhecida." }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: "Erro inesperado." }, 500);
  }
});
