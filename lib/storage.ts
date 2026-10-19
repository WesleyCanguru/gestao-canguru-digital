import { supabase } from './supabase';

const PRIVATE_BUCKETS = ['client-documents'];

/**
 * Converte uma URL pública antiga de um bucket privado em link temporário (10 min)
 * e abre em nova aba. Para outros links, abre direto.
 */
export const getViewableUrl = async (url: string): Promise<string> => {
  try {
    for (const bucket of PRIVATE_BUCKETS) {
      const marker = `/storage/v1/object/public/${bucket}/`;
      const markerSigned = `/storage/v1/object/sign/${bucket}/`;
      const idx = url.indexOf(marker);
      const idx2 = url.indexOf(markerSigned);
      if (idx >= 0 || idx2 >= 0) {
        const path = decodeURIComponent(
          (idx >= 0 ? url.slice(idx + marker.length) : url.slice(idx2 + markerSigned.length)).split('?')[0]
        );
        const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 600);
        if (!error && data?.signedUrl) return data.signedUrl;
      }
    }
  } catch { /* usa a URL original */ }
  return url;
};

export const openStoredFile = async (url: string) => {
  // abre a aba já no clique (evita bloqueio de pop-up) e depois aponta para o link assinado
  const win = window.open('about:blank', '_blank');
  const finalUrl = await getViewableUrl(url);
  if (win) win.location.href = finalUrl;
  else window.open(finalUrl, '_blank');
};
