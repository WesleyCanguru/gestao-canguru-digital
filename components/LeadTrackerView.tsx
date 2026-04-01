
import React, { useState, useEffect, useMemo } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Trash2, 
  Briefcase, 
  CheckCircle2, 
  FileText, 
  TrendingUp, 
  Users, 
  CheckCircle, 
  DollarSign,
  X,
  ThumbsUp,
  ThumbsDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
import { ClientLead, ClientLeadConfig } from '../types';
import { useLeadTracker } from '../hooks/useLeadTracker';
import { BRAZILIAN_STATES } from '../constants';

dayjs.locale('pt-br');

interface LeadTrackerViewProps {
  clientId: string;
  config: ClientLeadConfig;
  onBack: () => void;
}

export const LeadTrackerView: React.FC<LeadTrackerViewProps> = ({ clientId, config, onBack }) => {
  const { fetchLeads, fetchMonthLeads, addLead, updateLead, deleteLead } = useLeadTracker();
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [leads, setLeads] = useState<ClientLead[]>([]);
  const [monthLeads, setMonthLeads] = useState<ClientLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form state for new lead
  const [newLead, setNewLead] = useState<Partial<ClientLead>>({
    origin: BRAZILIAN_STATES[0],
    quality: 'bom',
    quote_sent: false,
    closed: false,
    deal_value: 0,
    notes: ''
  });

  const loadData = async () => {
    setLoading(true);
    const dateStr = selectedDate.format('YYYY-MM-DD');
    const monthYear = selectedDate.format('YYYY-MM');
    
    const [dayData, monthData] = await Promise.all([
      fetchLeads(clientId, dateStr),
      fetchMonthLeads(clientId, monthYear)
    ]);
    
    setLeads(dayData);
    setMonthLeads(monthData);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [selectedDate, clientId]);

  const stats = useMemo(() => {
    const total = monthLeads.length;
    const good = monthLeads.filter(l => l.quality === 'bom').length;
    const bad = monthLeads.filter(l => l.quality === 'ruim').length;
    const closed = monthLeads.filter(l => l.closed).length;
    const revenue = monthLeads.reduce((acc, l) => acc + (l.closed ? (Number(l.deal_value) || 0) : 0), 0);
    
    const goodPercent = total > 0 ? Math.round((good / total) * 100) : 0;
    const conversionRate = total > 0 ? Math.round((closed / total) * 100) : 0;
    
    return { total, good, bad, goodPercent, conversionRate, revenue };
  }, [monthLeads]);

  const handlePrevDay = () => setSelectedDate(prev => prev.subtract(1, 'day'));
  const handleNextDay = () => setSelectedDate(prev => prev.add(1, 'day'));
  const handleToday = () => setSelectedDate(dayjs());

  const dateDisplay = useMemo(() => {
    if (selectedDate.isSame(dayjs(), 'day')) return 'Hoje';
    if (selectedDate.isSame(dayjs().subtract(1, 'day'), 'day')) return 'Ontem';
    return selectedDate.format('DD [de] MMMM');
  }, [selectedDate]);

  const handleAddLead = async () => {
    try {
      await addLead({
        client_id: clientId,
        lead_date: selectedDate.format('YYYY-MM-DD'),
        origin: newLead.origin || '',
        quality: newLead.quality as 'bom' | 'ruim',
        quote_sent: !!newLead.quote_sent,
        closed: !!newLead.closed,
        deal_value: Number(newLead.deal_value) || 0,
        notes: newLead.notes || null
      });
      setIsModalOpen(false);
      setNewLead({
        origin: BRAZILIAN_STATES[0],
        quality: 'bom',
        quote_sent: false,
        closed: false,
        deal_value: 0,
        notes: ''
      });
      loadData();
    } catch (error) {
      console.error(error);
    }
  };

  const handleToggleQuality = async (lead: ClientLead) => {
    const newQuality = lead.quality === 'bom' ? 'ruim' : 'bom';
    try {
      await updateLead(lead.id, { quality: newQuality });
      loadData();
    } catch (error) {
      console.error(error);
    }
  };

  const handleUpdateLeadField = async (id: string, field: keyof ClientLead, value: any) => {
    try {
      await updateLead(id, { [field]: value });
      loadData();
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteLead = async (id: string) => {
    try {
      await deleteLead(id);
      loadData();
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Mini Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="premium-card p-6 flex flex-col justify-between">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
              <Users size={20} />
            </div>
            <span className="premium-label">Total do Mês</span>
          </div>
          <div className="text-4xl font-bold tracking-tighter">{stats.total}</div>
        </div>

        <div className="premium-card p-6 flex flex-col justify-between">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center text-green-600">
              <TrendingUp size={20} />
            </div>
            <span className="premium-label">Qualidade</span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-bold">
              <span className="text-green-600">{stats.goodPercent}% Bons</span>
              <span className="text-gray-400">{stats.good} de {stats.total}</span>
            </div>
            <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden flex">
              <div className="h-full bg-green-500" style={{ width: `${stats.goodPercent}%` }}></div>
              <div className="h-full bg-red-500" style={{ width: `${100 - stats.goodPercent}%` }}></div>
            </div>
          </div>
        </div>

        <div className="premium-card p-6 flex flex-col justify-between">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
              <CheckCircle size={20} />
            </div>
            <span className="premium-label">Conversão</span>
          </div>
          <div className="text-4xl font-bold tracking-tighter">{stats.conversionRate}%</div>
        </div>

        <div className="premium-card p-6 flex flex-col justify-between">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <DollarSign size={20} />
            </div>
            <span className="premium-label">Receita Potencial</span>
          </div>
          <div className="text-2xl font-bold tracking-tighter">
            {stats.revenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </div>
        </div>
      </div>

      {/* Date Navigation */}
      <div className="flex items-center justify-center gap-6">
        <button 
          onClick={handlePrevDay}
          className="w-10 h-10 rounded-full border border-black/[0.05] flex items-center justify-center hover:bg-gray-50 transition-colors"
        >
          <ChevronLeft size={20} />
        </button>
        
        <div className="text-center min-w-[200px]">
          <h2 className="text-2xl font-bold tracking-tight">{dateDisplay}</h2>
          <button 
            onClick={handleToday}
            className="text-[10px] font-bold uppercase tracking-widest text-brand-green hover:underline mt-1"
          >
            Voltar para hoje
          </button>
        </div>

        <button 
          onClick={handleNextDay}
          className="w-10 h-10 rounded-full border border-black/[0.05] flex items-center justify-center hover:bg-gray-50 transition-colors"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Leads List */}
      <div className="max-w-4xl mx-auto space-y-4">
        {leads.length === 0 ? (
          <div className="text-center py-12 bg-gray-50/50 rounded-[2.5rem] border border-dashed border-gray-200">
            <p className="text-gray-400 font-medium">Nenhum lead registrado para este dia.</p>
          </div>
        ) : (
          leads.map((lead) => (
            <div key={lead.id} className="premium-card p-4 group relative">
              <div className="flex flex-wrap items-center gap-4">
                {/* Origin Badge */}
                <div className="px-3 py-1.5 rounded-xl bg-gray-100 text-[11px] font-bold text-gray-600 uppercase tracking-wider">
                  {lead.origin}
                </div>

                {/* Quality Toggle */}
                <button 
                  onClick={() => handleToggleQuality(lead)}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all ${
                    lead.quality === 'bom' 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-red-100 text-red-700'
                  }`}
                >
                  {lead.quality === 'bom' ? 'Bom' : 'Ruim'}
                </button>

                {/* Quote Sent Toggle */}
                <button 
                  onClick={() => handleUpdateLeadField(lead.id, 'quote_sent', !lead.quote_sent)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all ${
                    lead.quote_sent ? 'text-blue-600 bg-blue-50' : 'text-gray-400 hover:bg-gray-50'
                  }`}
                >
                  <Briefcase size={14} />
                  Orçamento enviado
                </button>

                {/* Closed Toggle */}
                <button 
                  onClick={() => handleUpdateLeadField(lead.id, 'closed', !lead.closed)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all ${
                    lead.closed ? 'text-brand-green bg-green-50' : 'text-gray-400 hover:bg-gray-50'
                  }`}
                >
                  <CheckCircle2 size={14} />
                  Fechou
                </button>

                {/* Deal Value Inline */}
                {lead.closed && (
                  <div className="flex items-center gap-2 bg-gray-50 px-3 py-1 rounded-xl border border-black/[0.03]">
                    <span className="text-[10px] font-bold text-gray-400">R$</span>
                    <input 
                      type="number"
                      defaultValue={lead.deal_value}
                      onBlur={(e) => handleUpdateLeadField(lead.id, 'deal_value', Number(e.target.value))}
                      className="bg-transparent border-none p-0 w-20 text-sm font-bold focus:ring-0"
                      placeholder="Valor"
                    />
                  </div>
                )}

                {/* Notes Toggle (Simplified as a text field for now or expandable) */}
                <div className="flex-grow flex items-center gap-2 min-w-[200px]">
                  <FileText size={14} className="text-gray-400 shrink-0" />
                  <input 
                    type="text"
                    defaultValue={lead.notes || ''}
                    onBlur={(e) => handleUpdateLeadField(lead.id, 'notes', e.target.value)}
                    className="bg-transparent border-none p-0 w-full text-sm text-gray-600 placeholder:text-gray-300 focus:ring-0"
                    placeholder="Observações..."
                  />
                </div>

                {/* Delete Button */}
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <button 
                    onClick={() => handleDeleteLead(lead.id)}
                    className="p-2 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}

        <div className="flex justify-center pt-4">
          <button 
            onClick={() => setIsModalOpen(true)}
            className="premium-button premium-button-primary"
          >
            <Plus size={20} />
            Adicionar Lead
          </button>
        </div>
      </div>

      {/* Modal Adicionar Lead */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-brand-dark/40 backdrop-blur-sm"
            />
            
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white rounded-[2.5rem] p-8 w-full max-w-lg relative z-10 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-bold tracking-tight">Novo Lead</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="premium-label mb-2 block">Origem (Estado)</label>
                  <select 
                    value={newLead.origin}
                    onChange={(e) => setNewLead(prev => ({ ...prev, origin: e.target.value }))}
                    className="w-full bg-gray-50 border border-black/[0.05] rounded-2xl p-4 text-sm font-medium focus:ring-2 focus:ring-brand-green/20 outline-none"
                  >
                    {BRAZILIAN_STATES.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="premium-label mb-2 block">Qualidade</label>
                  <div className="grid grid-cols-2 gap-4">
                    <button 
                      onClick={() => setNewLead(prev => ({ ...prev, quality: 'bom' }))}
                      className={`flex items-center justify-center gap-2 p-4 rounded-2xl border transition-all font-bold ${
                        newLead.quality === 'bom' 
                          ? 'bg-green-50 border-green-200 text-green-700' 
                          : 'bg-white border-black/[0.05] text-gray-400 hover:bg-gray-50'
                      }`}
                    >
                      <ThumbsUp size={18} />
                      Bom
                    </button>
                    <button 
                      onClick={() => setNewLead(prev => ({ ...prev, quality: 'ruim' }))}
                      className={`flex items-center justify-center gap-2 p-4 rounded-2xl border transition-all font-bold ${
                        newLead.quality === 'ruim' 
                          ? 'bg-red-50 border-red-200 text-red-700' 
                          : 'bg-white border-black/[0.05] text-gray-400 hover:bg-gray-50'
                      }`}
                    >
                      <ThumbsDown size={18} />
                      Ruim
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <label className="flex items-center gap-3 p-4 rounded-2xl border border-black/[0.05] cursor-pointer hover:bg-gray-50 transition-colors">
                    <input 
                      type="checkbox" 
                      checked={newLead.quote_sent}
                      onChange={(e) => setNewLead(prev => ({ ...prev, quote_sent: e.target.checked }))}
                      className="w-5 h-5 rounded-lg border-gray-300 text-brand-green focus:ring-brand-green"
                    />
                    <span className="text-sm font-bold text-gray-600">Orçamento enviado</span>
                  </label>

                  <label className="flex items-center gap-3 p-4 rounded-2xl border border-black/[0.05] cursor-pointer hover:bg-gray-50 transition-colors">
                    <input 
                      type="checkbox" 
                      checked={newLead.closed}
                      onChange={(e) => setNewLead(prev => ({ ...prev, closed: e.target.checked }))}
                      className="w-5 h-5 rounded-lg border-gray-300 text-brand-green focus:ring-brand-green"
                    />
                    <span className="text-sm font-bold text-gray-600">Fechou o contrato</span>
                  </label>
                </div>

                {newLead.closed && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    className="overflow-hidden"
                  >
                    <label className="premium-label mb-2 block">Valor do Contrato (R$)</label>
                    <input 
                      type="number"
                      value={newLead.deal_value}
                      onChange={(e) => setNewLead(prev => ({ ...prev, deal_value: Number(e.target.value) }))}
                      className="w-full bg-gray-50 border border-black/[0.05] rounded-2xl p-4 text-sm font-medium focus:ring-2 focus:ring-brand-green/20 outline-none"
                      placeholder="0,00"
                    />
                  </motion.div>
                )}

                <div>
                  <label className="premium-label mb-2 block">Observações</label>
                  <textarea 
                    value={newLead.notes}
                    onChange={(e) => setNewLead(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full bg-gray-50 border border-black/[0.05] rounded-2xl p-4 text-sm font-medium focus:ring-2 focus:ring-brand-green/20 outline-none min-h-[100px]"
                    placeholder="Alguma nota importante?"
                  />
                </div>

                <button 
                  onClick={handleAddLead}
                  className="w-full premium-button premium-button-primary py-4"
                >
                  Salvar Lead
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
