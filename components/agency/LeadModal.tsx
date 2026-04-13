
import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  X, 
  Instagram, 
  Globe, 
  MessageCircle, 
  Mail, 
  ArrowRight, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Trash2,
  ExternalLink,
  Calendar,
  Zap,
  ShieldCheck
} from 'lucide-react';
import { Lead, LeadStage } from '../../types';
import dayjs from 'dayjs';
import { ConfirmModal } from '../ConfirmModal';

interface LeadModalProps {
  lead: Lead;
  onClose: () => void;
  onUpdateStage: (id: string, stage: LeadStage) => void;
  onUpdateLead: (id: string, lead: Partial<Lead>) => void;
  onDelete: (id: string) => void;
}

const STAGES: Record<LeadStage, { label: string; next?: LeadStage }> = {
  lead: { label: 'Lead', next: 'first_message' },
  first_message: { label: '1ª Mensagem', next: 'in_conversation' },
  in_conversation: { label: 'Em Conversa', next: 'followup_1' },
  followup_1: { label: 'Follow-up 1', next: 'followup_2' },
  followup_2: { label: 'Follow-up 2', next: 'farewell' },
  farewell: { label: 'Despedida' },
  converted: { label: 'Convertido' },
  lost: { label: 'Perdido' },
};

export const LeadModal: React.FC<LeadModalProps> = ({ lead, onClose, onUpdateStage, onUpdateLead, onDelete }) => {
  const currentStageInfo = STAGES[lead.kanban_stage];
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleMoveToNext = () => {
    if (currentStageInfo.next) {
      onUpdateStage(lead.id, currentStageInfo.next);
    }
  };

  const handleMarkAsConverted = () => onUpdateStage(lead.id, 'converted');
  const handleMarkAsLost = () => onUpdateStage(lead.id, 'lost');

  const handleDelete = () => {
    onDelete(lead.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="p-10 border-b border-gray-100 flex justify-between items-start">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 bg-blue-50 rounded-3xl flex items-center justify-center text-blue-600">
              <Instagram size={40} />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="px-3 py-1 bg-gray-100 text-gray-500 text-[10px] font-bold uppercase tracking-widest rounded-full">
                  {lead.niche}
                </span>
                <span className="px-3 py-1 bg-blue-50 text-blue-600 text-[10px] font-bold uppercase tracking-widest rounded-full">
                  {currentStageInfo.label}
                </span>
              </div>
              <h2 className="text-3xl font-bold text-brand-dark">{lead.name}</h2>
            </div>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-gray-50 rounded-2xl transition-colors text-gray-400">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-grow overflow-y-auto p-10 no-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {/* Main Info */}
            <div className="md:col-span-2 space-y-10">
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400">Instagram</p>
                  <a href={lead.instagram_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-blue-600 font-bold hover:underline">
                    <Instagram size={16} />
                    @{lead.instagram_url.split('/').pop()}
                    <ExternalLink size={12} />
                  </a>
                </div>
                {lead.website_url && (
                  <div className="space-y-2">
                    <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400">Website</p>
                    <a href={lead.website_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-blue-600 font-bold hover:underline">
                      <Globe size={16} />
                      Acessar Site
                      <ExternalLink size={12} />
                    </a>
                  </div>
                )}
                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400">Comunicação</p>
                  <div className="flex items-center gap-2 text-brand-dark font-bold">
                    {lead.preferred_communication === 'whatsapp' && <MessageCircle size={16} />}
                    {lead.preferred_communication === 'instagram_dm' && <Instagram size={16} />}
                    {lead.preferred_communication === 'email' && <Mail size={16} />}
                    <span className="capitalize">{lead.preferred_communication.replace('_', ' ')}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400">Anúncios Meta</p>
                  <div className="flex items-center gap-2 text-brand-dark font-bold">
                    <Zap size={16} className={lead.meta_ads_active === 'yes' ? 'text-yellow-500' : 'text-gray-300'} />
                    <span>{lead.meta_ads_active === 'yes' ? 'Ativos' : 'Inativos'}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400">Bio do Instagram</p>
                <div className="p-6 bg-gray-50 rounded-2xl border border-gray-100 text-gray-600 leading-relaxed italic">
                  {lead.instagram_bio || 'Sem bio cadastrada.'}
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400">Observações Internas</p>
                <div className="p-6 bg-gray-50 rounded-2xl border border-gray-100 text-gray-600 leading-relaxed">
                  {lead.observations || 'Nenhuma observação.'}
                </div>
              </div>

              <div className="pt-6 border-t border-gray-50 flex items-center justify-between text-[10px] font-bold text-gray-300 uppercase tracking-widest">
                <div className="flex items-center gap-2">
                  <Calendar size={12} />
                  Criado em: {dayjs(lead.created_at).format('DD/MM/YYYY')}
                </div>
                <div className="flex items-center gap-2">
                  <Clock size={12} />
                  Última alteração: {dayjs(lead.stage_changed_at).format('DD/MM/YYYY HH:mm')}
                </div>
              </div>
            </div>

            {/* Sidebar Actions */}
            <div className="space-y-8">
              <div className="bg-gray-50 p-8 rounded-[2rem] border border-gray-100 space-y-6">
                <h4 className="text-[10px] uppercase tracking-widest font-bold text-gray-400 text-center">Ações do Kanban</h4>
                
                {currentStageInfo.next && (
                  <button 
                    onClick={handleMoveToNext}
                    className="w-full py-4 bg-brand-dark text-white rounded-2xl font-bold text-sm uppercase tracking-widest hover:bg-gray-800 transition-all shadow-xl shadow-brand-dark/10 flex items-center justify-center gap-2"
                  >
                    Próxima Etapa <ArrowRight size={16} />
                  </button>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={handleMarkAsConverted}
                    className="flex flex-col items-center gap-2 p-4 bg-white border border-green-100 text-green-600 rounded-2xl hover:bg-green-600 hover:text-white transition-all group"
                  >
                    <CheckCircle2 size={24} />
                    <span className="text-[8px] font-bold uppercase tracking-widest">Converter</span>
                  </button>
                  <button 
                    onClick={handleMarkAsLost}
                    className="flex flex-col items-center gap-2 p-4 bg-white border border-red-100 text-red-600 rounded-2xl hover:bg-red-600 hover:text-white transition-all group"
                  >
                    <XCircle size={24} />
                    <span className="text-[8px] font-bold uppercase tracking-widest">Perder</span>
                  </button>
                </div>
              </div>

              <div className="bg-blue-50/50 p-8 rounded-[2rem] border border-blue-100/50 space-y-4">
                <h4 className="text-[10px] uppercase tracking-widest font-bold text-blue-400 text-center">Status Técnico</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest">
                    <span className="text-gray-400">Pixel Meta</span>
                    <span className={lead.meta_pixel_installed === 'yes' ? 'text-green-600' : 'text-red-400'}>
                      {lead.meta_pixel_installed === 'yes' ? 'Instalado' : 'Não'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest">
                    <span className="text-gray-400">Google Tag</span>
                    <span className={lead.google_tag_installed === 'yes' ? 'text-green-600' : 'text-red-400'}>
                      {lead.google_tag_installed === 'yes' ? 'Instalado' : 'Não'}
                    </span>
                  </div>
                </div>
              </div>

              <button 
                onClick={() => setConfirmDelete(true)}
                className="w-full py-4 flex items-center justify-center gap-2 text-red-400 hover:text-red-600 font-bold text-[10px] uppercase tracking-widest transition-colors"
              >
                <Trash2 size={14} />
                Excluir Lead
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      <ConfirmModal
        isOpen={confirmDelete}
        title="Excluir Lead"
        message="Tem certeza que deseja excluir este lead?"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
};
