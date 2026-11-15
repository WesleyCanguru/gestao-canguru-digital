// Marca, textos e envio dos e-mails (Resend). Compartilhado pelos avisos e relatórios.
export type Lang = "pt" | "en" | "es";

export const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

export type Brand = { app: string; agency: string; label: string; appUrl: string; logo: string | null; color: string; from: string };

// Canguru: "Bolsa · Canguru Digital". Joey em inglês: "Pouch · Joey Growth". Joey em PT/ES: "Bolsa da Joey".
export const brandOf = (a: any, lang: Lang): Brand => {
  const isJoey = a.id === 7;
  const app = isJoey && lang === "en" ? "Pouch" : "Bolsa";
  const label = isJoey ? (lang === "en" ? "Pouch · Joey Growth" : lang === "es" ? "Bolsa de Joey Growth" : "Bolsa da Joey Growth") : `Bolsa · ${a.name}`;
  const appUrl = `https://${a.domain || "bolsa.cangurudigital.com.br"}`;
  return { app, agency: a.name, label, appUrl, logo: a.logo_url || null, color: a.primary_color || "#20364D", from: `${label} <acesso@cangurudigital.com.br>` };
};

const MONTHS: Record<Lang, string[]> = {
  pt: ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  es: ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"],
};
export const fmtPostDate = (dateKey: string, time: string | null | undefined, lang: Lang) => {
  const m = /(\d{2})-(\d{2})-(\d{4})/.exec(dateKey || "");
  if (!m) return "";
  const d = parseInt(m[1], 10), mo = parseInt(m[2], 10) - 1;
  const day = lang === "en" ? `${MONTHS.en[mo]} ${d}` : `${d} ${MONTHS[lang][mo]}`;
  return time ? `${day} · ${time}` : day;
};

export const T: Record<Lang, any> = {
  pt: {
    pendOneSubject: (c: string) => `Novo post para aprovar · ${c}`,
    pendManySubject: (n: number, c: string) => `${n} novos posts para aprovar · ${c}`,
    pendOneTitle: "Tem um post esperando a sua aprovação",
    pendManyTitle: (n: number) => `${n} posts esperando a sua aprovação`,
    pendOneIntro: "Veja como ele vai ficar e aprove ou peça ajuste. Leva um minuto.",
    pendManyIntro: "Toque em cada um para ver como vai ficar e aprovar ou pedir ajuste.",
    pendFoot: "Quanto antes você aprovar, antes o post vai ao ar.",
    seeAndApprove: "Ver e aprovar", openPortal: "Abrir o portal",
    remSubject: (n: number, c: string) => n === 1 ? `Lembrete: 1 post esperando você · ${c}` : `Lembrete: ${n} posts esperando você · ${c}`,
    remTitle: (n: number) => n === 1 ? "Seu post ainda espera a sua aprovação" : `${n} posts ainda esperam a sua aprovação`,
    remIntro: "Passaram 24 horas. Se precisar mudar algo, é só pedir ajuste no próprio post.",
    footer: "Você recebe este e-mail porque tem acesso ao portal.",
  },
  en: {
    pendOneSubject: (c: string) => `New post to approve · ${c}`,
    pendManySubject: (n: number, c: string) => `${n} new posts to approve · ${c}`,
    pendOneTitle: "A post is waiting for your approval",
    pendManyTitle: (n: number) => `${n} posts are waiting for your approval`,
    pendOneIntro: "See how it will look, then approve it or request a change. It takes a minute.",
    pendManyIntro: "Tap each one to see how it will look, then approve or request a change.",
    pendFoot: "The sooner you approve, the sooner it goes live.",
    seeAndApprove: "Review and approve", openPortal: "Open the portal",
    remSubject: (n: number, c: string) => n === 1 ? `Reminder: 1 post waiting for you · ${c}` : `Reminder: ${n} posts waiting for you · ${c}`,
    remTitle: (n: number) => n === 1 ? "Your post is still waiting for approval" : `${n} posts are still waiting for approval`,
    remIntro: "It's been 24 hours. If something needs to change, just request a change on the post.",
    footer: "You're receiving this email because you have access to the portal.",
  },
  es: {
    pendOneSubject: (c: string) => `Nueva publicación para aprobar · ${c}`,
    pendManySubject: (n: number, c: string) => `${n} nuevas publicaciones para aprobar · ${c}`,
    pendOneTitle: "Hay una publicación esperando tu aprobación",
    pendManyTitle: (n: number) => `${n} publicaciones esperan tu aprobación`,
    pendOneIntro: "Mira cómo va a quedar y apruébala o pide un ajuste. Toma un minuto.",
    pendManyIntro: "Toca cada una para ver cómo va a quedar y aprobar o pedir un ajuste.",
    pendFoot: "Cuanto antes apruebes, antes se publica.",
    seeAndApprove: "Ver y aprobar", openPortal: "Abrir el portal",
    remSubject: (n: number, c: string) => n === 1 ? `Recordatorio: 1 publicación te espera · ${c}` : `Recordatorio: ${n} publicaciones te esperan · ${c}`,
    remTitle: (n: number) => n === 1 ? "Tu publicación aún espera aprobación" : `${n} publicaciones aún esperan aprobación`,
    remIntro: "Pasaron 24 horas. Si algo debe cambiar, pide un ajuste en la misma publicación.",
    footer: "Recibes este correo porque tienes acceso al portal.",
  },
};

type Item = { title: string; meta?: string; url?: string; tag?: string };
export const layout = (b: Brand, lang: Lang, o: { title: string; intro?: string; items?: Item[]; button?: { label: string; url: string }; footnote?: string; bodyHtml?: string }) => {
  const c = b.color;
  const items = (o.items || []).map((it) => `
    <tr><td style="padding:14px 16px;border:1px solid #E7EAF0;border-radius:12px;background:#FFFFFF">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="font:600 15px/1.4 -apple-system,Segoe UI,Arial,sans-serif;color:#17202E">${it.tag ? `<span style="display:inline-block;font:700 10px/1 Arial,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:${c};background:${c}14;padding:4px 8px;border-radius:999px;margin-bottom:6px">${esc(it.tag)}</span><br>` : ""}${esc(it.title)}
          ${it.meta ? `<div style="font:400 13px/1.4 -apple-system,Segoe UI,Arial,sans-serif;color:#6B7586;margin-top:2px">${esc(it.meta)}</div>` : ""}</td>
        ${it.url ? `<td align="right" style="white-space:nowrap;padding-left:12px"><a href="${esc(it.url)}" style="font:600 13px Arial,sans-serif;color:${c};text-decoration:none">${lang === "en" ? "Open" : lang === "es" ? "Abrir" : "Abrir"} →</a></td>` : ""}
      </tr></table>
    </td></tr><tr><td style="height:8px"></td></tr>`).join("");
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(o.title)}</title></head>
<body style="margin:0;padding:0;background:#F3F5F8">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F3F5F8"><tr><td align="center" style="padding:28px 12px">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
  <tr><td style="padding:0 4px 16px"><table width="100%" cellpadding="0" cellspacing="0"><tr>
    <td>${b.logo ? `<img src="${esc(b.logo)}" alt="${esc(b.agency)}" height="36" style="height:36px;max-width:160px;border-radius:8px;display:block">` : `<span style="font:700 18px Georgia,serif;color:#17202E">${esc(b.agency)}</span>`}</td>
    <td align="right" style="font:600 11px/1 Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#8A93A3">${esc(b.label)}</td>
  </tr></table></td></tr>
  <tr><td style="background:#FFFFFF;border-radius:20px;overflow:hidden;box-shadow:0 1px 2px rgba(16,24,40,.06)">
    <div style="height:6px;background:${c}"></div>
    <div style="padding:28px 28px 8px">
      <h1 style="margin:0 0 10px;font:700 22px/1.3 -apple-system,Segoe UI,Arial,sans-serif;color:#17202E">${esc(o.title)}</h1>
      ${o.intro ? `<p style="margin:0 0 20px;font:400 15px/1.55 -apple-system,Segoe UI,Arial,sans-serif;color:#4A5568">${esc(o.intro)}</p>` : ""}
      ${o.bodyHtml || ""}
      ${items ? `<table width="100%" cellpadding="0" cellspacing="0">${items}</table>` : ""}
      ${o.button ? `<div style="padding:14px 0 6px"><a href="${esc(o.button.url)}" style="display:inline-block;background:${c};color:#FFFFFF;font:700 15px Arial,sans-serif;text-decoration:none;padding:14px 22px;border-radius:12px">${esc(o.button.label)}</a></div>` : ""}
      ${o.footnote ? `<p style="margin:14px 0 20px;font:400 13px/1.5 -apple-system,Segoe UI,Arial,sans-serif;color:#8A93A3">${esc(o.footnote)}</p>` : `<div style="height:20px"></div>`}
    </div>
  </td></tr>
  <tr><td style="padding:16px 8px;font:400 12px/1.5 Arial,sans-serif;color:#8A93A3;text-align:center">${esc(b.label)} · ${esc(T[lang].footer)}</td></tr>
</table></td></tr></table></body></html>`;
};

export async function sendEmail(m: { from: string; to: string[]; subject: string; html: string; reply_to?: string | null }): Promise<{ ok: boolean; id?: string; error?: string }> {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return { ok: false, error: "RESEND_API_KEY ausente" };
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: m.from, to: m.to, subject: m.subject, html: m.html, ...(m.reply_to ? { reply_to: m.reply_to } : {}) }),
  });
  const body = await r.json().catch(() => ({}));
  return r.ok ? { ok: true, id: body.id } : { ok: false, error: `${r.status} ${body?.message || ""}`.trim() };
}

// Destinatários da equipe: os e-mails configurados ou, se vazio, os masters ativos da agência.
export async function teamRecipients(db: any, agencyId: number, s: any): Promise<string[]> {
  if (s?.team_emails?.length) return s.team_emails;
  const { data } = await db.from("agency_members").select("email, role").eq("agency_id", agencyId).eq("is_active", true).eq("role", "master");
  return [...new Set((data || []).map((m: any) => m.email).filter(Boolean))] as string[];
}
