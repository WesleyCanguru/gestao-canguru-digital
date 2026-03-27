
import React from 'react';
import { motion } from 'motion/react';
import { Building2, Users, ArrowRight, Shield } from 'lucide-react';
import { Logo } from '../Logo';

interface AgencyHomeProps {
  onManageAgency: () => void;
  onAccessClients: () => void;
}

export const AgencyHome: React.FC<AgencyHomeProps> = ({ onManageAgency, onAccessClients }) => {
  return (
    <div className="min-h-screen bg-[#FDFDFD] flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-50/50 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-50/50 rounded-full blur-[120px]"></div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-4xl"
      >
        <div className="text-center mb-16">
          <Logo size="large" />
          <p className="text-gray-400 text-[10px] uppercase tracking-[0.4em] font-bold mt-6">
            Canguru Digital • Gestão & Estratégia
          </p>
          <h1 className="text-4xl font-bold text-brand-dark mt-8 tracking-tight">Bem-vindo de volta, Wesley!</h1>
          <p className="text-gray-500 mt-4">O que você deseja fazer hoje?</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Gerenciar Agência */}
          <motion.button
            whileHover={{ scale: 1.02, y: -5 }}
            whileTap={{ scale: 0.98 }}
            onClick={onManageAgency}
            className="group relative bg-white p-10 rounded-[2.5rem] border border-black/[0.03] shadow-[0_20px_50px_rgba(0,0,0,0.04)] text-left transition-all"
          >
            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 mb-8 group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <Building2 size={32} />
            </div>
            <h2 className="text-2xl font-bold text-brand-dark mb-4">Gerenciar a Agência</h2>
            <p className="text-gray-500 leading-relaxed mb-8">
              Acesse o painel interno para gerenciar o financeiro, prospecção de novos leads e visão geral dos clientes.
            </p>
            <div className="flex items-center gap-2 text-blue-600 font-bold text-sm uppercase tracking-widest">
              Acessar Painel <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </div>
          </motion.button>

          {/* Acessar Clientes */}
          <motion.button
            whileHover={{ scale: 1.02, y: -5 }}
            whileTap={{ scale: 0.98 }}
            onClick={onAccessClients}
            className="group relative bg-brand-dark p-10 rounded-[2.5rem] text-left transition-all shadow-[0_20px_50px_rgba(0,0,0,0.1)]"
          >
            <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center text-white mb-8 group-hover:bg-white group-hover:text-brand-dark transition-colors">
              <Users size={32} />
            </div>
            <h2 className="text-2xl font-bold text-white mb-4">Acessar Cliente</h2>
            <p className="text-gray-300 leading-relaxed mb-8">
              Selecione um cliente específico para gerenciar seu mapa editorial, tráfego pago, documentos e outros módulos.
            </p>
            <div className="flex items-center gap-2 text-white font-bold text-sm uppercase tracking-widest">
              Ver Clientes <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </div>
          </motion.button>
        </div>

        <div className="mt-20 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-50 border border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            <Shield size={12} />
            Acesso Restrito ao Administrador
          </div>
        </div>
      </motion.div>
    </div>
  );
};
