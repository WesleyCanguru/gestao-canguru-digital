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

export function shouldAutoPublish(post: { status?: string; date_key?: string; scheduled_time?: string | null }): boolean {
  if (!post || post.status !== 'scheduled') return false;
  if (!post.date_key) return false;

  const dateParts = parseDateFromKey(post.date_key);
  if (!dateParts) return false;

  const { hours, minutes } = parseTime(post.scheduled_time);

  const targetDate = new Date(dateParts.year, dateParts.month - 1, dateParts.day, hours, minutes, 0);
  const now = new Date();

  return now >= targetDate;
}

/**
  Checks an array of posts, auto-updates any past scheduled posts to 'published' in Supabase,
  and returns the updated array.
 */
export async function autoPublishPastScheduledPosts<T extends { date_key: string; status: string; scheduled_time?: string | null }>(posts: T[]): Promise<T[]> {
  if (!posts || posts.length === 0) return posts;

  const postsToPublish = posts.filter(p => shouldAutoPublish(p));
  if (postsToPublish.length === 0) return posts;

  const keysToPublish = postsToPublish.map(p => p.date_key);

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

  // Return updated posts
  return posts.map(p => {
    if (shouldAutoPublish(p)) {
      return { ...p, status: 'published' };
    }
    return p;
  });
}
