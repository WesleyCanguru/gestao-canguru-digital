import { supabase } from './supabase';

export type PdfImportKind = 'calendario' | 'temas' | 'trafego';

export const fileToBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = (e) => reject(e);
  });

// Lê o PDF com o Claude (edge function import-pdf) e devolve os dados estruturados.
export async function readPdfWithClaude<T = any>(kind: PdfImportKind, clientId: string, pdfBase64: string, extra: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke('import-pdf', {
    body: { kind, client_id: clientId, pdf_base64: pdfBase64, ...extra },
  });
  if (error) {
    let msg = error.message;
    try { msg = (await (error as any).context?.json())?.error || msg; } catch { /* mantém a mensagem */ }
    throw new Error(msg || 'Erro ao ler o PDF.');
  }
  if (!data?.ok) throw new Error(data?.error || 'Erro ao ler o PDF.');
  return data.data as T;
}
