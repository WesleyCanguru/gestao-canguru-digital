import React, { useEffect, useState } from 'react';
import { Eye, KeyRound, Loader2, Mail, Plus, ShieldCheck, UserX, UserCheck, Copy, Check } from 'lucide-react';
import { supabase, callFunction, useAuth } from '../../lib/supabase';

interface Member {
  id: string;
  email: string | null;
  display_name: string | null;
  is_active: boolean;
  created_at: string;
}

const genPassword = () => {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(10))).map(b => chars[b % chars.length]).join('');
};

/** Logins do cliente no portal: criar, redefinir senha, desativar e ver como cliente. */
export const ClientAccessPanel: React.FC<{
  clientId: string;
  clientName: string;
  defaultEmail?: string;
  onViewAs: () => void;
}> = ({ clientId, clientName, defaultEmail, onViewAs }) => {
  const { can } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState(defaultEmail || '');
  const [name, setName] = useState('');
  const [password, setPassword] = useState(genPassword());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [shareText, setShareText] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const canCreate = can('manage_clients') || can('send_signup_links');
  const canManage = can('manage_clients');

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('client_members')
      .select('id, email, display_name, is_active, created_at')
      .eq('client_id', clientId).order('created_at');
    setMembers((data as Member[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [clientId]);

  const loginUrl = `${window.location.protocol}//${window.location.host}`;

  const buildShare = (e: string, p: string) =>
    `Olá! Seu acesso à Bolsa (${clientName}) está pronto.\n\nAcesse: ${loginUrl}\nE-mail: ${e}\nSenha provisória: ${p}\n\nDepois de entrar, você pode trocar a senha em "Esqueci minha senha".`;

  const create = async () => {
    setMsg(null); setShareText(null);
    if (!email.trim()) return setMsg({ type: 'err', text: 'Informe o e-mail do cliente.' });
    setBusy(true);
    const { data, error } = await callFunction<{ user_created: boolean }>('admin-users', {
      action: 'create_client_login', client_id: clientId, email: email.trim(), password, display_name: name.trim() || null,
    });
    setBusy(false);
    if (error) return setMsg({ type: 'err', text: error });
    setMsg({ type: 'ok', text: data?.user_created ? 'Login criado.' : 'Este e-mail já tinha login e foi vinculado a este cliente.' });
    if (data?.user_created) setShareText(buildShare(email.trim(), password));
    setPassword(genPassword());
    load();
  };

  const resetPassword = async (m: Member) => {
    const p = genPassword();
    if (!window.confirm(`Gerar uma nova senha provisória para ${m.email}?`)) return;
    setBusy(true);
    const { error } = await callFunction('admin-users', { action: 'reset_client_password', client_member_id: m.id, password: p });
    setBusy(false);
    if (error) return setMsg({ type: 'err', text: error });
    setShareText(buildShare(m.email || '', p));
    setMsg({ type: 'ok', text: 'Nova senha gerada. Envie a mensagem abaixo para o cliente.' });
  };

  const toggleActive = async (m: Member) => {
    setBusy(true);
    const { error } = await callFunction('admin-users', { action: 'set_client_login_active', client_member_id: m.id, is_active: !m.is_active });
    setBusy(false);
    if (error) return setMsg({ type: 'err', text: error });
    load();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Acesso do cliente ao portal</h3>
          <p className="text-xs text-gray-500 mt-1">Cada pessoa do cliente entra com o próprio e-mail e senha.</p>
        </div>
        <button type="button" onClick={onViewAs}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-xl text-xs font-bold self-start">
          <Eye size={14} /> Ver como cliente
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200 divide-y divide-slate-100 bg-white">
        {loading ? (
          <div className="p-5 flex justify-center"><Loader2 className="animate-spin text-gray-300" size={20} /></div>
        ) : members.length === 0 ? (
          <div className="p-5 text-sm text-gray-500">Nenhum login criado ainda.</div>
        ) : members.map(m => (
          <div key={m.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`p-2 rounded-xl ${m.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}><ShieldCheck size={16} /></div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-brand-dark truncate">{m.display_name || m.email}</p>
                <p className="text-xs text-gray-500 truncate">{m.email} {m.is_active ? '' : '· desativado'}</p>
              </div>
            </div>
            {canManage && (
              <div className="flex gap-2">
                <button type="button" disabled={busy} onClick={() => resetPassword(m)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50">
                  <KeyRound size={13} /> Nova senha
                </button>
                <button type="button" disabled={busy} onClick={() => toggleActive(m)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50">
                  {m.is_active ? <><UserX size={13} /> Desativar</> : <><UserCheck size={13} /> Reativar</>}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {canCreate && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 space-y-3">
          <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">Criar novo login</p>
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="relative sm:col-span-1">
              <Mail className="absolute left-3 top-3 text-gray-400" size={15} />
              <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="email@cliente.com"
                className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white" />
            </div>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Nome da pessoa (opcional)"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white" />
            <input value={password} onChange={e => setPassword(e.target.value)} placeholder="Senha provisória"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm font-mono bg-white" />
          </div>
          <button type="button" disabled={busy} onClick={create}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-dark text-white rounded-xl text-xs font-bold disabled:opacity-60">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Criar login
          </button>
        </div>
      )}

      {msg && (
        <p className={`text-xs font-bold ${msg.type === 'ok' ? 'text-emerald-700' : 'text-red-600'}`}>{msg.text}</p>
      )}

      {shareText && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 space-y-2">
          <p className="text-xs font-bold text-emerald-800">Mensagem pronta para enviar ao cliente</p>
          <pre className="whitespace-pre-wrap text-xs text-emerald-900 font-sans">{shareText}</pre>
          <button type="button" onClick={() => { navigator.clipboard.writeText(shareText); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800">
            {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copiado' : 'Copiar mensagem'}
          </button>
        </div>
      )}
    </div>
  );
};
