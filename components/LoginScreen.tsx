
import React, { useState } from 'react';
import { Logo } from './Logo';
import { AgencyLogo } from './AgencyLogo';
import { useAuth } from '../lib/supabase';
import { Lock, ArrowRight, ShieldCheck, Eye, EyeOff, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const LoginScreen: React.FC = () => {
  const { loginByPassword } = useAuth();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isAdminMode, setIsAdminMode] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await loginByPassword(password.trim());
    
    if (!result.success) {
      setError(result.error || 'Chave de acesso inválida.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFDFD] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      
      {/* Background decoration - More subtle and premium */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.4 }}
          transition={{ duration: 2 }}
          className="absolute top-[-15%] left-[-10%] w-[50%] h-[50%] bg-blue-50 rounded-full blur-[120px]"
        ></motion.div>
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.3 }}
          transition={{ duration: 2, delay: 0.5 }}
          className="absolute bottom-[-15%] right-[-10%] w-[50%] h-[50%] bg-indigo-50 rounded-full blur-[120px]"
        ></motion.div>
      </div>

      <div className="relative z-10 w-full max-w-lg">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="mb-12 text-center flex flex-col items-center justify-center"
        >
          <div className="relative mb-8 group">
            <div className="absolute -inset-4 bg-blue-50/50 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
            <AgencyLogo className="h-28 relative mix-blend-multiply" />
          </div>
          
          <div className="space-y-2">
            <motion.h1 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.8 }}
              className="text-brand-dark font-bold text-5xl tracking-tighter serif italic"
            >
              Bolsa
            </motion.h1>
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: 40 }}
              transition={{ delay: 0.5, duration: 0.8 }}
              className="h-0.5 bg-brand-dark mx-auto opacity-20"
            ></motion.div>
            <p className="text-gray-400 text-[10px] uppercase tracking-[0.4em] font-bold mt-4">
              Canguru Digital • Gestão & Estratégia
            </p>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="bg-white rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.04)] border border-black/[0.02] p-10 sm:p-12 relative overflow-hidden"
        >
          {/* Subtle pattern background */}
          <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
          
          <div className="relative z-10">
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-[9px] font-bold uppercase tracking-widest mb-6">
                <Sparkles size={10} />
                <span>Acesso Exclusivo</span>
              </div>
              
              <p className="text-[15px] text-gray-600 leading-relaxed font-medium max-w-md mx-auto">
                "O canguru carrega seu filhote em uma bolsa,<br />
                sempre perto, sempre protegido.<br /><br />
                <span className="text-brand-dark font-bold">Bolsa é isso:</span> o lugar onde a Canguru Digital guarda tudo da sua marca.<br /><br />
                Estratégia, conteúdo, relatórios e acessos em um só lugar,<br />
                para você sempre ter o que precisa, quando precisar."
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-[0.2em] font-bold text-gray-400 ml-1">Chave de Acesso</label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-brand-dark transition-colors" size={18} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-12 pr-12 py-4 bg-gray-50/50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-brand-dark/5 focus:border-brand-dark focus:bg-white outline-none transition-all placeholder-gray-300 text-gray-900 font-medium tracking-wide"
                    placeholder="Digite sua chave..."
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-600 p-1 rounded-md transition-colors focus:outline-none"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <AnimatePresence mode="wait">
                {error && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="p-4 bg-red-50 text-red-600 text-[11px] font-bold rounded-xl flex items-center justify-center gap-2 border border-red-100"
                  >
                    <ShieldCheck size={14} />
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                type="submit"
                disabled={loading}
                className={`w-full bg-brand-dark text-white py-5 rounded-2xl font-bold hover:bg-gray-800 transition-all shadow-xl shadow-brand-dark/10 hover:shadow-2xl hover:shadow-brand-dark/20 transform hover:-translate-y-0.5 flex items-center justify-center gap-3 group ${loading ? 'opacity-80 cursor-wait' : ''}`}
              >
                {loading ? (
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                ) : (
                  <>
                    Entrar na Bolsa <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>
            
            <div className="mt-10 pt-8 border-t border-gray-50 flex flex-col items-center gap-4">
               {!isAdminMode && (
                 <p className="text-[10px] text-gray-400 font-medium">
                   Precisa de ajuda? Nos chame no grupo de WhatsApp.
                 </p>
               )}
               
               <button 
                 type="button"
                 onClick={() => setIsAdminMode(!isAdminMode)}
                 className="text-[9px] text-gray-300 hover:text-brand-dark uppercase tracking-widest font-bold transition-colors"
               >
                 {isAdminMode ? 'Voltar para Acesso Cliente' : 'Acesso Administrativo'}
               </button>

               <div className="flex items-center gap-2 opacity-30 hover:opacity-100 transition-opacity duration-500">
                 <span className="text-[8px] uppercase tracking-[0.3em] font-bold text-gray-400">Powered by</span>
                 <AgencyLogo className="h-5 mix-blend-multiply" />
               </div>
            </div>
          </div>
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 1 }}
          className="mt-12 text-center space-y-4"
        >
          <p className="text-[10px] text-gray-300 uppercase tracking-[0.4em] font-bold">
            Ambiente Seguro • Canguru Digital 2026
          </p>
          <div className="flex justify-center gap-6">
            <div className="w-1 h-1 rounded-full bg-gray-200"></div>
            <div className="w-1 h-1 rounded-full bg-gray-200"></div>
            <div className="w-1 h-1 rounded-full bg-gray-200"></div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
