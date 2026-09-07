import React, { useState, useEffect } from 'react';
import { Plus, Settings, Kanban } from 'lucide-react';
import { useAgencyCRM } from '../../hooks/useAgencyCRM';
import { AgencyCRM } from '../../types';
import { CRMBoard } from './CRMBoard';
import { CRMSettings } from './CRMSettings';

export const AgencyCRMTab: React.FC = () => {
  const { crms, loading, fetchCRMs, createCRM } = useAgencyCRM();
  const [activeCRMId, setActiveCRMId] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editingCRM, setEditingCRM] = useState<AgencyCRM | null>(null);

  useEffect(() => {
    fetchCRMs();
  }, [fetchCRMs]);

  useEffect(() => {
    if (crms.length > 0 && !activeCRMId) {
      setActiveCRMId(crms[0].id);
    } else if (crms.length === 0) {
      setActiveCRMId(null);
    }
  }, [crms, activeCRMId]);

  const handleCreateCRM = async () => {
    try {
      const newCRM = await createCRM({
        name: 'Novo CRM',
        kanban_stages: [
          { id: 'novos', name: 'Novos Leads', color: '#6B7280', auto_advance_days: null },
          { id: 'primeira_mensagem', name: 'Primeira Mensagem', color: '#3B82F6', auto_advance_days: 2 },
          { id: 'em_negociacao', name: 'Em Negociação', color: '#F59E0B', auto_advance_days: null },
          { id: 'fechado', name: 'Fechado', color: '#10B981', auto_advance_days: null },
          { id: 'perdido', name: 'Perdido', color: '#EF4444', auto_advance_days: null }
        ],
        form_fields: [
          { key: 'nicho', label: 'Nicho', type: 'select', required: false, options: ['Advocacia', 'Médico', 'Odonto', 'Outro'] },
          { key: 'instagram_url', label: 'Instagram URL', type: 'text', required: false, placeholder: 'https://instagram.com/...' },
          { key: 'bio_instagram', label: 'Bio', type: 'textarea', required: false }
        ],
        auto_advance_time: '09:00'
      });
      setActiveCRMId(newCRM.id);
      setEditingCRM(newCRM);
      setIsSettingsOpen(true);
    } catch (err) {
      console.error('Error creating CRM:', err);
      alert('Erro ao criar CRM.');
    }
  };

  const openSettings = (crm: AgencyCRM) => {
    setEditingCRM(crm);
    setIsSettingsOpen(true);
  };

  if (loading && crms.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-brand-dark border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const activeCRM = crms.find(c => c.id === activeCRMId);

  return (
    <div className="flex flex-col space-y-6">
      {/* Header & Tabs */}
      <div className="shrink-0 space-y-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-brand-dark">CRM da Agência</h2>
            <p className="text-sm text-gray-500 mt-1">Gerencie seus funis de prospecção e vendas.</p>
          </div>
          <button
            onClick={handleCreateCRM}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-brand-dark text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:shadow-xl transition-all transform hover:-translate-y-1 w-full sm:w-auto"
          >
            <Plus size={18} />
            <span>Novo CRM</span>
          </button>
        </div>

        {crms.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {crms.map(crm => (
              <div key={crm.id} className="flex items-center group">
                <button
                  onClick={() => setActiveCRMId(crm.id)}
                  className={`px-4 py-2 rounded-l-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    activeCRMId === crm.id
                      ? 'bg-brand-dark text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200 border-r-0'
                  }`}
                >
                  {crm.name}
                </button>
                <button
                  onClick={() => openSettings(crm)}
                  className={`px-2 py-2 rounded-r-lg transition-colors border ${
                    activeCRMId === crm.id
                      ? 'bg-brand-dark text-white/80 hover:text-white border-brand-dark border-l-white/20'
                      : 'bg-white text-gray-400 hover:text-gray-600 hover:bg-gray-50 border-gray-200'
                  }`}
                  title="Configurações do CRM"
                >
                  <Settings className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Board Area */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 flex flex-col">
        {activeCRM ? (
          <CRMBoard crm={activeCRM} />
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 pb-20">
            <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-4 border border-gray-100">
              <Kanban className="w-8 h-8 text-gray-300" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Nenhum CRM encontrado</h3>
            <p className="text-gray-500 mb-6 max-w-md">
              Crie seu primeiro CRM para começar a gerenciar seus leads e processos de vendas.
            </p>
            <button
              onClick={handleCreateCRM}
              className="bg-brand-dark text-white px-6 py-3 rounded-2xl font-bold hover:bg-brand-dark/90 transition-all shadow-lg shadow-brand-dark/20 text-xs uppercase tracking-widest"
            >
              Criar Primeiro CRM
            </button>
          </div>
        )}
      </div>

      {/* Settings Modal */}
      {isSettingsOpen && editingCRM && (
        <CRMSettings
          crm={editingCRM}
          onClose={() => {
            setIsSettingsOpen(false);
            setEditingCRM(null);
            fetchCRMs(); // Refresh after settings close
          }}
        />
      )}
    </div>
  );
};
