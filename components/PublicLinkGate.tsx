import React, { useEffect, useState } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { ensurePublicAccess, PublicLinkScope } from '../lib/supabase';

/**
 * Abre um link público com segurança: cria uma sessão anônima e libera
 * no banco apenas o item daquele link (post, mapa, contrato etc.).
 */
export const PublicLinkGate: React.FC<{ scope: PublicLinkScope; token: string; children: React.ReactNode }> = ({ scope, token, children }) => {
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    ensurePublicAccess(scope, token).then((r) => {
      if (!alive) return;
      if (r.ok) setState('ok');
      else { setError(r.error || 'Link inválido.'); setState('error'); }
    });
    return () => { alive = false; };
  }, [scope, token]);

  if (state === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA]">
        <Loader2 className="w-8 h-8 animate-spin text-stone-400" />
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA] p-6">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-gray-100 shadow-[0_20px_50px_rgba(0,0,0,0.06)] text-center">
          <div className="w-14 h-14 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={28} />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Não foi possível abrir este link</h2>
          <p className="text-sm text-gray-500">{error} Peça um novo link para a agência.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
