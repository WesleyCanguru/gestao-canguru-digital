import React, { useState, useEffect } from 'react';
import { X, Save, Trash2, Clock, Pause, Play } from 'lucide-react';
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

  useEffect(() => {
    if (lead) {
      setName(lead.name);
      setFormData(lead.form_data || {});
      setNotes(lead.notes || '');
      setStage(lead.stage);
    } else {
      setName('');
      setFormData({});
      setNotes('');
      setStage(crm.kanban_stages[0]?.name || '');
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
      if (lead) {
        await updateLead(lead.id, {
          name,
          form_data: formData,
          notes
        });
        if (stage !== lead.stage) {
          await moveLeadToStage(lead, stage, crm.kanban_stages, crm.auto_advance_time);
        }
      } else {
        const newLead = await addLead(crm.id, name, formData);
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
            {lead ? 'Detalhes do Lead' : 'Novo Lead'}
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
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-dark/20 focus:border-brand-dark transition-all"
                placeholder="Ex: João Silva"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Etapa Atual</label>
                <select
                  value={stage}
                  onChange={(e) => setStage(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-dark/20 focus:border-brand-dark transition-all"
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
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
                    lead.auto_advance_paused 
                      ? 'bg-brand-dark text-white hover:bg-brand-dark/90' 
                      : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                  }`}
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
                        className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-dark/20 focus:border-brand-dark transition-all"
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
                        rows={3}
                        className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-dark/20 focus:border-brand-dark transition-all resize-none"
                      />
                    ) : (
                      <input
                        type="text"
                        value={formData[field.key] || ''}
                        onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                        required={field.required}
                        placeholder={field.placeholder}
                        className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-dark/20 focus:border-brand-dark transition-all"
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
              className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-dark/20 focus:border-brand-dark transition-all resize-none"
              placeholder="Adicione observações, histórico de conversas, etc..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between shrink-0">
          {lead ? (
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
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors font-medium text-sm"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 bg-brand-dark text-white px-6 py-2 rounded-lg hover:bg-brand-dark/90 transition-colors font-medium text-sm shadow-sm disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Salvando...' : 'Salvar'}
            </button>
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
