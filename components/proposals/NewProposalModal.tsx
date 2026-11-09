import React, { useRef, useState } from 'react';
import { callFunction, useAuth } from '../../lib/supabase';
import { CURRENCIES } from '../../lib/money';
import { parseCurrencyInput } from '../../lib/currencyUtils';
import { X, Loader2, Sparkles, FileUp, Trash2 } from 'lucide-react';

/** Nova proposta: cola o resumo/transcrição da reunião (ou sobe o PDF) e o Claude escreve a página. */
export const NewProposalModal: React.FC<{ onClose: () => void; onCreated: (p: any) => void }> = ({ onClose, onCreated }) => {
  const { agencyId } = useAuth();
  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [currency, setCurrency] = useState(agencyId === 7 ? 'USD' : 'BRL');
  const [language, setLanguage] = useState(agencyId === 7 ? 'en' : 'pt');
  const [notes, setNotes] = useState('');
  const [monthly, setMonthly] = useState('');
  const [setup, setSetup] = useState('');
  const [pdf, setPdf] = useState<{ name: string; b64: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const pickPdf = (f: File) => {
    setErr('');
    if (f.type !== 'application/pdf') { setErr('Envie um arquivo PDF.'); return; }
    if (f.size > 10 * 1024 * 1024) { setErr('O PDF precisa ter até 10 MB.'); return; }
    const r = new FileReader();
    r.onload = () => setPdf({ name: f.name, b64: String(r.result).split(',')[1] || '' });
    r.readAsDataURL(f);
  };

  const submit = async () => {
    setErr('');
    if (!name.trim()) { setErr('Informe o nome do cliente ou da empresa.'); return; }
    if (!notes.trim() && !pdf) { setErr('Cole o resumo da reunião ou envie o PDF.'); return; }
    setBusy(true);
    const { data, error } = await callFunction<{ proposal: any }>('generate-proposal', {
      action: 'create', agency_id: agencyId, prospect_name: name.trim(), whatsapp: whatsapp.trim(), currency, language,
      notes: notes.trim(), pdf_base64: pdf?.b64, monthly_value: parseCurrencyInput(monthly) || null, setup_value: parseCurrencyInput(setup) || null,
    });
    setBusy(false);
    if (error || !data?.proposal) { setErr(error || 'Não foi possível gerar.'); return; }
    onCreated(data.proposal);
  };

  const field = 'w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-black/5';
  const label = 'block text-xs font-semibold text-gray-600 mb-1.5';
  return (
    <div className="fixed inset-0 z-[80] bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-6" onClick={() => !busy && onClose()}>
      <div className="bg-white w-full max-w-2xl max-h-[94vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <div><p className="font-bold text-gray-900">Nova proposta</p><p className="text-xs text-gray-500">O Claude escreve a página a partir do que vocês conversaram. Sai como rascunho para você revisar.</p></div>
          <button disabled={busy} onClick={onClose} className="ml-auto p-2 rounded-xl hover:bg-gray-100 text-gray-500"><X size={18} /></button>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block"><span className={label}>Cliente ou empresa</span><input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Ex.: Clínica Sorriso" className={field} /></label>
          <label className="block"><span className={label}>WhatsApp do cliente (opcional)</span><input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="+55 11 99999-9999" className={field} /></label>
        </div>
        <label className="block">
          <span className={label}>O que vocês conversaram</span>
          <textarea rows={9} value={notes} onChange={e => setNotes(e.target.value)} className={field}
            placeholder="Cole aqui o resumo ou a transcrição da reunião (Wispr Flow, anotações, áudio transcrito pelo celular). Quanto mais detalhe sobre o negócio, o que o cliente quer e o que foi combinado, melhor." />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) pickPdf(f); }} />
          {pdf ? (
            <span className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-700">
              <FileUp size={15} /> {pdf.name}
              <button onClick={() => setPdf(null)} className="text-gray-400 hover:text-rose-600"><Trash2 size={14} /></button>
            </span>
          ) : (
            <button onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700"><FileUp size={15} /> Anexar PDF da reunião (opcional)</button>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <label className="block"><span className={label}>Moeda</span>
            <select value={currency} onChange={e => setCurrency(e.target.value)} className={`${field} bg-white`}>{CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}</select></label>
          <label className="block"><span className={label}>Mensalidade</span><input inputMode="decimal" value={monthly} onChange={e => setMonthly(e.target.value)} placeholder="Opcional" className={field} /></label>
          <label className="block"><span className={label}>Implantação</span><input inputMode="decimal" value={setup} onChange={e => setSetup(e.target.value)} placeholder="Opcional" className={field} /></label>
          <label className="block"><span className={label}>Idioma</span>
            <select value={language} onChange={e => setLanguage(e.target.value)} className={`${field} bg-white`}><option value="pt">Português</option><option value="en">English</option><option value="es">Español</option></select></label>
        </div>
        <p className="text-[11px] text-gray-400">Sem valores, o Claude sugere e marca como ponto a confirmar. Áudio: transcreva antes (Wispr Flow ou o ditado do celular) e cole o texto.</p>
        {err && <p className="text-sm text-rose-600">{err}</p>}
        <div className="flex justify-end gap-2">
          <button disabled={busy} onClick={onClose} className="px-4 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700">Cancelar</button>
          <button disabled={busy} onClick={submit} className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gray-900 text-white text-sm font-semibold disabled:opacity-60">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} {busy ? 'O Claude está escrevendo (cerca de 1 minuto)...' : 'Gerar proposta com o Claude'}
          </button>
        </div>
      </div>
    </div>
  );
};
