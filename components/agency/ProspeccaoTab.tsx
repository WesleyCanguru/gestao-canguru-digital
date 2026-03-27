
import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Search, 
  Filter, 
  AlertCircle, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  MessageCircle,
  Instagram,
  Globe,
  MoreVertical,
  ArrowRight,
  ChevronRight
} from 'lucide-react';
import { useLeads } from '../../hooks/useLeads';
import { LeadCard } from './LeadCard';
import { LeadModal } from './LeadModal';
import { Lead, LeadStage } from '../../types';
import dayjs from 'dayjs';

const STAGES: { id: LeadStage; label: string; color: string }[] = [
  { id: 'lead', label: 'Lead', color: 'bg-gray-100 text-gray-600' },
  { id: 'first_message', label: '1ª Mensagem', color: 'bg-blue-100 text-blue-600' },
  { id: 'in_conversation', label: 'Em Conversa', color: 'bg-indigo-100 text-indigo-600' },
  { id: 'followup_1', label: 'Follow-up 1', color: 'bg-purple-100 text-purple-600' },
  { id: 'followup_2', label: 'Follow-up 2', color: 'bg-pink-100 text-pink-600' },
  { id: 'farewell', label: 'Despedida', color: 'bg-orange-100 text-orange-600' },
  { id: 'converted', label: 'Convertido', color: 'bg-green-100 text-green-600' },
  { id: 'lost', label: 'Perdido', color: 'bg-red-100 text-red-600' },
];

export const ProspeccaoTab: React.FC = () => {
  const { leads, loading, addLead, updateLeadStage, updateLead, deleteLead } = useLeads();
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [showNewLeadModal, setShowNewLeadModal] = useState(false);
  const [newLead, setNewLead] = useState<Partial<Lead>>({
    name: '',
    niche: 'Advocacia',
    instagram_url: '',
    instagram_bio: '',
    meta_ads_active: 'no',
    posting_frequency: 'none',
    website_url: '',
    meta_pixel_installed: 'no',
    google_tag_installed: 'no',
    preferred_communication: 'whatsapp',
    observations: ''
  });

  const kanbanLeads = useMemo(() => {
    const grouped: Record<LeadStage, Lead[]> = {
      lead: [],
      first_message: [],
      in_conversation: [],
      followup_1: [],
      followup_2: [],
      farewell: [],
      converted: [],
      lost: []
    };
    leads.forEach(lead => {
      if (grouped[lead.kanban_stage]) {
        grouped[lead.kanban_stage].push(lead);
      }
    });
    return grouped;
  }, [leads]);

  const pendingFollowupsCount = useMemo(() => {
    const today = dayjs().startOf('day');
    return leads.filter(l => l.next_followup_date && dayjs(l.next_followup_date).isBefore(today.add(1, 'day'))).length;
  }, [leads]);

  const handleAddLead = async (e: React.FormEvent) => {
    e.preventDefault();
    await addLead(newLead as any);
    setShowNewLeadModal(false);
    setNewLead({
      name: '',
      niche: 'Advocacia',
      instagram_url: '',
      instagram_bio: '',
      meta_ads_active: 'no',
      posting_frequency: 'none',
      website_url: '',
      meta_pixel_installed: 'no',
      google_tag_installed: 'no',
      preferred_communication: 'whatsapp',
      observations: ''
    });
  };

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-6">
          <div className="bg-white px-6 py-3 rounded-2xl border border-black/[0.03] shadow-sm flex items-center gap-3">
            <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center text-red-600">
              <Clock size={18} />
            </div>
            <span className="text-sm font-bold text-brand-dark uppercase tracking-widest">
              {pendingFollowupsCount} leads com follow-up pendente
            </span>
          </div>
        </div>

        <button 
          onClick={() => setShowNewLeadModal(true)}
          className="flex items-center gap-2 px-6 py-3 bg-brand-dark text-white rounded-2xl font-bold text-sm uppercase tracking-widest hover:bg-gray-800 transition-all shadow-xl shadow-brand-dark/10"
        >
          <Plus size={18} />
          Novo Lead
        </button>
      </div>

      {/* Kanban Board */}
      <div className="flex gap-6 overflow-x-auto pb-10 no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
        {/* Active Stages */}
        {STAGES.filter(s => s.id !== 'converted' && s.id !== 'lost').map((stage) => (
          <div key={stage.id} className="flex-shrink-0 w-80">
            <div className="flex items-center justify-between mb-6 px-2">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${stage.color.split(' ')[1].replace('text-', 'bg-')}`}></div>
                <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold text-gray-400">{stage.label}</h3>
              </div>
              <span className="text-[10px] font-bold text-gray-300 bg-gray-50 px-2 py-0.5 rounded-full">
                {kanbanLeads[stage.id].length}
              </span>
            </div>
            <div className="space-y-4 min-h-[500px] p-2 bg-gray-50/50 rounded-[2rem] border border-dashed border-gray-200">
              {kanbanLeads[stage.id].map(lead => (
                <LeadCard key={lead.id} lead={lead} onClick={() => setSelectedLead(lead)} />
              ))}
            </div>
          </div>
        ))}

        {/* Closed Stages */}
        <div className="flex-shrink-0 w-80 border-l border-gray-100 pl-6">
          <div className="flex items-center gap-2 mb-6 px-2">
            <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold text-gray-400">Encerrados</h3>
          </div>
          <div className="space-y-8">
            {STAGES.filter(s => s.id === 'converted' || s.id === 'lost').map((stage) => (
              <div key={stage.id}>
                <div className="flex items-center justify-between mb-4 px-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${stage.color.split(' ')[1].replace('text-', 'bg-')}`}></div>
                    <h3 className="text-[10px] uppercase tracking-[0.2em] font-bold text-gray-400">{stage.label}</h3>
                  </div>
                  <span className="text-[10px] font-bold text-gray-300 bg-gray-50 px-2 py-0.5 rounded-full">
                    {kanbanLeads[stage.id].length}
                  </span>
                </div>
                <div className="space-y-4 p-2 bg-gray-50/50 rounded-[2rem] border border-dashed border-gray-200">
                  {kanbanLeads[stage.id].map(lead => (
                    <LeadCard key={lead.id} lead={lead} onClick={() => setSelectedLead(lead)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Lead Modal */}
      {selectedLead && (
        <LeadModal 
          lead={selectedLead} 
          onClose={() => setSelectedLead(null)} 
          onUpdateStage={updateLeadStage}
          onUpdateLead={updateLead}
          onDelete={deleteLead}
        />
      )}

      {/* New Lead Modal */}
      {showNewLeadModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white w-full max-w-2xl rounded-[2.5rem] p-10 shadow-2xl max-h-[90vh] overflow-y-auto no-scrollbar"
          >
            <h3 className="text-2xl font-bold text-brand-dark mb-8">Novo Lead para Prospecção</h3>
            <form onSubmit={handleAddLead} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-gray-400 ml-1">Nome do Lead</label>
                  <input 
                    type="text" required
                    value={newLead.name}
                    onChange={(e) => setNewLead({ ...newLead, name: e.target.value })}
                    className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-brand-dark/5 focus:border-brand-dark outline-none transition-all font-medium"
                    placeholder="Ex: João Silva"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-gray-400 ml-1">Nicho</label>
                  <select 
                    value={newLead.niche}
                    onChange={(e) => setNewLead({ ...newLead, niche: e.target.value })}
                    className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-brand-dark/5 focus:border-brand-dark outline-none transition-all font-medium"
                  >
                    {['Advocacia', 'Medicina', 'Odontologia', 'Estética', 'Educação', 'E-commerce', 'Imobiliária', 'Alimentação', 'Moda', 'Outros'].map(n => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-gray-400 ml-1">Instagram URL</label>
                  <input 
                    type="url" required
                    value={newLead.instagram_url}
                    onChange={(e) => setNewLead({ ...newLead, instagram_url: e.target.value })}
                    className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-brand-dark/5 focus:border-brand-dark outline-none transition-all font-medium"
                    placeholder="https://instagram.com/..."
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-gray-400 ml-1">Site URL (Opcional)</label>
                  <input 
                    type="url"
                    value={newLead.website_url || ''}
                    onChange={(e) => setNewLead({ ...newLead, website_url: e.target.value })}
                    className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-brand-dark/5 focus:border-brand-dark outline-none transition-all font-medium"
                    placeholder="https://..."
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-gray-400 ml-1">Anúncios ativos no Meta?</label>
                  <select 
                    value={newLead.meta_ads_active}
                    onChange={(e) => setNewLead({ ...newLead, meta_ads_active: e.target.value as 'yes' | 'no' })}
                    className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-brand-dark/5 focus:border-brand-dark outline-none transition-all font-medium"
                  >
                    <option value="yes">Sim</option>
                    <option value="no">Não</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-gray-400 ml-1">Frequência de postagens</label>
                  <select 
                    value={newLead.posting_frequency}
                    onChange={(e) => setNewLead({ ...newLead, posting_frequency: e.target.value as any })}
                    className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-brand-dark/5 focus:border-brand-dark outline-none transition-all font-medium"
                  >
                    <option value="none">Não posta</option>
                    <option value="1-2x">1-2x/semana</option>
                    <option value="3-4x">3-4x/semana</option>
                    <option value="daily">Diária</option>
                    <option value="multiple">Várias vezes ao dia</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-gray-400 ml-1">Pixel da Meta instalado?</label>
                  <select 
                    value={newLead.meta_pixel_installed}
                    onChange={(e) => setNewLead({ ...newLead, meta_pixel_installed: e.target.value as any })}
                    className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-brand-dark/5 focus:border-brand-dark outline-none transition-all font-medium"
                  >
                    <option value="yes">Sim</option>
                    <option value="no">Não</option>
                    <option value="dont_know">Não sei</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-gray-400 ml-1">Tag do Google instalada?</label>
                  <select 
                    value={newLead.google_tag_installed}
                    onChange={(e) => setNewLead({ ...newLead, google_tag_installed: e.target.value as any })}
                    className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-brand-dark/5 focus:border-brand-dark outline-none transition-all font-medium"
                  >
                    <option value="yes">Sim</option>
                    <option value="no">Não</option>
                    <option value="dont_know">Não sei</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-gray-400 ml-1">Comunicação Preferencial</label>
                  <select 
                    value={newLead.preferred_communication}
                    onChange={(e) => setNewLead({ ...newLead, preferred_communication: e.target.value as any })}
                    className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-brand-dark/5 focus:border-brand-dark outline-none transition-all font-medium"
                  >
                    <option value="whatsapp">WhatsApp</option>
                    <option value="instagram_dm">Instagram DM</option>
                    <option value="email">E-mail</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest font-bold text-gray-400 ml-1">Bio do Instagram</label>
                <textarea 
                  value={newLead.instagram_bio || ''}
                  onChange={(e) => setNewLead({ ...newLead, instagram_bio: e.target.value })}
                  className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-brand-dark/5 focus:border-brand-dark outline-none transition-all font-medium h-24 resize-none"
                  placeholder="Cole a bio aqui..."
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest font-bold text-gray-400 ml-1">Observações</label>
                <textarea 
                  value={newLead.observations || ''}
                  onChange={(e) => setNewLead({ ...newLead, observations: e.target.value })}
                  className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-brand-dark/5 focus:border-brand-dark outline-none transition-all font-medium h-24 resize-none"
                  placeholder="Notas internas..."
                />
              </div>
              <div className="flex gap-4 pt-4">
                <button 
                  type="button"
                  onClick={() => setShowNewLeadModal(false)}
                  className="flex-1 py-4 bg-gray-50 text-gray-500 rounded-2xl font-bold text-sm uppercase tracking-widest hover:bg-gray-100 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-4 bg-brand-dark text-white rounded-2xl font-bold text-sm uppercase tracking-widest hover:bg-gray-800 transition-all shadow-xl shadow-brand-dark/10"
                >
                  Cadastrar Lead
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};
