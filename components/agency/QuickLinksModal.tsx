
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Plus, 
  Trash2, 
  ExternalLink, 
  Globe, 
  Instagram, 
  BarChart2, 
  Zap,
  Link as LinkIcon
} from 'lucide-react';
import { ClientQuickLink } from '../../types';

interface QuickLinksModalProps {
  client: any;
  links: ClientQuickLink[];
  onClose: () => void;
  onAdd: (clientId: string, link: Partial<ClientQuickLink>) => void;
  onDelete: (id: string) => void;
}

export const QuickLinksModal: React.FC<QuickLinksModalProps> = ({ client, links, onClose, onAdd, onDelete }) => {
  const [newLink, setNewLink] = useState<Partial<ClientQuickLink>>({
    type: 'other',
    label: '',
    url: ''
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (newLink.label && newLink.url) {
      onAdd(client.id, newLink);
      setNewLink({ type: 'other', label: '', url: '' });
    }
  };

  const formatTypeIcon = (type: string) => {
    switch (type) {
      case 'google_ads': return <span className="text-green-500">🟢</span>;
      case 'meta_ads': return <span className="text-blue-500">🔵</span>;
      case 'reportei': return <BarChart2 size={18} className="text-indigo-500" />;
      case 'instagram': return <Instagram size={18} className="text-pink-500" />;
      default: return <Globe size={18} className="text-gray-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="p-10 border-b border-gray-100 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div 
              className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-black/5"
              style={{ backgroundColor: client.color }}
            >
              {client.initials}
            </div>
            <div>
              <h3 className="text-2xl font-bold text-brand-dark">Links Rápidos</h3>
              <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400">{client.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-gray-50 rounded-2xl transition-colors text-gray-400">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-grow overflow-y-auto p-10 no-scrollbar space-y-10">
          {/* New Link Form */}
          <form onSubmit={handleAdd} className="space-y-6 bg-gray-50 p-8 rounded-[2rem] border border-gray-100">
            <h4 className="text-[10px] uppercase tracking-widest font-bold text-gray-400 text-center">Adicionar Novo Link</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[8px] uppercase tracking-widest font-bold text-gray-400 ml-1">Tipo</label>
                <select 
                  value={newLink.type}
                  onChange={(e) => setNewLink({ ...newLink, type: e.target.value as any })}
                  className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl focus:ring-2 focus:ring-brand-dark/5 focus:border-brand-dark outline-none transition-all font-medium text-sm"
                >
                  <option value="google_ads">Google Ads</option>
                  <option value="meta_ads">Meta Ads</option>
                  <option value="reportei">Reportei</option>
                  <option value="instagram">Instagram</option>
                  <option value="other">Outro</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[8px] uppercase tracking-widest font-bold text-gray-400 ml-1">Rótulo</label>
                <input 
                  type="text" required
                  value={newLink.label}
                  onChange={(e) => setNewLink({ ...newLink, label: e.target.value })}
                  className="w-full px-4 py-3 bg-white border border-gray-100 rounded-xl focus:ring-2 focus:ring-brand-dark/5 focus:border-brand-dark outline-none transition-all font-medium text-sm"
                  placeholder="Ex: Dashboard de Vendas"
                />
              </div>
              <div className="md:col-span-2 space-y-2">
                <label className="text-[8px] uppercase tracking-widest font-bold text-gray-400 ml-1">URL</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                    <LinkIcon size={14} />
                  </div>
                  <input 
                    type="url" required
                    value={newLink.url}
                    onChange={(e) => setNewLink({ ...newLink, url: e.target.value })}
                    className="w-full pl-10 pr-4 py-3 bg-white border border-gray-100 rounded-xl focus:ring-2 focus:ring-brand-dark/5 focus:border-brand-dark outline-none transition-all font-medium text-sm"
                    placeholder="https://..."
                  />
                </div>
              </div>
            </div>
            <button 
              type="submit"
              className="w-full py-4 bg-brand-dark text-white rounded-2xl font-bold text-[10px] uppercase tracking-widest hover:bg-gray-800 transition-all shadow-xl shadow-brand-dark/10 flex items-center justify-center gap-2"
            >
              <Plus size={16} />
              Adicionar Link
            </button>
          </form>

          {/* Existing Links List */}
          <div className="space-y-4">
            <h4 className="text-[10px] uppercase tracking-widest font-bold text-gray-400">Links Cadastrados</h4>
            <div className="space-y-3">
              {links.map((link) => (
                <div 
                  key={link.id}
                  className="flex items-center justify-between p-5 bg-white border border-gray-100 rounded-2xl group hover:border-brand-dark/20 transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center">
                      {formatTypeIcon(link.type)}
                    </div>
                    <div>
                      <p className="font-bold text-brand-dark text-sm">{link.label}</p>
                      <p className="text-[10px] text-gray-400 truncate max-w-[200px]">{link.url}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <a 
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <ExternalLink size={18} />
                    </a>
                    <button 
                      onClick={() => onDelete(link.id)}
                      className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
              {links.length === 0 && (
                <div className="text-center py-10 text-gray-400 italic text-sm">
                  Nenhum link cadastrado para este cliente.
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
