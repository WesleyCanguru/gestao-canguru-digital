import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { KeyRound, Lock, CheckCircle2, AlertCircle, Loader2, Eye, EyeOff, ShieldCheck } from 'lucide-react';

interface ResetAccessKeyPageProps {
  token: string | null;
  clientId: string | null;
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export const ResetAccessKeyPage: React.FC<ResetAccessKeyPageProps> = ({ token, clientId }) => {
  const [loading, setLoading] = useState(true);
  const [validToken, setValidToken] = useState(false);
  const [clientName, setClientName] = useState('');
  const [agencyName, setAgencyName] = useState('Bolsa');
  const [agencyLogo, setAgencyLogo] = useState<string | null>(null);
  const [brandColor, setBrandColor] = useState('#1A3A5C');
  const [isEnglish, setIsEnglish] = useState(false);
  const [strategyData, setStrategyData] = useState<any>({});

  const [newKey, setNewKey] = useState('');
  const [confirmKey, setConfirmKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    const verifyResetToken = async () => {
      if (!token || !clientId) {
        setValidToken(false);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const { data: clientData, error: clientErr } = await supabase
          .from('clients')
          .select('id, name, agency_id, traffic_strategy_data')
          .eq('id', clientId)
          .maybeSingle();

        if (clientErr || !clientData) {
          setValidToken(false);
          setLoading(false);
          return;
        }

        setClientName(clientData.name || '');
        const strat = clientData.traffic_strategy_data || {};
        setStrategyData(strat);

        if (clientData.agency_id) {
          if (clientData.agency_id === 7) setIsEnglish(true);
          const { data: agencyData } = await supabase
            .from('agencies')
            .select('id, name, logo_url, primary_color')
            .eq('id', clientData.agency_id)
            .maybeSingle();

          if (agencyData) {
            setAgencyName(agencyData.name || 'Bolsa');
            setAgencyLogo(agencyData.logo_url || null);
            if (agencyData.primary_color) setBrandColor(agencyData.primary_color);
            if (agencyData.id === 7) setIsEnglish(true);
          }
        }

        let isTokenMatch = false;
        const now = Date.now();

        // 1. Verificar em client_users
        try {
          const { data: uData } = await supabase
            .from('client_users')
            .select('password_reset_token, password_reset_expires_at')
            .eq('client_id', clientId)
            .maybeSingle();

          if (uData?.password_reset_token && uData.password_reset_token === token) {
            const exp = uData.password_reset_expires_at ? new Date(uData.password_reset_expires_at).getTime() : now + 60000;
            if (exp > now) {
              isTokenMatch = true;
            }
          }
        } catch (e) {
          // Fallback caso as colunas não existam ainda em client_users
        }

        // 2. Fallback em traffic_strategy_data
        if (!isTokenMatch && strat.password_reset_token === token) {
          const exp = strat.password_reset_expires_at ? new Date(strat.password_reset_expires_at).getTime() : now + 60000;
          if (exp > now) {
            isTokenMatch = true;
          }
        }

        setValidToken(isTokenMatch);
      } catch (err) {
        console.error('Error verifying reset token:', err);
        setValidToken(false);
      } finally {
        setLoading(false);
      }
    };

    verifyResetToken();
  }, [token, clientId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanKey = newKey.trim();
    if (cleanKey.length < 6) {
      setErrorMsg(
        isEnglish
          ? 'Access key must be at least 6 characters.'
          : 'A chave de acesso deve ter pelo menos 6 caracteres.'
      );
      return;
    }

    if (cleanKey !== confirmKey.trim()) {
      setErrorMsg(
        isEnglish
          ? 'Access keys do not match.'
          : 'As chaves de acesso não coincidem.'
      );
      return;
    }

    if (!clientId) return;

    try {
      setSubmitting(true);
      const passwordHash = await sha256(cleanKey);

      // 1. Atualizar client_users
      const { error: uErr } = await supabase
        .from('client_users')
        .update({
          password_hash: passwordHash,
          access_key: cleanKey,
          password_reset_token: null,
          password_reset_expires_at: null
        })
        .eq('client_id', clientId);

      if (uErr) {
        await supabase
          .from('client_users')
          .update({
            password_hash: passwordHash
          })
          .eq('client_id', clientId);
      }

      // 2. Atualizar client_credentials
      try {
        await supabase
          .from('client_credentials')
          .update({
            password_encrypted: cleanKey
          })
          .eq('client_id', clientId)
          .eq('platform', 'portal');
      } catch (e) {}

      // 3. Atualizar clients.traffic_strategy_data
      await supabase
        .from('clients')
        .update({
          traffic_strategy_data: {
            ...strategyData,
            client_access_key: cleanKey,
            password_reset_token: null,
            password_reset_expires_at: null
          }
        })
        .eq('id', clientId);

      setCompleted(true);
    } catch (err) {
      console.error('Error resetting access key:', err);
      setErrorMsg(
        isEnglish
          ? 'Could not update your access key. Please try again.'
          : 'Não foi possível redefinir sua chave de acesso. Tente novamente.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F9FB] flex flex-col items-center justify-center p-6 text-stone-600">
        <Loader2 className="w-10 h-10 animate-spin text-stone-400 mb-4" />
        <p className="text-sm font-medium">Verificando link de redefinição...</p>
      </div>
    );
  }

  if (!validToken) {
    return (
      <div className="min-h-screen bg-[#F8F9FB] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-gray-100 shadow-lg text-center">
          <div className="w-14 h-14 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={28} />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            {isEnglish ? 'Invalid or Expired Link' : 'Link Inválido ou Expirado'}
          </h2>
          <p className="text-sm text-gray-500 mb-6 leading-relaxed">
            {isEnglish
              ? 'This password reset link is invalid or has already expired. Please request a new reset link from your agency.'
              : 'Este link de redefinição de chave é inválido ou já expirou. Solicite um novo link diretamente à sua agência.'}
          </p>
          <a
            href="/"
            className="inline-flex items-center justify-center px-6 py-3 bg-gray-900 hover:bg-black text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all"
          >
            {isEnglish ? 'Go to Login' : 'Ir para o Login'}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FB] flex flex-col justify-between p-6">
      <header className="w-full max-w-md mx-auto pt-4 flex items-center justify-center gap-3">
        {agencyLogo ? (
          <img src={agencyLogo} alt={agencyName} className="max-h-[40px] h-10 w-auto object-contain" />
        ) : (
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-base"
            style={{ backgroundColor: brandColor }}
          >
            {agencyName.slice(0, 2).toUpperCase()}
          </div>
        )}
        <span className="text-base font-bold text-gray-900">{agencyName}</span>
      </header>

      <main className="w-full max-w-md mx-auto my-auto py-8">
        <div className="bg-white rounded-3xl p-8 border border-black/[0.04] shadow-[0_20px_60px_rgba(0,0,0,0.04)]">
          {completed ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto mb-5 shadow-md">
                <CheckCircle2 size={34} />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {isEnglish ? 'Access Key Updated!' : 'Chave Atualizada!'}
              </h2>
              <p className="text-sm text-gray-500 mb-6">
                {isEnglish
                  ? 'Your new access key has been saved. You can now access the client portal.'
                  : 'Sua nova chave de acesso foi salva com sucesso. Você já pode acessar o portal.'}
              </p>
              <a
                href="/"
                className="w-full inline-flex items-center justify-center px-6 py-3.5 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-md"
                style={{ backgroundColor: brandColor }}
              >
                {isEnglish ? 'Go to Portal Login' : 'Acessar Portal'}
              </a>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-gray-50 border border-gray-100 rounded-lg text-gray-500 text-[10px] font-bold uppercase tracking-wider mb-2">
                  <KeyRound size={13} />
                  <span>{isEnglish ? 'Reset Access Key' : 'Redefinir Chave'}</span>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
                  {isEnglish ? 'Set New Access Key' : 'Definir Nova Chave de Acesso'}
                </h2>
                {clientName && (
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-1">
                    {clientName}
                  </p>
                )}
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
                    {isEnglish ? 'New Access Key *' : 'Nova Chave de Acesso *'}
                  </label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3.5 top-3.5 text-gray-400" />
                    <input
                      type={showKey ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={newKey}
                      onChange={e => setNewKey(e.target.value)}
                      placeholder={isEnglish ? 'Minimum 6 characters' : 'Mínimo 6 caracteres'}
                      className="w-full pl-10 pr-10 py-3 bg-gray-50/60 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:bg-white transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey(prev => !prev)}
                      className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 cursor-pointer"
                    >
                      {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
                    {isEnglish ? 'Confirm Access Key *' : 'Confirmar Nova Chave *'}
                  </label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3.5 top-3.5 text-gray-400" />
                    <input
                      type={showKey ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={confirmKey}
                      onChange={e => setConfirmKey(e.target.value)}
                      placeholder={isEnglish ? 'Repeat your access key' : 'Repita a chave de acesso'}
                      className="w-full pl-10 pr-10 py-3 bg-gray-50/60 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:bg-white transition-all"
                    />
                  </div>
                </div>

                {errorMsg && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-600 font-medium">
                    <AlertCircle size={15} className="flex-shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md hover:shadow-lg disabled:opacity-50 cursor-pointer mt-2"
                  style={{ backgroundColor: brandColor }}
                >
                  {submitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>{isEnglish ? 'Saving...' : 'Salvando...'}</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={16} />
                      <span>{isEnglish ? 'Save New Access Key' : 'Salvar Nova Chave'}</span>
                    </>
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </main>

      <footer className="w-full text-center text-xs text-gray-400 pb-4">
        &copy; {new Date().getFullYear()} {agencyName} &bull; Powered by Bolsa
      </footer>
    </div>
  );
};
