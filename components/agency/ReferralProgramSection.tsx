import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  DollarSign, 
  Plus, 
  Edit2, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Link as LinkIcon, 
  Search, 
  Check, 
  X, 
  UserPlus, 
  Percent, 
  Calendar, 
  Sparkles,
  Info
} from 'lucide-react';
import { useReferralProgram } from '../../hooks/useReferralProgram';
import { ReferralPartner, ReferralCommission, Client } from '../../types';
import dayjs from 'dayjs';

interface ReferralProgramSectionProps {
  formatCurrency: (val: number | string | null | undefined) => string;
}

export const ReferralProgramSection: React.FC<ReferralProgramSectionProps> = ({ formatCurrency }) => {
  const {
    partners,
    commissions,
    overdueCommissions,
    pendingCommissions,
    clients,
    loading,
    addPartner,
    updatePartner,
    linkClientToPartner,
    markCommissionAsPaid
  } = useReferralProgram();

  const [activeTab, setActiveTab] = useState<'partners' | 'commissions'>('commissions');
  const [commissionFilter, setCommissionFilter] = useState<'all' | 'pending' | 'paid'>('pending');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [showPartnerModal, setShowPartnerModal] = useState(false);
  const [editingPartner, setEditingPartner] = useState<ReferralPartner | null>(null);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [savingPartner, setSavingPartner] = useState(false);
  const [markingCommId, setMarkingCommId] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    contact: '',
    commission_rate: 10,
    notes: '',
    is_active: true
  });

  const openNewPartnerModal = () => {
    setEditingPartner(null);
    setFormData({
      name: '',
      contact: '',
      commission_rate: 10,
      notes: '',
      is_active: true
    });
    setShowPartnerModal(true);
  };

  const openEditPartnerModal = (partner: ReferralPartner) => {
    setEditingPartner(partner);
    setFormData({
      name: partner.name,
      contact: partner.contact || '',
      commission_rate: partner.commission_rate,
      notes: partner.notes || '',
      is_active: partner.is_active
    });
    setShowPartnerModal(true);
  };

  const handleSavePartner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || savingPartner) return;
    setSavingPartner(true);

    try {
      if (editingPartner) {
        await updatePartner(editingPartner.id, {
          name: formData.name.trim(),
          contact: formData.contact.trim() || null,
          commission_rate: Number(formData.commission_rate) || 0,
          notes: formData.notes.trim() || null,
          is_active: formData.is_active
        });
      } else {
        await addPartner({
          name: formData.name.trim(),
          contact: formData.contact.trim() || null,
          commission_rate: Number(formData.commission_rate) || 0,
          notes: formData.notes.trim() || null,
          is_active: formData.is_active,
          agency_id: 0
        });
      }
      setShowPartnerModal(false);
    } catch (err) {
      console.error('Error saving partner:', err);
    } finally {
      setSavingPartner(false);
    }
  };

  const handleMarkPaid = async (comm: ReferralCommission) => {
    if (markingCommId) return;
    setMarkingCommId(comm.id);
    try {
      await markCommissionAsPaid(comm.id);
    } catch (err) {
      console.error('Error marking commission as paid:', err);
    } finally {
      setMarkingCommId(null);
    }
  };

  // Filter commissions
  const filteredCommissions = commissions.filter(comm => {
    if (commissionFilter === 'pending' && comm.paid_to_partner) return false;
    if (commissionFilter === 'paid' && !comm.paid_to_partner) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const pName = (comm.partner?.name || '').toLowerCase();
      const cName = (comm.client?.name || '').toLowerCase();
      return pName.includes(q) || cName.includes(q);
    }
    return true;
  });

  // Filter partners
  const filteredPartners = partners.filter(p => {
    if (searchQuery.trim()) {
      return p.name.toLowerCase().includes(searchQuery.toLowerCase());
    }
    return true;
  });

  // Summary Metrics
  const totalPendingVal = pendingCommissions.reduce((acc, c) => acc + Number(c.commission_amount || 0), 0);
  const totalOverdueVal = overdueCommissions.reduce((acc, c) => acc + Number(c.commission_amount || 0), 0);
  const totalPaidVal = commissions
    .filter(c => c.paid_to_partner)
    .reduce((acc, c) => acc + Number(c.commission_amount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Sub-Header & Navigation */}
      <div className="bg-white p-5 rounded-3xl border border-black/[0.04] shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-purple-50 text-purple-600">
              <Sparkles size={18} />
            </span>
            <h3 className="text-lg font-bold text-brand-dark">Programa de Indicação & Comissões</h3>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Gestão de parceiros comerciais, vínculos com clientes e repasse automático de comissões (5 dias após o pagamento do cliente).
          </p>
        </div>

        {/* Tab Toggle Buttons */}
        <div className="flex items-center gap-1.5 p-1.5 bg-stone-100 rounded-2xl self-start md:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('commissions')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'commissions'
                ? 'bg-white text-brand-dark shadow-sm'
                : 'text-gray-500 hover:text-brand-dark'
            }`}
          >
            <Clock size={14} />
            <span>Comissões</span>
            {pendingCommissions.length > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                overdueCommissions.length > 0 ? 'bg-rose-500 text-white font-extrabold' : 'bg-purple-100 text-purple-700'
              }`}>
                {pendingCommissions.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('partners')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'partners'
                ? 'bg-white text-brand-dark shadow-sm'
                : 'text-gray-500 hover:text-brand-dark'
            }`}
          >
            <Users size={14} />
            <span>Parceiros</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-stone-200 text-stone-700">
              {partners.length}
            </span>
          </button>
        </div>
      </div>

      {/* Overview Cards for Commissions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-black/[0.04] shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[9px] uppercase tracking-widest font-bold text-gray-400 block mb-1">
              Comissões Pendentes
            </span>
            <h4 className="text-xl font-extrabold text-amber-600">
              {formatCurrency(totalPendingVal)}
            </h4>
            <span className="text-[10px] text-gray-400 mt-1 block">
              {pendingCommissions.length} registro(s) aguardando repasse
            </span>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Clock size={20} />
          </div>
        </div>

        <div className={`p-5 rounded-3xl border shadow-sm flex items-center justify-between transition-all ${
          overdueCommissions.length > 0 
            ? 'bg-rose-50/50 border-rose-200' 
            : 'bg-white border-black/[0.04]'
        }`}>
          <div>
            <span className={`text-[9px] uppercase tracking-widest font-bold block mb-1 ${
              overdueCommissions.length > 0 ? 'text-rose-600' : 'text-gray-400'
            }`}>
              Vencidas (Prontas p/ Pagar)
            </span>
            <h4 className={`text-xl font-extrabold ${
              overdueCommissions.length > 0 ? 'text-rose-600' : 'text-stone-700'
            }`}>
              {formatCurrency(totalOverdueVal)}
            </h4>
            <span className={`text-[10px] mt-1 block ${
              overdueCommissions.length > 0 ? 'text-rose-700 font-bold' : 'text-gray-400'
            }`}>
              {overdueCommissions.length} comissão(ões) no prazo ou em atraso
            </span>
          </div>
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
            overdueCommissions.length > 0 ? 'bg-rose-100 text-rose-600' : 'bg-stone-100 text-stone-500'
          }`}>
            <AlertTriangle size={20} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-black/[0.04] shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[9px] uppercase tracking-widest font-bold text-gray-400 block mb-1">
              Total Pago aos Parceiros
            </span>
            <h4 className="text-xl font-extrabold text-emerald-600">
              {formatCurrency(totalPaidVal)}
            </h4>
            <span className="text-[10px] text-gray-400 mt-1 block">
              Histórico acumulado
            </span>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 size={20} />
          </div>
        </div>
      </div>

      {/* SEARCH AND CONTROLS BAR */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-3xl border border-black/[0.04] shadow-sm">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder={activeTab === 'commissions' ? "Buscar por parceiro ou cliente..." : "Buscar parceiro..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-stone-50 border border-black/[0.04] rounded-2xl text-xs text-brand-dark focus:outline-none focus:ring-2 focus:ring-purple-500/20"
          />
        </div>

        {/* Tab Specific Actions */}
        {activeTab === 'commissions' ? (
          <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-2xl">
            <button
              type="button"
              onClick={() => setCommissionFilter('pending')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                commissionFilter === 'pending'
                  ? 'bg-white text-brand-dark shadow-sm'
                  : 'text-gray-500 hover:text-brand-dark'
              }`}
            >
              Pendentes ({pendingCommissions.length})
            </button>
            <button
              type="button"
              onClick={() => setCommissionFilter('paid')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                commissionFilter === 'paid'
                  ? 'bg-white text-brand-dark shadow-sm'
                  : 'text-gray-500 hover:text-brand-dark'
              }`}
            >
              Pagas
            </button>
            <button
              type="button"
              onClick={() => setCommissionFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                commissionFilter === 'all'
                  ? 'bg-white text-brand-dark shadow-sm'
                  : 'text-gray-500 hover:text-brand-dark'
              }`}
            >
              Todas
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowLinkModal(true)}
              className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-brand-dark rounded-2xl text-xs font-bold transition-all flex items-center gap-2"
            >
              <LinkIcon size={14} />
              <span>Vincular Clientes</span>
            </button>

            <button
              type="button"
              onClick={openNewPartnerModal}
              className="px-4 py-2 bg-brand-dark text-white rounded-2xl text-xs font-bold transition-all flex items-center gap-2 hover:bg-stone-800 shadow-md shadow-brand-dark/10"
            >
              <UserPlus size={14} />
              <span>Novo Parceiro</span>
            </button>
          </div>
        )}
      </div>

      {/* TAB CONTENT: COMISSÕES */}
      {activeTab === 'commissions' && (
        <div className="bg-white rounded-3xl border border-black/[0.04] shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between">
            <h4 className="font-bold text-brand-dark text-sm">Registros de Comissões</h4>
            <span className="text-xs text-gray-400">
              Regra: 5 dias após o pagamento do cliente • Calculado exclusivamente sobre o <span className="font-semibold text-stone-600">Valor Base</span>.
            </span>
          </div>

          {loading ? (
            <div className="p-8 text-center text-gray-400 text-sm">Carregando comissões...</div>
          ) : filteredCommissions.length === 0 ? (
            <div className="p-12 text-center text-gray-400 space-y-2">
              <Clock size={32} className="mx-auto text-gray-300" />
              <p className="text-sm font-medium">Nenhuma comissão encontrada para este filtro.</p>
              <p className="text-xs">
                As comissões são geradas automaticamente quando o faturamento de um cliente vinculado a um parceiro é marcado como <span className="font-bold">Pago</span>.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-stone-50/70 border-b border-stone-100">
                    <th className="px-6 py-3.5 text-[9px] uppercase tracking-widest font-bold text-gray-400">Parceiro</th>
                    <th className="px-6 py-3.5 text-[9px] uppercase tracking-widest font-bold text-gray-400">Cliente Indicado</th>
                    <th className="px-6 py-3.5 text-[9px] uppercase tracking-widest font-bold text-gray-400">Valor da Comissão</th>
                    <th className="px-6 py-3.5 text-[9px] uppercase tracking-widest font-bold text-gray-400">Pagamento Cliente</th>
                    <th className="px-6 py-3.5 text-[9px] uppercase tracking-widest font-bold text-gray-400">Vencimento Parceiro</th>
                    <th className="px-6 py-3.5 text-[9px] uppercase tracking-widest font-bold text-gray-400">Status</th>
                    <th className="px-6 py-3.5 text-[9px] uppercase tracking-widest font-bold text-gray-400 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredCommissions.map((comm) => {
                    const todayStr = dayjs().format('YYYY-MM-DD');
                    const isOverdue = !comm.paid_to_partner && comm.partner_due_date <= todayStr;
                    const partnerName = comm.partner?.name || partners.find(p => p.id === comm.partner_id)?.name || 'Parceiro';
                    const clientObj = comm.client || clients.find(c => c.id === comm.client_id);
                    const clientName = clientObj?.name || 'Cliente';

                    return (
                      <tr key={comm.id} className="hover:bg-stone-50/50 transition-colors">
                        {/* Parceiro */}
                        <td className="px-6 py-4">
                          <span className="font-bold text-sm text-brand-dark block">{partnerName}</span>
                          <span className="text-[10px] text-gray-400">
                            {comm.partner?.commission_rate || 0}% de comissão
                          </span>
                        </td>

                        {/* Cliente */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2.5">
                            {clientObj?.color ? (
                              <div
                                className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-[10px]"
                                style={{ backgroundColor: clientObj.color }}
                              >
                                {clientObj.initials}
                              </div>
                            ) : (
                              <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 font-bold text-[10px] flex items-center justify-center">
                                CL
                              </div>
                            )}
                            <span className="font-semibold text-xs text-stone-700">{clientName}</span>
                          </div>
                        </td>

                        {/* Valor */}
                        <td className="px-6 py-4 font-extrabold text-sm text-brand-dark">
                          {formatCurrency(comm.commission_amount)}
                        </td>

                        {/* Pago em */}
                        <td className="px-6 py-4 text-xs text-stone-600">
                          {comm.client_paid_at ? dayjs(comm.client_paid_at).format('DD/MM/YYYY') : '-'}
                        </td>

                        {/* Vencimento Parceiro (+5 dias) */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-xs font-bold ${isOverdue ? 'text-rose-600' : 'text-stone-700'}`}>
                              {dayjs(comm.partner_due_date).format('DD/MM/YYYY')}
                            </span>
                            {isOverdue && (
                              <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 text-[9px] font-extrabold uppercase tracking-wider">
                                Vencida
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Status Badge */}
                        <td className="px-6 py-4">
                          {comm.paid_to_partner ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-widest bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                              Pago
                            </span>
                          ) : isOverdue ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-widest bg-rose-50 text-rose-700 border border-rose-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                              Pagar Agora
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-widest bg-amber-50 text-amber-700 border border-amber-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
                              Aguardando (+5 dias)
                            </span>
                          )}
                        </td>

                        {/* Action Button */}
                        <td className="px-6 py-4 text-right">
                          {!comm.paid_to_partner ? (
                            <button
                              type="button"
                              disabled={markingCommId === comm.id}
                              onClick={() => handleMarkPaid(comm)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all shadow-sm disabled:opacity-50"
                            >
                              {markingCommId === comm.id ? 'Salvando...' : 'Marcar como Paga'}
                            </button>
                          ) : (
                            <span className="text-[10px] text-gray-400 font-medium">
                              Quitada em {comm.paid_to_partner_at ? dayjs(comm.paid_to_partner_at).format('DD/MM/YY') : 'OK'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: PARCEIROS */}
      {activeTab === 'partners' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPartners.map((partner) => {
            const linkedClients = clients.filter(c => c.referral_partner_id === partner.id);

            return (
              <div
                key={partner.id}
                className="bg-white p-5 rounded-3xl border border-black/[0.04] shadow-sm flex flex-col justify-between space-y-4 hover:border-purple-200 transition-all"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-extrabold text-base text-brand-dark">{partner.name}</h4>
                      {partner.contact && (
                        <p className="text-xs text-gray-400 mt-0.5">{partner.contact}</p>
                      )}
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-[9px] font-extrabold uppercase tracking-widest ${
                      partner.is_active 
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                        : 'bg-stone-100 text-stone-500'
                    }`}>
                      {partner.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>

                  {/* Commission Pill */}
                  <div className="flex items-center justify-between p-3 bg-stone-50 rounded-2xl border border-black/[0.03]">
                    <span className="text-xs text-gray-500 font-medium">Taxa de Comissão:</span>
                    <span className="text-sm font-extrabold text-purple-700 bg-purple-50 px-3 py-1 rounded-xl">
                      {partner.commission_rate}%
                    </span>
                  </div>

                  {/* Linked Clients */}
                  <div>
                    <span className="text-[9px] uppercase tracking-widest font-bold text-gray-400 block mb-1.5">
                      Clientes Indicados ({linkedClients.length})
                    </span>
                    {linkedClients.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {linkedClients.map(c => (
                          <span
                            key={c.id}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-stone-100 rounded-lg text-xs font-semibold text-stone-700"
                          >
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                            {c.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 italic">Nenhum cliente vinculado ainda.</p>
                    )}
                  </div>

                  {partner.notes && (
                    <p className="text-xs text-gray-500 bg-stone-50/50 p-2.5 rounded-xl border border-black/[0.02]">
                      {partner.notes}
                    </p>
                  )}
                </div>

                {/* Footer metrics & actions */}
                <div className="pt-3 border-t border-stone-100 flex items-center justify-between">
                  <div>
                    <span className="text-[9px] text-gray-400 block">Total já pago</span>
                    <span className="text-xs font-bold text-emerald-600">
                      {formatCurrency(partner.total_paid_history || 0)}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => openEditPartnerModal(partner)}
                    className="p-2 text-stone-500 hover:text-purple-600 hover:bg-purple-50 rounded-xl transition-all"
                    title="Editar parceiro"
                  >
                    <Edit2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: NOVO / EDITAR PARCEIRO */}
      <AnimatePresence>
        {showPartnerModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-stone-100 space-y-5"
            >
              <div className="flex justify-between items-center border-b border-stone-100 pb-3">
                <h3 className="font-bold text-lg text-brand-dark">
                  {editingPartner ? 'Editar Parceiro' : 'Novo Parceiro de Indicação'}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowPartnerModal(false)}
                  className="p-1 text-gray-400 hover:text-brand-dark rounded-xl"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSavePartner} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Nome do Parceiro *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Eric, Zizi"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Contato (Telefone / E-mail)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: (11) 99999-9999 ou email@parceiro.com"
                    value={formData.contact}
                    onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Percentual de Comissão (%) *
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="100"
                      required
                      placeholder="Ex: 10"
                      value={formData.commission_rate}
                      onChange={(e) => setFormData({ ...formData, commission_rate: Number(e.target.value) })}
                      className="w-full px-3.5 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 pr-10"
                    />
                    <Percent size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">
                    A comissão será calculada como {formData.commission_rate}% sobre o <span className="font-bold">Valor Base</span> de cada fatura quitada pelo cliente.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Observações
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Notas internas sobre o parceiro ou condições negociadas..."
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="is_active_chk"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4 text-purple-600 rounded border-stone-300 focus:ring-purple-500"
                  />
                  <label htmlFor="is_active_chk" className="text-xs font-medium text-stone-700">
                    Parceiro Ativo no sistema
                  </label>
                </div>

                <div className="flex items-center justify-end gap-2 pt-4 border-t border-stone-100">
                  <button
                    type="button"
                    onClick={() => setShowPartnerModal(false)}
                    className="px-4 py-2 text-xs font-bold text-stone-500 hover:bg-stone-100 rounded-xl"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={savingPartner}
                    className="px-5 py-2 bg-brand-dark text-white rounded-xl text-xs font-bold hover:bg-stone-800 transition-all shadow-md shadow-brand-dark/10"
                  >
                    {savingPartner ? 'Salvando...' : 'Salvar Parceiro'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: VINCULAR CLIENTES AOS PARCEIROS */}
      <AnimatePresence>
        {showLinkModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-stone-100 space-y-5"
            >
              <div className="flex justify-between items-center border-b border-stone-100 pb-3">
                <div>
                  <h3 className="font-bold text-lg text-brand-dark">Vincular Clientes aos Parceiros</h3>
                  <p className="text-xs text-gray-400">Selecione qual parceiro indicou cada cliente da agência</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowLinkModal(false)}
                  className="p-1 text-gray-400 hover:text-brand-dark rounded-xl"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="max-h-[350px] overflow-y-auto space-y-3 pr-1">
                {clients.map((client) => {
                  return (
                    <div key={client.id} className="flex items-center justify-between p-3 bg-stone-50 rounded-2xl border border-black/[0.03]">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-[10px]"
                          style={{ backgroundColor: client.color }}
                        >
                          {client.initials}
                        </div>
                        <span className="font-bold text-xs text-brand-dark">{client.name}</span>
                      </div>

                      <select
                        value={client.referral_partner_id || ''}
                        onChange={(e) => linkClientToPartner(client.id, e.target.value || null)}
                        className="px-3 py-1.5 bg-white border border-stone-200 rounded-xl text-xs font-semibold text-brand-dark focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                      >
                        <option value="">Nenhum parceiro</option>
                        {partners.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.commission_rate}%)
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setShowLinkModal(false)}
                  className="px-5 py-2 bg-brand-dark text-white rounded-xl text-xs font-bold hover:bg-stone-800"
                >
                  Concluir
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
