import React, { useState, useEffect } from 'react';
import { X, Save, Trash2, Clock, Pause, Play, Edit } from 'lucide-react';
import { AgencyCRM, AgencyLead } from '../../types';
import { useAgencyCRM } from '../../hooks/useAgencyCRM';
import { ConfirmModal } from '../ConfirmModal';

interface CRMLeadModalProps {
  crm: AgencyCRM;
  lead: AgencyLead | null;
  isOpen: boolean;
  onClose: () => void;
}

export const CRMLeadModal: React.FC<CRMLeadModalProps> = ({ crm, lead, isOpen, onClose }) => {
  const { addLead, updateLead, deleteLead, moveLeadToStage } = useAgencyCRM();
  
  const [name, setName] = useState('');
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [notes, setNotes] = useState('');
  const [stage, setStage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (lead) {
      setName(lead.name);
      
      const isPredefined = ["Não respondeu", "Achou caro", "Não era o momento", "Escolheu concorrente"].includes(lead.loss_reason || '');
      const temp_loss_reason = lead.loss_reason 
        ? (isPredefined ? lead.loss_reason : 'Outro')
        : '';
      const temp_custom_loss_reason = lead.loss_reason && !isPredefined ? lead.loss_reason : '';

      setFormData({
        ...(lead.form_data || {}),
        temp_loss_reason,
        temp_custom_loss_reason
      });
      setNotes(lead.notes || '');
      setStage(lead.stage);
      setIsEditing(false);
    } else {
      setName('');
      setFormData({});
      setNotes('');
      setStage(crm.kanban_stages[0]?.name || '');
      setIsEditing(true);
    }
  }, [lead, crm]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!name.trim()) {
      alert('O nome do lead é obrigatório.');
      return;
    }

    setIsSaving(true);
    try {
      const isPerdido = stage === 'Perdido' || crm.kanban_stages.find(s => s.name === stage)?.id === 'perdido';
      
      let resolvedLossReason = null;
      if (isPerdido) {
        resolvedLossReason = formData.temp_loss_reason === 'Outro' ? formData.temp_custom_loss_reason : formData.temp_loss_reason;
        if (!resolvedLossReason && formData.temp_loss_reason) {
          resolvedLossReason = 'Outro';
        }
      }

      // Clean up temporary fields
      const cleanFormData = { ...formData };
      delete cleanFormData.temp_loss_reason;
      delete cleanFormData.temp_custom_loss_reason;

      if (lead) {
        await updateLead(lead.id, {
          name,
          form_data: cleanFormData,
          notes,
          loss_reason: resolvedLossReason
        });
        if (stage !== lead.stage) {
          await moveLeadToStage(lead, stage, crm.kanban_stages, crm.auto_advance_time);
        }
      } else {
        const newLead = await addLead(crm.id, name, cleanFormData, stage);
        await updateLead(newLead.id, { loss_reason: resolvedLossReason });
        if (stage !== crm.kanban_stages[0]?.name) {
          await moveLeadToStage(newLead, stage, crm.kanban_stages, crm.auto_advance_time);
        }
      }
      onClose();
    } catch (err) {
      console.error('Error saving lead:', err);
      alert('Erro ao salvar lead.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (lead) {
      if (isEditing) {
        // Revert to original values and exit edit mode
        setName(lead.name);
        
        const isPredefined = ["Não respondeu", "Achou caro", "Não era o momento", "Escolheu concorrente"].includes(lead.loss_reason || '');
        const temp_loss_reason = lead.loss_reason 
          ? (isPredefined ? lead.loss_reason : 'Outro')
          : '';
        const temp_custom_loss_reason = lead.loss_reason && !isPredefined ? lead.loss_reason : '';

        setFormData({
          ...(lead.form_data || {}),
          temp_loss_reason,
          temp_custom_loss_reason
        });
        setNotes(lead.notes || '');
        setStage(lead.stage);
        setIsEditing(false);
      } else {
        onClose();
      }
    } else {
      onClose();
    }
  };

  const handleDelete = async () => {
    if (!lead) return;

    try {
      await deleteLead(lead.id);
      onClose();
    } catch (err) {
      console.error('Error deleting lead:', err);
      alert('Erro ao excluir lead.');
    } finally {
      setIsConfirmingDelete(false);
    }
  };

  const toggleAutoAdvance = async () => {
    if (!lead) return;
    try {
      await updateLead(lead.id, {
        auto_advance_paused: !lead.auto_advance_paused
      });
    } catch (err) {
      console.error('Error toggling auto advance:', err);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <h2 className="text-xl font-bold text-gray-900">
            {lead ? (isEditing ? 'Editar Lead' : 'Detalhes do Lead') : 'Novo Lead'}
          </h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Nome do Lead *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!isEditing}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-dark/20 focus:border-brand-dark transition-all disabled:opacity-100 disabled:bg-gray-50/30 disabled:text-gray-600 disabled:border-gray-100/80 disabled:cursor-default"
                placeholder="Ex: João Silva"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Etapa Atual</label>
                <select
                  value={stage}
                  onChange={(e) => setStage(e.target.value)}
                  disabled={!isEditing}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-dark/20 focus:border-brand-dark transition-all disabled:opacity-100 disabled:bg-gray-50/30 disabled:text-gray-600 disabled:border-gray-100/80 disabled:cursor-default"
                >
                  {crm.kanban_stages.map(s => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </div>
              
              {lead && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Entrou na etapa em</label>
                  <div className="px-4 py-2 bg-gray-100 border border-gray-200 rounded-xl text-gray-600 text-sm">
                    {new Date(lead.stage_entered_at).toLocaleString()}
                  </div>
                </div>
              )}
            </div>

            {/* Conditional inputs based on selected stage */}
            {(stage === 'Proposta Enviada' || crm.kanban_stages.find(s => s.name === stage)?.id === 'proposta_enviada') && (
              <div className="bg-purple-50/50 border border-purple-100 p-4 rounded-xl space-y-3">
                <label className="block text-sm font-bold text-purple-900">💜 Valor da Proposta (R$)</label>
                <input
                  type="number"
                  value={formData.deal_value || ''}
                  onChange={(e) => setFormData({ ...formData, deal_value: parseFloat(e.target.value) || null })}
                  disabled={!isEditing}
                  className="w-full px-4 py-2 bg-white border border-purple-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all disabled:opacity-100 disabled:bg-purple-50/30 disabled:text-purple-900/80 disabled:border-purple-100/80 disabled:cursor-default"
                  placeholder="Ex: 1500"
                />
              </div>
            )}

            {(stage === 'Perdido' || crm.kanban_stages.find(s => s.name === stage)?.id === 'perdido') && (
              <div className="bg-red-50/50 border border-red-100 p-4 rounded-xl space-y-3">
                <label className="block text-sm font-bold text-red-900">❌ Motivo da Perda</label>
                <div className="space-y-2">
                  {["Não respondeu", "Achou caro", "Não era o momento", "Escolheu concorrente", "Outro"].map(option => (
                    <label key={option} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="modal_loss_reason"
                        value={option}
                        checked={formData.temp_loss_reason === option}
                        onChange={(e) => setFormData({ ...formData, temp_loss_reason: e.target.value })}
                        disabled={!isEditing}
                        className="w-4 h-4 text-red-600 focus:ring-red-500 border-gray-300 disabled:opacity-70 disabled:cursor-default"
                      />
                      <span className="text-sm font-medium text-gray-700">{option}</span>
                    </label>
                  ))}
                </div>

                {formData.temp_loss_reason === 'Outro' && (
                  <input
                    type="text"
                    value={formData.temp_custom_loss_reason || ''}
                    onChange={(e) => setFormData({ ...formData, temp_custom_loss_reason: e.target.value })}
                    placeholder="Especifique o motivo..."
                    disabled={!isEditing}
                    className="w-full bg-white border border-red-200 rounded-xl p-2.5 text-sm font-medium focus:ring-2 focus:ring-red-500/20 outline-none mt-2 disabled:opacity-100 disabled:bg-red-50/30 disabled:text-red-900/80 disabled:border-red-100/80 disabled:cursor-default"
                  />
                )}
              </div>
            )}

            {/* Auto Advance Info */}
            {lead && lead.next_stage_at && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${lead.auto_advance_paused ? 'bg-gray-200 text-gray-500' : 'bg-blue-100 text-blue-600'}`}>
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">Avanço Automático</p>
                    <p className="text-xs text-gray-600">
                      {lead.auto_advance_paused ? 'Pausado' : `Programado para ${new Date(lead.next_stage_at).toLocaleString()}`}
                    </p>
                  </div>
                </div>
                <button
                  onClick={toggleAutoAdvance}
                  disabled={!isEditing}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
                    lead.auto_advance_paused 
                      ? 'bg-brand-dark text-white hover:bg-brand-dark/90 disabled:bg-gray-300 disabled:text-gray-500' 
                      : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 disabled:border-gray-100 disabled:text-gray-400'
                  } disabled:cursor-default`}
                >
                  {lead.auto_advance_paused ? (
                    <><Play className="w-4 h-4" /> Retomar</>
                  ) : (
                    <><Pause className="w-4 h-4" /> Pausar</>
                  )}
                </button>
              </div>
            )}
          </div>

          <div className="border-t border-gray-100"></div>

          {/* Dynamic Form Fields */}
          {crm.form_fields.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Dados do Lead</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {crm.form_fields.map(field => (
                  <div key={field.key} className={field.type === 'textarea' ? 'md:col-span-2' : ''}>
                    <label className="block text-sm font-bold text-gray-700 mb-1">
                      {field.label} {field.required && '*'}
                    </label>
                    {field.type === 'select' ? (
                      <select
                        value={formData[field.key] || ''}
                        onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                        required={field.required}
                        disabled={!isEditing}
                        className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-dark/20 focus:border-brand-dark transition-all disabled:opacity-100 disabled:bg-gray-50/30 disabled:text-gray-600 disabled:border-gray-100/80 disabled:cursor-default"
                      >
                        <option value="">Selecione...</option>
                        {field.options?.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : field.type === 'textarea' ? (
                      <textarea
                        value={formData[field.key] || ''}
                        onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                        required={field.required}
                        placeholder={field.placeholder}
                        disabled={!isEditing}
                        rows={3}
                        className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-dark/20 focus:border-brand-dark transition-all resize-none disabled:opacity-100 disabled:bg-gray-50/30 disabled:text-gray-600 disabled:border-gray-100/80 disabled:cursor-default"
                      />
                    ) : (
                      <input
                        type="text"
                        value={formData[field.key] || ''}
                        onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                        required={field.required}
                        placeholder={field.placeholder}
                        disabled={!isEditing}
                        className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-dark/20 focus:border-brand-dark transition-all disabled:opacity-100 disabled:bg-gray-50/30 disabled:text-gray-600 disabled:border-gray-100/80 disabled:cursor-default"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="border-t border-gray-100"></div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Notas Internas</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              disabled={!isEditing}
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-dark/20 focus:border-brand-dark transition-all resize-none disabled:opacity-100 disabled:bg-gray-50/30 disabled:text-gray-600 disabled:border-gray-100/80 disabled:cursor-default"
              placeholder="Adicione observações, histórico de conversas, etc..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between shrink-0">
          {lead && isEditing ? (
            <button
              onClick={() => setIsConfirmingDelete(true)}
              className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium text-sm"
            >
              <Trash2 className="w-4 h-4" />
              Excluir Lead
            </button>
          ) : (
            <div></div>
          )}
          <div className="flex items-center gap-3">
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors font-medium text-sm"
            >
              {isEditing ? 'Cancelar' : 'Fechar'}
            </button>
            {isEditing ? (
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 bg-brand-dark text-white px-6 py-2 rounded-lg hover:bg-brand-dark/90 transition-colors font-medium text-sm shadow-sm disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {isSaving ? 'Salvando...' : 'Salvar'}
              </button>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-2 bg-brand-dark text-white px-6 py-2 rounded-lg hover:bg-brand-dark/90 transition-colors font-medium text-sm shadow-sm"
              >
                <Edit className="w-4 h-4" />
                Editar
              </button>
            )}
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={isConfirmingDelete}
        title="Excluir Lead"
        message="Tem certeza que deseja excluir este lead?"
        onConfirm={handleDelete}
        onCancel={() => setIsConfirmingDelete(false)}
      />
    </div>
  );
};
