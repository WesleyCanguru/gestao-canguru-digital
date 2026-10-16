import React from 'react';
import { ClientLead, ClientLeadConfig } from '../../types';
import { User, Phone, Mail, MapPin, Calendar, Globe, Sparkles, FileText } from 'lucide-react';

interface VendaNegocioLeadFormProps {
  formData: Partial<ClientLead>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<ClientLead>>>;
  config: ClientLeadConfig;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  isEditing: boolean;
}

const SOURCES = [
  'Meta Ads',
  'Google Ads',
  'Google orgânico',
  'Redes sociais',
  'Indicação',
  'Direto'
];

export const VendaNegocioLeadForm: React.FC<VendaNegocioLeadFormProps> = ({
  formData,
  setFormData,
  config,
  onSubmit,
  onCancel,
  isEditing
}) => {
  const handleFormChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleDynamicFieldChange = (key: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      form_data: {
        ...(prev.form_data || {}),
        [key]: value
      }
    }));
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
            Nome do interessado *
          </label>
          <div className="relative">
            <User size={16} className="absolute left-3.5 top-3.5 text-gray-400" />
            <input
              type="text"
              required
              value={formData.lead_name || ''}
              onChange={e => handleFormChange('lead_name', e.target.value)}
              placeholder="Ex: Carlos Alberto"
              className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
            WhatsApp *
          </label>
          <div className="relative">
            <Phone size={16} className="absolute left-3.5 top-3.5 text-gray-400" />
            <input
              type="text"
              required
              value={formData.phone || ''}
              onChange={e => handleFormChange('phone', e.target.value)}
              placeholder="(11) 98765-4321"
              className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
            E-mail
          </label>
          <div className="relative">
            <Mail size={16} className="absolute left-3.5 top-3.5 text-gray-400" />
            <input
              type="email"
              value={formData.email || ''}
              onChange={e => handleFormChange('email', e.target.value)}
              placeholder="carlos@email.com"
              className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
            Cidade
          </label>
          <div className="relative">
            <MapPin size={16} className="absolute left-3.5 top-3.5 text-gray-400" />
            <input
              type="text"
              value={formData.city || ''}
              onChange={e => handleFormChange('city', e.target.value)}
              placeholder="Ex: Rio de Janeiro, RJ"
              className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
            Data de entrada *
          </label>
          <div className="relative">
            <Calendar size={16} className="absolute left-3.5 top-3.5 text-gray-400" />
            <input
              type="date"
              required
              value={formData.lead_date || ''}
              onChange={e => handleFormChange('lead_date', e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark"
            />
          </div>
        </div>
      </div>

      {/* Dynamic lead_fields from config */}
      {config.lead_fields && config.lead_fields.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-gray-100">
          {config.lead_fields.map(field => {
            const currentValue = formData.form_data?.[field.key] || '';
            return (
              <div key={field.key} className={field.type === 'textarea' ? 'sm:col-span-2' : ''}>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  {field.label}
                </label>
                {field.type === 'select' ? (
                  <select
                    value={currentValue}
                    onChange={e => handleDynamicFieldChange(field.key, e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark cursor-pointer"
                  >
                    <option value="">Selecione...</option>
                    {field.options?.map(opt => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : (
                  <textarea
                    rows={2}
                    value={currentValue}
                    onChange={e => handleDynamicFieldChange(field.key, e.target.value)}
                    placeholder={`Informe ${field.label.toLowerCase()}`}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark resize-none"
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-gray-100">
        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
            Origem *
          </label>
          <select
            value={formData.source || SOURCES[0]}
            onChange={e => handleFormChange('source', e.target.value)}
            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark cursor-pointer"
          >
            {SOURCES.map(src => (
              <option key={src} value={src}>
                {src}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
            Potencial *
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleFormChange('potential', 'alto')}
              className={`py-3 px-4 rounded-xl border text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                formData.potential === 'alto'
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-xs'
                  : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
              }`}
            >
              Alto potencial
            </button>
            <button
              type="button"
              onClick={() => handleFormChange('potential', 'baixo')}
              className={`py-3 px-4 rounded-xl border text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                formData.potential === 'baixo'
                  ? 'bg-amber-50 border-amber-500 text-amber-800 shadow-xs'
                  : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
              }`}
            >
              Baixo potencial
            </button>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
          Observações internas
        </label>
        <textarea
          rows={3}
          value={formData.notes || ''}
          onChange={e => handleFormChange('notes', e.target.value)}
          placeholder="Anotações sobre o interessado, perfil, alinhamentos..."
          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark resize-none"
        />
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs uppercase tracking-wider rounded-xl transition-colors cursor-pointer"
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="px-8 py-3 bg-brand-dark hover:bg-opacity-90 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md cursor-pointer"
        >
          {isEditing ? 'Salvar Alterações' : 'Cadastrar Interessado'}
        </button>
      </div>
    </form>
  );
};
