import React, { useState } from 'react';
import { callFunction } from '../../lib/supabase';
import { formatMoney } from '../../lib/money';
import { Check, Sparkles, Loader2, X, AlertTriangle, Trash2 } from 'lucide-react';

type Pessoa = { nome?: string; cargo?: string; contato?: string };
export type ProposalSummary = {
  empresa?: string;
  destinatario?: Pessoa;
  decisor?: Pessoa;
  servico?: { nome?: string; escopo?: string[] };
  investimento?: { implantacao?: number | null; mensal?: number | null; observacao?: string };
  opcionais?: { nome: string; valor?: number | null; periodicidade?: 'unico' | 'mensal'; descricao?: string }[];
  prazo?: string;
  validade?: string;
  contexto?: string[];
  pontos_a_confirmar?: string[];
};

const pessoaTxt = (p?: Pessoa) => (p?.nome ? [p.nome, p.cargo].filter(Boolean).join(', ') : 'Não informado');

/** Resumo para aprovar: a equipe confere o essencial e só depois o Claude escreve a página. */
export const ProposalSummaryCard: React.FC<{
  proposal: { id: string; prospect_name: string; currency: string | null; summary?: ProposalSummary | null; summary_instructions?: string | null; source?: string | null };
  onChanged: (msg: string) => void;
  onRemove: () => void;
}> = ({ proposal, onChanged, onRemove }) => {
  const s = proposal.summary || {};
  const [busy, setBusy] = useState<'approve' | 'adjust' | null>(null);
  const [adjusting, setAdjusting] = useState(false);
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const money = (v?: number | null) => (v || v === 0 ? formatMoney(v, proposal.currency) : 'Não há');

  const approve = async () => {
    if (!window.confirm(`Aprovar o resumo e gerar a página da proposta para ${proposal.prospect_name}?`)) return;
    setErr(''); setBusy('approve');
    const { error } = await callFunction('generate-proposal', { action: 'approve_summary', proposal_id: proposal.id });
    setBusy(null);
    if (error) { setErr(error); return; }
    onChanged('Página pronta como rascunho. Clique em Ver para revisar e depois em Publicar.');
  };
  const adjust = async () => {
    if (!text.trim()) return;
    setErr(''); setBusy('adjust');
    const { error } = await callFunction('generate-proposal', { action: 'revise_summary', proposal_id: proposal.id, instructions: text.trim() });
    setBusy(null);
    if (error) { setErr(error); return; }
    setAdjusting(false); setText('');
    onChanged('Resumo atualizado.');
  };

  const Item: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div className="min-w-0"><p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1">{label}</p><div className="text-sm text-gray-900">{children}</div></div>
  );

  if (!proposal.summary) return (
    <div className="mx-5 mb-5 rounded-2xl border border-violet-100 bg-violet-50/40 p-4 sm:p-5 flex flex-wrap items-center gap-3">
      <Loader2 size={16} className="animate-spin text-violet-600" />
      <p className="text-sm text-violet-900 flex-1 min-w-0">Buscando as anotações do Gemini e montando o resumo. Leva alguns minutos depois que a reunião termina.</p>
      <button onClick={onRemove} className="p-2 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50" aria-label="Cancelar pedido"><Trash2 size={15} /></button>
    </div>
  );

  return (
    <div className="mx-5 mb-5 rounded-2xl border border-violet-100 bg-violet-50/40 p-4 sm:p-5 space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <Item label="Para quem">
          <p>{pessoaTxt(s.destinatario)}{s.empresa ? <span className="text-gray-500"> · {s.empresa}</span> : null}</p>
          {s.destinatario?.contato && <p className="text-xs text-gray-500">{s.destinatario.contato}</p>}
          <p className="text-xs text-gray-600 mt-1">Decisor: {pessoaTxt(s.decisor)}</p>
        </Item>
        <Item label="Serviço">
          <p className="font-semibold">{s.servico?.nome || 'Não informado'}</p>
          {!!s.servico?.escopo?.length && <ul className="mt-1 list-disc pl-4 text-xs text-gray-700 space-y-0.5">{s.servico.escopo.map((e, i) => <li key={i}>{e}</li>)}</ul>}
        </Item>
        <Item label="Investimento">
          <p>Implantação: <span className="font-semibold">{money(s.investimento?.implantacao)}</span></p>
          <p>Mensal: <span className="font-semibold">{money(s.investimento?.mensal)}</span></p>
          {s.investimento?.observacao && <p className="text-xs text-gray-500 mt-1">{s.investimento.observacao}</p>}
        </Item>
        <Item label="Opcionais">
          {s.opcionais?.length ? (
            <ul className="space-y-1">{s.opcionais.map((o, i) => (
              <li key={i} className="text-sm">{o.nome}{o.valor || o.valor === 0 ? <span className="font-semibold">: {money(o.valor)}{o.periodicidade === 'mensal' ? '/mês' : ''}</span> : null}
                {o.descricao && <span className="block text-xs text-gray-500">{o.descricao}</span>}</li>
            ))}</ul>
          ) : <p className="text-gray-500">Nenhum</p>}
        </Item>
        <Item label="Prazo e validade">
          <p>{s.prazo || 'Não informado'}</p>
          <p className="text-xs text-gray-600 mt-1">Validade: {s.validade || 'Não informada'}</p>
        </Item>
        <Item label="Pontos a confirmar">
          {s.pontos_a_confirmar?.length ? (
            <ul className="space-y-1">{s.pontos_a_confirmar.map((p, i) => <li key={i} className="flex gap-1.5 text-sm text-amber-900"><AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-500" />{p}</li>)}</ul>
          ) : <p className="text-gray-500">Nada pendente</p>}
        </Item>
      </div>
      {!!s.contexto?.length && (
        <details className="text-sm text-gray-700"><summary className="cursor-pointer text-xs font-semibold text-gray-500">O que o cliente contou</summary>
          <ul className="mt-2 list-disc pl-5 space-y-0.5">{s.contexto.map((c, i) => <li key={i}>{c}</li>)}</ul></details>
      )}
      {proposal.summary_instructions && <p className="text-xs text-gray-500">Último ajuste pedido: {proposal.summary_instructions}</p>}
      {proposal.source && <p className="text-[11px] text-gray-400">Origem: {proposal.source}</p>}

      {adjusting && (
        <div className="space-y-2">
          <textarea rows={4} autoFocus value={text} onChange={e => setText(e.target.value)} placeholder="Ex.: mensal de R$ 2.500, implantação de R$ 1.500, tirar o opcional de Google, validade até sexta"
            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-black/5" />
          <div className="flex justify-end gap-2">
            <button disabled={!!busy} onClick={() => setAdjusting(false)} className="px-3 py-2 rounded-lg text-xs font-semibold text-gray-500"><X size={13} className="inline" /> Cancelar</button>
            <button disabled={!!busy || !text.trim()} onClick={adjust} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-900 text-white text-xs font-semibold disabled:opacity-50">
              {busy === 'adjust' ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} {busy === 'adjust' ? 'Reescrevendo...' : 'Reescrever resumo'}
            </button>
          </div>
        </div>
      )}
      {err && <p className="text-sm text-rose-600">{err}</p>}
      {!adjusting && (
        <div className="flex flex-wrap items-center gap-2 justify-end">
          <button onClick={onRemove} disabled={!!busy} className="mr-auto p-2 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50" aria-label="Excluir resumo"><Trash2 size={15} /></button>
          <button disabled={!!busy} onClick={() => { setAdjusting(true); setText(''); }} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 disabled:opacity-50"><Sparkles size={15} /> Ajustar</button>
          <button disabled={!!busy} onClick={approve} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold disabled:opacity-60">
            {busy === 'approve' ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} {busy === 'approve' ? 'Gerando a página (cerca de 1 minuto)...' : 'Aprovar e gerar página'}
          </button>
        </div>
      )}
    </div>
  );
};
