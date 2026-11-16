import React, { useState } from 'react';
import { supabase, useAuth } from '../../lib/supabase';
import { X, Loader2, Flag } from 'lucide-react';

const slugify = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40) || 'proposta';

/** "A reunião acabou": cria o pedido de resumo. O vigia do Drive acha as Anotações do Gemini e preenche o resumo para aprovar. */
export const MeetingEndedModal: React.FC<{ onClose: () => void; onCreated: () => void }> = ({ onClose, onCreated }) => {
  const { agencyId } = useAuth();
  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const submit = async () => {
    if (!name.trim()) { setErr('Informe a empresa (o mesmo nome do evento da agenda).'); return; }
    setBusy(true); setErr('');
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('proposals').insert({
      slug: `${slugify(name)}-${Math.random().toString(36).slice(2, 6)}`, agency_id: agencyId, prospect_name: name.trim(),
      whatsapp: whatsapp.trim() || null, status: 'summary', summary: null, source: 'Aguardando anotações do Gemini',
      currency: agencyId === 7 ? 'USD' : 'BRL', language: agencyId === 7 ? 'en' : 'pt', created_by: user?.id ?? null,
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    onCreated();
  };
  const field = 'w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black/5';
  return (
    <div className="fixed inset-0 z-[80] bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-6" onClick={() => !busy && onClose()}>
      <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-6 space-y-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-center"><p className="font-bold text-gray-900">A reunião acabou</p><button onClick={onClose} className="ml-auto p-2 rounded-xl hover:bg-gray-100 text-gray-500"><X size={18} /></button></div>
        <p className="text-xs text-gray-500">O Claude busca as Anotações do Gemini desta reunião no Drive e monta o resumo para você aprovar. Leva alguns minutos.</p>
        <label className="block"><span className="block text-xs font-semibold text-gray-600 mb-1.5">Empresa (como está no nome do evento)</span>
          <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Ex.: Donato Advogados" className={field} /></label>
        <label className="block"><span className="block text-xs font-semibold text-gray-600 mb-1.5">WhatsApp de quem recebe (opcional)</span>
          <input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="+55 11 99999-9999" className={field} /></label>
        {err && <p className="text-sm text-rose-600">{err}</p>}
        <div className="flex justify-end">
          <button disabled={busy} onClick={submit} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold disabled:opacity-60">
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Flag size={15} />} Buscar anotações e montar resumo
          </button>
        </div>
      </div>
    </div>
  );
};
