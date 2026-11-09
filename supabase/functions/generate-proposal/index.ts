// Gera o conteúdo estruturado da proposta comercial.
import { adminClient, corsHeaders, json, userClient } from "../_shared/common.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autenticado." }, 401);

    const user = userClient(req);
    const { data: { user: authUser }, error: userErr } = await user.auth.getUser();
    if (userErr || !authUser) return json({ error: "Usuário não autenticado." }, 401);

    const body = await req.json();
    const {
      prospect_name,
      title,
      segment,
      setup_value,
      monthly_value,
      currency,
      notes,
      agency_id,
      whatsapp,
    } = body;

    if (!prospect_name?.trim()) return json({ error: "Nome do prospect é obrigatório." }, 400);

    const slug = (body.slug || prospect_name)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);

    const content = {
      eyebrow: segment ? `Marketing para ${segment}` : (title || "Proposta comercial"),
      headline: body.headline || `Soluções completas de marketing digital para ${prospect_name}.`,
      lead: notes || `Proposta comercial personalizada com implantação, gestão e foco em resultados para alavancar suas vendas.`,
      understanding: {
        facts: [
          { label: "Empresa", value: prospect_name },
          { label: "Segmento", value: segment || "Negócios" },
          { label: "Foco", value: "Atrair clientes e fortalecer a presença digital" },
          { label: "Canal", value: "WhatsApp e redes sociais" },
        ],
        text: notes || "Alinhamos os principais objetivos e o formato de trabalho para atender a demanda da sua marca com agilidade e qualidade.",
      },
      scope: {
        title: "Como vamos trabalhar",
        items: [
          { title: "Presença digital alinhada.", desc: "Linha editorial profissional, posts periódicos e padrão visual consistente com a sua marca." },
          { title: "Anúncios segmentados.", desc: "Campanhas voltadas para o público certo, atraindo contatos qualificados diretamente para o WhatsApp." },
          { title: "Automações e processos.", desc: "Respostas rápidas e triagem inicial de contatos para não perder oportunidades de vendas." },
          { title: "Acompanhamento transparente.", desc: "Painel em tempo real na Bolsa com métricas de investimento, leads e retorno." },
        ],
      },
      investment: {
        setup: setup_value ? {
          title: "Implantação",
          price: Number(setup_value),
          items: [
            "Configuração inicial de contas e padrões visuais",
            "Configuração de rastreamento e tags",
            "Painel da Bolsa integrado para acompanhamento",
          ],
        } : undefined,
        monthly: monthly_value ? {
          title: "Mensalidade",
          price: Number(monthly_value),
          items: [
            "Gestão contínua de campanhas e publicações",
            "Otimizações semanais de orçamento e criativos",
            "Relatórios e alinhamentos de resultados",
          ],
        } : undefined,
        notes: "Investimento em mídia direto nas plataformas (Meta/Google) pago à parte conforme alinhamento prévio.",
      },
      next_steps: [
        { title: "Aprovação da proposta", desc: "Você confirma o interesse através do WhatsApp abaixo." },
        { title: "Alinhamento de início", desc: "Definimos prioridades, acessos e os primeiros materiais a serem produzidos." },
        { title: "Campanhas e entregas no ar", desc: "Tudo configurado para iniciar as ações com segurança e ritmo." },
      ],
      cta: {
        title: "Faz sentido para você?",
        text: "Se algo não couber agora ou precisar de ajuste, me fale que ajustamos juntos.",
        whatsapp_number: whatsapp || "",
        whatsapp_text: `Olá! Vi a proposta da ${prospect_name} e quero conversar.`,
      },
    };

    const admin = adminClient();
    const { data: proposal, error: insertErr } = await admin.from("proposals").insert({
      agency_id: agency_id || 1,
      slug,
      prospect_name: prospect_name.trim(),
      title: title?.trim() || null,
      monthly_value: monthly_value ? Number(monthly_value) : null,
      setup_value: setup_value ? Number(setup_value) : null,
      currency: currency || "BRL",
      status: "published",
      whatsapp: whatsapp || null,
      content,
    }).select().single();

    if (insertErr) {
      console.error("Erro inserindo proposta:", insertErr);
      return json({ error: "Erro ao salvar proposta: " + insertErr.message }, 500);
    }

    return json({ ok: true, proposal });
  } catch (e) {
    console.error(e);
    return json({ error: "Erro inesperado." }, 500);
  }
});
