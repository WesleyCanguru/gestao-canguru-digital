import React, { useRef, useState } from 'react';
import { supabase, useAuth } from '../../lib/supabase';
import { AgencyMark } from '../Navigation';
import { Upload, Loader2, Trash2, ImageIcon } from 'lucide-react';

/** Logo da agência: aparece no seletor de agências, no menu e nas páginas públicas (estratégia, propostas). */
export const AgencyBrandCard: React.FC = () => {
  const { agencyId, currentMembership, isMaster, reloadContext } = useAuth();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const canEdit = isMaster || currentMembership?.role === 'master';
  if (!agencyId || !currentMembership || !canEdit) return null;

  const upload = async (file: File) => {
    setMsg(null);
    if (!/^image\/(png|jpe?g|webp|svg\+xml)$/.test(file.type)) { setMsg({ ok: false, text: 'Use PNG, JPG, WEBP ou SVG.' }); return; }
    if (file.size > 2 * 1024 * 1024) { setMsg({ ok: false, text: 'A imagem precisa ter até 2 MB.' }); return; }
    setBusy(true);
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
    const path = `logos/agency-${agencyId}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('post-uploads').upload(path, file, { contentType: file.type, upsert: true });
    if (upErr) { setBusy(false); setMsg({ ok: false, text: `Não foi possível enviar: ${upErr.message}` }); return; }
    const { data } = supabase.storage.from('post-uploads').getPublicUrl(path);
    const { error } = await supabase.from('agencies').update({ logo_url: data.publicUrl }).eq('id', agencyId);
    if (error) { setBusy(false); setMsg({ ok: false, text: error.message }); return; }
    await reloadContext();
    setBusy(false);
    setMsg({ ok: true, text: 'Logo atualizado.' });
  };

  const remove = async () => {
    setBusy(true); setMsg(null);
    const { error } = await supabase.from('agencies').update({ logo_url: null }).eq('id', agencyId);
    if (!error) await reloadContext();
    setBusy(false);
    setMsg(error ? { ok: false, text: error.message } : { ok: true, text: 'Logo removido. Voltam as iniciais.' });
  };

  return (
    <div className="bg-white rounded-3xl border border-black/[0.04] shadow-sm p-6 flex flex-col sm:flex-row sm:items-center gap-5">
      <div className="w-20 h-20 rounded-2xl border border-gray-100 bg-gray-50 flex items-center justify-center overflow-hidden shrink-0">
        {currentMembership.logo_url
          ? <img src={currentMembership.logo_url} alt={currentMembership.agency_name} className="w-full h-full object-contain p-2" />
          : <span className="scale-[2]"><AgencyMark name={currentMembership.agency_name} color={currentMembership.primary_color} /></span>}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-gray-900 flex items-center gap-2"><ImageIcon size={16} /> Logo da {currentMembership.agency_name}</p>
        <p className="text-sm text-gray-500 mt-0.5">Aparece no seletor de agências, no menu e nas páginas que o cliente recebe, como a estratégia. Prefira um logo quadrado, com fundo transparente.</p>
        {msg && <p className={`text-sm mt-2 ${msg.ok ? 'text-emerald-700' : 'text-rose-600'}`}>{msg.text}</p>}
      </div>
      <div className="flex gap-2 shrink-0">
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) upload(f); }} />
        <button disabled={busy} onClick={() => input.current?.click()}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-dark text-white text-sm font-bold disabled:opacity-50">
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} {currentMembership.logo_url ? 'Trocar logo' : 'Enviar logo'}
        </button>
        {currentMembership.logo_url && (
          <button disabled={busy} onClick={remove} className="p-2.5 rounded-xl border border-gray-200 text-gray-500 hover:text-rose-600" title="Remover logo"><Trash2 size={16} /></button>
        )}
      </div>
    </div>
  );
};
