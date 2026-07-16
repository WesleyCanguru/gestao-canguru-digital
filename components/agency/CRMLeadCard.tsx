import React from 'react';
import { Clock, AlertCircle, ArrowRight } from 'lucide-react';
import { AgencyCRM, AgencyLead } from '../../types';
import { useAgencyCRM } from '../../hooks/useAgencyCRM';

interface CRMLeadCardProps {
  lead: AgencyLead;
  crm: AgencyCRM;
  onClick: () => void;
  onMoveStage?: (lead: AgencyLead, stageName: string) => void;
}

export const CRMLeadCard: React.FC<CRMLeadCardProps> = ({ lead, crm, onClick, onMoveStage }) => {
  const { moveLeadToStage } = useAgencyCRM();

  // Find the first form field that has a value to display
  const primaryField = crm.form_fields.find(f => lead.form_data[f.key]);
  const primaryValue = primaryField ? lead.form_data[primaryField.key] : null;

  const isPropostaEnviadaStage = lead.stage === 'Proposta Enviada' || 
                                crm.kanban_stages.find(s => s.name === lead.stage)?.id === 'proposta_enviada';
  
  const stageEnteredDate = lead.stage_entered_at ? new Date(lead.stage_entered_at) : new Date(lead.created_at);
  const diffHours = (new Date().getTime() - stageEnteredDate.getTime()) / (1000 * 60 * 60);
  const isOver48h = isPropostaEnviadaStage && diffHours >= 48;
  const daysInStage = Math.floor(diffHours / 24);

  const getRelativeTimeString = (date: Date) => {
    const diffMs = new Date().getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'hoje';
    if (diffDays === 1) return 'há 1 dia';
    return `há ${diffDays} dias`;
  };

  const renderCountdownBadge = () => {
    if (lead.auto_advance_paused || !lead.next_stage_at) return null;

    const now = new Date();
    const nextDate = new Date(lead.next_stage_at);
    const diffTime = nextDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return (
        <div className="flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 px-2 py-1 rounded-md border border-red-100">
          <AlertCircle className="w-3 h-3" />
          Atrasado
        </div>
      );
    }

    return (
      <div className="flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md border border-blue-100">
        <Clock className="w-3 h-3" />
        {diffDays === 0 ? 'Avança hoje' : `Avança em ${diffDays}d`}
      </div>
    );
  };

  const handleMoveToNextStage = (e: React.MouseEvent) => {
    e.stopPropagation();
    const currentStageIndex = crm.kanban_stages.findIndex(s => s.name === lead.stage);
    if (currentStageIndex !== -1 && currentStageIndex < crm.kanban_stages.length - 1) {
      const nextStage = crm.kanban_stages[currentStageIndex + 1];
      if (onMoveStage) {
        onMoveStage(lead, nextStage.name);
      } else {
        moveLeadToStage(lead, nextStage.name, crm.kanban_stages, crm.auto_advance_time);
      }
    }
  };

  const isLastStage = crm.kanban_stages.findIndex(s => s.name === lead.stage) === crm.kanban_stages.length - 1;

  return (
    <div 
      onClick={onClick}
      className={`p-4 rounded-xl shadow-sm border transition-all cursor-pointer group flex flex-col justify-between h-full ${
        isOver48h 
          ? 'bg-amber-50/10 border-amber-400 hover:border-amber-500 hover:shadow-amber-50' 
          : 'bg-white border-gray-200 hover:border-brand-dark/30'
      } hover:shadow-md`}
    >
      <div>
        <div className="flex justify-between items-start mb-2">
          <h4 className="font-bold text-gray-900 text-sm line-clamp-2 pr-2 flex items-center gap-1.5">
            {isOver48h && (
              <span 
                className="text-amber-500 shrink-0 text-base animate-pulse" 
                title={`Proposta enviada há ${daysInStage} dias — hora de dar um follow-up!`}
              >
                ⏰
              </span>
            )}
            {lead.name}
          </h4>
          {!isLastStage && (
            <button 
              onClick={handleMoveToNextStage}
              className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-brand-dark hover:bg-brand-dark/10 rounded transition-all shrink-0"
              title="Mover para próxima etapa"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Display Deal Value if present */}
        {(lead.form_data?.deal_value || lead.deal_value) ? (
          <div className="text-xs font-bold text-purple-700 bg-purple-50 border border-purple-100 px-2.5 py-1 rounded-lg inline-block mb-3">
            💜 {Number(lead.form_data?.deal_value || lead.deal_value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </div>
        ) : null}

        {primaryValue && (
          <div className="text-xs text-gray-500 mb-3 line-clamp-1">
            <span className="font-medium text-gray-600">{primaryField?.label}:</span> {String(primaryValue)}
          </div>
        )}

        {/* Badges para CRM Conhecidos */}
        {lead.form_data && (lead.form_data.tipo_contato || lead.form_data.nivel_relacionamento) && (
          <div className="flex flex-wrap gap-1 mb-3">
            {lead.form_data.tipo_contato && (() => {
              const val = lead.form_data.tipo_contato;
              let colorClass = 'bg-gray-50 text-gray-700 border-gray-100';
              if (val === 'Amigo Próximo') colorClass = 'bg-blue-50 text-blue-700 border-blue-100';
              else if (val === 'Familiar') colorClass = 'bg-green-50 text-green-700 border-green-100';
              else if (val === 'Conhecido') colorClass = 'bg-gray-50 text-gray-700 border-gray-100';
              else if (val === 'Indicação') colorClass = 'bg-amber-50 text-amber-700 border-amber-100';
              else if (val === 'Parceiro Estratégico') colorClass = 'bg-purple-50 text-purple-700 border-purple-100';
              return (
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${colorClass}`}>
                  {val}
                </span>
              );
            })()}
            {lead.form_data.nivel_relacionamento && (() => {
              const val = lead.form_data.nivel_relacionamento;
              let colorClass = 'bg-slate-50 text-slate-700 border-slate-100';
              if (val === 'Alto') colorClass = 'bg-emerald-50 text-emerald-700 border-emerald-100';
              else if (val === 'Médio') colorClass = 'bg-amber-50 text-amber-700 border-amber-100';
              else if (val === 'Baixo') colorClass = 'bg-slate-50 text-slate-700 border-slate-100';
              return (
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${colorClass}`} title="Nível de Relacionamento">
                  🤝 {val}
                </span>
              );
            })()}
          </div>
        )}

        {isPropostaEnviadaStage && (
          <div className="text-[10px] text-amber-600 bg-amber-50 border border-amber-100 px-2 py-1 rounded-md inline-block mt-1 font-semibold">
            Proposta {getRelativeTimeString(stageEnteredDate)}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50 shrink-0">
        {renderCountdownBadge()}
        <div className="text-[10px] text-gray-400 ml-auto font-medium">
          {new Date(lead.created_at).toLocaleDateString()}
        </div>
      </div>
    </div>
  );
};
