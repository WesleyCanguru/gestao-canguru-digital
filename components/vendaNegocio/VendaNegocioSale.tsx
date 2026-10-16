import React from 'react';
import { ClientLead, ClientLeadConfig } from '../../types';
import { Briefcase, CheckCircle2, TrendingUp, Calendar, DollarSign, User, Award, ArrowRight } from 'lucide-react';
import dayjs from 'dayjs';

interface VendaNegocioSaleProps {
  leads: ClientLead[];
  config: ClientLeadConfig;
  onOpenWinModal: (leadId: string) => void;
  onViewLead: (lead: ClientLead) => void;
}

export const VendaNegocioSale: React.FC<VendaNegocioSaleProps> = ({
  leads,
  config,
  onOpenWinModal,
  onViewLead
}) => {
  // Find sold lead (closed && kanban_stage === 'Vendido')
  const soldLead = leads.find(l => l.closed && (l.kanban_stage === 'Vendido' || l.kanban_stage === 'Fechado'));

  // Calculate stats
  const totalLeads = leads.length;
  const inNegotiation = leads.filter(l => l.kanban_stage === 'Proposta e negociação' && !l.closed).length;
  
  // First lead date
  const firstLeadDate = leads.length > 0
    ? leads.reduce((earliest, l) => {
        const d = l.lead_date || l.created_at;
        return d < earliest ? d : earliest;
      }, leads[0].lead_date || leads[0].created_at)
    : null;

  const daysOnMarket = firstLeadDate
    ? dayjs().diff(dayjs(firstLeadDate), 'day')
    : 0;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-[2rem] p-6 sm:p-10 border border-black/[0.03] shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
            <Award size={26} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Status da Venda do Negócio</h2>
            <p className="text-xs text-gray-500">Acompanhamento e registro da transação comercial principal.</p>
          </div>
        </div>

        {!soldLead ? (
          <div className="bg-gradient-to-br from-emerald-900 to-slate-900 text-white rounded-3xl p-8 sm:p-12 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
            
            <div className="relative z-10 max-w-2xl">
              <span className="inline-block px-3.5 py-1 bg-emerald-500/20 text-emerald-300 text-[10px] font-black uppercase tracking-widest rounded-full mb-4 border border-emerald-500/30">
                Oportunidade Ativa
              </span>
              <h3 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
                Negócio à venda
              </h3>
              <p className="text-gray-300 text-sm leading-relaxed mb-8">
                O funil de captação está ativo e qualificando potenciais compradores. Mova o interessado para a etapa de Venda quando o contrato for fechado.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/10 mb-8">
                <div>
                  <span className="block text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Tempo no mercado</span>
                  <span className="text-2xl font-black text-white">{daysOnMarket} <span className="text-xs font-normal text-gray-300">dias</span></span>
                </div>
                <div>
                  <span className="block text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Total de interessados</span>
                  <span className="text-2xl font-black text-white">{totalLeads}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Em negociação</span>
                  <span className="text-2xl font-black text-emerald-400">{inNegotiation}</span>
                </div>
              </div>

              {inNegotiation > 0 && (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-300">Existem interessados na etapa de Proposta e negociação prontos para conversão.</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-gradient-to-br from-emerald-800 to-slate-900 text-white rounded-3xl p-8 sm:p-12 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <span className="inline-block px-3.5 py-1 bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest rounded-full mb-3 shadow-xs">
                    Negócio Fechado 🎉
                  </span>
                  <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                    Negócio vendido em {soldLead.closed_at ? dayjs(soldLead.closed_at).format('DD/MM/YYYY') : dayjs(soldLead.created_at).format('DD/MM/YYYY')}
                  </h3>
                </div>
                <div className="text-right sm:text-left bg-white/10 backdrop-blur-md px-6 py-4 rounded-2xl border border-white/10">
                  <span className="block text-[10px] text-gray-300 font-bold uppercase tracking-wider mb-1">Valor da Venda</span>
                  <span className="text-2xl font-black text-emerald-300">
                    {Number(soldLead.deal_value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/10 mb-8">
                <div>
                  <span className="block text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Comprador</span>
                  <span className="text-base font-bold text-white">{soldLead.lead_name || 'Não informado'}</span>
                  {soldLead.phone && <span className="block text-xs text-gray-300">{soldLead.phone}</span>}
                </div>
                <div>
                  <span className="block text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Perfil / Capital</span>
                  <span className="text-sm font-semibold text-white">{soldLead.form_data?.perfil || '—'}</span>
                  <span className="block text-xs text-gray-300">Capital: {soldLead.form_data?.capital || '—'}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Forma de Pagamento</span>
                  <span className="text-sm font-semibold text-white">{soldLead.form_data?.venda_pagamento || 'Não informada'}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Funil de Vendas</span>
                  <span className="text-sm font-semibold text-white">{totalLeads} interessados</span>
                  <span className="block text-xs text-gray-300">
                    {firstLeadDate && soldLead.closed_at ? `${dayjs(soldLead.closed_at).diff(dayjs(firstLeadDate), 'day')} dias até a venda` : ''}
                  </span>
                </div>
              </div>

              {soldLead.form_data?.venda_observacoes && (
                <div className="bg-white/5 rounded-2xl p-4 border border-white/10 mb-6 text-xs text-gray-200">
                  <strong className="text-white block mb-1">Observações da venda:</strong>
                  {soldLead.form_data.venda_observacoes}
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => onViewLead(soldLead)}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-white text-gray-900 hover:bg-gray-100 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-md cursor-pointer"
                >
                  <span>Ver Ficha do Comprador</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
