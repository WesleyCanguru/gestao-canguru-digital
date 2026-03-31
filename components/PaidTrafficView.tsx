import React, { useState, useEffect, useRef } from 'react';
import { useAuth, supabase } from '../lib/supabase';
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
  FileText,
  Loader2,
  Trash2,
  Edit2,
  Check,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PaidTrafficStrategy } from '../types';
import { generatePaidTrafficStrategy } from '../src/services/geminiPaidTraffic';
import * as pdfjsLib from 'pdfjs-dist';

// Configuração do worker do PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export const PaidTrafficView: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const { activeClient, userRole } = useAuth();
  const [strategy, setStrategy] = useState<PaidTrafficStrategy | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedStrategy, setEditedStrategy] = useState<PaidTrafficStrategy | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = userRole === 'admin';

  useEffect(() => {
    if (activeClient) {
      fetchStrategy();
    }
  }, [activeClient]);

  const fetchStrategy = async () => {
    if (!activeClient) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('client_paid_traffic_strategies')
        .select('*')
        .eq('client_id', activeClient.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching strategy:', error);
      } else if (data) {
        setStrategy(data);
        setEditedStrategy(data);
      } else {
        setStrategy(null);
        setEditedStrategy(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const extractTextFromPdf = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      fullText += pageText + '\n';
    }
    
    return fullText;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !activeClient) return;

    setUploading(true);
    try {
      // 1. Extrair texto do PDF
      const pdfText = await extractTextFromPdf(file);

      // 2. Gerar estratégia com Gemini
      const generatedData = await generatePaidTrafficStrategy(pdfText);

      // 3. Salvar no Supabase
      const { error } = await supabase
        .from('client_paid_traffic_strategies')
        .upsert({
          client_id: activeClient.id,
          ...generatedData,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      await fetchStrategy();
      alert('Estratégia gerada com sucesso!');
    } catch (error) {
      console.error('Error uploading strategy:', error);
      alert('Erro ao processar o PDF. Tente novamente.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSaveEdit = async () => {
    if (!editedStrategy || !activeClient) return;

    try {
      const { error } = await supabase
        .from('client_paid_traffic_strategies')
        .upsert({
          ...editedStrategy,
          client_id: activeClient.id,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      setStrategy(editedStrategy);
      setIsEditing(false);
      alert('Estratégia atualizada com sucesso!');
    } catch (error) {
      console.error('Error updating strategy:', error);
      alert('Erro ao salvar as alterações.');
    }
  };

  const handleDeleteStrategy = async () => {
    if (!activeClient || !confirm('Tem certeza que deseja excluir esta estratégia?')) return;

    try {
      const { error } = await supabase
        .from('client_paid_traffic_strategies')
        .delete()
        .eq('client_id', activeClient.id);

      if (error) throw error;

      setStrategy(null);
      setEditedStrategy(null);
      alert('Estratégia excluída.');
    } catch (error) {
      console.error('Error deleting strategy:', error);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-brand-dark animate-spin" />
      </div>
    );
  }

  // Se não houver estratégia e for Next Safety, mostrar vazio ou opção de upload
  // Se for Calabres & Lima e não houver no banco, poderíamos mostrar o hardcoded original, 
  // mas o usuário quer poder alterar, então o ideal é que tudo venha do banco.
  
  const displayStrategy = strategy || (activeClient?.name?.includes('Calabres') ? {
    monthly_budget: 600,
    daily_budget: "R$ 25/dia (segunda a sábado a principio para quesito de teste) (Mês 1 = aprendizado)",
    priority_goal: "5 clientes",
    avg_ticket: 2000,
    strategic_decision: "100% Google Ads (Rede de Pesquisa). O público já está com o problema e buscando solução agora. O Google captura essa intenção ativa. O Meta Ads fará sentido quando o tráfego orgânico já existir e houver público para remarketing (previsto para os meses 3 ou 4).",
    campaign_structure: {
      sets: [
        {
          id: "Conjunto 1",
          title: "Direito do Consumidor e Bancário",
          destination_url: "https://consumidor.calabreselimaadvocacia.com.br/",
          audience: "Pessoas que tiveram conta bloqueada, plano de saúde negado, seguro não pago, produto com defeito ou serviço não prestado. Já têm o problema e estão buscando solução com urgência.",
          keywords: ["[conta bloqueada o que fazer]", "[banco bloqueou minha conta]", "[plano de saúde negou tratamento]", "[seguro não quer pagar sinistro]", "\"advogado direito de consumidor\"", "\"advogado conta bloqueada\""],
          prefilled_message: "Olá! Vi o anúncio e preciso de ajuda com uma situação urgente. Podem me dizer como funciona o atendimento?"
        },
        {
          id: "Conjunto 2",
          title: "Direito de Família",
          destination_url: "https://familia.calabreselimaadvocacia.com.br/",
          audience: "Pessoas passando por divórcio, disputas de guarda, pensão alimentícia ou inventário. Momento emocional delicado — a copy precisa ser acolhedora e transmitir segurança.",
          keywords: ["[advogado divórcio]", "[pensão alimentícia advogado]", "[guarda compartilhada advogado]", "[inventário advogado]", "\"advogado direito de família\"", "como pedir pensão alimentícia"],
          prefilled_message: "Olá! Vi o anúncio e estou passando por uma situação familiar. Gostaria de entender como vocês podem me ajudar."
        },
        {
          id: "Conjunto 3",
          title: "Cível e Indenizações",
          destination_url: "http://indenizacao.calabreselimaadvocacia.com.br/",
          audience: "Pessoas que sofreram dano moral, prejuízo por falha de serviço, acidente ou descumprimento de contrato. Sentem-se lesadas e querem justiça.",
          keywords: ["[dano moral advogado]", "[indenização por dano material]", "[cobrar empresa na justiça]", "\"advogado direito civil\"", "\"cobrar indenização de empresa\"", "como processar empresa por dano"],
          prefilled_message: "Olá! Vi o anúncio e acredito que tive um direito violado. Gostaria de saber se tenho base para buscar indenização."
        }
      ]
    },
    phase_2_description: "Quando a meta de 5 clientes for batida e a verba subir para R$ 1.500/mês, ativaremos a Campanha 2 focada nas áreas de crescimento.",
    phase_2_campaigns: [
      { title: "Campanha 1 (Mantida)", description: "Família, Cível, Consumidor", value: "R$ 900/mês" },
      { title: "Campanha 2 (Nova)", description: "Bancário e Imobiliário", value: "R$ 600/mês" }
    ],
    alert_message: "Lembre-se de orientar sua equipe a responder os leads do WhatsApp em até 1 hora durante o horário comercial. A velocidade de resposta de vocês é o principal fator de conversão nesse modelo de campanha!"
  } : null);

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
            {isAdmin && (
              <>
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".pdf"
                  className="hidden"
                />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-xl hover:bg-gray-50 transition-colors font-medium text-sm shadow-sm disabled:opacity-50"
                >
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  Subir PDF Estratégia
                </button>
                
                {displayStrategy && !isEditing && (
                  <button 
                    onClick={() => {
                      setEditedStrategy(displayStrategy);
                      setIsEditing(true);
                    }}
                    className="p-2 text-gray-400 hover:text-brand-dark transition-colors"
                  >
                    <Edit2 className="w-5 h-5" />
                  </button>
                )}
                
                {strategy && (
                  <button 
                    onClick={handleDeleteStrategy}
                    className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
              </>
            )}

            {activeClient?.paid_reportei_url && (
              <a 
                href={activeClient.paid_reportei_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 bg-brand-dark text-white px-5 py-2.5 rounded-xl hover:bg-brand-dark/90 transition-colors font-medium text-sm shadow-sm"
              >
                Acompanhe o Dashboard
                <ArrowRight className="w-4 h-4" />
              </a>
            )}
          </div>
        </div>
      </div>

      <motion.div 
        className="max-w-5xl mx-auto px-6 py-8 space-y-8"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {!displayStrategy ? (
          <div className="bg-white rounded-3xl p-12 border border-dashed border-gray-300 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-gray-300" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Nenhuma estratégia definida</h3>
            <p className="text-gray-500 mt-2 max-w-sm">
              {isAdmin 
                ? "Suba um arquivo PDF com a estratégia para que a IA possa processar e exibir as informações aqui."
                : "A estratégia de tráfego pago para este cliente ainda não foi definida pela agência."}
            </p>
            {isAdmin && (
              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 bg-brand-dark text-white px-6 py-3 rounded-xl hover:bg-brand-dark/90 transition-colors font-medium"
                >
                  <Upload className="w-5 h-5" />
                  Subir PDF Estratégia
                </button>
                <button 
                  onClick={() => {
                    setEditedStrategy({
                      monthly_budget: 0,
                      daily_budget: "",
                      priority_goal: "",
                      avg_ticket: 0,
                      strategic_decision: "",
                      campaign_structure: { sets: [] },
                      phase_2_description: "",
                      phase_2_campaigns: [],
                      alert_message: "",
                      updated_at: new Date().toISOString()
                    } as PaidTrafficStrategy);
                    setIsEditing(true);
                  }}
                  className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-6 py-3 rounded-xl hover:bg-gray-50 transition-colors font-medium"
                >
                  <Edit2 className="w-5 h-5" />
                  Adicionar Manualmente
                </button>
              </div>
            )}
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
                {isEditing ? (
                  <input 
                    type="number"
                    value={editedStrategy?.monthly_budget || 0}
                    onChange={(e) => setEditedStrategy(prev => ({ ...(prev || {}), monthly_budget: Number(e.target.value) } as PaidTrafficStrategy))}
                    className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 w-full text-white text-2xl font-bold"
                  />
                ) : (
                  <p className="text-3xl font-bold">R$ {displayStrategy.monthly_budget}</p>
                )}
                {isEditing ? (
                  <textarea 
                    value={editedStrategy?.daily_budget || ''}
                    onChange={(e) => setEditedStrategy(prev => ({ ...(prev || {}), daily_budget: e.target.value } as PaidTrafficStrategy))}
                    className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 w-full text-white text-sm mt-2"
                    rows={2}
                  />
                ) : (
                  <p className="text-sm text-white/60 mt-2">{displayStrategy.daily_budget}</p>
                )}
              </motion.div>

              <motion.div variants={itemVariants} className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                    <Target className="w-5 h-5 text-orange-600" />
                  </div>
                  <h3 className="font-medium text-gray-500">Meta Prioritária</h3>
                </div>
                {isEditing ? (
                  <input 
                    type="text"
                    value={editedStrategy?.priority_goal || ''}
                    onChange={(e) => setEditedStrategy(prev => ({ ...(prev || {}), priority_goal: e.target.value } as PaidTrafficStrategy))}
                    className="border border-gray-200 rounded-lg px-3 py-2 w-full text-gray-900 text-2xl font-bold"
                  />
                ) : (
                  <p className="text-3xl font-bold text-gray-900">{displayStrategy.priority_goal}</p>
                )}
                <p className="text-sm text-gray-500 mt-2">Objetivo para o Mês</p>
              </motion.div>

              <motion.div variants={itemVariants} className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                    <Users className="w-5 h-5 text-green-600" />
                  </div>
                  <h3 className="font-medium text-gray-500">Ticket Médio</h3>
                </div>
                {isEditing ? (
                  <input 
                    type="number"
                    value={editedStrategy?.avg_ticket || 0}
                    onChange={(e) => setEditedStrategy(prev => ({ ...(prev || {}), avg_ticket: Number(e.target.value) } as PaidTrafficStrategy))}
                    className="border border-gray-200 rounded-lg px-3 py-2 w-full text-gray-900 text-2xl font-bold"
                  />
                ) : (
                  <p className="text-3xl font-bold text-gray-900">R$ {displayStrategy.avg_ticket}</p>
                )}
                <p className="text-sm text-gray-500 mt-2">Por cliente fechado</p>
              </motion.div>
            </div>

            {/* Decisão Estratégica */}
            <motion.div variants={itemVariants} className="bg-white rounded-3xl p-8 border border-gray-200 shadow-sm">
              <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                <Search className="w-6 h-6 text-brand-dark" />
                Decisão Estratégica
              </h2>
              {isEditing ? (
                <textarea 
                  value={editedStrategy?.strategic_decision || ''}
                  onChange={(e) => setEditedStrategy(prev => ({ ...(prev || {}), strategic_decision: e.target.value } as PaidTrafficStrategy))}
                  className="border border-gray-200 rounded-xl px-4 py-3 w-full text-gray-600 leading-relaxed"
                  rows={4}
                />
              ) : (
                <div className="space-y-6">
                  <div className="flex gap-4">
                    <div className="w-1.5 bg-brand-dark rounded-full shrink-0"></div>
                    <div>
                      <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">
                        {displayStrategy.strategic_decision}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>

            {/* Estrutura das Campanhas */}
            <motion.div variants={itemVariants}>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Estrutura das Campanhas</h2>
              
              <div className="space-y-6">
                {displayStrategy.campaign_structure.sets.map((set, index) => (
                  <div key={index} className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="bg-gray-50 px-8 py-5 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <span className="text-xs font-bold tracking-wider text-gray-500 uppercase mb-1 block">{set.id}</span>
                        {isEditing ? (
                          <input 
                            type="text"
                            value={set.title || ''}
                            onChange={(e) => {
                              const newSets = [...(editedStrategy?.campaign_structure.sets || [])];
                              if (newSets[index]) {
                                newSets[index].title = e.target.value;
                                setEditedStrategy(prev => ({ ...(prev || {}), campaign_structure: { ...(prev?.campaign_structure || { sets: [] }), sets: newSets } } as PaidTrafficStrategy));
                              }
                            }}
                            className="border border-gray-200 rounded-lg px-3 py-1 text-lg font-bold text-gray-900 w-full"
                          />
                        ) : (
                          <h3 className="text-lg font-bold text-gray-900">{set.title}</h3>
                        )}
                      </div>
                      <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full border border-gray-200 text-sm font-medium text-gray-700 shadow-sm">
                        <Globe className="w-4 h-4 text-blue-500" />
                        Destino: {isEditing ? (
                          <input 
                            type="text"
                            value={set.destination_url || ''}
                            onChange={(e) => {
                              const newSets = [...(editedStrategy?.campaign_structure.sets || [])];
                              if (newSets[index]) {
                                newSets[index].destination_url = e.target.value;
                                setEditedStrategy(prev => ({ ...(prev || {}), campaign_structure: { ...(prev?.campaign_structure || { sets: [] }), sets: newSets } } as PaidTrafficStrategy));
                              }
                            }}
                            className="border border-gray-200 rounded-lg px-2 py-0.5 text-blue-600 w-full"
                          />
                        ) : (
                          <a href={set.destination_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate max-w-[200px]">
                            {set.destination_url}
                          </a>
                        )}
                      </div>
                    </div>
                    
                    <div className="p-8">
                      <div className="mb-6">
                        <strong className="text-gray-900 block mb-2">Público:</strong>
                        {isEditing ? (
                          <textarea 
                            value={set.audience || ''}
                            onChange={(e) => {
                              const newSets = [...(editedStrategy?.campaign_structure.sets || [])];
                              if (newSets[index]) {
                                newSets[index].audience = e.target.value;
                                setEditedStrategy(prev => ({ ...(prev || {}), campaign_structure: { ...(prev?.campaign_structure || { sets: [] }), sets: newSets } } as PaidTrafficStrategy));
                              }
                            }}
                            className="border border-gray-200 rounded-xl px-4 py-3 w-full text-gray-600 text-sm"
                            rows={3}
                          />
                        ) : (
                          <p className="text-gray-600">{set.audience}</p>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                          <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <Search className="w-4 h-4 text-gray-400" />
                            Palavras-chave Principais
                          </h4>
                          {isEditing ? (
                            <textarea 
                              value={(set.keywords || []).join('\n')}
                              onChange={(e) => {
                                const newSets = [...(editedStrategy?.campaign_structure.sets || [])];
                                if (newSets[index]) {
                                  newSets[index].keywords = e.target.value.split('\n');
                                  setEditedStrategy(prev => ({ ...(prev || {}), campaign_structure: { ...(prev?.campaign_structure || { sets: [] }), sets: newSets } } as PaidTrafficStrategy));
                                }
                              }}
                              className="border border-gray-200 rounded-xl px-4 py-3 w-full text-gray-600 font-mono text-sm"
                              rows={5}
                              placeholder="Uma palavra por linha"
                            />
                          ) : (
                            <ul className="space-y-2 font-mono text-sm text-gray-600 bg-gray-50 p-4 rounded-xl border border-gray-100">
                              {set.keywords.map((kw, kIndex) => (
                                <li key={kIndex}>{kw}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                        <div>
                          <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <MessageCircle className="w-4 h-4 text-gray-400" />
                            Mensagem Pré-preenchida
                          </h4>
                          {isEditing ? (
                            <textarea 
                              value={set.prefilled_message || ''}
                              onChange={(e) => {
                                const newSets = [...(editedStrategy?.campaign_structure.sets || [])];
                                if (newSets[index]) {
                                  newSets[index].prefilled_message = e.target.value;
                                  setEditedStrategy(prev => ({ ...(prev || {}), campaign_structure: { ...(prev?.campaign_structure || { sets: [] }), sets: newSets } } as PaidTrafficStrategy));
                                }
                              }}
                              className="border border-gray-200 rounded-xl px-4 py-3 w-full text-gray-600 text-sm"
                              rows={3}
                            />
                          ) : (
                            <div className="bg-green-50 border border-green-100 p-4 rounded-xl text-green-900 text-sm italic">
                              "{set.prefilled_message}"
                            </div>
                          )}
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
                  <h2 className="text-2xl font-bold">Fase 2 — Escala</h2>
                </div>
                
                {isEditing ? (
                  <textarea 
                    value={editedStrategy?.phase_2_description || ''}
                    onChange={(e) => setEditedStrategy(prev => ({ ...(prev || {}), phase_2_description: e.target.value } as PaidTrafficStrategy))}
                    className="bg-white/10 border border-white/20 rounded-xl px-4 py-3 w-full text-white mb-8"
                    rows={3}
                  />
                ) : (
                  <p className="text-gray-300 mb-8 max-w-2xl">
                    {displayStrategy.phase_2_description}
                  </p>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {displayStrategy.phase_2_campaigns.map((camp, cIndex) => (
                    <div key={cIndex} className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
                      {isEditing ? (
                        <>
                          <input 
                            type="text"
                            value={camp.title || ''}
                            onChange={(e) => {
                              const newCamps = [...(editedStrategy?.phase_2_campaigns || [])];
                              if (newCamps[cIndex]) {
                                newCamps[cIndex].title = e.target.value;
                                setEditedStrategy(prev => ({ ...(prev || {}), phase_2_campaigns: newCamps } as PaidTrafficStrategy));
                              }
                            }}
                            className="bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-white font-bold mb-2 w-full"
                          />
                          <input 
                            type="text"
                            value={camp.description || ''}
                            onChange={(e) => {
                              const newCamps = [...(editedStrategy?.phase_2_campaigns || [])];
                              if (newCamps[cIndex]) {
                                newCamps[cIndex].description = e.target.value;
                                setEditedStrategy(prev => ({ ...(prev || {}), phase_2_campaigns: newCamps } as PaidTrafficStrategy));
                              }
                            }}
                            className="bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-gray-300 text-sm mb-4 w-full"
                          />
                          <input 
                            type="text"
                            value={camp.value || ''}
                            onChange={(e) => {
                              const newCamps = [...(editedStrategy?.phase_2_campaigns || [])];
                              if (newCamps[cIndex]) {
                                newCamps[cIndex].value = e.target.value;
                                setEditedStrategy(prev => ({ ...(prev || {}), phase_2_campaigns: newCamps } as PaidTrafficStrategy));
                              }
                            }}
                            className="bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-orange-400 font-bold w-full"
                          />
                        </>
                      ) : (
                        <>
                          <h3 className="font-bold text-lg mb-2">{camp.title}</h3>
                          <p className="text-gray-300 text-sm mb-4">{camp.description}</p>
                          <div className="text-2xl font-bold text-orange-400">{camp.value}</div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Alerta */}
            <motion.div variants={itemVariants} className="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex gap-4">
              <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0" />
              <div className="flex-1">
                <h4 className="font-bold text-amber-900">Atenção ao Atendimento</h4>
                {isEditing ? (
                  <textarea 
                    value={editedStrategy?.alert_message || ''}
                    onChange={(e) => setEditedStrategy(prev => ({ ...(prev || {}), alert_message: e.target.value } as PaidTrafficStrategy))}
                    className="border border-amber-200 rounded-xl px-4 py-3 w-full text-amber-800 text-sm mt-1 bg-white"
                    rows={3}
                  />
                ) : (
                  <p className="text-amber-800 text-sm mt-1">
                    {displayStrategy.alert_message}
                  </p>
                )}
              </div>
            </motion.div>

            {/* Floating Save/Cancel for Edit Mode */}
            <AnimatePresence>
              {isEditing && (
                <motion.div 
                  initial={{ y: 100 }}
                  animate={{ y: 0 }}
                  exit={{ y: 100 }}
                  className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-white border border-gray-200 rounded-2xl p-4 shadow-2xl z-50 flex items-center gap-4"
                >
                  <button 
                    onClick={() => {
                      setIsEditing(false);
                      setEditedStrategy(strategy);
                    }}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors font-medium"
                  >
                    <X className="w-5 h-5" />
                    Cancelar
                  </button>
                  <button 
                    onClick={handleSaveEdit}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-dark text-white hover:bg-brand-dark/90 transition-colors font-medium shadow-lg shadow-brand-dark/20"
                  >
                    <Check className="w-5 h-5" />
                    Salvar Alterações
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </motion.div>
    </div>
  );
};
