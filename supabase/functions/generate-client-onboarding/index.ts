import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { client_id, agency_id } = await req.json();

    if (!client_id) {
      return new Response(
        JSON.stringify({ error: "client_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let query = supabase.from("clients").select("*").eq("id", client_id);
    if (agency_id) {
      query = query.eq("agency_id", agency_id);
    }
    const { data: client, error: clientErr } = await query.single();

    if (clientErr || !client) {
      return new Response(
        JSON.stringify({ error: "Client not found", details: clientErr }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const todayStr = new Date().toISOString().split("T")[0];
    const clientName = client.responsible || client.name;
    const businessName = client.name;
    const segment = client.segment || "Serviços / Vendas";
    const services = client.services || ["Tráfego Pago", "Social Media"];

    const checklist = [
      {
        id: "meta_business",
        category: "Meta Business Manager",
        icon: "📱",
        items: [
          {
            id: "mb1",
            label: "Criar conta no Meta Business Manager",
            url: "https://business.facebook.com",
            done: false,
          },
          {
            id: "mb2",
            label: "Adicionar o perfil do Instagram ao Business Manager",
            done: false,
          },
          {
            id: "mb3",
            label: "Criar conta de anúncios (Ads Account)",
            done: false,
          },
          {
            id: "mb4",
            label: "Cadastrar cartão de crédito ou método de pagamento",
            done: false,
          },
          {
            id: "mb5",
            label: "Conceder acesso de administrador para a agência",
            note: "Adicionar o e-mail oficial da agência como Administrador",
            done: false,
          },
        ],
      },
      {
        id: "instagram",
        category: "Instagram e Redes Sociais",
        icon: "📸",
        items: [
          {
            id: "ig1",
            label: "Confirmar que o perfil está configurado como Conta Profissional",
            done: false,
          },
          {
            id: "ig2",
            label: `Atualizar foto de perfil com a identidade oficial de ${businessName}`,
            done: false,
          },
          {
            id: "ig3",
            label: "Preencher biografia com proposta de valor clara e localização",
            done: false,
          },
          {
            id: "ig4",
            label: "Adicionar link de contato ou WhatsApp na bio",
            done: false,
          },
          {
            id: "ig5",
            label: "Organizar destaques estratégicos (Serviços, Depoimentos, Sobre, Contato)",
            done: false,
          },
        ],
      },
      {
        id: "pixel",
        category: "Pixel e Rastreamento",
        icon: "🎯",
        items: [
          {
            id: "px1",
            label: "Criar o Pixel / Conjunto de Dados da Meta",
            done: false,
          },
          {
            id: "px2",
            label: "Instalar o Pixel no site oficial ou página de captura",
            done: false,
          },
          {
            id: "px3",
            label: "Configurar eventos de conversão (Contato, Lead, WhatsApp)",
            done: false,
          },
        ],
      },
      {
        id: "materiais",
        category: "Materiais e Informações",
        icon: "📂",
        items: [
          {
            id: "ma1",
            label: "Enviar fotos e vídeos em alta resolução dos produtos ou serviços",
            done: false,
          },
          {
            id: "ma2",
            label: "Enviar logotipo em vetor ou PNG com fundo transparente",
            done: false,
          },
          {
            id: "ma3",
            label: "Enviar catálogo de preços, cardápio ou lista de serviços atualizada",
            done: false,
          },
          {
            id: "ma4",
            label: "Informar horários de funcionamento e canais de atendimento",
            done: false,
          },
          {
            id: "ma5",
            label: "Confirmar número oficial do WhatsApp para direcionamento dos anúncios",
            done: false,
          },
        ],
      },
      {
        id: "aprovacoes",
        category: "Aprovações e Alinhamentos",
        icon: "✅",
        items: [
          {
            id: "ap1",
            label: "Aprovar identidade visual e padrão das primeiras artes",
            done: false,
          },
          {
            id: "ap2",
            label: "Revisar e aprovar o primeiro calendário de publicações",
            done: false,
          },
          {
            id: "ap3",
            label: "Definir dia e horário fixo para alinhamentos mensais de resultados",
            done: false,
          },
        ],
      },
    ];

    const strategy_summary = {
      positioning: `Referência no segmento de ${segment}, unindo atendimento de excelência e diferenciais competitivos.`,
      content_pillars: [
        "Transformações e resultados (Antes e Depois)",
        "Diferenciais e bastidores do negócio",
        "Depoimentos e avaliações de clientes satisfeitos",
        "Ofertas exclusivas e chamadas para ação",
        "Conteúdos educativos e dicas rápidas",
      ],
      posting_frequency: services.includes("Social Media")
        ? "4 a 5x por semana no Instagram (Feed + Stories diários)"
        : "Foco principal em campanhas ativas de tráfego pago",
      priority_30_days: [
        "Crescer base qualificada e engajamento orgânico",
        "Lançar primeira campanha de tráfego direcionada para WhatsApp",
        "Construir acervo de fotos e depoimentos reais para conversão",
      ],
    };

    const aiOnboardingData = {
      generated_at: todayStr,
      version: 1,
      client_name: clientName,
      business_name: businessName,
      segment: segment,
      checklist: checklist,
      strategy_summary: strategy_summary,
    };

    const { error: updateErr } = await supabase
      .from("clients")
      .update({ ai_onboarding: aiOnboardingData })
      .eq("id", client_id);

    if (updateErr) {
      return new Response(
        JSON.stringify({ error: "Failed to update client", details: updateErr }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, ai_onboarding: aiOnboardingData }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
