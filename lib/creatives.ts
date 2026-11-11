import { supabase } from './supabase';
import { getAppUrl } from './appUrl';

/**
 * Aprovação de criativos de anúncio.
 * Lote (creative_batches) = um envio para o cliente. Peça (creative_items) = estático, carrossel ou vídeo.
 * Arquivos no bucket privado ad-creatives, caminho <cliente>/<lote>/<arquivo>.
 */

export const CREATIVES_BUCKET = 'ad-creatives';
export const MAX_FILE_MB = 50;

export type CreativeKind = 'image' | 'carousel' | 'video';
export type CreativeStatus = 'pending' | 'approved' | 'changes';
export type BatchStatus = 'draft' | 'sent' | 'reviewed' | 'closed';

export interface CreativeMedia {
  type: 'image' | 'video' | 'link';
  path?: string | null;
  url?: string | null;
  name?: string | null;
}

export interface CreativeBatch {
  id: string;
  agency_id: number;
  client_id: string;
  title: string;
  description: string | null;
  status: BatchStatus;
  public_token: string;
  sent_at: string | null;
  reviewed_at: string | null;
  reviewed_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreativeItem {
  id: string;
  batch_id: string;
  client_id: string;
  position: number;
  kind: CreativeKind;
  title: string | null;
  caption: string | null;
  placement: string | null;
  media: CreativeMedia[];
  status: CreativeStatus;
  feedback: string | null;
  decided_by_name: string | null;
  decided_at: string | null;
  version: number;
  history: { version: number; media: CreativeMedia[]; feedback: string | null; decided_at: string | null }[];
  created_at: string;
  updated_at: string;
}

export const KIND_LABEL: Record<CreativeKind, string> = { image: 'Estático', carousel: 'Carrossel', video: 'Vídeo' };
export const KIND_LABEL_PLURAL: Record<CreativeKind, string> = { image: 'Estáticos', carousel: 'Carrosséis', video: 'Vídeos' };
export const STATUS_LABEL: Record<CreativeStatus, string> = { pending: 'Pendente', approved: 'Aprovado', changes: 'Ajuste pedido' };
export const BATCH_STATUS_LABEL: Record<BatchStatus, string> = { draft: 'Rascunho', sent: 'Aguardando o cliente', reviewed: 'Revisado pelo cliente', closed: 'Encerrado' };
export const PLACEMENTS = ['Feed', 'Stories', 'Reels', 'Feed e Stories', 'Todos os posicionamentos'];

export const STATUS_STYLE: Record<CreativeStatus, string> = {
  pending: 'bg-gray-100 text-gray-600 border-gray-200',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  changes: 'bg-amber-50 text-amber-800 border-amber-200',
};
export const BATCH_STATUS_STYLE: Record<BatchStatus, string> = {
  draft: 'bg-gray-100 text-gray-600 border-gray-200',
  sent: 'bg-blue-50 text-blue-700 border-blue-200',
  reviewed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  closed: 'bg-slate-100 text-slate-500 border-slate-200',
};

export const batchLink = (b: Pick<CreativeBatch, 'public_token'>) => `${getAppUrl()}/criativos/${b.public_token}`;

export const batchMessage = (b: CreativeBatch, clientName: string, counts: { total: number }) =>
  `Oi${clientName ? `, ${clientName.split(' ')[0]}` : ''}! Os criativos de "${b.title}" estão prontos para a sua aprovação (${counts.total} ${counts.total === 1 ? 'peça' : 'peças'}).\n\n` +
  `É só abrir o link, passar peça por peça e marcar Aprovar ou Pedir ajuste:\n${batchLink(b)}`;

// ------------------------------------------------------------------
// Links externos (vídeo no Drive, YouTube, Vimeo)
// ------------------------------------------------------------------
const driveId = (url: string): string | null => {
  const m = url.match(/drive\.google\.com\/file\/d\/([\w-]+)/) || url.match(/drive\.google\.com\/open\?id=([\w-]+)/) || url.match(/[?&]id=([\w-]+)/);
  return m && url.includes('drive.google.com') ? m[1] : null;
};
const youtubeId = (url: string): string | null => {
  const m = url.match(/youtu\.be\/([\w-]{6,})/) || url.match(/youtube\.com\/(?:watch\?v=|shorts\/|embed\/)([\w-]{6,})/);
  return m ? m[1] : null;
};
const vimeoId = (url: string): string | null => {
  const m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return m ? m[1] : null;
};

/** URL para tocar dentro da tela (iframe) ou null se não reconhecer o link. */
export const embedUrl = (url: string): string | null => {
  const d = driveId(url); if (d) return `https://drive.google.com/file/d/${d}/preview`;
  const y = youtubeId(url); if (y) return `https://www.youtube.com/embed/${y}?rel=0`;
  const v = vimeoId(url); if (v) return `https://player.vimeo.com/video/${v}`;
  return null;
};

/** Miniatura de um link externo (quando o serviço oferece). */
export const linkThumb = (url: string): string | null => {
  const d = driveId(url); if (d) return `https://drive.google.com/thumbnail?id=${d}&sz=w800`;
  const y = youtubeId(url); if (y) return `https://img.youtube.com/vi/${y}/hqdefault.jpg`;
  return null;
};

export const isSupportedVideoLink = (url: string) => !!embedUrl(url.trim());

// ------------------------------------------------------------------
// Arquivos
// ------------------------------------------------------------------
const safeName = (name: string) =>
  name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '-').replace(/-+/g, '-').slice(-80);

export const uploadCreativeFile = async (clientId: string, batchId: string, file: File): Promise<CreativeMedia> => {
  if (file.size > MAX_FILE_MB * 1024 * 1024) {
    throw new Error(`"${file.name}" tem mais de ${MAX_FILE_MB} MB. Para vídeo grande, use o link do Google Drive.`);
  }
  const isVideo = file.type.startsWith('video/');
  if (!isVideo && !file.type.startsWith('image/')) throw new Error(`"${file.name}" não é imagem nem vídeo.`);
  const path = `${clientId}/${batchId}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${safeName(file.name)}`;
  const { error } = await supabase.storage.from(CREATIVES_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(`Não foi possível subir "${file.name}": ${error.message}`);
  return { type: isVideo ? 'video' : 'image', path, name: file.name };
};

export const removeCreativeFiles = async (media: CreativeMedia[]) => {
  const paths = media.map(m => m.path).filter(Boolean) as string[];
  if (paths.length) await supabase.storage.from(CREATIVES_BUCKET).remove(paths);
};

/** Gera links temporários (1h) para todos os arquivos de uma lista de peças. */
export const signMedia = async (items: Pick<CreativeItem, 'media' | 'history'>[]): Promise<Record<string, string>> => {
  const paths = new Set<string>();
  items.forEach(i => {
    (i.media || []).forEach(m => m.path && paths.add(m.path));
    (i.history || []).forEach(h => (h.media || []).forEach(m => m.path && paths.add(m.path)));
  });
  if (!paths.size) return {};
  const list = Array.from(paths);
  const out: Record<string, string> = {};
  for (let i = 0; i < list.length; i += 100) {
    const { data } = await supabase.storage.from(CREATIVES_BUCKET).createSignedUrls(list.slice(i, i + 100), 3600);
    (data || []).forEach((d: any) => { if (d.signedUrl && d.path) out[d.path] = d.signedUrl; });
  }
  return out;
};

export const mediaSrc = (m: CreativeMedia, signed: Record<string, string>): string | null =>
  m.path ? signed[m.path] || null : m.url || null;

export const counts = (items: CreativeItem[]) => ({
  total: items.length,
  pending: items.filter(i => i.status === 'pending').length,
  approved: items.filter(i => i.status === 'approved').length,
  changes: items.filter(i => i.status === 'changes').length,
  image: items.filter(i => i.kind === 'image').length,
  carousel: items.filter(i => i.kind === 'carousel').length,
  video: items.filter(i => i.kind === 'video').length,
});

// Nome de quem está revisando pelo link (só neste navegador)
const NAME_KEY = 'bolsa_creative_reviewer_name';
export const getReviewerName = () => { try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; } };
export const setReviewerName = (n: string) => { try { localStorage.setItem(NAME_KEY, n); } catch { /* ignore */ } };
