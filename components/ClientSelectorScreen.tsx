import React, { useState, useEffect } from 'react';
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
    <div className="min-h-screen bg-background-light flex flex-col items-center justify-center p-6">
      
      {/* Header */}
      <div className="mb-10 flex flex-col items-center gap-3">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-4">
          <AgencyLogo className="h-20" />
        </div>
        <h1 className="text-brand-dark text-2xl font-bold tracking-tight">Painel da Agência</h1>
        <p className="text-gray-500 text-sm">Selecione o cliente para gerenciar</p>
      </div>

      {/* Grid de clientes */}
      <div className="w-full max-w-2xl">
        {loading ? (
          <div className="text-center text-gray-400 py-12">Carregando clientes...</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            {clients.map((client) => (
              <button
                key={client.id}
                onClick={() => {
                  setActiveClient(client);
                  onSelectClient(client);
                }}
                className="group flex items-center gap-4 p-5 bg-white hover:bg-gray-50 border border-gray-200 hover:border-primary/30 rounded-xl text-left transition-all duration-200 hover:scale-[1.02] shadow-sm"
              >
                {/* Avatar do cliente */}
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0 shadow-sm overflow-hidden"
                  style={{ backgroundColor: client.color }}
                >
                  {client.logo_url ? (
                    <img src={client.logo_url} alt={client.name} className="w-full h-full object-contain mix-blend-multiply" />
                  ) : (
                    client.initials
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-brand-dark font-semibold text-sm truncate">{client.name}</p>
                  {client.segment && (
                    <p className="text-gray-500 text-xs mt-0.5 truncate">{client.segment}</p>
                  )}
                </div>
                <ChevronRight size={16} className="text-gray-300 group-hover:text-primary transition-colors flex-shrink-0" />
              </button>
            ))}
          </div>
        )}

        {/* Botões de ação */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={onManageClients}
            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-primary hover:bg-opacity-90 text-white rounded-xl font-semibold text-sm transition-all shadow-md"
          >
            <Plus size={16} />
            Gerenciar Clientes
          </button>
          <button
            onClick={onLogout}
            className="flex items-center justify-center gap-2 py-3 px-4 bg-white hover:bg-gray-50 text-gray-600 border border-gray-200 rounded-xl font-semibold text-sm transition-all shadow-sm"
          >
            <LogOut size={16} />
            Sair
          </button>
        </div>
      </div>
    </div>
  );
};
