// Primeiro acesso: troca a chave antiga da Bolsa por um login com e-mail + senha.
// Valida a chave (hash SHA-256 legado), cria o usuário no Supabase Auth e
// vincula as agências/clientes que aquela chave dava acesso.
import { adminClient, corsHeaders, findAuthUserByEmail, isEmail, json, normEmail, sha256Hex } from "../_shared/common.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const { legacy_key, email, password, name } = await req.json();
    if (typeof legacy_key !== "string" || legacy_key.trim().length < 4) return json({ error: "Informe a chave de acesso antiga." }, 400);
    if (!isEmail(email)) return json({ error: "Informe um e-mail válido." }, 400);
    if (typeof password !== "string" || password.length < 8) return json({ error: "A senha precisa ter pelo menos 8 caracteres." }, 400);

    const admin = adminClient();
    const hash = await sha256Hex(legacy_key.trim());

    const [{ data: agencyRows }, { data: clientRows }] = await Promise.all([
      admin.from("agency_users").select("id, agency_id, name, role, auth_user_id").eq("password_hash", hash).eq("is_active", true),
      admin.from("client_users").select("id, client_id, agency_id, username, auth_user_id").eq("password_hash", hash).eq("is_active", true),
    ]);

    if ((!agencyRows || agencyRows.length === 0) && (!clientRows || clientRows.length === 0)) {
      // pequeno atraso contra tentativa e erro
      await new Promise((r) => setTimeout(r, 800));
      return json({ error: "Chave de acesso não encontrada." }, 401);
    }

    const already = [...(agencyRows ?? []), ...(clientRows ?? [])].find((r: any) => r.auth_user_id);
    const cleanEmail = normEmail(email);

    // Usuário já existe com este e-mail? Precisa provar que é dono (senha correta).
    let user = await findAuthUserByEmail(admin, cleanEmail);
    if (already && (!user || user.id !== already.auth_user_id)) {
      return json({ error: "Esta chave já foi migrada para outro e-mail. Entre com o e-mail e a senha cadastrados ou peça ajuda à agência." }, 409);
    }
    if (user) {
      const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { auth: { persistSession: false } });
      const { error: signErr } = await anon.auth.signInWithPassword({ email: cleanEmail, password });
      if (signErr) return json({ error: "Este e-mail já tem login. Use a senha dele (ou recupere a senha)." }, 409);
    } else {
      const displayName = (typeof name === "string" && name.trim()) || agencyRows?.[0]?.name || clientRows?.[0]?.username || cleanEmail;
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: cleanEmail,
        password,
        email_confirm: true,
        user_metadata: { name: displayName },
      });
      if (createErr || !created.user) return json({ error: createErr?.message ?? "Não foi possível criar o login." }, 400);
      user = created.user;
    }

    const displayName = (typeof name === "string" && name.trim()) || agencyRows?.[0]?.name || null;

    for (const row of agencyRows ?? []) {
      await admin.from("agency_members").upsert({
        user_id: user.id,
        agency_id: row.agency_id,
        role: row.role === "admin" ? "master" : "team",
        display_name: displayName ?? row.name,
        email: cleanEmail,
        legacy_agency_user_id: row.id,
      }, { onConflict: "user_id,agency_id", ignoreDuplicates: true });
      await admin.from("agency_users").update({ auth_user_id: user.id }).eq("id", row.id);
    }

    for (const row of clientRows ?? []) {
      if (!row.client_id) continue;
      await admin.from("client_members").upsert({
        user_id: user.id,
        client_id: row.client_id,
        agency_id: row.agency_id,
        display_name: displayName,
        email: cleanEmail,
        legacy_client_user_id: row.id,
      }, { onConflict: "user_id,client_id", ignoreDuplicates: true });
      await admin.from("client_users").update({ auth_user_id: user.id }).eq("id", row.id);
    }

    return json({ ok: true, email: cleanEmail });
  } catch (e) {
    console.error(e);
    return json({ error: "Erro inesperado. Tente novamente." }, 500);
  }
});
