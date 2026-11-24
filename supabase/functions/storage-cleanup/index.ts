// Limpeza do Storage (bucket post-uploads), aprovada pelo Wesley em 15/11/2026.
// mode=orphans: apaga arquivos que nenhum post, foto IA ou logo usa (só os com mais de 3 dias).
// mode=retention: apaga a mídia de posts publicados há mais de 6 meses; o post continua (título, data, legenda).
// Só o pg_cron chama: exige o header x-cron-secret, conferido no banco (check_cron_secret, segredo no Vault).
import { createClient } from "npm:@supabase/supabase-js@2";

const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const mode = url.searchParams.get("mode") === "retention" ? "retention" : "orphans";
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: ok } = await db.rpc("check_cron_secret", { p_secret: req.headers.get("x-cron-secret") ?? "" });
  if (ok !== true) return json({ error: "unauthorized" }, 401);

  const rows = mode === "orphans"
    ? (await db.rpc("storage_orphan_files")).data as { name: string; size: number }[] | null
    : (await db.rpc("storage_old_published_media", { months: 6 })).data as { post_id: string; name: string; size: number }[] | null;
  if (!rows) return json({ error: "falha ao listar" }, 500);

  const names = [...new Set(rows.map((r) => r.name))];
  let removed = 0, bytes = 0; const errors: string[] = [];
  for (let i = 0; i < names.length; i += 100) {
    const chunk = names.slice(i, i + 100);
    const { data, error } = await db.storage.from("post-uploads").remove(chunk);
    if (error) { errors.push(error.message); continue; }
    removed += data?.length ?? 0;
  }
  const gone = new Set(names);
  bytes = rows.filter((r, i, a) => a.findIndex((x) => x.name === r.name) === i).reduce((s, r) => s + Number(r.size || 0), 0);

  let posts = 0;
  if (mode === "retention" && removed > 0) {
    const ids = [...new Set((rows as any[]).filter((r) => gone.has(r.name)).map((r) => r.post_id))];
    for (let i = 0; i < ids.length; i += 200) {
      const { error } = await db.from("posts").update({ image_url: null, video_thumbnail_url: null }).in("id", ids.slice(i, i + 200));
      if (error) errors.push(error.message); else posts += Math.min(200, ids.length - i);
    }
  }
  await db.from("storage_cleanup_log").insert({ mode, files: removed, bytes, posts, details: { errors: errors.slice(0, 5) } });
  return json({ mode, files: removed, bytes, posts, errors });
});
