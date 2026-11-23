// Notificação no iPhone/Mac (OneSignal, app da Bolsa instalada na tela de início / no Dock).
// Vai para os administradores da plataforma (hoje o Wesley), pelo id de login (OneSignal.login no app).
// Opcional: sem ONESIGNAL_CANGURU_REST_KEY não faz nada. Nunca lança erro.
const APP_ID = "dba12918-fbf1-4b24-9376-2740c1fd0e4b";
const APP_URL = "https://bolsa.cangurudigital.com.br/";

export async function pushToAdmins(db: any, title: string, body: string): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const key = Deno.env.get("ONESIGNAL_CANGURU_REST_KEY");
  if (!key) return { ok: false, skipped: true };
  try {
    const { data } = await db.from("platform_admins").select("user_id");
    const ids = [...new Set((data || []).map((r: any) => r.user_id).filter(Boolean))];
    if (!ids.length) return { ok: false, skipped: true };
    const r = await fetch("https://api.onesignal.com/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Key ${key}` },
      body: JSON.stringify({
        app_id: APP_ID, target_channel: "push", include_aliases: { external_id: ids },
        headings: { en: title, pt: title }, contents: { en: body, pt: body }, url: APP_URL,
      }),
    });
    const b = await r.json().catch(() => ({}));
    return r.ok && !b?.errors ? { ok: true } : { ok: false, error: `${r.status} ${JSON.stringify(b?.errors ?? b).slice(0, 200)}` };
  } catch (e) {
    return { ok: false, error: String((e as Error)?.message || e) };
  }
}
