import { supabase } from './supabase';
import { Client, AiOnboardingData, AiOnboardingCategory } from '../types';

export async function fetchClientAiOnboarding(clientId: string, agencyId?: number): Promise<AiOnboardingData | null> {
  try {
    let query = supabase
      .from('clients')
      .select('id, agency_id, ai_onboarding')
      .eq('id', clientId);

    if (agencyId) {
      query = query.eq('agency_id', agencyId);
    }

    const { data, error } = await query.single();
    if (error) {
      console.warn('Erro ao buscar ai_onboarding do cliente:', error);
      return null;
    }
    return (data?.ai_onboarding as AiOnboardingData) || null;
  } catch (err) {
    console.error('Falha ao obter Onboarding IA:', err);
    return null;
  }
}

export async function updateAiOnboardingDone(
  clientId: string,
  categoryId: string,
  itemId: string,
  newDoneValue: boolean,
  currentData: AiOnboardingData,
  agencyId?: number
): Promise<{ success: boolean; updatedData: AiOnboardingData }> {
  const updatedChecklist = currentData.checklist.map((cat) => {
    if (cat.id !== categoryId) return cat;
    return {
      ...cat,
      items: cat.items.map((item) => {
        if (item.id !== itemId) return item;
        return { ...item, done: newDoneValue };
      }),
    };
  });

  const updatedData: AiOnboardingData = {
    ...currentData,
    checklist: updatedChecklist,
  };

  try {
    let query = supabase
      .from('clients')
      .update({ ai_onboarding: updatedData })
      .eq('id', clientId);

    if (agencyId) {
      query = query.eq('agency_id', agencyId);
    }

    const { error } = await query;
    if (error) {
      console.error('Erro ao atualizar item do Onboarding IA no Supabase:', error);
      return { success: false, updatedData: currentData };
    }
    return { success: true, updatedData };
  } catch (err) {
    console.error('Falha na requisição ao salvar item do Onboarding IA:', err);
    return { success: false, updatedData: currentData };
  }
}

export async function generateOrRegenerateAiOnboarding(
  client: Client,
  agencyId?: number
): Promise<AiOnboardingData> {
  const effectiveAgencyId = agencyId || client.agency_id;

  // 1. Tentar chamar a Edge Function generate-client-onboarding
  try {
    const { data, error } = await supabase.functions.invoke('generate-client-onboarding', {
      body: { client_id: client.id, agency_id: effectiveAgencyId },
    });

    if (!error && data?.ai_onboarding) {
      return data.ai_onboarding as AiOnboardingData;
    }
  } catch (err) {
    console.info('Edge function generate-client-onboarding não disponível ou pendente de deploy, utilizando gerador nativo integrado.');
  }

  // 2. Gerador inteligente nativo
  const todayStr = new Date().toISOString().split('T')[0];
  const clientName = client.responsible || client.name;
  const businessName = client.name;
  const segment = client.segment || 'Serviços / Vendas';
  const services = client.services || ['Tráfego Pago', 'Social Media'];
  const hasSocial = services.some(s => s.toLowerCase().includes('social'));
  const hasTraffic = services.some(s => s.toLowerCase().includes('tráfego') || s.toLowerCase().includes('trafego'));

  const checklist: AiOnboardingCategory[] = [
    {
      id: 'meta_business',
      category: 'Meta Business Manager',
      icon: '📱',
      items: [
        {
          id: 'mb1',
          label: 'Criar conta no Meta Business Manager',
          url: 'https://business.facebook.com',
          done: false,
        },
        {
          id: 'mb2',
          label: 'Adicionar o perfil do Instagram ao Business Manager',
          done: false,
        },
        {
          id: 'mb3',
          label: 'Criar conta de anúncios (Ads Account)',
          done: false,
        },
        {
          id: 'mb4',
          label: 'Cadastrar cartão de crédito ou método de pagamento na conta de anúncios',
          done: false,
        },
        {
          id: 'mb5',
          label: 'Conceder acesso de administrador para a agência',
          note: 'Adicionar e-mail oficial da agência com permissão total',
          done: false,
        },
      ],
    },
    {
      id: 'instagram',
      category: 'Instagram e Redes Sociais',
      icon: '📸',
      items: [
        {
          id: 'ig1',
          label: 'Confirmar que o perfil está como Conta Profissional / Comercial',
          done: false,
        },
        {
          id: 'ig2',
          label: `Atualizar foto de perfil com logotipo oficial de ${businessName}`,
          done: false,
        },
        {
          id: 'ig3',
          label: 'Preencher biografia com proposta de valor, localização e link de contato',
          done: false,
        },
        {
          id: 'ig4',
          label: 'Adicionar link do WhatsApp ou site na biografia',
          done: false,
        },
        {
          id: 'ig5',
          label: 'Organizar ou criar os principais Destaques (Serviços, Depoimentos, Localização)',
          done: false,
        },
      ],
    },
    {
      id: 'pixel',
      category: 'Pixel e Rastreamento',
      icon: '🎯',
      items: [
        {
          id: 'px1',
          label: 'Criar o Pixel / Conjunto de Dados da Meta na conta de anúncios',
          done: false,
        },
        {
          id: 'px2',
          label: 'Instalar o Pixel no site oficial ou página de captura',
          done: false,
        },
        {
          id: 'px3',
          label: 'Configurar eventos de conversão prioritários (WhatsApp, Formulário, Compra)',
          done: false,
        },
      ],
    },
    {
      id: 'materiais',
      category: 'Materiais para a Agência',
      icon: '📂',
      items: [
        {
          id: 'ma1',
          label: 'Enviar pelo menos 15 a 20 fotos e vídeos dos serviços em alta resolução',
          done: false,
        },
        {
          id: 'ma2',
          label: 'Enviar logotipo oficial em alta resolução (PNG com fundo transparente ou vetor)',
          done: false,
        },
        {
          id: 'ma3',
          label: 'Enviar tabela de preços ou cardápio atualizado',
          done: false,
        },
        {
          id: 'ma4',
          label: 'Informar horários de funcionamento e canais de atendimento',
          done: false,
        },
        {
          id: 'ma5',
          label: 'Confirmar número oficial de WhatsApp para direcionamento das campanhas',
          done: false,
        },
      ],
    },
    {
      id: 'aprovacoes',
      category: 'Aprovações e Alinhamentos',
      icon: '✅',
      items: [
        {
          id: 'ap1',
          label: 'Aprovar identidade visual das artes e modelo inicial de criativos',
          done: false,
        },
        {
          id: 'ap2',
          label: 'Revisar e aprovar planejamento editorial do primeiro ciclo',
          done: false,
        },
        {
          id: 'ap3',
          label: 'Definir dia e horário fixo para reunião mensal de acompanhamento de resultados',
          done: false,
        },
      ],
    },
  ];

  const strategy_summary = {
    positioning: `Referência no segmento de ${segment}, unindo excelência em atendimento, diferenciais competitivos e autoridade.`,
    content_pillars: [
      'Transformações e resultados (Antes e Depois)',
      'Tendências e novidades do segmento',
      'Bastidores do negócio e rotina de atendimento',
      'Promoções estratégicas e datas comemorativas',
      'Depoimentos e provas sociais de clientes satisfeitos',
    ],
    posting_frequency: hasSocial
      ? '5x por semana no Instagram (Feed + Stories diários)'
      : 'Foco contínuo na otimização e veiculação de anúncios de tráfego pago',
    priority_30_days: [
      'Crescer base qualificada de seguidores e engajamento orgânico',
      'Lançar primeira campanha de tráfego direto para atendimento via WhatsApp',
      'Construir acervo de fotos reais do trabalho para fortalecer prova social',
    ],
  };

  const newAiOnboarding: AiOnboardingData = {
    generated_at: todayStr,
    version: 1,
    client_name: clientName,
    business_name: businessName,
    segment: segment,
    checklist,
    strategy_summary,
  };

  let updateQuery = supabase
    .from('clients')
    .update({ ai_onboarding: newAiOnboarding })
    .eq('id', client.id);

  if (effectiveAgencyId) {
    updateQuery = updateQuery.eq('agency_id', effectiveAgencyId);
  }

  const { error: updateError } = await updateQuery;
  if (updateError) {
    console.error('Erro ao salvar Onboarding IA gerado no Supabase:', updateError);
    throw new Error('Não foi possível salvar o Onboarding IA no banco de dados');
  }

  return newAiOnboarding;
}
