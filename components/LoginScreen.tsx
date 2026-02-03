
import React, { useState } from 'react';
import { Logo } from './Logo';
import { AgencyLogo } from './AgencyLogo';
import { useAuth } from '../lib/supabase';
import { Lock, ArrowRight, ShieldCheck } from 'lucide-react';

export const LoginScreen: React.FC = () => {
  const { login } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Pequeno delay para sensação de segurança/processamento
    setTimeout(() => {
      const cleanPass = password.trim();

      // LÓGICA DE ACESSO POR SENHA (Atualizado)
      // Nota: As senhas diferenciam maiúsculas de minúsculas para maior segurança.
      
      if (cleanPass === 'Canguru2026') {
        login('admin');
      } else if (cleanPass === 'Vivi2026') {
        login('approver');
      } else if (cleanPass === 'Next2026') {
        login('team');
      } else {
        setError('Senha incorreta. Verifique maiúsculas e minúsculas.');
        setLoading(false);
      }
    }, 600);
  };

  return (
    <div className="min-h-screen bg-background-light flex flex-col items-center justify-center p-4 relative overflow-hidden">
      
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 opacity-50">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-100 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-100 rounded-full blur-[100px]"></div>
      </div>

      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-10 text-center flex justify-center">
          <Logo size="large" />
        </div>

        <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/50 p-8">
          <div className="text-center mb-8">
            <h2 className="text-xl font-bold text-gray-900">Acesso Restrito</h2>
            <p className="text-sm text-gray-500 mt-1">Insira sua chave de acesso para continuar</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <div className="relative group">
                <Lock className="absolute left-3 top-3.5 text-gray-400 group-focus-within:text-blue-600 transition-colors" size={18} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all placeholder-gray-400 text-gray-900 font-medium tracking-wide"
                  placeholder="Senha de acesso"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 text-red-600 text-xs font-bold rounded-lg flex items-center justify-center gap-2 animate-in fade-in slide-in-from-top-1">
                <ShieldCheck size={14} />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`w-full bg-brand-dark text-white py-3.5 rounded-xl font-bold hover:bg-gray-800 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center justify-center gap-2 ${loading ? 'opacity-80 cursor-wait' : ''}`}
            >
              {loading ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              ) : (
                <>
                  Entrar no Sistema <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
          
          <div className="mt-6 pt-6 border-t border-gray-100 flex justify-center opacity-60">
             <AgencyLogo className="h-6 opacity-80 grayscale hover:grayscale-0 transition-all duration-500" />
          </div>
        </div>
        
        <p className="text-center text-[10px] text-gray-400 mt-6 uppercase tracking-widest font-medium">
          Ambiente Seguro • 2026
        </p>
      </div>
    </div>
  );
};
