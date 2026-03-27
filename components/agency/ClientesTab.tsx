
import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Users, 
  Settings, 
  ExternalLink, 
  Calendar, 
  CheckCircle2, 
  ArrowRight,
  Globe,
  Instagram,
  BarChart2,
  Zap,
  MoreVertical
} from 'lucide-react';
import { useClientesOverview } from '../../hooks/useClientesOverview';
import { QuickLinksModal } from './QuickLinksModal';
import dayjs from 'dayjs';

interface ClientesTabProps {
  onSelectClient: (client: any) => void;
}

export const ClientesTab: React.FC<ClientesTabProps> = ({ onSelectClient }) => {
  const { clients, quickLinks, stats, loading, addQuickLink, deleteQuickLink } = useClientesOverview();
  const [selectedClientForLinks, setSelectedClientForLinks] = useState<any | null>(null);

  const formatTypeIcon = (type: string) => {
    switch (type) {
      case 'google_ads': return <span className="text-green-500">🟢</span>;
      case 'meta_ads': return <span className="text-blue-500">🔵</span>;
      case 'reportei': return <BarChart2 size={14} className="text-indigo-500" />;
      case 'instagram': return <Instagram size={14} className="text-pink-500" />;
      default: return <Globe size={14} className="text-gray-400" />;
    }
  };

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-6">
          <div className="bg-white px-6 py-3 rounded-2xl border border-black/[0.03] shadow-sm flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
              <Users size={18} />
            </div>
            <span className="text-sm font-bold text-brand-dark uppercase tracking-widest">
              {clients.length} Clientes Ativos
            </span>
          </div>
        </div>
      </div>

      {/* Clients Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {clients.map((client) => {
          const clientStats = stats[client.id] || { publishedToday: 0, nextPublication: null, totalPublishedMonth: 0 };
          const clientLinks = quickLinks.filter(l => l.client_id === client.id);

          return (
            <motion.div
              key={client.id}
              whileHover={{ y: -5 }}
              className="bg-white rounded-[2.5rem] border border-black/[0.03] shadow-sm overflow-hidden flex flex-col"
            >
              {/* Card Header */}
              <div className="p-8 border-b border-gray-50 flex justify-between items-start">
                <div className="flex items-center gap-4">
                  <div 
                    className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-black/5"
                    style={{ backgroundColor: client.color }}
                  >
                    {client.logo_url ? (
                      <img src={client.logo_url} alt={client.name} className="w-full h-full object-contain mix-blend-multiply" />
                    ) : (
                      client.initials
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-brand-dark text-lg">{client.name}</h3>
                      <span className="w-2 h-2 rounded-full bg-green-500"></span>
                    </div>
                    <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400">{client.segment}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedClientForLinks(client)}
                  className="p-3 hover:bg-gray-50 rounded-2xl transition-colors text-gray-400 hover:text-brand-dark"
                >
                  <Settings size={20} />
                </button>
              </div>

              {/* Card Stats */}
              <div className="p-8 grid grid-cols-2 gap-6 border-b border-gray-50">
                <div className="space-y-1">
                  <p className="text-[8px] uppercase tracking-widest font-bold text-gray-400">Publicações Hoje</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-bold text-brand-dark">{clientStats.publishedToday}</span>
                    {clientStats.publishedToday > 0 && <CheckCircle2 size={14} className="text-green-500" />}
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-[8px] uppercase tracking-widest font-bold text-gray-400">Total no Mês</p>
                  <span className="text-xl font-bold text-brand-dark">{clientStats.totalPublishedMonth}</span>
                </div>
                <div className="col-span-2 space-y-1">
                  <p className="text-[8px] uppercase tracking-widest font-bold text-gray-400">Próxima Publicação</p>
                  <div className="flex items-center gap-2 text-sm font-bold text-brand-dark">
                    <Calendar size={14} className="text-blue-600" />
                    {clientStats.nextPublication ? dayjs(clientStats.nextPublication).format('DD/MM/YYYY') : 'Nenhuma agendada'}
                  </div>
                </div>
              </div>

              {/* Quick Links */}
              <div className="p-8 flex-grow">
                <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400 mb-4">Links Rápidos</p>
                <div className="flex flex-wrap gap-2">
                  {clientLinks.map((link) => (
                    <a 
                      key={link.id}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-100 rounded-xl text-[10px] font-bold text-brand-dark uppercase tracking-widest transition-all"
                    >
                      {formatTypeIcon(link.type)}
                      {link.label}
                    </a>
                  ))}
                  {clientLinks.length === 0 && (
                    <p className="text-[10px] text-gray-300 font-medium italic">Nenhum link cadastrado.</p>
                  )}
                </div>
              </div>

              {/* Card Footer */}
              <div className="p-8 pt-0 mt-auto">
                <button 
                  onClick={() => onSelectClient(client)}
                  className="w-full py-4 bg-gray-50 text-brand-dark rounded-2xl font-bold text-[10px] uppercase tracking-widest hover:bg-brand-dark hover:text-white transition-all flex items-center justify-center gap-2"
                >
                  Gerenciar Cliente <ArrowRight size={14} />
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Quick Links Modal */}
      {selectedClientForLinks && (
        <QuickLinksModal 
          client={selectedClientForLinks} 
          links={quickLinks.filter(l => l.client_id === selectedClientForLinks.id)}
          onClose={() => setSelectedClientForLinks(null)}
          onAdd={addQuickLink}
          onDelete={deleteQuickLink}
        />
      )}
    </div>
  );
};
