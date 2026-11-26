export type AdPlatform = 'meta' | 'google';

/**
 * Plataformas de anúncio que o cliente usa de verdade (campo clients.traffic_platforms).
 * Se o campo estiver vazio, vale Meta e Google, como era antes.
 */
export const clientAdPlatforms = (client: { traffic_platforms?: string[] | null } | null | undefined): AdPlatform[] => {
  const list = ((client?.traffic_platforms as string[]) || []).filter((p): p is AdPlatform => p === 'meta' || p === 'google');
  return list.length ? (['meta', 'google'] as AdPlatform[]).filter(p => list.includes(p)) : ['meta', 'google'];
};
