// Gestão de logins (equipe e clientes). Toda ação confere a permissão de quem chamou.
import { adminClient, corsHeaders, findAuthUserByEmail, isEmail, json, normEmail, randomToken, userClient } from "../_shared/common.ts";

const PERM_KEYS = [
  "view_finance", "edit_finance", "edit_contracts", "manage_clients", "delete_clients",
  "manage_team", "send_signup_links", "manage_proposals", "manage_crm",
];

const cleanPerms = (p: unknown) => {
  const out: Record<string, boolean> = {};
  if (p && typeof p === "object") {
    for (const k of PERM_KEYS) if (k in (p as any)) out[k] = !!(p as any)[k];
  }
  return out;
};

const slugify = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 20) || "time";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const caller = userClient(req);
    const { data: who } = await caller.auth.getUser();
    if (!who?.user || who.user.is_anonymous) return json({ error: "Faça login." }, 401);

    const admin = adminClient();
    const body = await req.json();
    const action = body.action as string;

    const can = async (agencyId: number, perm: string) => {
      const { data } = await caller.rpc("i_can", { p_agency: agencyId, p_perm: perm });
      return data === true;
    };

    const getOrCreateUser = async (email: string, password: string | undefined, name: string) => {
      const existing = await findAuthUserByEmail(admin, email);
      if (existing) return { user: existing, created: false };
      if (!password || password.length < 8) throw new Error("Defina uma senha de pelo menos 8 caracteres.");
      const { data, error } = await admin.auth.admin.createUser({
        email: normEmail(email), password, email_confirm: true, user_metadata: { name },
      });
      if (error || !data.user) throw new Error(error?.message ?? "Erro ao criar login.");
      return { user: data.user, created: true };
    };

    switch (action) {
      // ----------------------------------------------------------- EQUIPE
      case "create_member": {
        const { agency_id, email, password, display_name, role = "partner", permissions } = body;
        if (!agency_id || !isEmail(email)) return json({ error: "Agência e e-mail são obrigatórios." }, 400);
        if (!["master", "partner", "team"].includes(role)) return json({ error: "Papel inválido." }, 400);
        if (!(await can(agency_id, "manage_team"))) return json({ error: "Sem permissão para gerenciar a equipe." }, 403);

        const { user, created } = await getOrCreateUser(email, password, display_name || email);
        const ref = `${slugify(display_name || email.split("@")[0])}${randomToken(2)}`;
        const { data: member, error } = await admin.from("agency_members").upsert({
          user_id: user.id, agency_id, role, permissions: cleanPerms(permissions),
          display_name: display_name || null, email: normEmail(email), ref_code: ref, is_active: true,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id,agency_id" }).select().single();
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true, member, user_created: created });
      }

      case "update_member": {
        const { member_id, role, permissions, is_active, display_name } = body;
        const { data: m } = await admin.from("agency_members").select("*").eq("id", member_id).single();
        if (!m) return json({ error: "Membro não encontrado." }, 404);
        if (!(await can(m.agency_id, "manage_team"))) return json({ error: "Sem permissão." }, 403);
        if (m.user_id === who.user.id && is_active === false) return json({ error: "Você não pode desativar o próprio acesso." }, 400);
        const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (role && ["master", "partner", "team"].includes(role)) patch.role = role;
        if (permissions) patch.permissions = cleanPerms(permissions);
        if (typeof is_active === "boolean") patch.is_active = is_active;
        if (typeof display_name === "string") patch.display_name = display_name;
        if (!m.ref_code) patch.ref_code = `${slugify(display_name || m.display_name || "time")}${randomToken(2)}`;
        const { data, error } = await admin.from("agency_members").update(patch).eq("id", member_id).select().single();
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true, member: data });
      }

      case "reset_member_password": {
        const { member_id, password } = body;
        if (typeof password !== "string" || password.length < 8) return json({ error: "Senha precisa de 8+ caracteres." }, 400);
        const { data: m } = await admin.from("agency_members").select("*").eq("id", member_id).single();
        if (!m) return json({ error: "Membro não encontrado." }, 404);
        if (!(await can(m.agency_id, "manage_team"))) return json({ error: "Sem permissão." }, 403);
        const { error } = await admin.auth.admin.updateUserById(m.user_id, { password });
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true });
      }

      // ---------------------------------------------------------- CLIENTES
      case "create_client_login": {
        const { client_id, email, password, display_name } = body;
        if (!client_id || !isEmail(email)) return json({ error: "Cliente e e-mail são obrigatórios." }, 400);
        const { data: c } = await admin.from("clients").select("id, agency_id, name").eq("id", client_id).single();
        if (!c) return json({ error: "Cliente não encontrado." }, 404);
        if (!(await can(c.agency_id, "manage_clients")) && !(await can(c.agency_id, "send_signup_links")))
          return json({ error: "Sem permissão para criar login de cliente." }, 403);

        const { user, created } = await getOrCreateUser(email, password, display_name || c.name);
        const { data: staffHit } = await admin.from("agency_members").select("id").eq("user_id", user.id).limit(1);
        if (staffHit && staffHit.length) return json({ error: "Este e-mail é de alguém da equipe. Use outro e-mail para o cliente." }, 400);
        const { error } = await admin.from("client_members").upsert({
          user_id: user.id, client_id, agency_id: c.agency_id,
          display_name: display_name || null, email: normEmail(email), is_active: true,
        }, { onConflict: "user_id,client_id" });
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true, user_created: created });
      }

      case "reset_client_password": {
        const { client_member_id, password } = body;
        if (typeof password !== "string" || password.length < 8) return json({ error: "Senha precisa de 8+ caracteres." }, 400);
        const { data: m } = await admin.from("client_members").select("*, clients(agency_id)").eq("id", client_member_id).single();
        if (!m) return json({ error: "Login não encontrado." }, 404);
        const agencyId = (m as any).clients?.agency_id ?? m.agency_id;
        if (!(await can(agencyId, "manage_clients"))) return json({ error: "Sem permissão." }, 403);
        const { error } = await admin.auth.admin.updateUserById(m.user_id, { password });
        if (error) return json({ error: error.message }, 400);
        return json({ ok: true });
      }

      case "set_client_login_active": {
        const { client_member_id, is_active } = body;
        const { data: m } = await admin.from("client_members").select("*, clients(agency_id)").eq("id", client_member_id).single();
        if (!m) return json({ error: "Login não encontrado." }, 404);
        const agencyId = (m as any).clients?.agency_id ?? m.agency_id;
        if (!(await can(agencyId, "manage_clients"))) return json({ error: "Sem permissão." }, 403);
        await admin.from("client_members").update({ is_active: !!is_active }).eq("id", client_member_id);
        return json({ ok: true });
      }

      default:
        return json({ error: "Ação desconhecida." }, 400);
    }
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message ?? "Erro inesperado." }, 500);
  }
});
