// Envio para o Telegram (Bot API oficial). Opcional: sem TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID não faz nada.
// Nunca lança erro: quem chama segue a vida (o e-mail não depende disto).
export const tgEsc = (s: unknown) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));

export const telegramReady = () => !!(Deno.env.get("TELEGRAM_BOT_TOKEN") && Deno.env.get("TELEGRAM_CHAT_ID"));

export async function sendTelegram(html: string): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const chat = Deno.env.get("TELEGRAM_CHAT_ID");
  if (!token || !chat) return { ok: false, skipped: true };
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chat, text: html.slice(0, 4000), parse_mode: "HTML", link_preview_options: { is_disabled: true } }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    const body = await r.json().catch(() => ({}));
    return r.ok && body?.ok ? { ok: true } : { ok: false, error: `${r.status} ${body?.description || ""}`.trim() };
  } catch (e) {
    return { ok: false, error: String((e as Error)?.message || e) };
  }
}
