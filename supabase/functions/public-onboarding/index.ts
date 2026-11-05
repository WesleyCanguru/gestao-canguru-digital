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
      const { data } = await admin.from("agencies").select("id, name, slug, logo_url, primary_color, is_active")
        .eq("slug", str(body.agency_slug, 60).toLowerCase()).eq("is_active", true).maybeSingle();
      if (!data) return json({ error: "Agência não encontrada." }, 404);
      let referrer: string | null = null;
      if (body.ref) {
        const { data: m } = await admin.from("agency_members").select("display_name")
          .eq("agency_id", data.id).eq("ref_code", str(body.ref, 60)).eq("is_active", true).maybeSingle();
        referrer = m?.display_name ?? null;
      }
      return json({ agency: data, referrer });
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
          agency_slug: agency.slug,
          registration_step: 1,
        },
      }).select("id").single();
      if (error || !created) return json({ error: "Não foi possível salvar os dados." }, 400);
      return json({ client_id: created.id, token });
    }

    // Passos 2 e 3: atualiza dados (aceite de contrato, briefing)
    if (action === "update") {
      const c = await loadByToken(body.client_id, body.token);
      if (!c) return json({ error: "Cadastro não encontrado." }, 404);
      const step = Number(body.step) || 2;
      const tsd = { ...(c.traffic_strategy_data ?? {}), registration_step: step };
      const patch: Record<string, unknown> = {};

      if (body.contract_accepted) {
        tsd.contract_accepted_at = new Date().toISOString();
        patch.onboarding_status = "em_andamento";
      }
      if (body.briefing) {
        const b = body.briefing;
        const onboarding_briefing = {
          nicho: str(b.niche), objetivo: str(b.objective),
          target_age_ranges: Array.isArray(b.targetAgeRanges) ? b.targetAgeRanges.slice(0, 10).map((x: unknown) => str(x, 20)) : [],
          target_location: str(b.targetLocation), target_interests: str(b.targetInterests, 1000),
          concorrentes: str(b.competitors, 1000), diferencial: str(b.differentiator, 1000), observacoes: str(b.notes, 2000),
        };
        Object.assign(tsd, {
          target_age_ranges: onboarding_briefing.target_age_ranges,
          target_location: onboarding_briefing.target_location || null,
          target_interests: onboarding_briefing.target_interests || null,
          onboarding_briefing,
        });
        if (onboarding_briefing.nicho) patch.segment = onboarding_briefing.nicho;
        await admin.from("client_briefings").insert({
          client_id: c.id, agency_id: c.agency_id, briefing_type: "onboarding",
          responses: onboarding_briefing, is_completed: true, completed_at: new Date().toISOString(),
        });
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

      const tsd = { ...(c.traffic_strategy_data ?? {}), registration_step: 4 };
      await admin.from("clients").update({
        onboarding_status: "concluido",
        onboarding_completed_at: new Date().toISOString(),
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
