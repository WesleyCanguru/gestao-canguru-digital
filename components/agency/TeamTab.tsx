import React, { useEffect, useState } from 'react';
import { getAppUrl } from '../../lib/appUrl';
import { UserCog, Plus, Loader2, KeyRound, Copy, Check, Link2, ShieldCheck, UserX, UserCheck, X, Pencil, Eye, EyeOff, RefreshCw, Crown, Briefcase, Users, MessageCircle } from 'lucide-react';
import { ActivityHistory } from './ActivityHistory';
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

const ROLE_INFO: { role: Member['role']; title: string; text: string; icon: any }[] = [
  { role: 'master', title: 'Administrador', text: 'Vê e faz tudo, inclusive financeiro, equipe e logins.', icon: Crown },
  { role: 'partner', title: 'Sócio', text: 'Comercial e financeiro conforme as permissões que você marcar.', icon: Briefcase },
  { role: 'team', title: 'Equipe', text: 'Operação do dia a dia. Financeiro só se você liberar.', icon: Users },
];

const RolePicker: React.FC<{ value: Member['role']; onChange: (r: Member['role']) => void; allowMaster: boolean; disabled?: boolean }> = ({ value, onChange, allowMaster, disabled }) => (
  <div className="grid gap-2 sm:grid-cols-3">
    {ROLE_INFO.filter(r => allowMaster || r.role !== 'master').map(r => {
      const active = value === r.role;
      const Icon = r.icon;
      return (
        <button key={r.role} type="button" disabled={disabled} onClick={() => onChange(r.role)}
          className={`relative text-left rounded-2xl border p-4 transition-all disabled:opacity-60 ${active ? 'border-brand-dark bg-brand-dark/[0.03] ring-1 ring-brand-dark' : 'border-gray-200 hover:border-gray-300 bg-white'}`}>
          {active && <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-brand-dark text-white flex items-center justify-center"><Check size={12} /></span>}
          <Icon size={18} className={active ? 'text-brand-dark' : 'text-gray-400'} />
          <p className="font-bold text-sm text-brand-dark mt-2">{r.title}</p>
          <p className="text-[11px] text-gray-500 leading-snug mt-0.5">{r.text}</p>
        </button>
      );
    })}
  </div>
);

const PasswordField: React.FC<{ value: string; onChange: (v: string) => void }> = ({ value, onChange }) => {
  const [show, setShow] = useState(true);
  const [ok, setOk] = useState(false);
  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input value={value} onChange={e => onChange(e.target.value)} type={show ? 'text' : 'password'}
            className={`${INPUT_CLS} font-mono pr-11`} autoComplete="new-password" />
          <button type="button" onClick={() => setShow(v => !v)} title={show ? 'Esconder' : 'Mostrar'}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700">{show ? <EyeOff size={16} /> : <Eye size={16} />}</button>
        </div>
        <button type="button" onClick={() => onChange(genPassword())} title="Gerar outra"
          className="px-3 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50"><RefreshCw size={15} /></button>
        <button type="button" onClick={() => { navigator.clipboard.writeText(value); setOk(true); setTimeout(() => setOk(false), 1500); }} title="Copiar"
          className="px-3 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50">{ok ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} />}</button>
      </div>
      <p className={`text-[11px] ${value.length > 0 && value.length < 8 ? 'text-red-600' : 'text-gray-400'}`}>Mínimo de 8 caracteres.</p>
    </div>
  );
};

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

export const TeamTab: React.FC = () => {
  const { agencyId, currentMembership, userId, isMaster, can } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [clientNames, setClientNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [share, setShare] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const [draft, setDraft] = useState<{ display_name: string; role: Member['role']; permissions: Partial<Record<PermissionKey, boolean>> } | null>(null);
  const [newPwd, setNewPwd] = useState<string | null>(null);
  const [pwdDone, setPwdDone] = useState<string | null>(null);
  const [formPerms, setFormPerms] = useState<Partial<Record<PermissionKey, boolean>>>({ ...ROLE_DEFAULTS.partner });

  const openEdit = (m: Member) => {
    setEditing(m);
    setNewPwd(null);
    setPwdDone(null);
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
    const [{ data: m }, { data: c }] = await Promise.all([
      supabase.from('agency_members').select('*').eq('agency_id', agencyId).order('created_at'),
      supabase.from('clients').select('id, name').eq('agency_id', agencyId),
    ]);
    setMembers((m as Member[]) || []);
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

  const accessMessage = (name: string | null, email: string, password: string, isNew: boolean) =>
    `Olá${name ? `, ${name.split(' ')[0]}` : ''}! ${isNew ? `Seu acesso à Bolsa (${currentMembership?.agency_name}) está pronto.` : 'Sua senha da Bolsa foi trocada.'}\n\nAcesse: ${origin}\nE-mail: ${email}\nSenha: ${password}`;

  const saveNewPassword = async () => {
    if (!editing || !newPwd) return;
    if (newPwd.length < 8) return setMsg({ type: 'err', text: 'A senha precisa de pelo menos 8 caracteres.' });
    setBusy(true); setMsg(null);
    const { error } = await callFunction('admin-users', { action: 'reset_member_password', member_id: editing.id, password: newPwd });
    setBusy(false);
    if (error) return setMsg({ type: 'err', text: error });
    setPwdDone(newPwd);
    setNewPwd(null);
  };

  const create = async () => {
    setMsg(null); setShare(null);
    if (!isEmail(form.email)) return setMsg({ type: 'err', text: 'Informe um e-mail válido.' });
    if (form.password.length < 8) return setMsg({ type: 'err', text: 'A senha precisa de pelo menos 8 caracteres.' });
    setBusy(true);
    const { data, error } = await callFunction<{ user_created: boolean }>('admin-users', {
      action: 'create_member', agency_id: agencyId, email: form.email.trim(), password: form.password,
      display_name: form.display_name.trim() || null, role: form.role, permissions: form.role === 'master' ? ROLE_DEFAULTS.master : formPerms,
    });
    setBusy(false);
    if (error) return setMsg({ type: 'err', text: error });
    if (data?.user_created) {
      setShare(accessMessage(form.display_name.trim() || null, form.email.trim(), form.password, true));
    } else {
      setMsg({ type: 'ok', text: 'Este e-mail já tinha login e agora também acessa esta agência com a mesma senha.' });
    }
    setForm({ email: '', display_name: '', role: 'partner', password: genPassword() });
    setFormPerms({ ...ROLE_DEFAULTS.partner });
    setShowForm(false);
    load();
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
        {can('manage_team') && (
          <button onClick={() => { setShowForm(true); setShare(null); setMsg(null); }}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-dark text-white rounded-xl text-sm font-bold self-start">
            <Plus size={16} /> Adicionar pessoa
          </button>
        )}
      </div>

      <AgencyBrandCard />

      {showForm && (
        <div className="fixed inset-0 z-[120] bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-6" onClick={() => !busy && setShowForm(false)}>
          <div className="bg-white w-full sm:max-w-xl rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-brand-dark text-lg">Adicionar pessoa</h3>
                <p className="text-xs text-gray-500">Cria o login de alguém da {currentMembership?.agency_name}.</p>
              </div>
              <button onClick={() => setShowForm(false)} className="p-2 rounded-xl hover:bg-gray-50 text-gray-400"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-5">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className={LABEL_CLS}>Nome</label>
                  <input value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} placeholder="Ex.: Sarah Camelo" className={INPUT_CLS} />
                </div>
                <div className="space-y-1.5">
                  <label className={LABEL_CLS}>E-mail de acesso</label>
                  <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="nome@cangurudigital.com.br" type="email" className={INPUT_CLS} />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className={LABEL_CLS}>Papel</label>
                <RolePicker value={form.role} allowMaster={isMaster}
                  onChange={role => { setForm(f => ({ ...f, role })); setFormPerms({ ...ROLE_DEFAULTS[role] }); }} />
              </div>
              {form.role !== 'master' && (
                <div className="space-y-1.5">
                  <label className={LABEL_CLS}>Permissões</label>
                  <div className="rounded-2xl border border-gray-100 divide-y divide-gray-50">
                    {PERMS.map(p => (
                      <label key={p.key} className="flex items-center justify-between gap-3 px-4 py-2.5 cursor-pointer">
                        <span className="min-w-0">
                          <span className="text-sm text-gray-800 font-medium">{p.label}</span>
                          {p.hint && <span className="block text-[11px] text-gray-400">{p.hint}</span>}
                        </span>
                        <input type="checkbox" checked={!!formPerms[p.key]} onChange={() => setFormPerms(fp => ({ ...fp, [p.key]: !fp[p.key] }))}
                          className="w-4 h-4 accent-brand-dark shrink-0" />
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <div className="space-y-1.5">
                <label className={LABEL_CLS}>Senha de acesso</label>
                <PasswordField value={form.password} onChange={v => setForm(f => ({ ...f, password: v }))} />
                <p className="text-[11px] text-gray-400">Você pode trocar depois em Editar pessoa.</p>
              </div>
              {msg?.type === 'err' && <p className="text-sm font-bold text-red-600">{msg.text}</p>}
            </div>
            <div className="p-6 border-t border-gray-100 flex gap-3">
              <button onClick={() => setShowForm(false)} className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-bold text-gray-600">Cancelar</button>
              <button disabled={busy} onClick={create} className="flex-1 py-3 bg-brand-dark text-white rounded-xl text-sm font-bold disabled:opacity-60 inline-flex items-center justify-center gap-2">
                {busy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Criar acesso
              </button>
            </div>
          </div>
        </div>
      )}

      {msg && !showForm && !editing && <p className={`text-sm font-bold ${msg.type === 'ok' ? 'text-emerald-700' : 'text-red-600'}`}>{msg.text}</p>}

      {share && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 space-y-2">
          <p className="text-xs font-bold text-emerald-800">Mensagem pronta para enviar</p>
          <pre className="whitespace-pre-wrap text-sm text-emerald-900 font-sans">{share}</pre>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => copy(share, 'share')} className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800">
              {copied === 'share' ? <Check size={13} /> : <Copy size={13} />} Copiar mensagem
            </button>
            <a href={`https://wa.me/?text=${encodeURIComponent(share)}`} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800">
              <MessageCircle size={13} /> Abrir no WhatsApp
            </a>
            <button onClick={() => setShare(null)} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-emerald-800/70">Fechar</button>
          </div>
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
                <RolePicker value={draft.role} allowMaster={isMaster} disabled={editing.user_id === userId}
                  onChange={role => setDraft({ ...draft, role, permissions: { ...ROLE_DEFAULTS[role] } })} />
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
              <div className="space-y-2 pt-1">
                <label className={LABEL_CLS}>Senha</label>
                {pwdDone ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 space-y-2">
                    <p className="text-sm font-bold text-emerald-800">Senha trocada. A nova senha é:</p>
                    <p className="font-mono text-base text-emerald-900 select-all">{pwdDone}</p>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => copy(pwdDone, 'pwd')} className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800">
                        {copied === 'pwd' ? <Check size={13} /> : <Copy size={13} />} Copiar senha
                      </button>
                      <button onClick={() => copy(accessMessage(editing.display_name, editing.email || '', pwdDone, false), 'pwdmsg')} className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800">
                        {copied === 'pwdmsg' ? <Check size={13} /> : <Copy size={13} />} Copiar mensagem para a pessoa
                      </button>
                    </div>
                  </div>
                ) : newPwd !== null ? (
                  <div className="rounded-2xl border border-gray-100 p-4 space-y-3">
                    <PasswordField value={newPwd} onChange={setNewPwd} />
                    <div className="flex gap-2">
                      <button onClick={() => setNewPwd(null)} className="px-3 py-2 border border-gray-200 rounded-xl text-xs font-bold text-gray-600">Cancelar</button>
                      <button disabled={busy} onClick={saveNewPassword} className="px-3 py-2 bg-brand-dark text-white rounded-xl text-xs font-bold disabled:opacity-60">
                        {busy ? 'Salvando...' : 'Salvar nova senha'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setNewPwd(genPassword())} className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50">
                    <KeyRound size={13} /> Definir nova senha
                  </button>
                )}
                <p className="text-[11px] text-gray-400">Por segurança, a senha atual não pode ser vista. Defina uma nova quando precisar.</p>
              </div>
              {msg?.type === 'err' && <p className="text-sm font-bold text-red-600">{msg.text}</p>}
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

      <ActivityHistory agencyId={agencyId} clientNames={clientNames} />
    </div>
  );
};
