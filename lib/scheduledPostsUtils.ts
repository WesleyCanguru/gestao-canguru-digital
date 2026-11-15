import { supabase } from './supabase';

export function parseDateFromKey(dateKey?: string | null): { day: number; month: number; year: number } | null {
  if (!dateKey) return null;
  const parts = dateKey.split('-');
  if (parts.length >= 3) {
    const d = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const y = parseInt(parts[2], 10);
    if (!isNaN(d) && !isNaN(m) && !isNaN(y) && y >= 2000 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return { day: d, month: m, year: y };
    }
  }
  return null;
}

export function parseTime(timeStr?: string | null): { hours: number; minutes: number } {
  if (!timeStr) return { hours: 0, minutes: 0 };
  const parts = timeStr.split(':');
  if (parts.length >= 2) {
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (!isNaN(h) && !isNaN(m)) {
      return { hours: h, minutes: m };
    }
  }
  return { hours: 0, minutes: 0 };
}

// Diferença (minutos) entre o relógio do fuso e o UTC naquele instante.
function tzOffsetMinutes(tz: string, at: Date): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(at);
    const g = (t: string) => parseInt(parts.find(p => p.type === t)?.value || '0', 10);
    return Math.round((Date.UTC(g('year'), g('month') - 1, g('day'), g('hour') % 24, g('minute')) - at.getTime()) / 60000);
  } catch { return -180; }
}

/**
 * Instante em que o post deve ir ao ar. O horário é o do FUSO DO CLIENTE (padrão: Brasília),
 * não o de quem está com a Bolsa aberta. Ex.: post às 18:00 de um cliente do Brasil vira publicado
 * às 18:00 de Brasília, mesmo que a equipe esteja em Paris.
 */
export function getTargetDateTime(dateKey?: string | null, scheduledTime?: string | null, clientTz: string = 'America/Sao_Paulo'): Date | null {
  if (!dateKey) return null;
  const dateParts = parseDateFromKey(dateKey);
  if (!dateParts) return null;
  const { hours, minutes } = parseTime(scheduledTime);
  const naive = Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day, hours, minutes, 0);
  return new Date(naive - tzOffsetMinutes(clientTz || 'America/Sao_Paulo', new Date(naive)) * 60000);
}

export function shouldAutoPublish(post: { status?: string; date_key?: string; scheduled_time?: string | null }): boolean {
  if (!post || post.status !== 'scheduled') return false;
  const targetDate = getTargetDateTime(post.date_key, post.scheduled_time);
  if (!targetDate) return false;
  const now = new Date();
  return now >= targetDate;
}

export function getPostGroupIdentifier(post: { date_key: string; theme?: string | null; client_id?: string | null }): string {
  if (!post || !post.date_key) return '';
  const parts = post.date_key.split('-');
  const datePart = parts.length >= 3 ? `${parts[0]}-${parts[1]}-${parts[2]}` : post.date_key;
  const suffix = parts.length > 4 ? parts.slice(4).join('-') : '';
  const cleanTheme = (post.theme || '').trim().toLowerCase();
  const clientId = post.client_id || '';

  if (suffix) {
    return `${datePart}_${clientId}_${suffix}`;
  }
  if (cleanTheme) {
    return `${datePart}_${clientId}_${cleanTheme}`;
  }
  return `${datePart}_${clientId}`;
}

export function shouldAutoPublishGroup(groupPosts: Array<{ status?: string; date_key?: string; scheduled_time?: string | null }>): boolean {
  if (!groupPosts || groupPosts.length === 0) return false;

  const scheduledPosts = groupPosts.filter(p => p && p.status === 'scheduled');
  if (scheduledPosts.length === 0) return false;

  const now = new Date();
  let latestTargetDate: Date | null = null;

  for (const post of scheduledPosts) {
    const target = getTargetDateTime(post.date_key, post.scheduled_time);
    if (target) {
      if (!latestTargetDate || target > latestTargetDate) {
        latestTargetDate = target;
      }
    }
  }

  if (!latestTargetDate) return false;

  return now >= latestTargetDate;
}

/**
  Checks an array of posts, auto-updates any past scheduled posts to 'published' in Supabase,
  ensuring multi-platform posts only auto-publish after ALL platform scheduled times have passed.
 */
export async function autoPublishPastScheduledPosts<T extends { date_key: string; status: string; scheduled_time?: string | null; theme?: string | null; client_id?: string | null }>(posts: T[]): Promise<T[]> {
  if (!posts || posts.length === 0) return posts;

  // Group posts by logical publication group
  const groups: Record<string, T[]> = {};
  posts.forEach(p => {
    const groupId = getPostGroupIdentifier(p);
    if (!groups[groupId]) {
      groups[groupId] = [];
    }
    groups[groupId].push(p);
  });

  const keysToPublishSet = new Set<string>();

  Object.values(groups).forEach(groupList => {
    if (shouldAutoPublishGroup(groupList)) {
      groupList.forEach(p => {
        if (p.status === 'scheduled') {
          keysToPublishSet.add(p.date_key);
        }
      });
    }
  });

  if (keysToPublishSet.size === 0) return posts;

  const keysToPublish = Array.from(keysToPublishSet);

  // Update in Supabase
  try {
    const { error } = await supabase
      .from('posts')
      .update({ status: 'published', last_updated: new Date().toISOString() })
      .in('date_key', keysToPublish);

    if (error) {
      console.error("Erro ao auto-publicar posts no Supabase:", error);
    }
  } catch (err) {
    console.error("Exceção ao auto-publicar posts:", err);
  }

  // Return updated posts array
  return posts.map(p => {
    if (keysToPublishSet.has(p.date_key)) {
      return { ...p, status: 'published' };
    }
    return p;
  });
}
