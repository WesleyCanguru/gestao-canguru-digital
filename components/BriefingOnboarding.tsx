import React, { useState, useEffect } from 'react';
import { supabase, useAuth } from '../lib/supabase';
import { CheckCircle, AlertCircle, ChevronRight, FileText, Send, ArrowLeft, Target, LogOut } from 'lucide-react';
import { Logo } from './Logo';

export const BRIEFING_QUESTIONS: Record<string, { title: string, questions: any[] }> = {
  'persona': {
    title: 'Persona',
    questions: [
      { key: 'nome_ficticio', label: 'Nome fictício da Persona', type: 'text' },
      { key: 'idade', label: 'Idade', type: 'text' },
      { key: 'dia_tipico', label: 'Como é o dia típico dessa pessoa?', type: 'textarea' },
      { key: 'como_chegou', label: 'Como ela chegou até o seu produto/serviço?', type: 'textarea' },
      { key: 'frase_resumo', label: 'Uma frase que resume o problema/necessidade dela', type: 'text' },
      { key: 'impede_comprar', label: 'O que a impede de comprar? (objeções)', type: 'array' }
    ]
  },
  'posicionamento': {
    title: 'Posicionamento',
    questions: [
      { key: 'uma_palavra', label: 'Sua marca em uma palavra', type: 'text' },
      { key: 'descricao_empresa', label: 'Descrição da empresa (Pitch 30s)', type: 'textarea' },
      { key: 'transformacao_concreta', label: 'A transformação concreta que o seu produto gera', type: 'textarea' },
      { key: 'diferenciais', label: 'Quais os principais diferenciais?', type: 'textarea' },
      { key: 'concorrentes', label: 'Principais concorrentes', type: 'textarea' },
      { key: 'erro_concorrente', label: 'Qual o maior erro dos seus concorrentes?', type: 'textarea' },
      { key: 'pessoa_famosa', label: 'Se a sua marca fosse uma pessoa famosa, quem seria?', type: 'text' },
      { key: 'objetivo_redes', label: 'Objetivo principal nas redes sociais', type: 'textarea' },
      { key: 'percebido_1_ano', label: 'Como deseja ser percebido daqui a 1 ano?', type: 'textarea' },
      { key: 'presenca_anterior', label: 'O que funcionou ou não funcionou na sua presença anterior?', type: 'textarea' }
    ]
  },
  'publico_alvo': {
    title: 'Público-Alvo',
    questions: [
      { key: 'genero', label: 'Gênero(s)', type: 'text' },
      { key: 'faixa_etaria', label: 'Faixa Etária', type: 'text' },
      { key: 'renda_mensal', label: 'Renda Mensal', type: 'text' },
      { key: 'localizacao', label: 'Localização (Região/Cidades)', type: 'text' },
      { key: 'rede_social', label: 'Redes Sociais mais utilizadas', type: 'array' },
      { key: 'escolaridade', label: 'Escolaridade', type: 'text' },
      { key: 'conteudos', label: 'Que conteúdos eles consomem?', type: 'textarea' },
      { key: 'como_abordado', label: 'Como gostam de ser abordados?', type: 'textarea' },
      { key: 'sonhos_ambicoes', label: 'Sonhos e Ambições', type: 'textarea' }
    ]
  },
  'tom_voz': {
    title: 'Tom de Voz',
    questions: [
      { key: 'adjetivos', label: 'Adjetivos que descrevem a marca', type: 'array' },
      { key: 'dimensoes', label: 'Dimensões da Marca', type: 'object', objectKeys: ['Linguagem', 'Seriedade', 'Formalidade'] },
      { key: 'emocao_principal', label: 'Emoção Principal ao falar com o público', type: 'text' },
      { key: 'pilar_principal', label: 'Pilar principal da comunicação', type: 'text' },
      { key: 'uso_emojis', label: 'Como é o uso de Emojis?', type: 'text' },
      { key: 'utiliza_humor', label: 'Utiliza Humor?', type: 'text' },
      { key: 'diferencial_tom', label: 'Diferencial do Tom', type: 'textarea' },
      { key: 'marcas_admiradas', label: 'Marcas Admiradas pelo tom de voz', type: 'textarea' },
      { key: 'girias_expressoes', label: 'Gírias ou expressões usadas', type: 'textarea' },
      { key: 'palavras_proibidas', label: 'Palavras proibidas', type: 'textarea' }
    ]
  },
  'site': {
    title: 'Website',
    questions: [
      { key: 'tem_website', label: 'Já tem website?', type: 'text' },
      { key: 'paginas_essenciais', label: 'Páginas essenciais', type: 'array' },
      { key: 'objetivo_site', label: 'Objetivo do Site', type: 'array' },
      { key: 'formas_contato', label: 'Formas de Contato', type: 'array' },
      { key: 'estilo_design', label: 'Estilo de Design preferido', type: 'text' },
      { key: 'sites_admira', label: 'Sites que admira (Referências)', type: 'textarea' },
      { key: 'imagens_midias', label: 'Imagens e Mídias (Possui material?)', type: 'textarea' },
      { key: 'sobre_conteudo', label: 'Sobre o conteúdo (Textos)', type: 'textarea' },
      { key: 'dominio_hospedagem', label: 'Domínio e Hospedagem', type: 'text' },
      { key: 'integracoes', label: 'Integrações', type: 'object', objectKeys: ['CRM', 'Analytics', 'E-commerce', 'Agendamento', 'Pixels'] },
      { key: 'funciona_melhorar', label: 'O que funciona e o que deve melhorar no site atual?', type: 'textarea' }
    ]
  },
  'trafego_pago': {
    title: 'Tráfego Pago',
    questions: [
      { key: 'genero', label: 'Gênero', type: 'text' },
      { key: 'faixa_etaria', label: 'Faixa Etária', type: 'text' },
      { key: 'renda_mensal', label: 'Renda Mensal', type: 'text' },
      { key: 'localizacao', label: 'Localização/Região', type: 'text' },
      { key: 'profissao_cargo', label: 'Profissão / Cargo', type: 'text' },
      { key: 'onde_passa_tempo', label: 'Onde passa o tempo online?', type: 'array' },
      { key: 'ticket_medio', label: 'Ticket Médio', type: 'text' },
      { key: 'ciclo_vendas', label: 'Ciclo de Vendas', type: 'text' },
      { key: 'maior_problema', label: 'Maior Problema do Cliente', type: 'textarea' },
      { key: 'motivou_buscar', label: 'O que o motivou a buscar você?', type: 'array' },
      { key: 'meta_principal', label: 'Meta principal das campanhas', type: 'textarea' },
      { key: 'gatilho_agir', label: 'Gatilho para agir', type: 'array' }
    ]
  }
};

const SERVICE_TO_BRIEFINGS: Record<string, string[]> = {
  'Social Media': ['persona', 'publico_alvo', 'tom_voz', 'posicionamento'],
  'Tráfego Pago': ['trafego_pago'],
  'Website': ['site'],
  'Identidade Visual': ['persona', 'posicionamento'],
  'E-mail Marketing': ['publico_alvo', 'tom_voz'],
  'Fotos com IA': ['persona', 'publico_alvo']
};

export const BriefingOnboarding: React.FC<{ isDashboardView?: boolean }> = ({ isDashboardView }) => {
  const { activeClient, refreshActiveClient, logout } = useAuth();
  const [briefings, setBriefings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBriefingType, setSelectedBriefingType] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (activeClient) {
      loadBriefings();
    }
  }, [activeClient]);

  const loadBriefings = async () => {
    setLoading(true);
    try {
      const services = activeClient?.services || [];
      
      const { data: existingBriefings } = await supabase
        .from('client_briefings')
        .select('*')
        .eq('client_id', activeClient!.id);
      
      let currentBriefings = existingBriefings || [];
      
      // Determine required briefing types based on services
      const requiredTypes = new Set<string>();
      for (const service of services) {
        const types = SERVICE_TO_BRIEFINGS[service] || [];
        types.forEach(t => requiredTypes.add(t));
      }

      let neededToCreate = [];
      for (const bType of requiredTypes) {
        const exists = currentBriefings.find((b: any) => b.briefing_type === bType);
        if (!exists) {
          neededToCreate.push({
            client_id: activeClient!.id,
            agency_id: 1,
            briefing_type: bType,
            responses: {},
            is_completed: false
          });
        }
      }

      if (neededToCreate.length > 0) {
        const { data: created } = await supabase
          .from('client_briefings')
          .insert(neededToCreate)
          .select();
        
        if (created) {
          currentBriefings = [...currentBriefings, ...created];
        }
      }

      const relevantBriefings = currentBriefings.filter((b: any) => requiredTypes.has(b.briefing_type));
      setBriefings(relevantBriefings);
      
      // Check overall completion
      if (requiredTypes.size > 0) {
          const completedCount = relevantBriefings.filter((b: any) => b.is_completed).length;
          if (completedCount === requiredTypes.size && !activeClient?.onboarding_completed) {
            await supabase.from('clients').update({ onboarding_completed: true }).eq('id', activeClient!.id);
            await refreshActiveClient();
          }
      } else if (!activeClient?.onboarding_completed) {
         await supabase.from('clients').update({ onboarding_completed: true }).eq('id', activeClient!.id);
         await refreshActiveClient();
      }

    } catch (err) {
      console.error('Error loading briefings', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectBriefing = (briefing: any) => {
    setSelectedBriefingType(briefing.briefing_type);
    setFormData(briefing.responses || {});
  };

  const handleSave = async (complete: boolean) => {
    if (!selectedBriefingType || !activeClient) return;
    setSaving(true);
    
    try {
      // Process array fields
      const processedData = { ...formData };
      const currentSpec = BRIEFING_QUESTIONS[selectedBriefingType];
      if (currentSpec) {
        currentSpec.questions.forEach(q => {
          if (q.type === 'array' && typeof processedData[q.key] === 'string') {
            processedData[q.key] = processedData[q.key].split(',').map((s: string) => s.trim()).filter(Boolean);
          }
        });
      }

      await supabase
        .from('client_briefings')
        .update({
          responses: processedData,
          is_completed: complete,
          completed_at: complete ? new Date().toISOString() : null
        })
        .eq('client_id', activeClient.id)
        .eq('briefing_type', selectedBriefingType);
      
      await loadBriefings();
      if (complete) setSelectedBriefingType(null);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64 w-full">
        <div className="w-8 h-8 border-4 border-brand-dark/20 border-t-brand-dark rounded-full animate-spin" />
      </div>
    );
  }

  const allCompleted = briefings.length > 0 && briefings.every(b => b.is_completed);
  const completedCount = briefings.filter(b => b.is_completed).length;

  if (selectedBriefingType) {
    const briefingSpec = BRIEFING_QUESTIONS[selectedBriefingType];
    const questions = briefingSpec ? briefingSpec.questions : [];
    const title = briefingSpec ? briefingSpec.title : selectedBriefingType;

    return (
      <div className="w-full min-h-[calc(100vh-80px)] bg-[#FDFDFD] flex flex-col items-center justify-center py-10 px-4 relative">
        <div className="absolute top-10 left-10 hidden sm:block">
          <Logo className="w-48" />
        </div>

        <div className="absolute top-10 right-10">
          <button 
            onClick={() => logout()}
            className="flex items-center gap-2 px-4 py-2 border border-brand-dark/10 rounded-xl text-gray-500 hover:text-red-500 hover:border-red-100 hover:bg-red-50 transition-all font-bold tracking-widest uppercase text-[10px]"
          >
            <LogOut size={16} /> Sair do sistema
          </button>
        </div>
        
        <div className="w-full max-w-3xl mx-auto p-4 sm:p-10 bg-white rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-black/[0.03] min-h-[80vh] flex flex-col pt-10">
          <button 
            onClick={() => setSelectedBriefingType(null)}
          className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-gray-500 hover:text-brand-dark transition-colors mb-8 w-fit"
        >
          <ArrowLeft size={16} /> Voltar para os briefings
        </button>
        
        <h2 className="text-3xl font-black text-brand-dark mb-2 tracking-tight">{title}</h2>
        <p className="text-gray-500 font-medium mb-10">Preencha as informações detalhadas para este módulo.</p>

        <div className="space-y-8 flex-1">
          {questions.map((q) => (
            <div key={q.key}>
              <label className="block text-sm font-bold text-gray-800 mb-2">{q.label}</label>
              {q.help && <p className="text-[11px] text-gray-500 mb-3 leading-relaxed">{q.help}</p>}
              
              {q.type === 'object' && q.objectKeys ? (
                <div className="space-y-3 p-4 bg-gray-50/50 rounded-2xl border border-gray-200">
                  {q.objectKeys.map((objKey: string) => (
                    <div key={objKey} className="flex flex-col sm:flex-row sm:items-center gap-2">
                       <label className="text-xs font-bold text-gray-500 uppercase w-32 shrink-0">{objKey}</label>
                       <input
                          type="text"
                          value={(formData[q.key] && formData[q.key][objKey]) || ''}
                          onChange={(e) => setFormData({ 
                            ...formData, 
                            [q.key]: { ...(formData[q.key] || {}), [objKey]: e.target.value } 
                          })}
                          className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark shadow-sm transition-all bg-white"
                       />
                    </div>
                  ))}
                </div>
              ) : q.type === 'array' ? (
                <div>
                  <p className="text-[10px] text-gray-400 mb-2 italic">Separe os itens por vírgula</p>
                  <textarea
                    value={Array.isArray(formData[q.key]) ? formData[q.key].join(', ') : (formData[q.key] || '')}
                    onChange={(e) => setFormData({ ...formData, [q.key]: e.target.value })}
                    placeholder="Item 1, Item 2, Item 3..."
                    className="w-full border border-gray-200 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark resize-none shadow-sm transition-all bg-gray-50/50"
                    rows={3}
                  />
                </div>
              ) : q.type === 'textarea' ? (
                <textarea
                  value={formData[q.key] || ''}
                  onChange={(e) => setFormData({ ...formData, [q.key]: e.target.value })}
                  placeholder={q.placeholder}
                  className="w-full border border-gray-200 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark resize-none shadow-sm transition-all bg-gray-50/50"
                  rows={4}
                />
              ) : (
                <input
                  type="text"
                  value={formData[q.key] || ''}
                  onChange={(e) => setFormData({ ...formData, [q.key]: e.target.value })}
                  placeholder={q.placeholder}
                  className="w-full border border-gray-200 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark shadow-sm transition-all bg-gray-50/50"
                />
              )}
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col sm:flex-row gap-4 pt-8 border-t border-gray-100 pb-10">
          <button
            onClick={() => handleSave(false)}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-4 border border-gray-200 text-gray-700 rounded-2xl hover:bg-gray-50 transition-colors font-bold tracking-widest uppercase text-xs disabled:opacity-50"
          >
            Salvar Rascunho
          </button>
          <button
            onClick={() => handleSave(true)}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-brand-dark text-white rounded-2xl hover:opacity-90 transition-opacity font-bold tracking-widest uppercase text-xs shadow-lg disabled:opacity-50"
          >
            {saving ? 'Salvando...' : <><CheckCircle size={16} /> Concluir Briefing</>}
          </button>
        </div>
      </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-[calc(100vh-80px)] bg-[#FDFDFD] flex flex-col items-center justify-center py-10 px-4 relative">
      <div className="absolute top-10 left-10 hidden sm:block">
        <Logo className="w-56" />
      </div>

      <div className="absolute top-10 right-10">
        <button 
          onClick={() => logout()}
          className="flex items-center gap-2 px-4 py-2 border border-brand-dark/10 rounded-xl text-gray-500 hover:text-red-500 hover:border-red-100 hover:bg-red-50 transition-all font-bold tracking-widest uppercase text-[10px]"
        >
          <LogOut size={16} /> Sair do sistema
        </button>
      </div>
      
      <div className="max-w-4xl w-full p-6 sm:p-10 bg-white rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-black/[0.03]">
        <div className="mb-10 text-center">
          <div className="w-20 h-20 bg-brand-dark/5 rounded-[1.5rem] flex items-center justify-center mx-auto mb-6 shrink-0 text-brand-dark">
            <Target size={32} />
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-brand-dark mb-4 tracking-tight">Bem-vindo!</h1>
          <p className="text-gray-500 font-medium max-w-lg mx-auto text-sm sm:text-base mb-8">
            Antes de começar, precisamos de algumas informações estratégicas. Preencha os formulários dos serviços contratados abaixo.
          </p>
          
          <div className="max-w-lg mx-auto">
            <div className="mb-3 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-gray-400">
              <span>Progresso Geral</span>
              <span>{completedCount} de {briefings.length} concluídos</span>
            </div>
            <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
               <div className="h-full bg-brand-dark transition-all duration-500" style={{ width: `${briefings.length ? (completedCount / briefings.length) * 100 : 0}%` }} />
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 mb-10 max-w-2xl mx-auto">
          {briefings.map(b => {
             const spec = BRIEFING_QUESTIONS[b.briefing_type];
             const title = spec ? spec.title : b.briefing_type;
             return (
              <div 
                key={b.id} 
                onClick={() => handleSelectBriefing(b)}
                className={`p-6 rounded-[1.5rem] border-2 cursor-pointer transition-all hover:-translate-y-1 ${b.is_completed ? 'border-green-100 bg-green-50/50' : 'border-gray-100 hover:border-brand-dark bg-white shadow-[0_4px_20px_rgba(0,0,0,0.03)]'}`}
              >
                <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${b.is_completed ? 'bg-green-100 text-green-600' : 'bg-brand-dark/5 text-brand-dark'}`}>
                      {b.is_completed ? <CheckCircle size={24} /> : <FileText size={24} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-900 truncate text-lg">{title}</h3>
                      <span className={`text-[10px] uppercase tracking-widest font-bold mt-1 block ${b.is_completed ? 'text-green-600' : 'text-gray-400'}`}>
                          {b.is_completed ? 'Concluído' : 'Pendente'}
                      </span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-300 shrink-0" />
                </div>
              </div>
            );
          })}
        </div>

        {allCompleted && briefings.length > 0 && (
          <div className="flex justify-center border-t border-gray-100 pt-10">
            <button
              onClick={() => window.location.reload()}
              className="flex items-center gap-3 px-8 py-4 bg-brand-dark text-white rounded-2xl font-bold uppercase tracking-widest text-sm hover:opacity-90 transition-all hover:shadow-xl shadow-brand-dark/20 hover:-translate-y-1"
            >
              Acessar minha Bolsa <Send size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
