// Roda o Raio-X de um cliente (site, tags, páginas, Instagram) e salva em client_audits.
// Só a equipe da agência do cliente pode chamar. Body: { client_id, force?: boolean }
import { adminClient, corsHeaders, json, userClient } from "../_shared/common.ts";
import { getOrRunXray } from "../_shared/xray-store.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    const body = await req.json();
    const clientId = typeof body.client_id === "string" ? body.client_id : "";
    if (!clientId) return json({ error: "client_id obrigatório" }, 400);
    const admin = adminClient();
    const { data: client } = await admin.from("clients").select("*").eq("id", clientId).maybeSingle();
    if (!client) return json({ error: "Cliente não encontrado." }, 404);
    const asUser = userClient(req);
    const { data: { user } } = await asUser.auth.getUser();
    if (!user) return json({ error: "Faça login." }, 401);
    const { data: isStaff } = await asUser.rpc("i_am_staff_of", { p_agency: client.agency_id });
    if (!isStaff) return json({ error: "Sem acesso a este cliente." }, 403);
    const audit = await getOrRunXray(admin, client, user.id, { force: body.force !== false });
    return json({ audit });
  } catch (e) {
    console.error(e);
    return json({ error: "Erro inesperado." }, 500);
  }
});
