import React, { useEffect, useState } from 'react';
import { callFunction, useAuth } from '../../lib/supabase';
import { X, Loader2, Flag, RefreshCw, Check, CalendarDays } from 'lucide-react';

type Meeting = { id: string; title: string; company: string; start: string; end: string; guests: string[]; proposal: { id: string; status: string } | null };

const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

/** "A reunião acabou": lista as reuniões comerciais de hoje na agenda; ao escolher, o Claude lê as Anotações do Gemini e monta o resumo para aprovar. */
export const MeetingEndedModal: React.FC<{ onClose: () => void; onCreated: () => void }> = ({ onClose, onCreated }) => {
  const { agencyId } = useAuth();
  const [meetings, setMeetings] = useState<Meeting[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [whatsapp, setWhatsapp] = useState('');
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');

  const load = async () => {
    setLoading(true); setErr('');
    const { data, error } = await callFunction<{ meetings: Meeting[] }>('generate-proposal', { action: 'meetings_today', agency_id: agencyId });
    setLoading(false);
    if (error) { setErr(error); return; }
    setMeetings(data?.meetings ?? []);
  };
  useEffect(() => { load(); }, [agencyId]);

  const pick = async (m: Meeting) => {
    setBusyId(m.id); setErr(''); setInfo('');
    const { data, error } = await callFunction<{ pending?: boolean; reason?: string }>('generate-proposal', {
      action: 'summarize_meeting', agency_id: agencyId, event_id: m.id, whatsapp: whatsapp.trim() || undefined,
    });
    setBusyId(null);
    if (error) { setErr(error); return; }
    if (data?.pending) { setInfo(`${data.reason ?? 'As anotações ainda não estão prontas.'} O Gemini costuma levar de 5 a 15 minutos depois do fim da reunião. Tente de novo daqui a pouco.`); return; }
    onCreated();
  };

  const field = 'w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black/5';
  return (
    <div className="fixed inset-0 z-[80] bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-6" onClick={() => !busyId && onClose()}>
      <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-6 space-y-3 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center"><p className="font-bold text-gray-900">A reunião acabou</p>
          <button onClick={load} disabled={loading || !!busyId} className="ml-auto p-2 rounded-xl hover:bg-gray-100 text-gray-500" aria-label="Atualizar"><RefreshCw size={16} className={loading ? 'animate-spin' : ''} /></button>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500"><X size={18} /></button></div>
        <p className="text-xs text-gray-500">Escolha a reunião. O Claude lê as Anotações do Gemini no Drive e monta o resumo para você aprovar (cerca de 30 segundos).</p>
        <label className="block"><span className="block text-xs font-semibold text-gray-600 mb-1.5">WhatsApp de quem recebe (opcional)</span>
          <input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="+55 11 99999-9999" className={field} /></label>

        {loading && <p className="flex items-center gap-2 text-sm text-gray-500"><Loader2 size={15} className="animate-spin" /> Lendo a agenda de hoje...</p>}
        {!loading && meetings && meetings.length === 0 && <p className="text-sm text-gray-500">Nenhuma reunião comercial hoje na agenda (Reunião de Diagnóstico ou Apresentação de Proposta).</p>}
        {!loading && !!meetings?.length && (
          <ul className="space-y-2">
            {meetings.map(m => (
              <li key={m.id} className="rounded-2xl border border-gray-200 p-3 flex items-center gap-3">
                <CalendarDays size={18} className="shrink-0 text-violet-600" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900 truncate">{m.company}</p>
                  <p className="text-xs text-gray-500 truncate">{hora(m.start)} a {hora(m.end)} · {m.title.replace(/^.*\|\s*/, '')}</p>
                </div>
                {m.proposal ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"><Check size={14} /> Já tem resumo</span>
                ) : (
                  <button disabled={!!busyId} onClick={() => pick(m)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-violet-600 text-white text-xs font-semibold disabled:opacity-60">
                    {busyId === m.id ? <Loader2 size={14} className="animate-spin" /> : <Flag size={14} />} {busyId === m.id ? 'Montando...' : 'Montar resumo'}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {info && <p className="text-sm text-amber-700 bg-amber-50 rounded-xl p-3">{info}</p>}
        {err && <p className="text-sm text-rose-600">{err}</p>}
      </div>
    </div>
  );
};
