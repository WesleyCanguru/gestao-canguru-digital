import React, { useEffect, useState } from 'react';
import { Lock, Loader2, CheckCircle2, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { AuthShell } from './LoginScreen';

/** Página de nova senha (link do e-mail de recuperação). */
export const ResetPasswordPage: React.FC<{ legacyLink?: boolean }> = ({ legacyLink }) => {
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (legacyLink) { setReady(true); return; }
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) { setHasSession(!!session); setReady(true); }
    });
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(!!data.session && !(data.session.user as any).is_anonymous);
      setTimeout(() => setReady(true), 600);
    });
    return () => sub.subscription.unsubscribe();
  }, [legacyLink]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) return setError('A senha precisa ter pelo menos 8 caracteres.');
    if (password !== confirm) return setError('As senhas não coincidem.');
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) return setError(error.message);
    setDone(true);
  };

  const goHome = () => { window.location.href = '/'; };

  return (
    <AuthShell>
      {!ready ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-gray-300" /></div>
      ) : legacyLink || !hasSession ? (
        <div className="text-center space-y-4">
          <h2 className="text-xl font-bold text-brand-dark">
            {legacyLink ? 'O acesso à Bolsa mudou' : 'Link expirado'}
          </h2>
          <p className="text-sm text-gray-500 leading-relaxed">
            {legacyLink
              ? 'Agora o acesso é com e-mail e senha. Na tela de login, use "Primeiro acesso" com a sua chave antiga para criar o seu login.'
              : 'Este link de recuperação expirou ou já foi usado. Peça um novo na tela de login.'}
          </p>
          <button onClick={goHome} className="w-full bg-brand-dark text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2">
            Ir para o login <ArrowRight size={16} />
          </button>
        </div>
      ) : done ? (
        <div className="text-center space-y-4">
          <CheckCircle2 className="mx-auto text-emerald-500" size={40} />
          <h2 className="text-xl font-bold text-brand-dark">Senha atualizada</h2>
          <button onClick={goHome} className="w-full bg-brand-dark text-white py-4 rounded-2xl font-bold">Entrar na Bolsa</button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <h2 className="text-xl font-bold text-brand-dark text-center mb-2">Crie uma nova senha</h2>
          {[{ v: password, set: setPassword, ph: 'Nova senha (mín. 8 caracteres)' }, { v: confirm, set: setConfirm, ph: 'Repita a nova senha' }].map((f, i) => (
            <div key={i} className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" size={18} />
              <input type="password" value={f.v} onChange={(e) => f.set(e.target.value)} placeholder={f.ph} required
                className="w-full pl-12 pr-4 py-4 bg-gray-50/50 border border-gray-100 rounded-2xl outline-none focus:border-brand-dark focus:bg-white" />
            </div>
          ))}
          {error && <p className="text-xs font-bold text-red-600 text-center">{error}</p>}
          <button disabled={saving} className="w-full bg-brand-dark text-white py-4 rounded-2xl font-bold disabled:opacity-60">
            {saving ? 'Salvando...' : 'Salvar nova senha'}
          </button>
        </form>
      )}
    </AuthShell>
  );
};
