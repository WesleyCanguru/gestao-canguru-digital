import React, { useMemo, useState } from 'react';
import { AgencyCRM, AgencyLead } from '../../types';
import { computeFollowUp, FollowUpDue, renderFollowUpTemplate, whatsappLink } from '../../lib/followups';
import type { LeadFollowUpRow } from '../../hooks/useLeadFollowUps';

interface FollowUpPanelProps {
  crm: AgencyCRM;
  leads: AgencyLead[];
  history: LeadFollowUpRow[];
  onRecord: (lead: AgencyLead, due: FollowUpDue, outcome: 'feito' | 'pulado') => Promise<void>;
  onReplied: (lead: AgencyLead) => Promise<void>;
  onLose: (lead: AgencyLead) => Promise<void>;
  onOpenLead: (lead: AgencyLead) => void;
}

const fmtDay = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

export const FollowUpPanel: React.FC<FollowUpPanelProps> = ({ crm, leads, history, onRecord, onReplied, onLose, onOpenLead }) => {
  const [open, setOpen] = useState(true);
  const [showUpcoming, setShowUpcoming] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<string | null>(null);

  const items = useMemo(() => {
    const today = new Date();
    return leads
      .map(lead => ({ lead, due: computeFollowUp(lead, crm.kanban_stages, history, today) }))
      .filter((x): x is { lead: AgencyLead; due: FollowUpDue } => !!x.due);
  }, [leads, history, crm.kanban_stages]);

  const hasCadence = crm.kanban_stages.some(s => s.followup);
  if (!hasCadence) return null;

  const dueNow = items
    .filter(x => x.due.status !== 'proximo')
    .sort((a, b) => b.due.daysLate - a.due.daysLate || a.lead.name.localeCompare(b.lead.name));
  const weekAhead = new Date(); weekAhead.setDate(weekAhead.getDate() + 7);
  const upcoming = items
    .filter(x => x.due.status === 'proximo' && x.due.dueAt <= weekAhead)
    .sort((a, b) => a.due.dueAt.getTime() - b.due.dueAt.getTime());
  const late = dueNow.filter(x => x.due.status === 'atrasado').length;

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try { await fn(); } catch (e) { console.error(e); alert('Não consegui salvar. Tente de novo.'); } finally { setBusy(null); }
  };

  const copy = async (key: string, text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(null), 1500); } catch { /* sem clipboard */ }
  };

  const renderItem = ({ lead, due }: { lead: AgencyLead; due: FollowUpDue }, compact = false) => {
    const key = `${lead.id}:${due.stageName}:${due.step}`;
    const text = edits[key] ?? (due.template ? renderFollowUpTemplate(due.template, lead) : '');
    const link = text ? whatsappLink(lead, text) : null;
    const chip = due.status === 'atrasado'
      ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-100">atrasado {due.daysLate}d</span>
      : due.status === 'hoje'
        ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100">hoje</span>
        : <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{fmtDay(due.dueAt)}</span>;
    return (
      <div key={key} className="p-4 rounded-2xl border border-gray-100 bg-white space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => onOpenLead(lead)} className="font-bold text-sm text-gray-900 hover:underline text-left">{lead.name}</button>
          {chip}
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-50 text-slate-600 border border-slate-100">{due.stageName}</span>
          <span className="text-[11px] text-gray-500 font-medium">
            {due.isEnd ? 'Sem resposta depois dos follow-ups' : due.isReturn ? `Retomar em ${fmtDay(due.dueAt)}` : `${due.label} · ${due.step + 1} de ${due.total}`}
          </span>
        </div>
        {due.isReturn && lead.form_data?.retomar_nota && (
          <p className="text-xs text-gray-600 bg-sky-50 border border-sky-100 rounded-xl px-3 py-2">📝 {String(lead.form_data.retomar_nota)}</p>
        )}
        {!compact && !due.isEnd && text && (
          <textarea
            value={text}
            onChange={e => setEdits(prev => ({ ...prev, [key]: e.target.value }))}
            rows={Math.min(6, Math.max(2, Math.ceil(text.length / 70)))}
            className="w-full text-sm text-gray-800 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-neutral-200"
          />
        )}
        {!compact && (
          <div className="flex flex-wrap gap-2">
            {due.isEnd ? (
              <>
                <button disabled={busy === key} onClick={() => run(key, () => onLose(lead))} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">Marcar perdido (Não respondeu)</button>
                <button disabled={busy === key} onClick={() => run(key, () => onRecord(lead, due, 'pulado'))} className="text-xs font-bold px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50">Manter na etapa</button>
              </>
            ) : (
              <>
                {link && (
                  <a href={link} target="_blank" rel="noopener noreferrer" className="text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700">Abrir WhatsApp</a>
                )}
                {text && (
                  <button onClick={() => copy(key, text)} className="text-xs font-bold px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50">{copied === key ? 'Copiado' : 'Copiar'}</button>
                )}
                <button disabled={busy === key} onClick={() => run(key, () => onRecord(lead, due, 'feito'))} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-neutral-900 text-white hover:bg-neutral-700 disabled:opacity-50">Feito ✓</button>
                <button disabled={busy === key} onClick={() => run(key, () => onReplied(lead))} className="text-xs font-bold px-3 py-1.5 rounded-lg border border-violet-200 text-violet-700 hover:bg-violet-50 disabled:opacity-50">Respondeu</button>
                <button disabled={busy === key} onClick={() => run(key, () => onRecord(lead, due, 'pulado'))} className="text-xs font-semibold px-3 py-1.5 rounded-lg text-gray-500 hover:bg-gray-50 disabled:opacity-50">Pular</button>
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="px-6 py-3 bg-white border-t border-gray-100">
      <div className="rounded-2xl border border-amber-200/80 bg-amber-50/40">
        <button onClick={() => setOpen(o => !o)} className="w-full flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-left">
          <span className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <span>📬</span> Follow-ups de hoje
            <span className="text-xs font-black px-2 py-0.5 rounded-full bg-amber-500 text-white">{dueNow.length}</span>
            {late > 0 && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">{late} atrasados</span>}
          </span>
          <span className="text-xs text-gray-500 font-medium">{upcoming.length} nos próximos 7 dias · {open ? 'recolher' : 'abrir'}</span>
        </button>
        {open && (
          <div className="px-4 pb-4 space-y-3">
            {dueNow.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhum follow-up para hoje. 🎉</p>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">{dueNow.map(x => renderItem(x))}</div>
            )}
            {upcoming.length > 0 && (
              <div>
                <button onClick={() => setShowUpcoming(s => !s)} className="text-xs font-bold text-gray-600 hover:text-gray-900">
                  {showUpcoming ? 'Esconder' : 'Ver'} os próximos 7 dias ({upcoming.length})
                </button>
                {showUpcoming && <div className="grid gap-2 lg:grid-cols-2 mt-2">{upcoming.map(x => renderItem(x, true))}</div>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
