import React, { useState, useEffect } from 'react';
import { supabase, useAuth } from '../lib/supabase';
import { CheckCircle, AlertCircle, ChevronRight, FileText, Send, ArrowLeft, Target, LogOut, Download } from 'lucide-react';
import { Logo } from './Logo';

export const handleDownloadBriefingPDF = (briefing: any, clientName: string, customTemplates: Record<string, any>) => {
  const spec = customTemplates[briefing.briefing_type] || BRIEFING_QUESTIONS[briefing.briefing_type];
  const title = spec ? spec.title : briefing.briefing_type;
  const questions = spec ? spec.questions : [];
  
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;
  
  const dateStr = briefing.updated_at 
        ? new Date(briefing.updated_at).toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' })
        : (briefing.created_at ? new Date(briefing.created_at).toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' }) : '');

  const html = `
    <html>
      <head>
        <title>Briefing - ${title} - ${clientName}</title>
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #333; line-height: 1.6; max-width: 800px; margin: 0 auto; }
          h1 { color: #111; font-size: 28px; margin-bottom: 5px; }
          .subtitle { color: #666; font-size: 14px; margin-bottom: 40px; border-bottom: 2px solid #eee; padding-bottom: 20px; display: flex; justify-content: space-between; }
          .question { font-weight: bold; font-size: 16px; color: #111; margin-top: 30px; margin-bottom: 10px; }
          .answer { font-size: 15px; color: #333; background: #f9f9f9; padding: 15px 20px; border-left: 4px solid #111; border-radius: 4px; white-space: pre-wrap; }
          .empty { font-style: italic; color: #999; }
          .footer { margin-top: 50px; font-size: 12px; color: #aaa; text-align: center; border-top: 1px solid #eee; padding-top: 20px; }
          @media print { 
            body { padding: 0; } 
            .no-print { display: none !important; }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="position: sticky; top: 0; background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border: 1px solid #e5e7eb; border-radius: 16px; padding: 14px 20px; display: flex; justify-content: space-between; align-items: center; margin: -20px 0 40px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; box-shadow: 0 4px 20px rgba(0,0,0,0.05); z-index: 1000;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 14px; font-weight: 700; color: #111827;">📄 Visualização do Briefing</span>
          </div>
          <div style="display: flex; gap: 10px;">
            <button onclick="window.print()" style="background: #f3f4f6; color: #1f2937; border: 1px solid #e5e7eb; padding: 8px 16px; border-radius: 10px; font-size: 13px; font-weight: 700; cursor: pointer; transition: all 0.2s;">
              Imprimir / Salvar PDF
            </button>
            <button onclick="goBack()" style="background: #111827; color: white; border: none; padding: 8px 16px; border-radius: 10px; font-size: 13px; font-weight: 700; cursor: pointer; transition: all 0.2s;">
              Voltar ao Aplicativo ➔
            </button>
          </div>
        </div>

        <h1>Briefing: ${title}</h1>
        <div class="subtitle">
          <div><strong>Cliente:</strong> ${clientName || 'Cliente'}</div>
          <div><strong>Respondido em:</strong> ${dateStr}</div>
        </div>
        
        <div class="content">
          ${questions.map((q: any) => {
             const ans = briefing.responses?.[q.key];
             const hasAnswer = ans && (Array.isArray(ans) ? ans.length > 0 : String(ans).trim() !== '');
             const displayAns = hasAnswer 
                 ? (Array.isArray(ans) ? ans.join(', ') : (typeof ans === 'object' ? JSON.stringify(ans, null, 2) : String(ans)))
                 : '<span class="empty">Não respondido</span>';
             return '<div class="item"><div class="question">' + q.label + '</div><div class="answer">' + displayAns + '</div></div>';
          }).join('')}
        </div>
        
        <div class="footer">Gerado por Canguru Digital</div>
        <script>
          function goBack() {
            try {
              window.close();
            } catch (e) {}
            try {
              if (window.history.length > 1) {
                window.history.back();
                return;
              }
            } catch (e) {}
            window.location.href = window.location.origin;
          }
          window.onload = function() { 
            setTimeout(function() { 
              window.print(); 
            }, 500); 
          };
        </script>
      </body>
    </html>
  `;
  
  printWindow.document.write(html);
  printWindow.document.close();
};

export const BRIEFING_QUESTIONS: Record<string, { title: string, questions: any[] }> = {
  'persona': {
    title: 'Persona',
    questions: [
      { key: 'nome_ficticio', label: 'Nome fictício da Persona', type: 'text', help: 'Dê um nome para facilitar a visualização (Ex: João Empreendedor)' },
      { 
        key: 'faixa_etaria', 
        label: 'Faixa Etária do Público-Alvo', 
        type: 'multiselect', 
        options: ['18 a 24 anos', '25 a 34 anos', '35 a 44 anos', '45 a 54 anos', '55 a 64 anos', '65+ anos'],
        help: 'Selecione uma ou mais faixas etárias principais.' 
      },
      { 
        key: 'genero', 
        label: 'Gênero do Público-Alvo', 
        type: 'multiselect', 
        options: ['Masculino', 'Feminino', 'Todos os gêneros'],
        help: 'Selecione a segmentação por gênero.' 
      },
      { 
        key: 'renda_mensal', 
        label: 'Renda Mensal do Público-Alvo', 
        type: 'multiselect', 
        options: ['Até R$ 2.500', 'R$ 2.500 a R$ 5.000', 'R$ 5.000 a R$ 10.000', 'R$ 10.000 a R$ 15.000', 'R$ 15.000 a R$ 20.000', 'R$ 20.000 a R$ 30.000', 'Acima de R$ 30.000'],
        help: 'Selecione o poder aquisitivo estimado.' 
      },
      { key: 'dia_tipico', label: 'Como é o dia típico dessa pessoa?', type: 'textarea', help: 'Desde que acorda até dormir. O que ela lê? Com quem fala? Onde trabalha?' },
      { key: 'como_chegou', label: 'Como ela chegou até o seu produto/serviço?', type: 'textarea', help: 'Qual caminho ela percorreu até decidir que precisava da sua solução?' },
      { key: 'frase_resumo', label: 'Uma frase que resume o problema/necessidade dela', type: 'text', help: 'Ex: "Preciso de mais tempo livre para focar na estratégia da minha empresa."' },
      { 
        key: 'impede_comprar', 
        label: 'O que a impede de comprar? (objeções)', 
        type: 'multiselect', 
        options: ['Falta de orçamento', 'Falta de tempo', 'Desconfiança / Insegurança', 'Não entende o produto/serviço', 'Já usou concorrente e teve experiência ruim', 'Preço elevado'],
        help: 'Selecione as principais objeções enfrentadas.' 
      }
    ]
  },
  'posicionamento': {
    title: 'Posicionamento',
    questions: [
      { key: 'uma_palavra', label: 'Sua marca em uma palavra', type: 'text', help: 'Ex: Inovação, Confiança, Velocidade, Elegância...' },
      {
        key: 'maturidade_digital',
        label: 'Maturidade Digital do Negócio',
        type: 'select',
        options: ['Estou começando do zero', 'Já tenho presença mas quero crescer', 'Já invisto em marketing e quero escalar'],
        help: 'Qual é o momento atual da sua empresa no digital?'
      },
      { key: 'descricao_empresa', label: 'Descrição da empresa (Pitch 30s)', type: 'textarea', help: 'Como você explicaria sua empresa para alguém em 30 segundos?' },
      { key: 'transformacao_concreta', label: 'A transformação concreta que o seu produto gera', type: 'textarea', help: 'Ex: Aumentamos o faturamento em 30%, Reduzimos o tempo de entrega pela metade...' },
      { key: 'diferenciais', label: 'Quais os principais diferenciais?', type: 'textarea', help: 'O que só você faz? Por que escolher você e não o concorrente?' },
      { key: 'concorrentes', label: 'Principais concorrentes', type: 'textarea', help: 'Liste nomes e/ou links dos principais concorrentes diretos.' },
      { key: 'erro_concorrente', label: 'Qual o maior erro dos seus concorrentes?', type: 'textarea', help: 'Onde eles falham que você pode aproveitar como oportunidade?' },
      { key: 'pessoa_famosa', label: 'Se a sua marca fosse uma pessoa famosa, quem seria?', type: 'text', help: 'Isso nos ajuda a entender a personalidade e os arquétipos da marca.' },
      { 
        key: 'objetivo_redes', 
        label: 'Objetivo principal nas redes sociais', 
        type: 'select', 
        options: ['Gerar leads qualificados', 'Aumentar vendas diretas', 'Reconhecimento de marca', 'Tráfego para o site', 'Engajamento nas redes sociais', 'Agendamentos / consultas', 'Construir autoridade'],
        help: 'Selecione a meta prioritária da sua presença digital.' 
      },
      { key: 'percebido_1_ano', label: 'Como deseja ser percebido daqui a 1 ano?', type: 'textarea', help: 'Qual a imagem e reputação que você quer construir para o seu negócio no futuro?' },
      { key: 'presenca_anterior', label: 'O que funcionou ou não funcionou na sua presença anterior?', type: 'textarea', help: 'Ex: Fizemos posts diários mas não gerou vendas, fizemos anúncios de vídeo e deram muito certo...' }
    ]
  },
  'publico_alvo': {
    title: 'Público-Alvo',
    questions: [
      { 
        key: 'genero', 
        label: 'Gênero do Público-Alvo', 
        type: 'multiselect', 
        options: ['Masculino', 'Feminino', 'Todos os gêneros'],
        help: 'Selecione os gêneros do seu público.' 
      },
      { 
        key: 'faixa_etaria', 
        label: 'Faixa Etária do Público-Alvo', 
        type: 'multiselect', 
        options: ['18 a 24 anos', '25 a 34 anos', '35 a 44 anos', '45 a 54 anos', '55 a 64 anos', '65+ anos'],
        help: 'Marque uma ou mais faixas de idade.' 
      },
      { 
        key: 'renda_mensal', 
        label: 'Renda Mensal do Público-Alvo', 
        type: 'multiselect', 
        options: ['Até R$ 2.500', 'R$ 2.500 a R$ 5.000', 'R$ 5.000 a R$ 10.000', 'R$ 10.000 a R$ 15.000', 'R$ 15.000 a R$ 20.000', 'R$ 20.000 a R$ 30.000', 'Acima de R$ 30.000'],
        help: 'Qual o poder aquisitivo estimado?' 
      },
      { 
        key: 'localizacao', 
        label: 'Localização / Abrangência Geográfica', 
        type: 'select', 
        options: ['Local (bairro/cidade)', 'Regional (cidades da região)', 'Estadual', 'Nacional', 'Internacional'],
        help: 'Qual o alcance geográfico da sua empresa?' 
      },
      { 
        key: 'rede_social', 
        label: 'Redes Sociais mais utilizadas', 
        type: 'multiselect', 
        options: ['Instagram', 'Facebook', 'LinkedIn', 'TikTok', 'YouTube', 'Pinterest', 'X (Twitter)', 'WhatsApp'],
        help: 'Selecione onde seu público mais passa tempo.' 
      },
      { 
        key: 'escolaridade', 
        label: 'Escolaridade do Público', 
        type: 'multiselect', 
        options: ['Ensino Fundamental', 'Ensino Médio', 'Nível Superior', 'Pós-graduação / Mestrado / Doutorado'],
        help: 'Selecione o nível acadêmico predominate.' 
      },
      { key: 'conteudos', label: 'Que conteúdos eles consomem?', type: 'textarea', help: 'Quais assuntos eles mais leem ou assistem nas horas vagas ou de trabalho? (Ex: Notícias de negócios, vídeos de humor, tutoriais de maquiagem...)' },
      { key: 'como_abordado', label: 'Como gostam de ser abordados?', type: 'textarea', help: 'Preferem uma abordagem formal? Gostam de informalidade e conversa rápida por WhatsApp? Precisam de e-mails bem detalhados?' },
      { key: 'sonhos_ambicoes', label: 'Sonhos e Ambições', type: 'textarea', help: 'O que eles mais querem conquistar na vida pessoal ou profissional com a ajuda da sua solução?' }
    ]
  },
  'tom_voz': {
    title: 'Tom de Voz',
    questions: [
      { 
        key: 'adjetivos', 
        label: 'Tom de Voz / Personalidade da Marca', 
        type: 'multiselect', 
        options: ['Profissional e formal', 'Próximo e informal', 'Divertido e descontraído', 'Educativo e informativo', 'Inspiracional e motivacional', 'Luxo e exclusividade', 'Moderno e Inovador', 'Acolhedor e Humano'],
        help: 'Escolha os adjetivos que representam o tom da sua marca.' 
      },
      { key: 'dimensoes', label: 'Dimensões da Marca', type: 'object', objectKeys: ['Linguagem', 'Seriedade', 'Formalidade'], help: 'Defina a intensidade. Ex: Linguagem (Técnica ou Simples), Seriedade (Muito Séria ou Descontraída), Formalidade (Formal ou Informal)' },
      { 
        key: 'emocao_principal', 
        label: 'Emoção Principal ao falar com o público', 
        type: 'select', 
        options: ['Empatia e Acolhimento', 'Motivação e Inspiração', 'Segurança e Confiança', 'Urgência e Ação', 'Alegria e Entusiasmo', 'Exclusividade e Status'],
        help: 'Qual sentimento deve prevalecer na sua comunicação?' 
      },
      { key: 'pilar_principal', label: 'Pilar principal da comunicação', type: 'text', help: 'Qual a mensagem central e mais importante que a sua marca sempre deve transmitir nos conteúdos?' },
      { 
        key: 'uso_emojis', 
        label: 'Como é o uso de Emojis?', 
        type: 'select', 
        options: ['Não usamos emojis', 'Usamos com frequência (divertidos e expressivos)', 'Apenas emojis neutros/profissionais (✅, 📊, 🚀)', 'Uso moderado / pontual'],
        help: 'Como os emojis devem ser aplicados nos textos?' 
      },
      { 
        key: 'utiliza_humor', 
        label: 'Utiliza Humor?', 
        type: 'select', 
        options: ['Não (somos estritamente profissionais)', 'Sim (memes, piadas leves e cotidianas)', 'Esporadicamente / Moderado'],
        help: 'Podemos utilizar humor ou memes nas publicações?' 
      },
      { key: 'diferencial_tom', label: 'Diferencial do Tom', type: 'textarea', help: 'O que faz sua forma de falar ou escrever ser totalmente única e diferente das outras marcas?' },
      { key: 'marcas_admiradas', label: 'Marcas Admiradas pelo tom de voz', type: 'textarea', help: 'Cite outras empresas (mesmo de outros setores) que comunicam de um jeito que você adora e quer usar como referência.' },
      { key: 'girias_expressoes', label: 'Gírias ou expressões usadas', type: 'textarea', help: 'Existem palavras específicas ou bordões que sua marca fala constantemente?' },
      { key: 'palavras_proibidas', label: 'Palavras proibidas', type: 'textarea', help: 'Quais palavras NUNCA devemos falar na nossa comunicação? (Ex: Problema, Barato, Crise...)' }
    ]
  },
  'site': {
    title: 'Website',
    questions: [
      { 
        key: 'tem_website', 
        label: 'Já tem website?', 
        type: 'select', 
        options: ['Não (será criado um site do zero)', 'Sim (necessita de reformulação total)', 'Sim (apenas ajustes e melhorias)'],
        help: 'Informe a situação atual do seu website.' 
      },
      { 
        key: 'paginas_essenciais', 
        label: 'Páginas essenciais', 
        type: 'multiselect', 
        options: ['Home', 'Sobre a empresa', 'Nossos Serviços / Produtos', 'Contato / Localização', 'Blog / Artigos', 'Depoimentos / Cases', 'Landing Page de Vendas'],
        help: 'Quais seções ou páginas o site precisa ter?' 
      },
      { 
        key: 'objetivo_site', 
        label: 'Objetivo do Site', 
        type: 'multiselect', 
        options: ['Gerar leads (contatos)', 'Venda online (E-commerce)', 'Vitrine institucional (autoridade)', 'Agendamento de consultas/serviços', 'Suporte ao cliente / FAQ'],
        help: 'Quais os propósitos principais da plataforma?' 
      },
      { 
        key: 'formas_contato', 
        label: 'Formas de Contato', 
        type: 'multiselect', 
        options: ['Botão de WhatsApp', 'Formulário de Orçamento/Contato', 'Telefone Fixo / Celular', 'E-mail', 'Chat ao vivo / Bot'],
        help: 'Como os visitantes do site poderão entrar em contato?' 
      },
      { 
        key: 'estilo_design', 
        label: 'Estilo de Design preferido', 
        type: 'multiselect', 
        options: ['Clean e Minimalista', 'Colorido e Divertido', 'Corporativo e Tecnológico', 'Elegante e Premium', 'Moderno e Arrojado'],
        help: 'Selecione os estilos visuais que agradam a marca.' 
      },
      { key: 'sites_admira', label: 'Sites que admira (Referências)', type: 'textarea', help: 'Cole os links de sites e Landing Pages que possuem visuais ou funcionalidades que você gostaria de ter como referência.' },
      { key: 'imagens_midias', label: 'Imagens e Mídias (Possui material?)', type: 'textarea', help: 'Você já possui fotos da equipe, vídeos da empresa ou será necessário usar bancos de imagens/produzir esse novo material fotográfico?' },
      { key: 'sobre_conteudo', label: 'Sobre o conteúdo (Textos)', type: 'textarea', help: 'Os textos das páginas já existem num documento ou iremos criar tudo do zero com Copywriting baseado neste briefing?' },
      { 
        key: 'dominio_hospedagem', 
        label: 'Domínio e Hospedagem', 
        type: 'select', 
        options: ['Já possuo domínio e hospedagem', 'Possuo apenas o domínio', 'Ainda não possuo domínio nem hospedagem', 'Preciso de ajuda para contratar'],
        help: 'Qual a situação técnica de endereço e hospedagem?' 
      },
      { key: 'integracoes', label: 'Integrações', type: 'object', objectKeys: ['CRM', 'Analytics', 'E-commerce', 'Agendamento', 'Pixels'], help: 'Existem plataformas que devem estar conectadas ao site? Ex: RD Station, Pipedrive, Calendly, Meta Pixel, Google Tag Manager...' },
      { key: 'funciona_melhorar', label: 'O que funciona e o que deve melhorar no site atual?', type: 'textarea', help: 'Caso já possua um site, explique os principais pontos de insatisfação que motivam a reformulação e o que pode ser mantido.' }
    ]
  },
  'trafego_pago': {
    title: 'Tráfego Pago',
    questions: [
      { 
        key: 'genero', 
        label: 'Gênero do Público-Alvo', 
        type: 'multiselect', 
        options: ['Masculino', 'Feminino', 'Todos os gêneros'],
        help: 'Para quem os anúncios devem ser segmentados?' 
      },
      { 
        key: 'faixa_etaria', 
        label: 'Faixa Etária do Público-Alvo', 
        type: 'multiselect', 
        options: ['18 a 24 anos', '25 a 34 anos', '35 a 44 anos', '45 a 54 anos', '55 a 64 anos', '65+ anos'],
        help: 'Selecione as faixas etárias dos anúncios.' 
      },
      { 
        key: 'renda_mensal', 
        label: 'Renda Mensal do Público-Alvo', 
        type: 'multiselect', 
        options: ['Até R$ 2.500', 'R$ 2.500 a R$ 5.000', 'R$ 5.000 a R$ 10.000', 'R$ 10.000 a R$ 15.000', 'R$ 15.000 a R$ 20.000', 'R$ 20.000 a R$ 30.000', 'Acima de R$ 30.000'],
        help: 'Qual é o poder aquisitivo estimado de quem compra a oferta?' 
      },
      { 
        key: 'localizacao', 
        label: 'Localização / Abrangência Geográfica', 
        type: 'select', 
        options: ['Local (bairro/cidade)', 'Regional (cidades da região)', 'Estadual', 'Nacional', 'Internacional'],
        help: 'Onde rodaremos os anúncios?' 
      },
      { 
        key: 'plataformas', 
        label: 'Plataformas de Anúncios', 
        type: 'multiselect', 
        options: ['Google Search', 'Google Display', 'YouTube', 'Meta Ads (Facebook / Instagram)', 'TikTok Ads', 'LinkedIn Ads'],
        help: 'Em quais canais pagos pretendemos anunciar?' 
      },
      { key: 'profissao_cargo', label: 'Profissão / Cargo do Público', type: 'text', help: 'Ex: Vamos atingir Médicos. Ou vamos focar em Diretores de empresas.' },
      { 
        key: 'onde_passa_tempo', 
        label: 'Onde passa o tempo online?', 
        type: 'multiselect', 
        options: ['Instagram / Facebook', 'YouTube', 'TikTok', 'Google / Blogs de Pesquisa', 'LinkedIn', 'Portais de Notícias'],
        help: 'Onde o público navega frequentemente?' 
      },
      { 
        key: 'ticket_medio', 
        label: 'Ticket Médio do Produto/Serviço', 
        type: 'select', 
        options: ['Até R$ 100', 'R$ 100 a R$ 500', 'R$ 500 a R$ 2.000', 'R$ 2.000 a R$ 10.000', 'Acima de R$ 10.000'],
        help: 'Qual o preço médio da solução anunciada?' 
      },
      { 
        key: 'orcamento_midia', 
        label: 'Orçamento Mensal em Mídia Paga', 
        type: 'select', 
        options: ['Até R$ 1.000', 'R$ 1.000 a R$ 3.000', 'R$ 3.000 a R$ 5.000', 'R$ 5.000 a R$ 10.000', 'Acima de R$ 10.000'],
        help: 'Qual o valor estimado para investimento direto em anúncios?' 
      },
      { 
        key: 'ciclo_vendas', 
        label: 'Ciclo de Vendas', 
        type: 'select', 
        options: ['Imediato (mesmo dia)', 'Até 7 dias', '15 a 30 dias', '1 a 3 meses', 'Mais de 3 meses'],
        help: 'Quanto tempo leva entre o 1º contato e o fechamento?' 
      },
      { key: 'maior_problema', label: 'Maior Problema do Cliente', type: 'textarea', help: 'Qual é a maior urgência ou "dor de cabeça" constante do cliente e que é resolvida pelo seu serviço?' },
      { 
        key: 'motivou_buscar', 
        label: 'O que o motivou a buscar você?', 
        type: 'multiselect', 
        options: ['Urgência / Necessidade imediata', 'Desejo de crescimento / Oportunidade', 'Insatisfação com concorrente atual', 'Recomendação de terceiros', 'Preço / Oferta especial'],
        help: 'Quais os motivos que levam à busca pela sua oferta?' 
      },
      { 
        key: 'meta_principal', 
        label: 'Objetivo Principal / Meta da Campanha', 
        type: 'select', 
        options: ['Gerar leads qualificados', 'Aumentar vendas diretas', 'Reconhecimento de marca', 'Tráfego para o site', 'Agendamentos / consultas'],
        help: 'O que definirá o projeto como um Sucesso Absoluto?' 
      },
      { 
        key: 'gatilho_agir', 
        label: 'Gatilho para agir', 
        type: 'multiselect', 
        options: ['Bônus VIP', 'Desconto na 1ª Consulta / Compra', 'Escassez (Últimas Vagas / Estoque)', 'Autoridade / Prova Social', 'Garantia Incondicional'],
        help: 'Qual oferta ou isca fará o usuário clicar no seu anúncio agora?' 
      }
    ]
  },
  'conteudo_bastidores': {
    title: 'Conteúdo, Bastidores e Autoridade',
    questions: [
      { key: 'duvidas_frequentes', label: 'Quais dúvidas seus clientes mais fazem antes de contratar/comprar?', type: 'textarea' },
      { key: 'erros_mercado', label: 'Quais erros você mais vê as pessoas cometendo no seu mercado?', type: 'textarea' },
      { key: 'entendimento_servico', label: 'O que você gostaria que as pessoas entendessem melhor sobre seu serviço?', type: 'textarea' },
      { key: 'processo_atendimento', label: 'Como funciona seu processo de atendimento do início ao fim?', type: 'textarea' },
      { key: 'diferencial_pratica', label: 'O que torna seu atendimento/produto diferente na prática?', type: 'textarea' },
      { key: 'historias_clientes', label: 'Quais histórias de clientes você pode contar sem expor nomes?', type: 'textarea' },
      { key: 'bastidores_confianca', label: 'Quais bastidores do seu trabalho poderiam gerar confiança?', type: 'textarea' },
      { key: 'nunca_faria', label: 'O que você nunca faria no seu mercado?', type: 'textarea' },
      { key: 'crencas_defende', label: 'Quais crenças você defende sobre sua área?', type: 'textarea' },
      { key: 'temas_evitar', label: 'Quais temas você não quer abordar nas redes sociais?', type: 'textarea' },
      { key: 'produtos_vender_30d', label: 'Quais serviços/produtos você mais quer vender nos próximos 30 dias?', type: 'textarea' },
      { key: 'provas_sociais', label: 'Quais provas você tem hoje? (Depoimentos, antes/depois, cases, fotos, números, anos de experiência, clientes atendidos)', type: 'textarea' }
    ]
  }
};

const SERVICE_TO_BRIEFINGS: Record<string, string[]> = {
  'Social Media': ['persona', 'publico_alvo', 'tom_voz', 'posicionamento', 'conteudo_bastidores'],
  'Tráfego Pago': ['trafego_pago'],
  'Website': ['site'],
  'Identidade Visual': ['persona', 'posicionamento'],
  'E-mail Marketing': ['publico_alvo', 'tom_voz'],
  'Fotos com IA': ['persona', 'publico_alvo']
};

export const BriefingOnboarding: React.FC<{ isDashboardView?: boolean }> = ({ isDashboardView }) => {
  const { activeClient, refreshActiveClient, logout, userRole, agencyId } = useAuth();
  const [briefings, setBriefings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBriefingType, setSelectedBriefingType] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [customTemplates, setCustomTemplates] = useState<Record<string, any>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (activeClient) {
      loadBriefings();
    }
  }, [activeClient]);

  useEffect(() => {
    if (briefings.length > 0) {
      const params = new URLSearchParams(window.location.search);
      const typeParam = params.get('type');
      if (typeParam) {
        const targetBriefing = briefings.find(b => b.briefing_type === typeParam);
        if (targetBriefing && !selectedBriefingType) {
          handleSelectBriefing(targetBriefing);
          // Remove from URL so it doesn't get re-triggered when returning to the menu
          const newUrl = window.location.pathname + '?view=strategic-briefings';
          window.history.replaceState({}, document.title, newUrl);
        }
      }
    }
  }, [briefings]);

  const loadBriefings = async () => {
    setLoading(true);
    try {
      // Load custom templates first
      const { data: templatesData } = await supabase
        .from('agency_briefing_templates')
        .select('*')
        .eq('agency_id', agencyId);
      
      const templatesMap: Record<string, any> = {};
      if (templatesData && templatesData.length > 0) {
        templatesData.forEach(t => {
          templatesMap[t.briefing_type] = t;
        });
        setCustomTemplates(templatesMap);
      } else {
        setCustomTemplates({});
      }

      // Load fresh client data to ensure features_settings is up-to-date
      const { data: freshClientData } = await supabase
        .from('clients')
        .select('services, features_settings, onboarding_completed')
        .eq('id', activeClient!.id)
        .single();
        
      let services = freshClientData?.services || activeClient?.services || [];
      if (!Array.isArray(services) || services.length === 0) {
        services = ['Social Media']; // Default
      }
      
      const customTypes = freshClientData?.features_settings?.active_briefing_types ?? activeClient?.features_settings?.active_briefing_types;

      const { data: existingBriefings } = await supabase
        .from('client_briefings')
        .select('*')
        .eq('agency_id', agencyId)
        .eq('client_id', activeClient!.id);
      
      let currentBriefings = existingBriefings || [];
      
      // Determine required briefing types based on services + custom types
      const requiredTypes = new Set<string>();
      if (Array.isArray(customTypes)) {
        // Explicitly set by admin (if [], requiredTypes remains empty => 0 briefings)
        customTypes.forEach((t: string) => requiredTypes.add(t));
      } else {
        // Not set yet (undefined/null), use automatic detection based on services
        for (const service of services) {
          const types = SERVICE_TO_BRIEFINGS[service] || [];
          types.forEach(t => requiredTypes.add(t));
        }
      }

      let neededToCreate = [];
      for (const bType of requiredTypes) {
        const exists = currentBriefings.find((b: any) => b.briefing_type === bType);
        if (!exists) {
          neededToCreate.push({
            client_id: activeClient!.id,
            agency_id: agencyId,
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
      if (requiredTypes.size > 0 && agencyId) {
          const completedCount = relevantBriefings.filter((b: any) => b.is_completed).length;
          if (completedCount === requiredTypes.size && !activeClient?.onboarding_completed) {
            await supabase.from('clients').update({ onboarding_completed: true }).eq('id', activeClient!.id).eq('agency_id', agencyId);
            await refreshActiveClient();
          }
      } else if (!activeClient?.onboarding_completed && agencyId) {
         await supabase.from('clients').update({ onboarding_completed: true }).eq('id', activeClient!.id).eq('agency_id', agencyId);
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
    
    if (complete) {
      const currentSpec = customTemplates[selectedBriefingType] || BRIEFING_QUESTIONS[selectedBriefingType];
      if (currentSpec && currentSpec.questions) {
        let hasMissing = false;
        
        for (const q of currentSpec.questions) {
          const val = formData[q.key];
          
          if (q.type === 'object' && q.objectKeys) {
             let missingObj = false;
             for (const objKey of q.objectKeys) {
                if (!val || typeof val !== 'object' || !val[objKey] || (typeof val[objKey] === 'string' && val[objKey].trim() === '')) {
                   missingObj = true;
                }
             }
             if (missingObj) hasMissing = true;
          } else if (q.type === 'array') {
             if (!val || (Array.isArray(val) && val.length === 0) || (typeof val === 'string' && val.trim() === '')) {
                hasMissing = true;
             }
          } else {
             if (val === undefined || val === null || (typeof val === 'string' && val.trim() === '')) {
                hasMissing = true;
             }
          }
        }
        
        if (hasMissing) {
           setError("Por favor, preencha todas as perguntas antes de concluir o briefing.");
           setTimeout(() => setError(null), 5000);
           return;
        }
      }
    }

    setSaving(true);
    
    try {
      // Process array fields
      const processedData = { ...formData };
      const currentSpec = customTemplates[selectedBriefingType] || BRIEFING_QUESTIONS[selectedBriefingType];
      if (currentSpec) {
        currentSpec.questions.forEach((q: any) => {
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
        .eq('agency_id', agencyId)
        .eq('client_id', activeClient.id)
        .eq('briefing_type', selectedBriefingType);
      
      await loadBriefings();
      if (complete) {
        setSelectedBriefingType(null);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleType = async (type: string) => {
    if (!activeClient || userRole !== 'admin') return;
    
    let currentTypes = activeClient.features_settings?.active_briefing_types;
    
    if (!Array.isArray(currentTypes)) {
      currentTypes = [];
      const services = activeClient.services || [];
      for (const service of services) {
        const autoTypes = SERVICE_TO_BRIEFINGS[service] || [];
        autoTypes.forEach(t => {
          if (!currentTypes.includes(t)) currentTypes.push(t);
        });
      }
    }
    
    let newTypes;
    if (currentTypes.includes(type)) {
      newTypes = currentTypes.filter((t: string) => t !== type);
    } else {
      newTypes = [...currentTypes, type];
    }
    
    try {
      const { error } = await supabase
        .from('clients')
        .update({
          features_settings: {
            ...(activeClient.features_settings || {}),
            active_briefing_types: newTypes
          }
        })
        .eq('agency_id', agencyId)
        .eq('id', activeClient.id);
      
      if (error) throw error;
      await refreshActiveClient();
    } catch (err) {
      console.error('Error toggling briefing type:', err);
    }
  };

  const isAdmin = userRole === 'admin';

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64 w-full">
        <div className="w-8 h-8 border-4 border-brand-dark/20 border-t-brand-dark rounded-full animate-spin" />
      </div>
    );
  }

  const handleDownloadPDF = (briefing: any, e: React.MouseEvent) => {
    e.stopPropagation();
    handleDownloadBriefingPDF(briefing, activeClient?.name || 'Cliente', customTemplates);
  };

  const renderHeader = () => (
    <header className="w-full max-w-7xl mx-auto px-4 sm:px-8 py-5 flex items-center justify-between border-b border-gray-100 bg-white/50 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <Logo className="w-32 sm:w-44" />
      </div>
      <div>
        <button 
          onClick={() => logout()}
          className="flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-brand-dark transition-colors font-bold text-[10px] uppercase tracking-widest"
        >
          <span>Sair</span>
          <LogOut size={14} />
        </button>
      </div>
    </header>
  );

  const allCompleted = briefings.length > 0 && briefings.every(b => b.is_completed);
  const completedCount = briefings.filter(b => b.is_completed).length;

  if (selectedBriefingType) {
    const briefingSpec = customTemplates[selectedBriefingType] || BRIEFING_QUESTIONS[selectedBriefingType];
    const questions = briefingSpec ? briefingSpec.questions : [];
    const title = briefingSpec ? briefingSpec.title : selectedBriefingType;

    return (
      <div className="w-full min-h-screen bg-[#FDFDFD] flex flex-col">
        {renderHeader()}

        <div className="flex-1 flex flex-col items-center justify-center py-8 px-4">
          <div className="w-full max-w-3xl mx-auto p-5 sm:p-10 bg-white rounded-[2rem] sm:rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.03)] border border-black/[0.02] flex flex-col pt-10">
            <button 
              onClick={() => setSelectedBriefingType(null)}
              className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-gray-500 hover:text-brand-dark transition-colors mb-8 w-fit"
            >
              <ArrowLeft size={16} /> Voltar para os briefings
            </button>
            
            <h2 className="text-3xl font-black text-brand-dark mb-2 tracking-tight">{title}</h2>
            <p className="text-gray-500 font-medium mb-10">Preencha as informações detalhadas para este módulo.</p>

            <div className="space-y-8 flex-1">
              {questions.map((q) => {
                const options: string[] = q.options || [];

                return (
                  <div key={q.key} className="bg-gray-50/40 p-5 sm:p-6 rounded-2xl border border-black/[0.03]">
                    <label className="block text-sm font-bold text-gray-800 mb-1">{q.label}</label>
                    {q.help && <p className="text-[11px] text-gray-500 mb-3 leading-relaxed">{q.help}</p>}
                    
                    {q.type === 'multiselect' ? (
                      (() => {
                        const rawVal = formData[q.key];
                        let selectedArray: string[] = [];
                        if (Array.isArray(rawVal)) {
                          selectedArray = rawVal;
                        } else if (typeof rawVal === 'string' && rawVal.trim()) {
                          selectedArray = rawVal.includes(',') 
                            ? rawVal.split(',').map((s: string) => s.trim()).filter(Boolean)
                            : [rawVal.trim()];
                        }

                        const toggleOpt = (opt: string) => {
                          let next: string[];
                          if (selectedArray.includes(opt)) {
                            next = selectedArray.filter(item => item !== opt);
                          } else {
                            next = [...selectedArray, opt];
                          }
                          setFormData({ ...formData, [q.key]: next });
                        };

                        return (
                          <div className="flex flex-wrap gap-2.5 my-1">
                            {options.map((opt: string) => {
                              const isSelected = selectedArray.includes(opt);
                              return (
                                <button
                                  key={opt}
                                  type="button"
                                  onClick={() => toggleOpt(opt)}
                                  className={`px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-2 cursor-pointer text-left ${
                                    isSelected
                                      ? 'bg-brand-dark text-white border-brand-dark shadow-sm ring-2 ring-brand-dark/10'
                                      : 'bg-white text-gray-700 border-gray-200 hover:border-brand-dark/30 hover:bg-gray-50'
                                  }`}
                                >
                                  {isSelected ? (
                                    <CheckCircle size={15} className="text-white shrink-0" />
                                  ) : (
                                    <div className="w-3.5 h-3.5 rounded-md border border-gray-300 bg-gray-50 shrink-0" />
                                  )}
                                  <span>{opt}</span>
                                </button>
                              );
                            })}
                          </div>
                        );
                      })()
                    ) : q.type === 'select' ? (
                      (() => {
                        const currentVal = formData[q.key] || '';
                        
                        return (
                          <div className="flex flex-wrap gap-2.5 my-1">
                            {options.map((opt: string) => {
                              const isSelected = currentVal === opt;
                              return (
                                <button
                                  key={opt}
                                  type="button"
                                  onClick={() => setFormData({ ...formData, [q.key]: opt })}
                                  className={`px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-2 cursor-pointer text-left ${
                                    isSelected
                                      ? 'bg-brand-dark text-white border-brand-dark shadow-sm ring-2 ring-brand-dark/10'
                                      : 'bg-white text-gray-700 border-gray-200 hover:border-brand-dark/30 hover:bg-gray-50'
                                  }`}
                                >
                                  <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${isSelected ? 'border-white bg-white' : 'border-gray-300 bg-gray-50'}`}>
                                    {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-brand-dark" />}
                                  </div>
                                  <span>{opt}</span>
                                </button>
                              );
                            })}
                          </div>
                        );
                      })()
                    ) : q.type === 'object' && q.objectKeys ? (
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
                          className="w-full border border-gray-200 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark resize-none shadow-sm transition-all bg-white"
                          rows={3}
                        />
                      </div>
                    ) : q.type === 'textarea' ? (
                      <textarea
                        value={formData[q.key] || ''}
                        onChange={(e) => setFormData({ ...formData, [q.key]: e.target.value })}
                        placeholder={q.placeholder}
                        className="w-full border border-gray-200 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark resize-none shadow-sm transition-all bg-white"
                        rows={4}
                      />
                    ) : (
                      <input
                        type="text"
                        value={formData[q.key] || ''}
                        onChange={(e) => setFormData({ ...formData, [q.key]: e.target.value })}
                        placeholder={q.placeholder}
                        className="w-full border border-gray-200 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark shadow-sm transition-all bg-white"
                      />
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-12 flex flex-col sm:flex-row gap-4 pt-8 border-t border-gray-100 pb-10 relative">
              {error && (
                <div className="absolute -top-16 left-0 right-0 p-4 bg-red-50 text-red-600 border border-red-100 rounded-2xl flex items-center justify-center gap-2 font-bold text-sm tracking-wide shadow-sm animate-in fade-in slide-in-from-bottom-2">
                  <AlertCircle size={18} /> {error}
                </div>
              )}
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
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-[#FDFDFD] flex flex-col">
      {renderHeader()}
      
      <div className="flex-1 flex flex-col items-center justify-center py-8 px-4 pb-16">
        <div className="max-w-4xl w-full p-6 sm:p-10 bg-white rounded-[2rem] sm:rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.03)] border border-black/[0.02]">
          <div className="mb-10 text-center">
            <div className="w-20 h-20 bg-brand-dark/5 rounded-[1.5rem] flex items-center justify-center mx-auto mb-6 shrink-0 text-brand-dark">
              <Target size={32} />
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-brand-dark mb-4 tracking-tight">Briefings Estratégicos</h1>
            <p className="text-gray-500 font-medium max-w-lg mx-auto text-sm sm:text-base mb-8">
              {isAdmin ? 'Gerenciamento de formulários estratégicos do cliente.' : 'Antes de começar, precisamos de algumas informações estratégicas. Preencha os formulários abaixo.'}
            </p>
            
            <div className="max-w-lg mx-auto">
              <div className="mb-3 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-gray-400">
                <span>{isAdmin ? 'Status do Cliente' : 'Progresso Geral'}</span>
                <span>{completedCount} de {briefings.length} concluídos</span>
              </div>
              <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                 <div className="h-full bg-brand-dark transition-all duration-500" style={{ width: `${briefings.length ? (completedCount / briefings.length) * 100 : 0}%` }} />
              </div>
            </div>
          </div>

          {isAdmin && (
            <div className="mb-10 bg-gray-50 p-6 rounded-3xl border border-gray-100">
              <h3 className="text-sm font-bold text-brand-dark uppercase tracking-widest mb-4">Gerenciar Formulários Ativos</h3>
              <div className="flex flex-wrap gap-2">
                {Array.from(new Set([...Object.keys(BRIEFING_QUESTIONS), ...Object.keys(customTemplates)])).map((type) => {
                  const spec = customTemplates[type] || BRIEFING_QUESTIONS[type];
                  const isActive = briefings.some(b => b.briefing_type === type);
                  return (
                    <button
                      key={type}
                      onClick={() => handleToggleType(type)}
                      className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${
                        isActive 
                          ? 'bg-brand-dark text-white shadow-md' 
                          : 'bg-white text-gray-400 border border-gray-100 hover:border-brand-dark/20'
                      }`}
                    >
                      {spec.title}
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-gray-400 mt-4 italic">* Clique para ativar ou desativar os formulários para este cliente.</p>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 mb-10 mx-auto w-full max-w-4xl">
            {briefings.map(b => {
               const spec = customTemplates[b.briefing_type] || BRIEFING_QUESTIONS[b.briefing_type];
               const title = spec ? spec.title : b.briefing_type;
               return (
                <div 
                  key={b.id} 
                  onClick={() => handleSelectBriefing(b)}
                  className={`p-6 rounded-[1.5rem] border-2 cursor-pointer transition-all hover:-translate-y-1 ${b.is_completed ? 'border-green-100 bg-green-50/50 hover:bg-green-50' : 'border-gray-100/70 hover:border-brand-dark bg-white shadow-[0_4px_20px_rgba(0,0,0,0.02)]'}`}
                >
                  <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${b.is_completed ? 'bg-green-100 text-green-600' : 'bg-brand-dark/5 text-brand-dark'}`}>
                         {b.is_completed ? <CheckCircle size={24} /> : <FileText size={24} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-gray-900 text-base sm:text-lg leading-snug break-normal">{title}</h3>
                        <span className={`text-[10px] uppercase tracking-widest font-bold mt-1 block ${b.is_completed ? 'text-green-600' : 'text-gray-400'}`}>
                            {b.is_completed ? 'Concluído' : 'Pendente'}
                        </span>
                      </div>
                      {b.is_completed && (
                         <button 
                             onClick={(e) => handleDownloadPDF(b, e)}
                             title="Baixar respostas como PDF"
                             className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-brand-dark transition-colors shrink-0"
                         >
                             <Download size={20} />
                         </button>
                      )}
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
    </div>
  );
};
