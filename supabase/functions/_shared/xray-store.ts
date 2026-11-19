// Busca o Raio-X mais recente do cliente ou roda um novo e salva em client_audits.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { collectXray } from "./xray.ts";

export async function getOrRunXray(
  admin: SupabaseClient,
  client: any,
  userId: string | null,
  opts: { force?: boolean; maxAgeHours?: number } = {},
) {
  const maxAge = opts.maxAgeHours ?? 72;
  const tsd = client.traffic_strategy_data ?? {};
  const website = tsd.website_url ?? null;
  const instagram = client.instagram ?? tsd.instagram_url ?? null;

  if (!opts.force) {
    const { data: last } = await admin.from("client_audits").select("*")
      .eq("client_id", client.id).eq("kind", "xray")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (last && Date.now() - new Date(last.created_at).getTime() < maxAge * 3600_000) return last;
  }

  const data = await collectXray({ website, instagram }, {
    apifyToken: Deno.env.get("APIFY_TOKEN") ?? null,
    pagespeedKey: Deno.env.get("PAGESPEED_API_KEY") ?? null,
  });
  const { data: saved, error } = await admin.from("client_audits").insert({
    client_id: client.id, agency_id: client.agency_id, kind: "xray",
    website: data.website, data, created_by: userId,
  }).select("*").single();
  if (error) console.error("erro ao salvar raio-x", error);
  return saved ?? { data, created_at: data.collected_at };
}
