import React, { useState, useEffect } from 'react';
import { supabase, useAuth } from '../lib/supabase';
import { 
  CheckCircle, 
  Circle, 
  ArrowRight, 
  Save, 
  Globe, 
  Target, 
  Users, 
  MessageSquare, 
  Zap,
  TrendingUp,
  ChevronRight,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface BriefingFormProps {
  onComplete: () => void;
}

interface Question {
  id: string;
  text: string;
  type: 'text' | 'textarea' | 'select' | 'multiselect';
  options?: string[];
  placeholder?: string;
}

interface BriefingSection {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  serviceRequired?: string;
  questions: Question[];
}

const SECTIONS: BriefingSection[] = [
  {
    id: 'publico_alvo',
    title: 'Público-Alvo',
    description: 'Defina quem são as pessoas que você quer atingir.',
    icon: <Users size={20} />,
    questions: [
      { id: 'faixa_etaria', text: 'Qual a faixa etária predominante?', type: 'text', placeholder: 'Ex: 25-45 anos' },
      { id: 'genero', text: 'Gênero predominante', type: 'select', options: ['Masculino', 'Feminino', 'Ambos', 'Outro'] },
      { id: 'localizacao', text: 'Onde eles moram?', type: 'text', placeholder: 'Ex: São Paulo, Brasil todo...' },
      { id: 'interesses', text: 'Quais os principais interesses?', type: 'textarea', placeholder: 'Ex: Tecnologia, moda, investimentos...' },
      { id: 'dores', text: 'Quais os principais problemas/dores que eles enfrentam?', type: 'textarea' },
    ]
  },
  {
    id: 'persona',
    title: 'Persona',
    description: 'Crie um personagem que represente seu cliente ideal.',
    icon: <Target size={20} />,
    questions: [
      { id: 'nome_persona', text: 'Dê um nome para sua persona', type: 'text', placeholder: 'Ex: Maria, a empreendedora' },
      { id: 'profissao', text: 'Qual a profissão dela?', type: 'text' },
      { id: 'objetivos', text: 'Quais os maiores objetivos de vida/carreira dela?', type: 'textarea' },
      { id: 'comportamento', text: 'Como ela se comporta nas redes sociais?', type: 'textarea' },
    ]
  },
  {
    id: 'tom_voz',
    title: 'Tom de Voz',
    description: 'Como sua marca deve falar com o público.',
    icon: <MessageSquare size={20} />,
    questions: [
      { id: 'estilo', text: 'Qual o estilo de comunicação?', type: 'select', options: ['Formal', 'Informal', 'Inspiracional', 'Educativo', 'Divertido'] },
      { id: 'palavras_chave', text: 'Palavras que definem a marca', type: 'text', placeholder: 'Ex: Inovação, Confiança, Agilidade' },
      { id: 'evitar', text: 'O que devemos evitar falar/fazer?', type: 'textarea' },
    ]
  },
  {
    id: 'posicionamento',
    title: 'Posicionamento',
    description: 'Como você quer ser percebido no mercado.',
    icon: <Zap size={20} />,
    questions: [
      { id: 'diferencial', text: 'Qual seu maior diferencial competitivo?', type: 'textarea' },
      { id: 'proposta_valor', text: 'Qual sua proposta de valor em uma frase?', type: 'text' },
      { id: 'concorrentes', text: 'Quem são seus principais concorrentes?', type: 'textarea' },
    ]
  },
  {
    id: 'site',
    title: 'Briefing de Website',
    description: 'Informações para a criação ou melhoria do seu site.',
    icon: <Globe size={20} />,
    serviceRequired: 'Website',
    questions: [
      { id: 'objetivo_site', text: 'Qual o principal objetivo do site?', type: 'select', options: ['Vendas (E-commerce)', 'Geração de Leads', 'Institucional', 'Portfólio'] },
      { id: 'paginas_necessarias', text: 'Quais páginas não podem faltar?', type: 'textarea', placeholder: 'Ex: Home, Sobre, Serviços, Contato...' },
      { id: 'referencias_site', text: 'Links de sites que você gosta', type: 'textarea' },
    ]
  },
  {
    id: 'trafego_pago',
    title: 'Briefing de Tráfego Pago',
    description: 'Diretrizes para suas campanhas de anúncios.',
    icon: <TrendingUp size={20} />,
    serviceRequired: 'Tráfego Pago',
    questions: [
      { id: 'investimento_mensal', text: 'Qual o investimento mensal pretendido?', type: 'text', placeholder: 'Ex: R$ 2.000,00' },
      { id: 'produtos_foco', text: 'Quais produtos/serviços devemos focar?', type: 'textarea' },
      { id: 'oferta_principal', text: 'Qual a oferta principal para os anúncios?', type: 'text' },
    ]
  }
];

export const BriefingOnboarding: React.FC<BriefingFormProps> = ({ onComplete }) => {
  const { activeClient } = useAuth();
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [completedSections, setCompletedSections] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const availableSections = SECTIONS.filter(s => 
    !s.serviceRequired || (activeClient?.services || []).includes(s.serviceRequired)
  );

  const currentSection = availableSections[currentSectionIndex];

  useEffect(() => {
    const fetchResponses = async () => {
      if (!activeClient) return;
      const { data, error } = await supabase
        .from('client_briefings')
        .select('*')
        .eq('client_id', activeClient.id);
      
      if (data) {
        const loadedResponses: Record<string, any> = {};
        const loadedCompleted: string[] = [];
        data.forEach(item => {
          loadedResponses[item.briefing_type] = item.responses;
          if (item.is_completed) loadedCompleted.push(item.briefing_type);
        });
        setResponses(loadedResponses);
        setCompletedSections(loadedCompleted);
      }
      setLoading(false);
    };
    fetchResponses();
  }, [activeClient]);

  const handleInputChange = (sectionId: string, questionId: string, value: any) => {
    setResponses(prev => ({
      ...prev,
      [sectionId]: {
        ...(prev[sectionId] || {}),
        [questionId]: value
      }
    }));
  };

  const saveCurrentSection = async () => {
    if (!activeClient || !currentSection) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('client_briefings')
        .upsert({
          client_id: activeClient.id,
          briefing_type: currentSection.id,
          responses: responses[currentSection.id] || {},
          is_completed: true,
          completed_at: new Date().toISOString()
        }, { onConflict: 'client_id,briefing_type' });

      if (error) throw error;

      if (!completedSections.includes(currentSection.id)) {
        setCompletedSections(prev => [...prev, currentSection.id]);
      }

      if (currentSectionIndex < availableSections.length - 1) {
        setCurrentSectionIndex(prev => prev + 1);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        // Finalizar onboarding
        await supabase
          .from('clients')
          .update({ onboarding_completed: true })
          .eq('id', activeClient.id);
        
        onComplete();
      }
    } catch (err) {
      console.error('Erro ao salvar briefing:', err);
      alert('Erro ao salvar suas respostas. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mb-4" />
      <p className="text-gray-500 font-medium">Preparando seus formulários...</p>
    </div>
  );

  const progress = Math.round((completedSections.length / availableSections.length) * 100);

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="text-center mb-12 space-y-4">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 text-blue-600 text-[10px] font-bold uppercase tracking-widest">
          <Zap size={12} /> Onboarding Estratégico
        </div>
        <h1 className="text-4xl font-bold text-brand-dark tracking-tight">
          Seja bem-vindo, <span className="serif italic font-normal text-gray-400">{activeClient?.name}</span>
        </h1>
        <p className="text-gray-500 max-w-xl mx-auto">
          Para começarmos nossa estratégia com o pé direito, precisamos que você preencha alguns formulários iniciais. Isso nos ajudará a entender melhor sua marca e seus objetivos.
        </p>
      </div>

      {/* Progress Bar */}
      <div className="bg-white rounded-3xl border border-black/[0.03] p-8 mb-10 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
              <CheckCircle size={20} />
            </div>
            <div>
              <p className="text-sm font-bold text-brand-dark">Seu Progresso</p>
              <p className="text-xs text-gray-400">{completedSections.length} de {availableSections.length} formulários concluídos</p>
            </div>
          </div>
          <span className="text-2xl font-bold text-blue-600">{progress}%</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            className="bg-blue-600 h-full rounded-full"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Sidebar Navigation */}
        <div className="lg:col-span-1 space-y-3">
          {availableSections.map((section, index) => {
            const isCompleted = completedSections.includes(section.id);
            const isActive = currentSectionIndex === index;
            
            return (
              <button
                key={section.id}
                onClick={() => setCurrentSectionIndex(index)}
                className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all text-left ${
                  isActive 
                    ? 'bg-brand-dark border-brand-dark text-white shadow-lg shadow-brand-dark/10' 
                    : isCompleted
                      ? 'bg-white border-green-100 text-gray-700 hover:border-green-200'
                      : 'bg-white border-gray-100 text-gray-400 hover:border-gray-200'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  isActive ? 'bg-white/10' : isCompleted ? 'bg-green-50 text-green-600' : 'bg-gray-50'
                }`}>
                  {isCompleted ? <CheckCircle size={16} /> : section.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold uppercase tracking-widest truncate">{section.title}</p>
                </div>
                {isActive && <ChevronRight size={16} className="opacity-50" />}
              </button>
            );
          })}
        </div>

        {/* Form Content */}
        <div className="lg:col-span-2">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSection.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="bg-white rounded-[2.5rem] border border-black/[0.03] p-10 shadow-sm"
            >
              <div className="flex items-center gap-4 mb-8">
                <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
                  {currentSection.icon}
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-brand-dark">{currentSection.title}</h2>
                  <p className="text-sm text-gray-500">{currentSection.description}</p>
                </div>
              </div>

              <div className="space-y-8">
                {currentSection.questions.map((q) => (
                  <div key={q.id} className="space-y-3">
                    <label className="block text-sm font-bold text-brand-dark tracking-tight">
                      {q.text}
                    </label>
                    
                    {q.type === 'textarea' ? (
                      <textarea
                        value={responses[currentSection.id]?.[q.id] || ''}
                        onChange={(e) => handleInputChange(currentSection.id, q.id, e.target.value)}
                        placeholder={q.placeholder}
                        rows={4}
                        className="w-full px-5 py-4 bg-gray-50 border border-transparent rounded-2xl text-sm focus:bg-white focus:border-blue-200 focus:ring-4 focus:ring-blue-50 transition-all outline-none resize-none"
                      />
                    ) : q.type === 'select' ? (
                      <select
                        value={responses[currentSection.id]?.[q.id] || ''}
                        onChange={(e) => handleInputChange(currentSection.id, q.id, e.target.value)}
                        className="w-full px-5 py-4 bg-gray-50 border border-transparent rounded-2xl text-sm focus:bg-white focus:border-blue-200 focus:ring-4 focus:ring-blue-50 transition-all outline-none"
                      >
                        <option value="">Selecione uma opção</option>
                        {q.options?.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={responses[currentSection.id]?.[q.id] || ''}
                        onChange={(e) => handleInputChange(currentSection.id, q.id, e.target.value)}
                        placeholder={q.placeholder}
                        className="w-full px-5 py-4 bg-gray-50 border border-transparent rounded-2xl text-sm focus:bg-white focus:border-blue-200 focus:ring-4 focus:ring-blue-50 transition-all outline-none"
                      />
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-12 pt-8 border-t border-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-2 text-gray-400 text-xs font-medium">
                  <AlertCircle size={14} /> Suas respostas são salvas automaticamente ao avançar.
                </div>
                <button
                  onClick={saveCurrentSection}
                  disabled={saving}
                  className="flex items-center gap-3 px-8 py-4 bg-blue-600 text-white rounded-2xl font-bold text-sm hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50"
                >
                  {saving ? 'Salvando...' : currentSectionIndex === availableSections.length - 1 ? 'Finalizar Onboarding' : 'Próximo Formulário'}
                  <ArrowRight size={18} />
                </button>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
