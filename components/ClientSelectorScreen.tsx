import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { supabase, useAuth } from '../lib/supabase';
import { Client } from '../types';
import { AgencyLogo } from './AgencyLogo';
import { Plus, Users, LogOut, ChevronRight, Building2 } from 'lucide-react';

interface ClientSelectorScreenProps {
  onSelectClient: (client: Client) => void;
  onManageClients: () => void;
  onLogout: () => void;
}

export const ClientSelectorScreen: React.FC<ClientSelectorScreenProps> = ({
  onSelectClient,
  onManageClients,
  onLogout,
}) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const { setActiveClient } = useAuth();

  useEffect(() => {
    const fetchClients = async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (!error && data) setClients(data as Client[]);
      setLoading(false);
    };
    fetchClients();
  }, []);

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
        className="relative z-10 w-full max-w-3xl"
      >
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-block bg-white p-6 rounded-[2rem] shadow-[0_10px_40px_rgba(0,0,0,0.03)] border border-black/[0.02] mb-8">
            <AgencyLogo className="h-16" />
          </div>
          <p className="text-gray-400 text-[10px] uppercase tracking-[0.4em] font-bold mb-4">
            Painel da Agência
          </p>
          <h1 className="text-4xl font-bold text-brand-dark tracking-tight mb-4">Selecione o Cliente</h1>
          <p className="text-gray-500">Escolha um cliente para gerenciar seu mapa editorial e estratégias.</p>
        </div>

        {/* Grid de clientes */}
        <div className="w-full">
          {loading ? (
            <div className="text-center text-gray-400 py-12">Carregando clientes...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
              {clients.map((client, index) => (
                <motion.button
                  key={client.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setActiveClient(client);
                    onSelectClient(client);
                  }}
                  className="group flex items-center gap-5 p-6 bg-white hover:bg-gray-50/50 border border-black/[0.03] hover:border-brand-dark/20 rounded-3xl text-left transition-all duration-300 shadow-[0_10px_30px_rgba(0,0,0,0.02)] hover:shadow-[0_20px_40px_rgba(0,0,0,0.06)]"
                >
                  {/* Avatar do cliente */}
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-xl flex-shrink-0 shadow-sm overflow-hidden"
                    style={{ backgroundColor: client.color }}
                  >
                    {client.logo_url ? (
                      <img src={client.logo_url} alt={client.name} className="w-full h-full object-contain mix-blend-multiply" />
                    ) : (
                      client.initials
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-brand-dark font-bold text-base truncate mb-1">{client.name}</p>
                    {client.segment && (
                      <p className="text-gray-400 text-xs truncate uppercase tracking-wider font-semibold">{client.segment}</p>
                    )}
                  </div>
                  <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-brand-dark transition-colors flex-shrink-0">
                    <ChevronRight size={16} className="text-gray-400 group-hover:text-white transition-colors" />
                  </div>
                </motion.button>
              ))}
            </div>
          )}

          {/* Botões de ação */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={onManageClients}
              className="flex items-center justify-center gap-2 py-3 px-6 bg-brand-dark hover:bg-opacity-90 text-white rounded-2xl font-bold text-xs uppercase tracking-widest transition-all shadow-[0_10px_20px_rgba(0,0,0,0.1)] hover:shadow-[0_15px_30px_rgba(0,0,0,0.15)] hover:-translate-y-0.5"
            >
              <Plus size={16} />
              Gerenciar Clientes
            </button>
            <button
              onClick={onLogout}
              className="flex items-center justify-center gap-2 py-3 px-6 bg-white hover:bg-gray-50 text-gray-500 border border-black/[0.05] rounded-2xl font-bold text-xs uppercase tracking-widest transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5"
            >
              <LogOut size={16} />
              Sair
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
