import React, { useState, useEffect } from 'react';
import { supabase, useAuth } from '../lib/supabase';
import { processTrafficStrategyPdf } from '../src/services/geminiService';
import { TrafficStrategyData } from '../types';
import {
  ChevronLeft,
  Target,
  DollarSign,
  Users,
  Search,
  MessageCircle,
  ArrowRight,
  AlertTriangle,
  Zap,
  Globe,
  Upload,
  Loader2,
  FileText
} from 'lucide-react';
import { motion } from 'motion/react';

const CALABRES_STRATEGY: TrafficStrategyData = {
  kpis: {
    monthlyBudget: "R$ 600",
    budgetDetails: "R$ 25/dia (segunda a sábado a principio para quesito de teste) (Mês 1 = aprendizado)",
    priorityGoal: "5 clientes",
    goalDetails: "Objetivo para o Mês",
    averageTicket: "R$ 2.000",
    ticketDetails: "Por cliente fechado"
  },
  strategicDecision: {
    title: "Decisão Estratégica",
    items: [
      {
        title: "100% Google Ads (Rede de Pesquisa)",
        description: "O público já está com o problema e buscando solução agora. O Google captura essa intenção ativa. O Meta Ads fará sentido quando o tráfego orgânico já existir e houver público para remarketing (previsto para os meses 3 ou 4).",
        color: "brand-dark"
      },
      {
        title: "Destino: Landing Pages Exclusivas por Conjunto",
        description: "Cada conjunto de anúncios direciona para uma landing page própria, com copy alinhada à intenção de busca de cada público. As páginas já estão publicadas e os links estão configurados nos grupos de anúncios.",
        color: "green-500"
      }
    ]
  },
  campaignStructure: {
    title: "Estrutura das Campanhas",
    sets: [
      {
        id: "Conjunto 1",
        name: "Direito do Consumidor e Bancário",
        destination: "https://consumidor.calabreselimaadvocacia.com.br/",
        destinationUrl: "https://consumidor.calabreselimaadvocacia.com.br/",
        audience: "Público: Pessoas que tiveram conta bloqueada, plano de saúde negado, seguro não pago, produto com defeito ou serviço não prestado. Já têm o problema e estão buscando solução com urgência.",
        keywords: ["[conta bloqueada o que fazer]", "[banco bloqueou minha conta]", "[plano de saúde negou tratamento]", "[seguro não quer pagar sinistro]", "\"advogado direito de consumidor\"", "\"advogado conta bloqueada\""],
        preFilledMessage: "Olá! Vi o anúncio e preciso de ajuda com uma situação urgente. Podem me dizer como funciona o atendimento?"
      },
      {
        id: "Conjunto 2",
        name: "Direito de Família",
        destination: "https://familia.calabreselimaadvocacia.com.br/",
        destinationUrl: "https://familia.calabreselimaadvocacia.com.br/",
        audience: "Público: Pessoas passando por divórcio, disputas de guarda, pensão alimentícia ou inventário. Momento emocional delicado — a copy precisa ser acolhedora e transmitir segurança.",
        keywords: ["[advogado divórcio]", "[pensão alimentícia advogado]", "[guarda compartilhada advogado]", "[inventário advogado]", "\"advogado direito de família\"", "como pedir pensão alimentícia"],
        preFilledMessage: "Olá! Vi o anúncio e estou passando por uma situação familiar. Gostaria de entender como vocês podem me ajudar."
      },
      {
        id: "Conjunto 3",
        name: "Cível e Indenizações",
        destination: "http://indenizacao.calabreselimaadvocacia.com.br/",
        destinationUrl: "http://indenizacao.calabreselimaadvocacia.com.br/",
        audience: "Público: Pessoas que sofreram dano moral, prejuízo por falha de serviço, acidente ou descumprimento de contrato. Sentem-se lesadas e querem justiça.",
        keywords: ["[dano moral advogado]", "[indenização por dano material]", "[cobrar empresa na justiça]", "\"advogado direito civil\"", "\"cobrar indenização de empresa\"", "como processar empresa por dano"],
        preFilledMessage: "Olá! Vi o anúncio e acredito que tive um direito violado. Gostaria de saber se tenho base para buscar indenização."
      }
    ]
  },
  phase2: {
    title: "Fase 2 — Escala",
    description: "Quando a meta de 5 clientes for batida e a verba subir para R$ 1.500/mês, ativaremos a Campanha 2 focada nas áreas de crescimento.",
    campaigns: [
      { title: "Campanha 1 (Mantida)", areas: "Família, Cível, Consumidor", budget: "R$ 900/mês" },
      { title: "Campanha 2 (Nova)", areas: "Bancário e Imobiliário", budget: "R$ 600/mês" }
    ]
  },
  alert: {
    title: "Atenção ao Atendimento",
    message: "Lembre-se de orientar sua equipe a responder os leads do WhatsApp em até 1 hora durante o horário comercial. A velocidade de resposta de vocês é o principal fator de conversão nesse modelo de campanha!"
  }
};

export const PaidTrafficView: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const { activeClient, userRole, refreshActiveClient } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const isCalabres = activeClient?.id === 'e817fbf9-0985-4453-b710-34623af870d6' || activeClient?.name?.includes('Calabres');
  const isNextSafety = activeClient?.id === '75b00b27-61ee-4b23-8721-70748ccb0789' || activeClient?.name?.includes('Next Safety');

  const strategyData = activeClient?.traffic_strategy_data || (isCalabres ? CALABRES_STRATEGY : null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !activeClient) return;

    if (file.type !== 'application/pdf') {
      setUploadError('Por favor, envie apenas arquivos PDF.');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        try {
          const processedData = await processTrafficStrategyPdf(base64);
          
          const { error } = await supabase
            .from('clients')
            .update({ traffic_strategy_data: processedData })
            .eq('id', activeClient.id);

          if (error) throw error;
          
          await refreshActiveClient();
          setIsUploading(false);
        } catch (err) {
          console.error('Error processing PDF:', err);
          setUploadError('Erro ao processar a estratégia com IA. Tente novamente.');
          setIsUploading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Error reading file:', err);
      setUploadError('Erro ao ler o arquivo.');
      setIsUploading(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-6 sticky top-0 z-10 shadow-sm">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {onBack && (
              <button 
                onClick={onBack}
                className="p-2 hover:bg-gray-50 rounded-xl transition-colors text-gray-400 hover:text-brand-dark"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Estratégia de Tráfego Pago</h1>
              <p className="text-sm text-gray-500 mt-1">Google Ads • {activeClient?.name || 'Cliente'}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {userRole === 'admin' && (
              <div className="relative">
                <input
                  type="file"
                  id="pdf-upload"
                  className="hidden"
                  accept=".pdf"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                />
                <label
                  htmlFor="pdf-upload"
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all font-medium text-sm shadow-sm cursor-pointer ${
                    isUploading 
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                      : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Subir Estratégia (PDF)
                    </>
                  )}
                </label>
              </div>
            )}

          </div>
        </div>
        {uploadError && (
          <div className="max-w-5xl mx-auto mt-4 px-2">
            <div className="bg-red-50 text-red-600 text-xs py-2 px-4 rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-3 h-3" />
              {uploadError}
            </div>
          </div>
        )}
      </div>

      <motion.div 
        className="max-w-5xl mx-auto px-6 py-8 space-y-8"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Metric Placeholders & Live Sync Banner */}
        <motion.div variants={itemVariants} className="bg-white rounded-3xl p-8 border border-gray-200 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-5">
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Dashboard de Desempenho</span>
              <h2 className="text-xl font-bold text-gray-900 mt-1">Métricas de Campanhas (Google & Meta Ads)</h2>
            </div>
            <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-xs font-semibold self-start sm:self-auto">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
              Sincronização em breve
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-gray-50/80 rounded-2xl p-4 border border-gray-100">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Investimento</span>
              <p className="text-lg font-bold text-gray-800">R$ 0,00</p>
              <span className="text-[10px] text-gray-400 font-medium">Acumulado mês</span>
            </div>

            <div className="bg-gray-50/80 rounded-2xl p-4 border border-gray-100">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Impressões</span>
              <p className="text-lg font-bold text-gray-800">--</p>
              <span className="text-[10px] text-gray-400 font-medium">Alcance total</span>
            </div>

            <div className="bg-gray-50/80 rounded-2xl p-4 border border-gray-100">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Cliques</span>
              <p className="text-lg font-bold text-gray-800">--</p>
              <span className="text-[10px] text-gray-400 font-medium">Tráfego gerado</span>
            </div>

            <div className="bg-gray-50/80 rounded-2xl p-4 border border-gray-100">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Conversões</span>
              <p className="text-lg font-bold text-gray-800">--</p>
              <span className="text-[10px] text-gray-400 font-medium">Leads e contatos</span>
            </div>

            <div className="bg-gray-50/80 rounded-2xl p-4 border border-gray-100">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">CPC Médio</span>
              <p className="text-lg font-bold text-gray-800">R$ --</p>
              <span className="text-[10px] text-gray-400 font-medium">Custo p/ clique</span>
            </div>

            <div className="bg-gray-50/80 rounded-2xl p-4 border border-gray-100">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">CPL Médio</span>
              <p className="text-lg font-bold text-gray-800">R$ --</p>
              <span className="text-[10px] text-gray-400 font-medium">Custo p/ lead</span>
            </div>
          </div>
        </motion.div>
        {!strategyData ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6">
              <FileText className="w-10 h-10 text-gray-300" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Sem Estratégia Definida</h3>
            <p className="text-gray-500 max-w-md">
              Ainda não há uma estratégia de tráfego configurada para este cliente. 
              {userRole === 'admin' && ' Faça o upload de um PDF para gerar a estratégia automaticamente.'}
            </p>
          </div>
        ) : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <motion.div variants={itemVariants} className="bg-brand-dark rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
                <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="font-medium text-white/80">Verba Mensal</h3>
                </div>
                <p className="text-3xl font-bold">{strategyData.kpis.monthlyBudget}</p>
                <p className="text-sm text-white/60 mt-2">{strategyData.kpis.budgetDetails}</p>
              </motion.div>

              <motion.div variants={itemVariants} className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                    <Target className="w-5 h-5 text-orange-600" />
                  </div>
                  <h3 className="font-medium text-gray-500">Meta Prioritária</h3>
                </div>
                <p className="text-3xl font-bold text-gray-900">{strategyData.kpis.priorityGoal}</p>
                <p className="text-sm text-gray-500 mt-2">{strategyData.kpis.goalDetails}</p>
              </motion.div>

              <motion.div variants={itemVariants} className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                    <Users className="w-5 h-5 text-green-600" />
                  </div>
                  <h3 className="font-medium text-gray-500">Ticket Médio</h3>
                </div>
                <p className="text-3xl font-bold text-gray-900">{strategyData.kpis.averageTicket}</p>
                <p className="text-sm text-gray-500 mt-2">{strategyData.kpis.ticketDetails}</p>
              </motion.div>
            </div>

            {/* Decisão Estratégica */}
            <motion.div variants={itemVariants} className="bg-white rounded-3xl p-8 border border-gray-200 shadow-sm">
              <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                <Search className="w-6 h-6 text-brand-dark" />
                {strategyData.strategicDecision.title}
              </h2>
              <div className="space-y-6">
                {strategyData.strategicDecision.items.map((item, idx) => (
                  <div key={idx} className="flex gap-4">
                    <div className={`w-1.5 rounded-full shrink-0 ${item.color === 'brand-dark' ? 'bg-brand-dark' : 'bg-green-500'}`}></div>
                    <div>
                      <h3 className="font-bold text-gray-900 text-lg">{item.title}</h3>
                      <p className="text-gray-600 mt-2 leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Estrutura das Campanhas */}
            <motion.div variants={itemVariants}>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">{strategyData.campaignStructure.title}</h2>
              
              <div className="space-y-6">
                {strategyData.campaignStructure.sets.map((set, idx) => (
                  <div key={idx} className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="bg-gray-50 px-8 py-5 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <span className="text-xs font-bold tracking-wider text-gray-500 uppercase mb-1 block">{set.id}</span>
                        <h3 className="text-lg font-bold text-gray-900">{set.name}</h3>
                      </div>
                      <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full border border-gray-200 text-sm font-medium text-gray-700 shadow-sm">
                        <Globe className="w-4 h-4 text-blue-500" />
                        Destino: <a href={set.destinationUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{set.destination}</a>
                      </div>
                    </div>
                    
                    <div className="p-8">
                      <p className="text-gray-600 mb-6">
                        {set.audience}
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                          <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <Search className="w-4 h-4 text-gray-400" />
                            Palavras-chave Principais
                          </h4>
                          <ul className="space-y-2 font-mono text-sm text-gray-600 bg-gray-50 p-4 rounded-xl border border-gray-100">
                            {set.keywords.map((kw, kidx) => (
                              <li key={kidx}>{kw}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <MessageCircle className="w-4 h-4 text-gray-400" />
                            Mensagem Pré-preenchida
                          </h4>
                          <div className="bg-green-50 border border-green-100 p-4 rounded-xl text-green-900 text-sm italic">
                            "{set.preFilledMessage}"
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Fase 2 */}
            <motion.div variants={itemVariants} className="bg-gradient-to-br from-brand-dark to-gray-900 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl"></div>
              
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-6">
                  <Zap className="w-6 h-6 text-orange-400" />
                  <h2 className="text-2xl font-bold">{strategyData.phase2.title}</h2>
                </div>
                
                <p className="text-gray-300 mb-8 max-w-2xl">
                  {strategyData.phase2.description}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {strategyData.phase2.campaigns.map((camp, idx) => (
                    <div key={idx} className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
                      <h3 className="font-bold text-lg mb-2">{camp.title}</h3>
                      <p className="text-gray-300 text-sm mb-4">{camp.areas}</p>
                      <div className="text-2xl font-bold text-orange-400">{camp.budget}</div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Alerta */}
            <motion.div variants={itemVariants} className="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex gap-4">
              <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0" />
              <div>
                <h4 className="font-bold text-amber-900">{strategyData.alert.title}</h4>
                <p className="text-amber-800 text-sm mt-1">
                  {strategyData.alert.message}
                </p>
              </div>
            </motion.div>
          </>
        )}
      </motion.div>
    </div>
  );
};
