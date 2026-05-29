import React, { useState, useEffect } from 'react';
import { useAuth, supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, Lock, Eye, EyeOff, Sparkles, Loader2, LogOut, ShieldAlert, ArrowRight } from 'lucide-react';
import { Logo } from './Logo';
import { AgencyLogo } from './AgencyLogo';
import { AiPhotosView } from './AiPhotosView';

interface PhotosApprovalPublicProps {
  clientId: string;
}

export const PhotosApprovalPublic: React.FC<PhotosApprovalPublicProps> = ({ clientId }) => {
  const { 
    isAuthenticated, 
    userRole, 
    activeClient, 
    setActiveClient, 
    loginByPassword, 
    logout 
  } = useAuth();

  const [clientInfo, setClientInfo] = useState<any>(null);
  const [loadingClient, setLoadingClient] = useState(true);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loadingLogin, setLoadingLogin] = useState(false);
  const [isSuccessfullyAuthorized, setIsSuccessfullyAuthorized] = useState(false);

  // 1. Fetch client information
  useEffect(() => {
    const fetchClient = async () => {
      setLoadingClient(true);
      try {
        const { data, error: err } = await supabase
          .from('clients')
          .select('*')
          .eq('id', clientId)
          .single();

        if (err || !data) {
          setError('Cliente não encontrado.');
        } else {
          setClientInfo(data);
        }
      } catch (error) {
        console.error('Error fetching client info:', error);
        setError('Ocorreu um erro ao carregar as informações do ensaio.');
      } finally {
        setLoadingClient(false);
      }
    };

    if (clientId) {
      fetchClient();
    }
  }, [clientId]);

  // 2. Validate current auth status
  useEffect(() => {
    if (isAuthenticated) {
      if (userRole === 'admin') {
        // Admin has universal access. If activeClient is not the requested one, switch it.
        if (!activeClient || activeClient.id !== clientId) {
          const switchClient = async () => {
            const { data } = await supabase
              .from('clients')
              .select('*')
              .eq('id', clientId)
              .single();
            if (data) {
              setActiveClient(data);
            }
          };
          switchClient();
        }
        setIsSuccessfullyAuthorized(true);
      } else if (activeClient && activeClient.id === clientId) {
        // Logged in user matches requested client photos
        setIsSuccessfullyAuthorized(true);
      } else {
        // Logged in as a different client
        setIsSuccessfullyAuthorized(false);
      }
    } else {
      setIsSuccessfullyAuthorized(false);
    }
  }, [isAuthenticated, userRole, activeClient, clientId, setActiveClient]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;

    setError('');
    setLoadingLogin(true);

    try {
      const result = await loginByPassword(password.trim());
      
      if (!result.success) {
        setError(result.error || 'Chave de acesso inválida.');
        setLoadingLogin(false);
        return;
      }

      // Re-fetch active client state to verify if matches
      // Since loginByPassword updates activeClient in localStorage and supabase context,
      // it should be available now. Let's make an explicit check.
      const storedClientStr = localStorage.getItem('next_app_client');
      let storedClientObj: any = null;
      if (storedClientStr) {
        try {
          storedClientObj = JSON.parse(storedClientStr);
        } catch (_) {}
      }

      const role = localStorage.getItem('next_app_role');

      if (role === 'admin') {
        // Logged in as admin, switch active client to this one
        if (clientInfo) {
          setActiveClient(clientInfo);
        }
        setIsSuccessfullyAuthorized(true);
      } else if (storedClientObj && storedClientObj.id === clientId) {
        setIsSuccessfullyAuthorized(true);
      } else {
        // Password works but is for another client
        setError('Esta chave de acesso pertence a outro cliente. Por favor, use a chave correta.');
        logout(); // Logout to clean up stale context
      }
    } catch (err) {
      console.error(err);
      setError('Erro ao validar acesso. Tente novamente.');
    } finally {
      setLoadingLogin(false);
    }
  };

  const handleLogout = () => {
    logout();
    setIsSuccessfullyAuthorized(false);
  };

  if (loadingClient) {
    return (
      <div className="min-h-screen bg-[#FDFDFD] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="animate-spin text-fuchsia-600" size={40} />
          <p className="text-sm font-medium text-gray-500">Carregando ensaio fotográfico...</p>
        </div>
      </div>
    );
  }

  if (error && !clientInfo) {
    return (
      <div className="min-h-screen bg-[#FDFDFD] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4">
          <ShieldAlert size={32} />
        </div>
        <h2 className="text-xl font-bold mb-2 text-brand-dark">Link Indisponível</h2>
        <p className="text-gray-500 max-w-sm mb-6">{error}</p>
        <button 
          onClick={() => window.location.href = '/'}
          className="px-6 py-2.5 bg-brand-dark text-white rounded-xl font-bold hover:bg-black transition-colors"
        >
          Voltar para Bolsa
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFDFD] flex flex-col font-sans">
      <AnimatePresence mode="wait">
        {!isSuccessfullyAuthorized ? (
          <motion.div 
            key="login-view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-grow flex flex-col items-center justify-center p-4 relative overflow-hidden"
          >
            {/* Background decoration with Fuchsia highlight for AI Photos */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
              <div className="absolute top-[-10%] left-[-10%] w-[45%] h-[45%] bg-fuchsia-50/40 rounded-full blur-[120px]"></div>
              <div className="absolute bottom-[-10%] right-[-10%] w-[45%] h-[45%] bg-blue-50/40 rounded-full blur-[120px]"></div>
            </div>

            <div className="relative z-10 w-full max-w-md">
              <div className="mb-8 text-center flex flex-col items-center justify-center">
                <div className="relative mb-5">
                  <AgencyLogo className="h-16 mix-blend-multiply" />
                </div>
                
                <h1 className="text-brand-dark font-bold text-3xl tracking-tighter serif italic">
                  Aprovação de Fotos • IA
                </h1>
                <p className="text-gray-400 text-[10px] uppercase tracking-[0.4em] font-bold mt-1">
                  Ensaio Fotográfico Exclusivo
                </p>
              </div>

              <motion.div 
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="bg-white rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.02)] border border-black/[0.02] p-8 sm:p-10"
              >
                <div className="text-center mb-6">
                  {clientInfo?.logo_url ? (
                    <img 
                      src={clientInfo.logo_url} 
                      alt={clientInfo.name} 
                      className="h-16 w-auto object-contain mx-auto mb-4 mix-blend-multiply" 
                    />
                  ) : (
                    <div className="w-16 h-16 bg-fuchsia-50 rounded-2xl flex items-center justify-center text-fuchsia-600 mx-auto mb-4">
                      <Camera size={28} />
                    </div>
                  )}

                  <h2 className="text-lg font-bold text-brand-dark mb-1">
                    {clientInfo?.name}
                  </h2>
                  <p className="text-xs text-gray-500 font-medium">
                    Para visualizar e aprovar suas fotos geradas por inteligência artificial, digite sua chave de acesso.
                  </p>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-[0.2em] font-bold text-gray-400 ml-1">
                      Chave de Acesso
                    </label>
                    <div className="relative group">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-fuchsia-500 transition-colors" size={18} />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-12 pr-12 py-3.5 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-fuchsia-500/5 focus:border-fuchsia-500 focus:bg-white outline-none transition-all text-sm font-medium tracking-wide"
                        placeholder="Insira sua chave de acesso..."
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-600 p-1"
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <div className="p-3 bg-red-50 text-red-600 text-xs font-bold rounded-xl text-center border border-red-100 flex items-center justify-center gap-2">
                      <span>⚠️ {error}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loadingLogin}
                    className="w-full bg-brand-dark text-white py-3.5 rounded-2xl font-bold hover:bg-fuchsia-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center justify-center gap-2"
                  >
                    {loadingLogin ? (
                      <Loader2 className="animate-spin" size={18} />
                    ) : (
                      <>
                        Visualizar Ensaio <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                </form>

                {isAuthenticated && !isSuccessfullyAuthorized && (
                  <div className="mt-6 pt-4 border-t border-gray-50 text-center">
                    <p className="text-xs text-red-500 font-medium mb-2">
                      Conectado como {activeClient?.name || 'outro usuário'}.
                    </p>
                    <button 
                      onClick={handleLogout}
                      className="text-xs font-bold text-gray-400 hover:text-brand-dark"
                    >
                      Alterar Conta
                    </button>
                  </div>
                )}
              </motion.div>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="approval-view"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-grow flex flex-col"
          >
            {/* Header */}
            <header className="bg-white border-b border-gray-100 py-4 sticky top-0 z-20">
              <div className="max-w-6xl mx-auto px-4 flex justify-between items-center">
                <div className="flex items-center gap-4">
                  {clientInfo?.logo_url ? (
                    <img 
                      src={clientInfo.logo_url} 
                      alt={clientInfo.name} 
                      className="h-12 w-auto object-contain mix-blend-multiply" 
                    />
                  ) : (
                    <span className="text-xl font-bold text-brand-dark tracking-tighter serif italic">
                      {clientInfo?.name}
                    </span>
                  )}
                  <div className="h-5 w-px bg-gray-200 hidden sm:block"></div>
                  <div className="flex items-center gap-1 opacity-50 hover:opacity-100 transition-opacity">
                    <span className="text-[7px] uppercase tracking-[0.35em] text-gray-400 font-bold hidden lg:block">Direcionado por</span>
                    <Logo size="small" />
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <span className="text-xs font-bold text-fuchsia-600 bg-fuchsia-50 px-2.5 py-1 rounded-lg border border-fuchsia-100 hidden sm:inline-block">
                    Painel de Fotos IA
                  </span>
                  <button
                    onClick={handleLogout}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-gray-50 rounded-xl transition-all"
                    title="Sair"
                  >
                    <LogOut size={18} />
                  </button>
                </div>
              </div>
            </header>

            {/* Main view container */}
            <main className="flex-grow p-4 sm:p-8">
              <AiPhotosView />
            </main>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
