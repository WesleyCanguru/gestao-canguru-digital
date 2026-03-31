import React from 'react';
import { useAuth } from '../lib/supabase';
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
  Globe
} from 'lucide-react';
import { motion } from 'motion/react';

export const PaidTrafficView: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const { activeClient } = useAuth();

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

  const isCalabres = activeClient?.id === 'e817fbf9-0985-4453-b710-34623af870d6';

  if (!isCalabres) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] pb-20">
        <div className="bg-white border-b border-gray-200 px-6 py-6 sticky top-0 z-10 shadow-sm">
          <div className="max-w-5xl mx-auto flex items-center gap-4">
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
              <p className="text-sm text-gray-500 mt-1">{activeClient?.name || 'Cliente'}</p>
            </div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-6 py-20 flex flex-col items-center justify-center text-center space-y-4">
          <div className="w-20 h-20 bg-blue-50 rounded-3xl flex items-center justify-center text-blue-600 mb-4">
            <Zap size={40} />
          </div>
          <h2 className="text-2xl font-bold text-brand-dark">Estratégia em Desenvolvimento</h2>
          <p className="text-gray-500 max-w-md mx-auto">
            Estamos preparando a estratégia de tráfego pago personalizada para a {activeClient?.name || 'sua marca'}. 
            Em breve você poderá acompanhar todos os detalhes aqui.
          </p>
          {onBack && (
            <button 
              onClick={onBack}
              className="mt-6 px-6 py-3 bg-brand-dark text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:shadow-xl transition-all transform hover:-translate-y-1"
            >
              Voltar ao Início
            </button>
          )}
        </div>
      </div>
    );
  }

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

      <motion.div 
        className="max-w-5xl mx-auto px-6 py-8 space-y-8"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
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
            <p className="text-3xl font-bold">R$ 600</p>
            <p className="text-sm text-white/60 mt-2">R$ 25/dia (segunda a sábado a principio para quesito de teste) (Mês 1 = aprendizado)</p>
          </motion.div>

          <motion.div variants={itemVariants} className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                <Target className="w-5 h-5 text-orange-600" />
              </div>
              <h3 className="font-medium text-gray-500">Meta Prioritária</h3>
            </div>
            <p className="text-3xl font-bold text-gray-900">5 clientes</p>
            <p className="text-sm text-gray-500 mt-2">Objetivo para o Mês</p>
          </motion.div>

          <motion.div variants={itemVariants} className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                <Users className="w-5 h-5 text-green-600" />
              </div>
              <h3 className="font-medium text-gray-500">Ticket Médio</h3>
            </div>
            <p className="text-3xl font-bold text-gray-900">R$ 2.000</p>
            <p className="text-sm text-gray-500 mt-2">Por cliente fechado</p>
          </motion.div>
        </div>

        {/* Decisão Estratégica */}
        <motion.div variants={itemVariants} className="bg-white rounded-3xl p-8 border border-gray-200 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-3">
            <Search className="w-6 h-6 text-brand-dark" />
            Decisão Estratégica
          </h2>
          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="w-1.5 bg-brand-dark rounded-full shrink-0"></div>
              <div>
                <h3 className="font-bold text-gray-900 text-lg">100% Google Ads (Rede de Pesquisa)</h3>
                <p className="text-gray-600 mt-2 leading-relaxed">
                  O público já está com o problema e buscando solução agora. O Google captura essa intenção ativa. O Meta Ads fará sentido quando o tráfego orgânico já existir e houver público para remarketing (previsto para os meses 3 ou 4).
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-1.5 bg-green-500 rounded-full shrink-0"></div>
              <div>
                <h3 className="font-bold text-gray-900 text-lg">Destino: Landing Pages Exclusivas por Conjunto</h3>
                <p className="text-gray-600 mt-2 leading-relaxed">
                  Cada conjunto de anúncios direciona para uma landing page própria, com copy alinhada à intenção de busca de cada público. As páginas já estão publicadas e os links estão configurados nos grupos de anúncios.
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Estrutura das Campanhas */}
        <motion.div variants={itemVariants}>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Estrutura das Campanhas</h2>
          
          <div className="space-y-6">
            {/* Conjunto 1 */}
            <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="bg-gray-50 px-8 py-5 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-bold tracking-wider text-gray-500 uppercase mb-1 block">Conjunto 1</span>
                  <h3 className="text-lg font-bold text-gray-900">Direito do Consumidor e Bancário</h3>
                </div>
                <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full border border-gray-200 text-sm font-medium text-gray-700 shadow-sm">
                  <Globe className="w-4 h-4 text-blue-500" />
                  Destino: <a href="https://consumidor.calabreselimaadvocacia.com.br/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">https://consumidor.calabreselimaadvocacia.com.br/</a>
                </div>
              </div>
              
              <div className="p-8">
                <p className="text-gray-600 mb-6">
                  <strong className="text-gray-900">Público:</strong> Pessoas que tiveram conta bloqueada, plano de saúde negado, seguro não pago, produto com defeito ou serviço não prestado. Já têm o problema e estão buscando solução com urgência.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <Search className="w-4 h-4 text-gray-400" />
                      Palavras-chave Principais
                    </h4>
                    <ul className="space-y-2 font-mono text-sm text-gray-600 bg-gray-50 p-4 rounded-xl border border-gray-100">
                      <li>[conta bloqueada o que fazer]</li>
                      <li>[banco bloqueou minha conta]</li>
                      <li>[plano de saúde negou tratamento]</li>
                      <li>[seguro não quer pagar sinistro]</li>
                      <li>"advogado direito de consumidor"</li>
                      <li>"advogado conta bloqueada"</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <MessageCircle className="w-4 h-4 text-gray-400" />
                      Mensagem Pré-preenchida
                    </h4>
                    <div className="bg-green-50 border border-green-100 p-4 rounded-xl text-green-900 text-sm italic">
                      "Olá! Vi o anúncio e preciso de ajuda com uma situação urgente. Podem me dizer como funciona o atendimento?"
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Conjunto 2 */}
            <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="bg-gray-50 px-8 py-5 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-bold tracking-wider text-gray-500 uppercase mb-1 block">Conjunto 2</span>
                  <h3 className="text-lg font-bold text-gray-900">Direito de Família</h3>
                </div>
                <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full border border-gray-200 text-sm font-medium text-gray-700 shadow-sm">
                  <Globe className="w-4 h-4 text-blue-500" />
                  Destino: <a href="https://familia.calabreselimaadvocacia.com.br/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">https://familia.calabreselimaadvocacia.com.br/</a>
                </div>
              </div>
              
              <div className="p-8">
                <p className="text-gray-600 mb-6">
                  <strong className="text-gray-900">Público:</strong> Pessoas passando por divórcio, disputas de guarda, pensão alimentícia ou inventário. Momento emocional delicado — a copy precisa ser acolhedora e transmitir segurança.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <Search className="w-4 h-4 text-gray-400" />
                      Palavras-chave Principais
                    </h4>
                    <ul className="space-y-2 font-mono text-sm text-gray-600 bg-gray-50 p-4 rounded-xl border border-gray-100">
                      <li>[advogado divórcio]</li>
                      <li>[pensão alimentícia advogado]</li>
                      <li>[guarda compartilhada advogado]</li>
                      <li>[inventário advogado]</li>
                      <li>"advogado direito de família"</li>
                      <li>como pedir pensão alimentícia</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <MessageCircle className="w-4 h-4 text-gray-400" />
                      Mensagem Pré-preenchida
                    </h4>
                    <div className="bg-green-50 border border-green-100 p-4 rounded-xl text-green-900 text-sm italic">
                      "Olá! Vi o anúncio e estou passando por uma situação familiar. Gostaria de entender como vocês podem me ajudar."
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Conjunto 3 */}
            <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="bg-gray-50 px-8 py-5 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-bold tracking-wider text-gray-500 uppercase mb-1 block">Conjunto 3</span>
                  <h3 className="text-lg font-bold text-gray-900">Cível e Indenizações</h3>
                </div>
                <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full border border-gray-200 text-sm font-medium text-gray-700 shadow-sm">
                  <Globe className="w-4 h-4 text-blue-500" />
                  Destino: <a href="http://indenizacao.calabreselimaadvocacia.com.br/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">http://indenizacao.calabreselimaadvocacia.com.br/</a>
                </div>
              </div>
              
              <div className="p-8">
                <p className="text-gray-600 mb-6">
                  <strong className="text-gray-900">Público:</strong> Pessoas que sofreram dano moral, prejuízo por falha de serviço, acidente ou descumprimento de contrato. Sentem-se lesadas e querem justiça.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <Search className="w-4 h-4 text-gray-400" />
                      Palavras-chave Principais
                    </h4>
                    <ul className="space-y-2 font-mono text-sm text-gray-600 bg-gray-50 p-4 rounded-xl border border-gray-100">
                      <li>[dano moral advogado]</li>
                      <li>[indenização por dano material]</li>
                      <li>[cobrar empresa na justiça]</li>
                      <li>"advogado direito civil"</li>
                      <li>"cobrar indenização de empresa"</li>
                      <li>como processar empresa por dano</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <MessageCircle className="w-4 h-4 text-gray-400" />
                      Mensagem Pré-preenchida
                    </h4>
                    <div className="bg-green-50 border border-green-100 p-4 rounded-xl text-green-900 text-sm italic">
                      "Olá! Vi o anúncio e acredito que tive um direito violado. Gostaria de saber se tenho base para buscar indenização."
                    </div>
                  </div>
                </div>
              </div>
            </div>
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
            
            <p className="text-gray-300 mb-8 max-w-2xl">
              Quando a meta de 5 clientes for batida e a verba subir para R$ 1.500/mês, ativaremos a Campanha 2 focada nas áreas de crescimento.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
                <h3 className="font-bold text-lg mb-2">Campanha 1 (Mantida)</h3>
                <p className="text-gray-300 text-sm mb-4">Família, Cível, Consumidor</p>
                <div className="text-2xl font-bold text-orange-400">R$ 900/mês</div>
              </div>
              
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
                <h3 className="font-bold text-lg mb-2">Campanha 2 (Nova)</h3>
                <p className="text-gray-300 text-sm mb-4">Bancário e Imobiliário</p>
                <div className="text-2xl font-bold text-orange-400">R$ 600/mês</div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Alerta */}
        <motion.div variants={itemVariants} className="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex gap-4">
          <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0" />
          <div>
            <h4 className="font-bold text-amber-900">Atenção ao Atendimento</h4>
            <p className="text-amber-800 text-sm mt-1">
              Lembre-se de orientar sua equipe a responder os leads do WhatsApp em até 1 hora durante o horário comercial. A velocidade de resposta de vocês é o principal fator de conversão nesse modelo de campanha!
            </p>
          </div>
        </motion.div>

      </motion.div>
    </div>
  );
};
