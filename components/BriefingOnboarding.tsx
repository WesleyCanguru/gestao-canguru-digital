import React, { useState, useEffect } from 'react';
import { supabase, useAuth } from '../lib/supabase';
import { CheckCircle, AlertCircle, ChevronRight, FileText, Send, ArrowLeft, Target, LogOut } from 'lucide-react';
import { Logo } from './Logo';

export const BRIEFING_QUESTIONS: Record<string, { title: string, questions: any[] }> = {
  'persona': {
    title: 'Persona',
    questions: [
      { 
        key: 'cliente_ideal', 
        label: 'Quem é o seu cliente ideal (Perfil)?', 
        type: 'textarea',
        placeholder: 'Ex: Homens e mulheres de 30-45 anos, empreendedores de médio porte, que buscam automatizar processos.',
        help: 'Pense em quem é a pessoa que toma a decisão de compra. Quais são suas características demográficas e comportamentais?'
      },
      { 
        key: 'dores_desejos', 
        label: 'Quais são as principais dores e desejos dele?', 
        type: 'textarea',
        placeholder: '1. Falha na comunicação interna...\n2. Perda de prazos...\n3. Dificuldade em escalar...',
        help: 'O que tira o sono do seu cliente? Qual problema ele tenta resolver quando procura sua empresa?'
      },
      { 
        key: 'sonhos_desejos', 
        label: 'Quais são os grandes sonhos e desejos dele a longo prazo?', 
        type: 'textarea',
        placeholder: 'Ex: Ter mais tempo com a família, ser referência no setor, faturar 1 milhão/ano...',
        help: 'Para onde ele quer ir? O que ele espera alcançar?'
      },
      { 
        key: 'objecoes_comuns', 
        label: 'Quais as principais objeções que ele apresenta na hora de comprar?', 
        type: 'textarea',
        placeholder: 'Ex: Preço alto, falta de tempo para implementar, medo de não funcionar...',
        help: 'O que faz ele travar na hora de fechar negócio?'
      }
    ]
  },
  'publico_alvo': {
    title: 'Público-Alvo',
    questions: [
      { 
        key: 'descricao_publico', 
        label: 'Descreva seu público-alvo ideal', 
        type: 'textarea', 
        placeholder: 'Ex: Todo o Brasil, apenas São Paulo (Capital), Região Sul...',
        help: 'Onde eles estão? O que eles fazem? Idade, gênero, localização, interesses.'
      },
      { 
        key: 'poder_aquisitivo', 
        label: 'Qual a classe social ou poder aquisitivo estimado?', 
        type: 'text', 
        placeholder: 'Ex: Classe A/B, Renda mensal acima de R$ 5.000...',
        help: 'Isso ajuda a definir o tipo de linguagem.'
      }
    ]
  },
  'tom_voz': {
    title: 'Tom de Voz',
    questions: [
      { 
        key: 'tom_marca', 
        label: 'Qual o tom de voz da sua marca?', 
        type: 'text', 
        placeholder: 'Ex: Um mentor experiente, um amigo descontraído, um especialista técnico...',
        help: 'Se sua marca fosse uma pessoa, como ela seria? Formal, descontraído, técnico, inspiracional, divertido?'
      },
      { 
        key: 'palavras_chave', 
        label: 'Quais palavras NUNCA devem ser usadas na comunicação?', 
        type: 'text', 
        placeholder: 'Ex: Oferta, promoção, barato (preferimos "oportunidade", "investimento")...',
        help: 'Termos que não combinam com o seu posicionamento.'
      }
    ]
  },
  'posicionamento': {
    title: 'Posicionamento',
    questions: [
      { 
        key: 'diferencial', 
        label: 'Qual o principal diferencial em relação à concorrência?', 
        type: 'textarea',
        placeholder: 'Ex: Nós ajudamos empresas a reduzirem custos operacionais em até 30% em 90 dias.',
        help: 'Por que o cliente deve escolher você?'
      },
      { 
        key: 'visao_mercado', 
        label: 'Como você quer que a sua marca seja vista no mercado?', 
        type: 'textarea',
        placeholder: 'Ex: Líder em tecnologia, a mais humana do setor...',
        help: 'Qual imagem você quer passar?'
      }
    ]
  },
  'site': {
    title: 'Website',
    questions: [
      { key: 'objetivo', label: 'Qual o objetivo principal do site?', type: 'text', placeholder: 'institucional, e-commerce, landing page, portfólio'},
      { key: 'proposta_valor_destaque', label: 'Qual mensagem principal deve aparecer logo no topo (Hero Section)?', type: 'textarea', help: 'A primeira coisa que o visitante deve ler.'},
      { key: 'paginas', label: 'Quais páginas são necessárias?', type: 'text', placeholder: 'ex: home, sobre, serviços, contato, blog'},
      { key: 'chamadas_acao', label: 'Quais os principais CTAs (Botões de Ação)?', type: 'text', placeholder: 'Ex: Fale no WhatsApp, Solicite Orçamento, Baixe o E-book...'},
      { key: 'referencias', label: 'Tem referências de sites que gosta? (cole as URLs)', type: 'textarea', help: 'Podem ser concorrentes ou sites de outros setores que tenham um visual que você admira.'},
      { key: 'integracoes', label: 'Precisa de integrações específicas?', type: 'text', placeholder: 'Ex: RD Station, Mailchimp, CRM Próprio, PagSeguro...'},
      { key: 'dominio_hospedagem', label: 'Já possui domínio registrado? Tem hospedagem?', type: 'text'},
      { key: 'identidade_visual', label: 'Já tem identidade visual definida (cores, fontes, logo)?', type: 'text'}
    ]
  },
  'trafego_pago': {
    title: 'Tráfego Pago',
    questions: [
      { key: 'produtos_destaque', label: 'Quais produtos ou serviços têm maior margem e devem ser priorizados?', type: 'textarea', help: 'Onde o seu lucro é maior?'},
      { key: 'geolocalizacao_anuncios', label: 'Para quais regiões devemos anunciar?', type: 'text', placeholder: 'Ex: Brasil todo, apenas cidades com mais de 500k habitantes, raio de 10km da loja...'},
      { key: 'historico_anuncios', label: 'Já fez anúncios antes? O que funcionou e o que não funcionou?', type: 'textarea'},
      { key: 'objetivo_campanha', label: 'Qual o objetivo imediato?', type: 'text', placeholder: 'geração de leads, vendas diretas, tráfego para site, reconhecimento de marca'},
      { key: 'investimento_mensal', label: 'Qual a verba mensal destinada aos anúncios?', type: 'text', placeholder: 'Ex: R$ 2.000,00 por plataforma'},
      { key: 'canais_preferenciais', label: 'Quais canais você acredita que seu público mais utiliza?', type: 'text', placeholder: 'Ex: Instagram e Google Search...'}
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
      await supabase
        .from('client_briefings')
        .update({
          responses: formData,
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
              {q.type === 'textarea' ? (
                <textarea
                  value={typeof formData[q.key] === 'object' 
                    ? (Array.isArray(formData[q.key]) ? formData[q.key].join(', ') : Object.entries(formData[q.key] || {}).filter(([_, v]) => v).map(([k]) => k).join(', ')) 
                    : (formData[q.key] || '')}
                  onChange={(e) => setFormData({ ...formData, [q.key]: e.target.value })}
                  placeholder={q.placeholder}
                  className="w-full border border-gray-200 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark resize-none shadow-sm transition-all bg-gray-50/50"
                  rows={4}
                />
              ) : (
                <input
                  type="text"
                  value={typeof formData[q.key] === 'object' 
                    ? (Array.isArray(formData[q.key]) ? formData[q.key].join(', ') : Object.entries(formData[q.key] || {}).filter(([_, v]) => v).map(([k]) => k).join(', ')) 
                    : (formData[q.key] || '')}
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
