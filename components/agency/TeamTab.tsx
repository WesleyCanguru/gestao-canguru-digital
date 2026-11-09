import React, { useEffect, useState } from 'react';
import { getAppUrl } from '../../lib/appUrl';
import { UserCog, Plus, Loader2, KeyRound, Copy, Check, Link2, ShieldCheck, History, UserX, UserCheck, X, Pencil } from 'lucide-react';
import { supabase, callFunction, useAuth, PermissionKey } from '../../lib/supabase';
import { AgencyBrandCard } from './AgencyBrandCard';
import dayjs from 'dayjs';

interface Member {
  id: string;
  user_id: string;
  agency_id: number;
  role: 'master' | 'partner' | 'team';
  permissions: Partial<Record<PermissionKey, boolean>>;
  display_name: string | null;
  email: string | null;
  ref_code: string | null;
  is_active: boolean;
}

interface LogRow {
  id: number;
  actor_name: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  client_id: string | null;
  details: any;
  created_at: string;
}

const PERMS: { key: PermissionKey; label: string; hint: string }[] = [
  { key: 'view_finance', label: 'Ver financeiro e metas', hint: 'Receitas, despesas, MRR' },
  { key: 'edit_finance', label: 'Lançar receitas e despesas', hint: 'Criar, editar e dar baixa' },
  { key: 'edit_contracts', label: 'Editar valores e contratos', hint: 'Mensalidade, vencimento, contrato assinado' },
  { key: 'manage_clients', label: 'Cadastrar e editar clientes', hint: 'Dados, serviços, módulos, logins' },
  { key: 'delete_clients', label: 'Excluir ou cancelar clientes', hint: '' },
  { key: 'send_signup_links', label: 'Enviar links de cadastro', hint: 'Copiar e mandar o link de cadastro para novos clientes' },
  { key: 'manage_proposals', label: 'Criar e enviar propostas', hint: '' },
  { key: 'manage_crm', label: 'Movimentar o CRM comercial', hint: '' },
  { key: 'manage_team', label: 'Gerenciar equipe e logins', hint: 'Só para quem administra a agência' },
];

const ROLE_DEFAULTS: Record<Member['role'], Partial<Record<PermissionKey, boolean>>> = {
  master: Object.fromEntries(PERMS.map(p => [p.key, true])),
  partner: { view_finance: true, send_signup_links: true, manage_proposals: true, manage_crm: true },
  team: {},
};

const PERM_GROUPS: { title: string; keys: PermissionKey[] }[] = [
  { title: 'Comercial', keys: ['send_signup_links', 'manage_proposals', 'manage_crm'] },
  { title: 'Financeiro e contratos', keys: ['view_finance', 'edit_finance', 'edit_contracts'] },
  { title: 'Clientes', keys: ['manage_clients', 'delete_clients'] },
  { title: 'Administração', keys: ['manage_team'] },
];

const LABEL_CLS = 'text-[10px] font-bold uppercase tracking-widest text-gray-500';
const INPUT_CLS = 'w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-brand-dark/20 outline-none';

const ROLE_LABEL: Record<Member['role'], string> = { master: 'Administrador', partner: 'Sócio', team: 'Equipe' };

const genPassword = () => {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(10))).map(b => chars[b % chars.length]).join('');
};

const ENTITY_LABEL: Record<string, string> = {
  clients: 'cliente', contract_forms: 'contrato', agency_billing: 'faturamento', agency_expenses: 'despesa',
  agency_members: 'equipe', client_members: 'login de cliente', client_credentials: 'cofre de senhas',
};
const ACTION_LABEL: Record<string, string> = { insert: 'criou', update: 'alterou', delete: 'excluiu', view_as: 'visualizou como' };

export const TeamTab: React.FC = () => {
  const { agencyId, currentMembership, userId, isMaster, can } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [clientNames, setClientNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [share, setShare] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const [draft, setDraft] = useState<{ display_name: string; role: Member['role']; permissions: Partial<Record<PermissionKey, boolean>> } | null>(null);

  const openEdit = (m: Member) => {
    setEditing(m);
    setDraft({
      display_name: m.display_name || '',
      role: m.role,
      permissions: Object.fromEntries(PERMS.map(p => [p.key, m.role === 'master' ? true : (m.permissions?.[p.key] ?? ROLE_DEFAULTS[m.role]?.[p.key] ?? false)])),
    });
  };

  const saveEdit = async () => {
    if (!editing || !draft) return;
    setBusy(true); setMsg(null);
    const { error } = await callFunction('admin-users', {
      action: 'update_member', member_id: editing.id,
      display_name: draft.display_name.trim(), role: draft.role, permissions: draft.permissions,
    });
    setBusy(false);
    if (error) return setMsg({ type: 'err', text: error });
    setEditing(null);
    setMsg({ type: 'ok', text: 'Alterações salvas.' });
    load();
  };
  const [form, setForm] = useState({ email: '', display_name: '', role: 'partner' as Member['role'], password: genPassword() });

  const load = async () => {
    if (!agencyId) return;
    setLoading(true);
    const [{ data: m }, { data: l }, { data: c }] = await Promise.all([
      supabase.from('agency_members').select('*').eq('agency_id', agencyId).order('created_at'),
      supabase.from('activity_log').select('*').eq('agency_id', agencyId).order('created_at', { ascending: false }).limit(60),
      supabase.from('clients').select('id, name').eq('agency_id', agencyId),
    ]);
    setMembers((m as Member[]) || []);
    setLogs((l as LogRow[]) || []);
    setClientNames(Object.fromEntries(((c as any[]) || []).map(x => [x.id, x.name])));
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [agencyId]);

  const origin = getAppUrl();
  const signupLink = (_ref?: string | null) => `${origin}/cadastro?agency=${currentMembership?.slug ?? ''}`;

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const effective = (m: Member, k: PermissionKey) =>
    m.role === 'master' ? true : (m.permissions?.[k] ?? ROLE_DEFAULTS[m.role]?.[k] ?? false);

  const updateMember = async (m: Member, patch: Partial<Member>) => {
    setBusy(true); setMsg(null);
    const { error } = await callFunction('admin-users', { action: 'update_member', member_id: m.id, ...patch });
    setBusy(false);
    if (error) return setMsg({ type: 'err', text: error });
    load();
  };

  const togglePerm = (m: Member, k: PermissionKey) => {
    const next = { ...(m.permissions || {}) } as Record<string, boolean>;
    next[k] = !effective(m, k);
    updateMember(m, { permissions: next });
  };

  const resetPassword = async (m: Member) => {
    if (!window.confirm(`Gerar uma nova senha provisória para ${m.display_name || m.email}?`)) return;
    const p = genPassword();
    setBusy(true);
    const { error } = await callFunction('admin-users', { action: 'reset_member_password', member_id: m.id, password: p });
    setBusy(false);
    if (error) return setMsg({ type: 'err', text: error });
    setShare(`Seu acesso à Bolsa foi atualizado.\n\nAcesse: ${origin}\nE-mail: ${m.email}\nSenha provisória: ${p}`);
  };

  const create = async () => {
    setMsg(null); setShare(null);
    if (!form.email.trim()) return setMsg({ type: 'err', text: 'Informe o e-mail.' });
    setBusy(true);
    const { data, error } = await callFunction<{ user_created: boolean }>('admin-users', {
      action: 'create_member', agency_id: agencyId, email: form.email.trim(), password: form.password,
      display_name: form.display_name.trim() || null, role: form.role, permissions: ROLE_DEFAULTS[form.role],
    });
    setBusy(false);
    if (error) return setMsg({ type: 'err', text: error });
    if (data?.user_created) {
      setShare(`Olá${form.display_name ? `, ${form.display_name.split(' ')[0]}` : ''}! Seu acesso à Bolsa (${currentMembership?.agency_name}) está pronto.\n\nAcesse: ${origin}\nE-mail: ${form.email.trim()}\nSenha provisória: ${form.password}`);
    } else {
      setMsg({ type: 'ok', text: 'Este e-mail já tinha login e agora também acessa esta agência com a mesma senha.' });
    }
    setForm({ email: '', display_name: '', role: 'partner', password: genPassword() });
    setShowForm(false);
    load();
  };

  const describeLog = (l: LogRow) => {
    const who = l.actor_name || 'Alguém';
    const act = ACTION_LABEL[l.action] || l.action;
    const ent = ENTITY_LABEL[l.entity] || l.entity;
    const cname = l.client_id ? clientNames[l.client_id] : null;
    const fields = l.details && typeof l.details === 'object' ? Object.keys(l.details).slice(0, 4).join(', ') : '';
    if (l.action === 'view_as') return `${who} visualizou o painel como ${cname || 'cliente'}`;
    return `${who} ${act} ${ent}${cname ? ` · ${cname}` : ''}${fields ? ` (${fields})` : ''}`;
  };

  if (!agencyId) return null;

  return (
    <div className="space-y-8 pb-16">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-brand-dark">
            <UserCog size={22} />
            <h1 className="text-2xl font-bold tracking-tight">Equipe & Acessos</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">Quem acessa a {currentMembership?.agency_name}, o que cada um pode fazer e o histórico de alterações.</p>
        </div>
        <button onClick={() => setShowForm(v => !v)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-dark text-white rounded-xl text-sm font-bold self-start">
          {showForm ? <X size={16} /> : <Plus size={16} />} {showForm ? 'Fechar' : 'Adicionar pessoa'}
        </button>
      </div>

      <AgencyBrandCard />

      {showForm && (
        <div className="bg-white rounded-3xl border border-black/[0.04] shadow-sm p-6 space-y-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <input value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} placeholder="Nome"
              className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm" />
            <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="E-mail" type="email"
              className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm" />
            <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as Member['role'] }))}
              className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white">
              <option value="partner">Sócio</option>
              <option value="team">Equipe</option>
              {isMaster && <option value="master">Administrador</option>}
            </select>
            <input value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Senha provisória"
              className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm font-mono" />
          </div>
          <p className="text-xs text-gray-500">As permissões começam pelo padrão do papel e você ajusta depois, pessoa por pessoa.</p>
          <button disabled={busy} onClick={create} className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-dark text-white rounded-xl text-sm font-bold disabled:opacity-60">
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Criar acesso
          </button>
        </div>
      )}

      {msg && <p className={`text-sm font-bold ${msg.type === 'ok' ? 'text-emerald-700' : 'text-red-600'}`}>{msg.text}</p>}

      {share && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 space-y-2">
          <p className="text-xs font-bold text-emerald-800">Mensagem pronta para enviar</p>
          <pre className="whitespace-pre-wrap text-sm text-emerald-900 font-sans">{share}</pre>
          <button onClick={() => copy(share, 'share')} className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800">
            {copied === 'share' ? <Check size={13} /> : <Copy size={13} />} Copiar
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-300" /></div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {members.map(m => {
            const isSelf = m.user_id === userId;
            const enabled = PERMS.filter(p => effective(m, p.key));
            return (
              <div key={m.id} className={`bg-white rounded-3xl border border-black/[0.04] shadow-sm p-6 flex flex-col gap-4 ${m.is_active ? '' : 'opacity-60'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-brand-dark truncate">{m.display_name || m.email} {isSelf && <span className="text-xs text-gray-400 font-medium">(você)</span>}</p>
                    <p className="text-xs text-gray-500 truncate">{m.email}</p>
                  </div>
                  <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                    {ROLE_LABEL[m.role]}{m.is_active ? '' : ' · inativo'}
                  </span>
                </div>

                {m.role === 'master' ? (
                  <p className="text-xs text-gray-500 flex items-center gap-1.5"><ShieldCheck size={14} /> Acesso total a esta agência.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {enabled.length === 0 && <span className="text-xs text-gray-400">Só operação (tarefas, conteúdo, clientes)</span>}
                    {enabled.map(p => (
                      <span key={p.key} className="text-[11px] font-medium px-2 py-1 rounded-lg bg-slate-50 border border-slate-100 text-slate-600">{p.label}</span>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-1 mt-auto">
                  {(!isSelf || isMaster) && (
                    <button disabled={busy} onClick={() => openEdit(m)} className="inline-flex items-center gap-1.5 px-3 py-2 bg-brand-dark text-white rounded-xl text-xs font-bold hover:bg-black">
                      <Pencil size={13} /> Editar pessoa
                    </button>
                  )}
                  {!isSelf && (
                    <>
                      <button disabled={busy} onClick={() => resetPassword(m)} className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50">
                        <KeyRound size={13} /> Nova senha
                      </button>
                      <button disabled={busy} onClick={() => updateMember(m, { is_active: !m.is_active })} className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50">
                        {m.is_active ? <><UserX size={13} /> Desativar</> : <><UserCheck size={13} /> Reativar</>}
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Link de cadastro da agência */}
      {can('send_signup_links') && (
        <div className="bg-white rounded-3xl border border-black/[0.04] shadow-sm p-6">
          <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1"><Link2 size={12} /> Link de cadastro de novos clientes</p>
          <div className="flex items-center gap-2">
            <code className="text-xs text-slate-700 truncate flex-1 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5">{signupLink()}</code>
            <button onClick={() => copy(signupLink(), 'signup')} className="inline-flex items-center gap-1.5 px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold shrink-0">
              {copied === 'signup' ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />} Copiar
            </button>
          </div>
        </div>
      )}

      {editing && draft && (
        <div className="fixed inset-0 z-[120] bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-6" onClick={() => setEditing(null)}>
          <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-brand-dark text-lg">Editar pessoa</h3>
              <button onClick={() => setEditing(null)} className="p-2 rounded-xl hover:bg-gray-50 text-gray-400"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-5">
              <div className="space-y-1.5">
                <label className={LABEL_CLS}>Nome completo</label>
                <input value={draft.display_name} onChange={e => setDraft({ ...draft, display_name: e.target.value })} className={INPUT_CLS} />
              </div>
              <div className="space-y-1.5">
                <label className={LABEL_CLS}>E-mail de acesso</label>
                <input value={editing.email || ''} disabled className={`${INPUT_CLS} opacity-60`} />
              </div>
              <div className="space-y-1.5">
                <label className={LABEL_CLS}>Papel</label>
                <select value={draft.role} disabled={editing.user_id === userId}
                  onChange={e => {
                    const role = e.target.value as Member['role'];
                    setDraft({ ...draft, role, permissions: { ...ROLE_DEFAULTS[role] } });
                  }} className={INPUT_CLS}>
                  <option value="partner">Sócio</option>
                  <option value="team">Equipe</option>
                  {isMaster && <option value="master">Administrador (acesso total)</option>}
                </select>
              </div>
              {draft.role !== 'master' && (
                <div className="space-y-4">
                  {PERM_GROUPS.map(g => (
                    <div key={g.title}>
                      <p className={`${LABEL_CLS} mb-1`}>{g.title}</p>
                      <div className="rounded-2xl border border-gray-100 divide-y divide-gray-50">
                        {PERMS.filter(p => g.keys.includes(p.key)).map(p => (
                          <label key={p.key} className="flex items-center justify-between gap-3 px-4 py-3 cursor-pointer">
                            <span className="min-w-0">
                              <span className="text-sm text-gray-800 font-medium">{p.label}</span>
                              {p.hint && <span className="block text-[11px] text-gray-400">{p.hint}</span>}
                            </span>
                            <input type="checkbox" checked={!!draft.permissions[p.key]}
                              onChange={() => setDraft({ ...draft, permissions: { ...draft.permissions, [p.key]: !draft.permissions[p.key] } })}
                              className="w-4 h-4 accent-brand-dark shrink-0" />
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-6 border-t border-gray-100 flex gap-3">
              <button onClick={() => setEditing(null)} className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-bold text-gray-600">Cancelar</button>
              <button disabled={busy} onClick={saveEdit} className="flex-1 py-3 bg-brand-dark text-white rounded-xl text-sm font-bold disabled:opacity-60">
                {busy ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-3xl border border-black/[0.04] shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4 text-brand-dark">
          <History size={18} /><h2 className="font-bold">Histórico de atividade</h2>
        </div>
        {logs.length === 0 ? (
          <p className="text-sm text-gray-500">Nada registrado ainda. As alterações em clientes, contratos, financeiro e equipe aparecem aqui.</p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {logs.map(l => (
              <li key={l.id} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span className="text-sm text-gray-700">{describeLog(l)}</span>
                <span className="text-xs text-gray-400 shrink-0">{dayjs(l.created_at).format('DD/MM HH:mm')}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
