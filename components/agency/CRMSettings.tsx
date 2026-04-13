import React, { useState } from 'react';
import { X, Save, Trash2, Plus, GripVertical } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AgencyCRM, KanbanStage, FormField } from '../../types';
import { useAgencyCRM } from '../../hooks/useAgencyCRM';
import { ConfirmModal } from '../ConfirmModal';

interface CRMSettingsProps {
  crm: AgencyCRM;
  onClose: () => void;
}

// --- Sortable Stage Item ---
const SortableStage: React.FC<{ stage: KanbanStage, onUpdate: (s: KanbanStage) => void, onRemove: () => void }> = ({ stage, onUpdate, onRemove }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stage.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-3 bg-white p-3 rounded-xl border border-gray-200">
      <div {...attributes} {...listeners} className="cursor-grab text-gray-400 hover:text-gray-600">
        <GripVertical className="w-5 h-5" />
      </div>
      <input
        type="color"
        value={stage.color}
        onChange={(e) => onUpdate({ ...stage, color: e.target.value })}
        className="w-8 h-8 rounded cursor-pointer border-0 p-0"
      />
      <input
        type="text"
        value={stage.name}
        onChange={(e) => onUpdate({ ...stage, name: e.target.value })}
        className="flex-1 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm"
        placeholder="Nome da etapa"
      />
      <div className="flex items-center gap-2 w-32">
        <input
          type="number"
          value={stage.auto_advance_days || ''}
          onChange={(e) => onUpdate({ ...stage, auto_advance_days: e.target.value ? parseInt(e.target.value) : null })}
          className="w-16 px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm"
          placeholder="Dias"
          min="1"
        />
        <span className="text-xs text-gray-500">dias auto</span>
      </div>
      <button onClick={onRemove} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
};

// --- Sortable Field Item ---
const SortableField: React.FC<{ field: FormField, onUpdate: (f: FormField) => void, onRemove: () => void }> = ({ field, onUpdate, onRemove }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.key });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <div ref={setNodeRef} style={style} className="flex flex-col gap-2 bg-white p-3 rounded-xl border border-gray-200">
      <div className="flex items-center gap-3">
        <div {...attributes} {...listeners} className="cursor-grab text-gray-400 hover:text-gray-600">
          <GripVertical className="w-5 h-5" />
        </div>
        <input
          type="text"
          value={field.label}
          onChange={(e) => onUpdate({ ...field, label: e.target.value })}
          className="flex-1 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm"
          placeholder="Label do campo"
        />
        <select
          value={field.type}
          onChange={(e) => onUpdate({ ...field, type: e.target.value as any })}
          className="w-32 px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm"
        >
          <option value="text">Texto</option>
          <option value="textarea">Área de Texto</option>
          <option value="select">Seleção</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={field.required}
            onChange={(e) => onUpdate({ ...field, required: e.target.checked })}
            className="rounded border-gray-300 text-brand-dark focus:ring-brand-dark"
          />
          Obrig.
        </label>
        <button onClick={onRemove} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      {field.type === 'select' && (
        <div className="pl-8">
          <input
            type="text"
            value={field.options?.join(', ') || ''}
            onChange={(e) => onUpdate({ ...field, options: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
            className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm"
            placeholder="Opções separadas por vírgula (ex: Opção 1, Opção 2)"
          />
        </div>
      )}
    </div>
  );
};

export const CRMSettings: React.FC<CRMSettingsProps> = ({ crm, onClose }) => {
  const { updateCRM, deleteCRM } = useAgencyCRM();
  
  const [name, setName] = useState(crm.name);
  const [description, setDescription] = useState(crm.description || '');
  const [autoAdvanceTime, setAutoAdvanceTime] = useState(crm.auto_advance_time);
  const [stages, setStages] = useState<KanbanStage[]>(crm.kanban_stages);
  const [fields, setFields] = useState<FormField[]>(crm.form_fields);
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateCRM(crm.id, {
        name,
        description,
        auto_advance_time: autoAdvanceTime,
        kanban_stages: stages,
        form_fields: fields
      });
      onClose();
    } catch (err) {
      console.error('Error saving CRM settings:', err);
      alert('Erro ao salvar configurações.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteCRM(crm.id);
      onClose();
    } catch (err) {
      console.error('Error deleting CRM:', err);
      alert('Erro ao excluir CRM.');
    } finally {
      setIsConfirmingDelete(false);
    }
  };

  const handleDragEndStages = (event: any) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      setStages((items) => {
        const oldIndex = items.findIndex(i => i.id === active.id);
        const newIndex = items.findIndex(i => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleDragEndFields = (event: any) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      setFields((items) => {
        const oldIndex = items.findIndex(i => i.key === active.id);
        const newIndex = items.findIndex(i => i.key === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const addStage = () => {
    const newId = `stage_${Date.now()}`;
    setStages([...stages, { id: newId, name: 'Nova Etapa', color: '#CBD5E1', auto_advance_days: null }]);
  };

  const addField = () => {
    const newKey = `field_${Date.now()}`;
    setFields([...fields, { key: newKey, label: 'Novo Campo', type: 'text', required: false }]);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh] overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <h2 className="text-xl font-bold text-gray-900">Configurações do CRM</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* General Info */}
          <section className="space-y-4">
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Informações Gerais</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Nome do CRM</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-dark/20 focus:border-brand-dark"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Horário de Avanço Automático</label>
                <input
                  type="time"
                  value={autoAdvanceTime}
                  onChange={(e) => setAutoAdvanceTime(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-dark/20 focus:border-brand-dark"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Descrição</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-dark/20 focus:border-brand-dark resize-none"
              />
            </div>
          </section>

          <div className="border-t border-gray-100"></div>

          {/* Kanban Stages */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Etapas do Funil (Kanban)</h3>
              <button onClick={addStage} className="flex items-center gap-1 text-sm text-brand-dark hover:text-brand-dark/80 font-medium">
                <Plus className="w-4 h-4" /> Adicionar Etapa
              </button>
            </div>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndStages}>
              <SortableContext items={stages.map(s => s.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {stages.map(stage => (
                    <SortableStage
                      key={stage.id}
                      stage={stage}
                      onUpdate={(s) => setStages(stages.map(st => st.id === s.id ? s : st))}
                      onRemove={() => setStages(stages.filter(st => st.id !== stage.id))}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </section>

          <div className="border-t border-gray-100"></div>

          {/* Form Fields */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Campos do Formulário de Lead</h3>
              <button onClick={addField} className="flex items-center gap-1 text-sm text-brand-dark hover:text-brand-dark/80 font-medium">
                <Plus className="w-4 h-4" /> Adicionar Campo
              </button>
            </div>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndFields}>
              <SortableContext items={fields.map(f => f.key)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {fields.map(field => (
                    <SortableField
                      key={field.key}
                      field={field}
                      onUpdate={(f) => setFields(fields.map(fd => fd.key === f.key ? f : fd))}
                      onRemove={() => setFields(fields.filter(fd => fd.key !== field.key))}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </section>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between shrink-0">
          <button
            onClick={() => setIsConfirmingDelete(true)}
            className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium text-sm"
          >
            <Trash2 className="w-4 h-4" />
            Excluir CRM
          </button>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors font-medium text-sm">
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 bg-brand-dark text-white px-6 py-2 rounded-lg hover:bg-brand-dark/90 transition-colors font-medium text-sm shadow-sm disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={isConfirmingDelete}
        title="Excluir CRM"
        message="Tem certeza que deseja excluir este CRM? Esta ação não pode ser desfeita e excluirá todos os leads associados."
        onConfirm={handleDelete}
        onCancel={() => setIsConfirmingDelete(false)}
      />
    </div>
  );
};
