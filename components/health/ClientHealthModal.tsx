import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Activity, Building2 } from 'lucide-react';
import { Client } from '../../types';
import { ClientHealthPanel } from './ClientHealthPanel';

interface ClientHealthModalProps {
  client: Client | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ClientHealthModal: React.FC<ClientHealthModalProps> = ({
  client,
  isOpen,
  onClose
}) => {
  if (!isOpen || !client) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-black/60 backdrop-blur-sm animate-fade-in">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className="bg-white rounded-3xl shadow-2xl border border-black/[0.06] w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden relative my-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-stone-50/50">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-bold text-sm shadow-xs overflow-hidden shrink-0"
                style={{ backgroundColor: client.color || '#1e293b' }}
              >
                {client.logo_url ? (
                  <img src={client.logo_url} alt={client.name} className="w-full h-full object-contain mix-blend-multiply" />
                ) : (
                  client.initials || client.name.slice(0, 2).toUpperCase()
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-brand-dark text-base">{client.name}</h2>
                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200/60 rounded-full text-[9px] font-black uppercase tracking-wider">
                    Health Score
                  </span>
                </div>
                <p className="text-[11px] text-gray-400 font-medium">
                  {client.responsible ? `Responsável: ${client.responsible}` : 'Diagnóstico de saúde e risco de cancelamento'}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-brand-dark flex items-center justify-center transition-colors cursor-pointer"
              title="Fechar"
            >
              <X size={16} />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
            <ClientHealthPanel client={client} />
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
