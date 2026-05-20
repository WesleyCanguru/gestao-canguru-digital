import React, { useState, useEffect } from 'react';
import { supabase, useAuth } from '../../lib/supabase';
import { X, Plus, GripVertical, Settings2, Trash2, Save } from 'lucide-react';
import { BRIEFING_QUESTIONS } from '../BriefingOnboarding';

interface Props {
  onClose: () => void;
}

export function BriefingTemplatesModal({ onClose }: Props) {
  const { agencyId } = useAuth();
  const [templates, setTemplates] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [editingQuestions, setEditingQuestions] = useState<any[]>([]);
  const [editingTitle, setEditingTitle] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, [agencyId]);

  const fetchTemplates = async () => {
    if (!agencyId) return;
    try {
      const { data, error } = await supabase
        .from('agency_briefing_templates')
        .select('*')
        .eq('agency_id', agencyId);
      
      if (error) {
         // fallback silently if table doesn't exist yet
         console.log('Error fetching or table not found', error);
      }

      const map: Record<string, any> = {};
      Object.keys(BRIEFING_QUESTIONS).forEach(key => {
         const custom = data?.find(d => d.briefing_type === key);
         if (custom) {
           map[key] = { title: custom.title, questions: custom.questions };
         } else {
           map[key] = { title: BRIEFING_QUESTIONS[key].title, questions: BRIEFING_QUESTIONS[key].questions };
         }
      });

      // Include any custom types not in defaults
      data?.forEach(custom => {
         if (!map[custom.briefing_type]) {
             map[custom.briefing_type] = { title: custom.title, questions: custom.questions };
         }
      });

      setTemplates(map);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const handleSelectType = (type: string) => {
    setSelectedType(type);
    setEditingTitle(templates[type]?.title || '');
    setEditingQuestions(JSON.parse(JSON.stringify(templates[type]?.questions || [])));
  };

  const handleSave = async () => {
    if (!selectedType || !agencyId) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('agency_briefing_templates')
        .upsert({
          agency_id: agencyId,
          briefing_type: selectedType,
          title: editingTitle,
          questions: editingQuestions
        });

      if (error) throw error;
      
      setTemplates({
        ...templates,
        [selectedType]: { title: editingTitle, questions: editingQuestions }
      });
      alert('Salvo com sucesso!');
    } catch (err: any) {
      alert('Erro ao salvar. Verifique se a tabela agency_briefing_templates foi criada. ' + err.message);
    }
    setSaving(false);
  };

  const addQuestion = () => {
    setEditingQuestions([
      ...editingQuestions,
      { key: 'nova_pergunta_' + Date.now(), label: 'Nova Pergunta', type: 'text', help: '' }
    ]);
  };

  const updateQuestion = (index: number, key: string, value: any) => {
    const newQs = [...editingQuestions];
    newQs[index] = { ...newQs[index], [key]: value };
    setEditingQuestions(newQs);
  };

  const removeQuestion = (index: number) => {
    if (!window.confirm('Excluir esta pergunta?')) return;
    const newQs = [...editingQuestions];
    newQs.splice(index, 1);
    setEditingQuestions(newQs);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-8 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div>
            <h3 className="text-2xl font-black text-brand-dark tracking-tight">Perguntas de Briefings</h3>
            <p className="text-sm font-bold text-gray-500 uppercase tracking-widest mt-1">Configuração de Formulários</p>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-white rounded-2xl transition-all shadow-sm">
            <X size={24} className="text-gray-400 hover:text-red-500" />
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex">
          {/* Sidebar */}
          <div className="w-1/3 border-r border-gray-100 bg-gray-50/30 overflow-y-auto p-4 hide-scrollbar">
            {loading ? (
               <div className="p-4 text-center text-gray-400 text-sm">Carregando...</div>
            ) : (
              <div className="space-y-2">
                {Object.keys(templates).map(type => (
                  <button
                    key={type}
                    onClick={() => handleSelectType(type)}
                    className={`w-full text-left p-4 rounded-xl transition-all ${selectedType === type ? 'bg-brand-dark text-white shadow-md' : 'bg-white border border-gray-100 hover:border-brand-dark/30 text-gray-700'}`}
                  >
                    <p className={`font-bold ${selectedType === type ? 'text-white' : 'text-gray-900'}`}>{templates[type].title}</p>
                    <p className={`text-[10px] uppercase font-bold tracking-widest mt-1 ${selectedType === type ? 'text-white/70' : 'text-gray-400'}`}>{templates[type].questions.length} perguntas</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Editor */}
          <div className="flex-1 overflow-y-auto bg-white relative">
            {!selectedType ? (
               <div className="h-full flex items-center justify-center text-gray-400 text-sm p-10">
                 Selecione um briefing ao lado para editar suas perguntas.
               </div>
            ) : (
               <div className="p-8 pb-32">
                 <div className="mb-6">
                   <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Título do Formulário</label>
                   <input
                     type="text"
                     value={editingTitle}
                     onChange={e => setEditingTitle(e.target.value)}
                     className="w-full text-lg font-bold px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:bg-white focus:ring-2 focus:ring-brand-dark/20 text-gray-900 outline-none"
                   />
                 </div>

                 <div className="space-y-6">
                   <div className="flex items-center justify-between">
                     <label className="block text-xs font-bold uppercase tracking-widest text-gray-500">Perguntas</label>
                     <button
                       onClick={addQuestion}
                       className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors"
                     >
                       <Plus size={14} /> Adicionar Pergunta
                     </button>
                   </div>

                   <div className="space-y-4">
                     {editingQuestions.map((q, idx) => (
                       <div key={idx} className="bg-white border border-gray-100 p-5 rounded-2xl shadow-sm relative group hover:border-gray-300 transition-colors space-y-4">
                         <button onClick={() => removeQuestion(idx)} className="absolute top-4 right-4 p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100">
                           <Trash2 size={16} />
                         </button>

                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                           <div>
                             <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Enunciado / Label</label>
                             <input type="text" value={q.label} onChange={e => updateQuestion(idx, 'label', e.target.value)} className="w-full text-sm px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg focus:bg-white outline-none focus:ring-2 focus:ring-brand-dark/20" />
                           </div>
                           <div>
                             <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Chave (Deve ser única, sem espaços)</label>
                             <input type="text" value={q.key} onChange={e => updateQuestion(idx, 'key', e.target.value)} className="w-full text-sm px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg focus:bg-white outline-none focus:ring-2 focus:ring-brand-dark/20 font-mono text-gray-500" />
                           </div>
                         </div>

                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                           <div>
                             <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Tipo da Resposta</label>
                             <select value={q.type} onChange={e => updateQuestion(idx, 'type', e.target.value)} className="w-full text-sm px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg focus:bg-white outline-none focus:ring-2 focus:ring-brand-dark/20 cursor-pointer">
                               <option value="text">Texto Curto</option>
                               <option value="textarea">Texto Longo</option>
                               <option value="array">Múltiplos Itens (Vírgula)</option>
                             </select>
                           </div>
                           <div>
                             <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Ajuda (Dica / Help text)</label>
                             <input type="text" value={q.help || ''} onChange={e => updateQuestion(idx, 'help', e.target.value)} placeholder="Ex: Digite o nome aqui..." className="w-full text-sm px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg focus:bg-white outline-none focus:ring-2 focus:ring-brand-dark/20" />
                           </div>
                         </div>
                       </div>
                     ))}
                   </div>
                 </div>
               </div>
            )}

            {/* Save bar */}
            {selectedType && (
              <div className="absolute bottom-0 left-0 right-0 p-6 bg-white border-t border-gray-100 shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full flex items-center justify-center gap-2 py-4 bg-brand-dark text-white rounded-xl font-bold uppercase tracking-widest text-sm hover:opacity-90 disabled:opacity-50 transition-opacity shadow-lg"
                >
                  {saving ? 'Salvando...' : <><Save size={18} /> Salvar Formulário</>}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
