

import { AdSetData, AnnualStrategy, PlatformStrategy, WeeklyScheduleRow, MonthlyDetailedPlan } from './types';

export const ANNUAL_PLAN: AnnualStrategy = {
  northStar: {
    title: 'NORTE DO ANO',
    description: 'Autoridade técnica + presença em eventos + educação contínua + produto com contexto real'
  },
  benefits: [
    'Coerência ao longo do ano',
    'Conteúdo que evolui, não repete',
    'Eventos integrados (não soltos)',
    'Fácil validação com diretoria',
    'Base perfeita para o nível mensal'
  ],
  months: [
    {
      month: 'FEVEREIRO',
      title: 'BASE TÉCNICA & PRECISÃO APLICADA',
      function: 'Construir base técnica sólida',
      color: 'blue',
      deliverables: [
        'Foco: MaxiFlex, MaxiCut, MaxiDex (introdução)',
        'Reforçar domínio sobre precisão e riscos mecânicos',
        'Iniciar cultura de vídeo técnico semanal'
      ],
      takeaways: ['Construção de autoridade', 'Base técnica sólida']
    },
    {
      month: 'MARÇO',
      title: 'ROBUSTEZ, COMPARAÇÃO E AUTORIDADE',
      function: 'Construir credibilidade técnica',
      color: 'blue',
      deliverables: [
        'Foco: Linha Mack e Química (MaxiChem)',
        'Trabalhar comparação técnica real',
        'Conectar com evento de 05/03 (Autoridade técnica)'
      ],
      takeaways: ['Mercado começa a "escutar"', 'Autoridade de campo']
    },
    {
      month: 'ABRIL',
      title: 'ESPECIALIDADES & POSICIONAMENTO',
      function: 'Conteúdo sofisticado e inovação',
      color: 'yellow',
      events: [
        { name: 'Proteminas', date: '14 a 16/04' }
      ],
      deliverables: [
        'Foco: Proteminas e MaxiDex como inovação',
        'Comparações técnicas avançadas',
        'Conteúdo mais sofisticado'
      ],
      takeaways: ['Marca visível', 'Conteúdo com lastro real']
    },
    {
      month: 'MAIO',
      title: 'SST EM FOCO + TEASER FISP',
      function: 'Autoridade máxima',
      color: 'yellow',
      events: [
        { name: 'PrevenSul', date: '27 a 29/05' }
      ],
      deliverables: [
        'Início dos Teasers FISP (Evolução Técnica)',
        'Conteúdo institucional com profundidade',
        'Produto sempre ligado a risco real',
        'Forte presença no LinkedIn'
      ],
      takeaways: ['Mês de autoridade máxima', 'Conversa direta com técnicos e decisores']
    },
    {
      month: 'JUNHO',
      title: 'CONSOLIDAÇÃO TÉCNICA',
      function: 'Consolidação de aprendizados',
      color: 'yellow',
      events: [
        { name: 'Exposeg', date: '01 a 03/06' }
      ],
      deliverables: [
        'Teaser FISP #2 (O que mudou no mercado)',
        'Consolidação de aprendizados',
        'Conteúdo técnico mais aplicado',
        'Reforço da exclusividade ATG'
      ],
      takeaways: ['Marca sólida', 'Sem repetição de discurso']
    },
    {
      month: 'JULHO',
      title: 'EDUCAÇÃO CONTÍNUA',
      function: 'Maturidade',
      color: 'blue',
      deliverables: [
        'Séries educativas avançadas',
        'Riscos combinados',
        'Aplicações específicas por setor',
        'Conteúdo evergreen'
      ],
      takeaways: ['Alto valor técnico', 'Baixo ruído']
    },
    {
      month: 'AGOSTO',
      title: 'AQUECIMENTO FISP TOTAL',
      function: 'Foco total no Nacional',
      color: 'red',
      deliverables: [
        'Intensificação da comunicação FISP',
        'Tecnologia como diferencial real',
        'Casos técnicos (sem depoimento)',
        'Preparação para SulSST'
      ],
      takeaways: ['Produto sem "vitrine"', 'Venda consultiva']
    },
    {
      month: 'SETEMBRO',
      title: 'AUTORIDADE REGIONAL',
      function: 'Conexão técnica regional (SulSST)',
      color: 'yellow',
      events: [
        { name: 'SulSST', date: '25 a 27/09' }
      ],
      deliverables: [
        'Conteúdo regionalizado',
        'Presença técnica',
        'Relacionamento',
        'Pós-evento estratégico'
      ],
      takeaways: ['Marca próxima do mercado', 'Forte conexão técnica']
    },
    {
      month: 'OUTUBRO',
      title: 'FISP — O GRANDE PALCO',
      function: 'Consolidar autoridade nacional',
      color: 'red',
      events: [
        { name: 'FISP', date: '06 a 08/10' }
      ],
      deliverables: [
        'Lançamentos e Inovação',
        'Tecnologia e futuro',
        'Liderança de mercado',
        'Forte presença institucional'
      ],
      takeaways: ['Pico de visibilidade', 'Marca em posição de liderança']
    },
    {
      month: 'NOVEMBRO',
      title: 'VISÃO & CONTINUIDADE',
      function: 'Maturidade institucional',
      color: 'blue',
      deliverables: [
        'Tendências observadas no ano',
        'Consolidação de posicionamento',
        'Conteúdo estratégico',
        'Planejamento implícito para 2027'
      ],
      takeaways: ['Autoridade silenciosa', 'Marca madura']
    },
    {
      month: 'DEZEMBRO',
      title: 'RELACIONAMENTO & FECHAMENTO',
      function: 'Vínculo humano',
      color: 'green',
      deliverables: [
        'Mensagens institucionais',
        'Operação (plantões, inventário)',
        'Relacionamento',
        'Encerramento de ciclo'
      ],
      takeaways: ['Próxima do cliente', 'Sem marketing vazio']
    }
  ]
};

export const SOCIAL_STRATEGY: PlatformStrategy[] = [
  {
    id: 'meta',
    name: 'Instagram / Facebook',
    schedule: 'Segunda, Quarta e Sexta',
    description: 'Foco em conteúdo educacional, vídeos técnicos e autoridade.',
    bestDays: [
      {
        day: 'Segunda',
        reason: ['Conteúdo educacional estratégico']
      },
      {
        day: 'Quarta',
        reason: ['Vídeo técnico aplicado (produto em ação)']
      },
      {
        day: 'Sexta',
        reason: ['Autoridade técnica / posicionamento institucional']
      }
    ]
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    schedule: 'Segunda, Terça, Quarta e Sexta',
    description: 'Foco técnico profundo, analítico e estratégico.',
    bestDays: [
      {
        day: 'Segunda',
        reason: ['Conteúdo analítico / educacional']
      },
      {
        day: 'Terça',
        reason: ['Ficha técnica horizontal (produto específico)']
      },
      {
        day: 'Quarta',
        reason: ['Vídeo técnico aplicado']
      },
      {
        day: 'Sexta',
        reason: ['Posicionamento estratégico / visão de mercado']
      }
    ],
    tip: 'O LinkedIn é o canal para aprofundamento técnico e conexão com decisores.'
  }
];

export const WEEKLY_SCHEDULE: WeeklyScheduleRow[] = [
  {
    day: 'Segunda',
    platforms: 'IG + LinkedIn',
    content: 'Conteúdo estratégico / educacional'
  },
  {
    day: 'Terça',
    platforms: 'LinkedIn only',
    content: 'Ficha técnica horizontal (produto)'
  },
  {
    day: 'Quarta',
    platforms: 'IG + LinkedIn',
    content: 'VÍDEO (Técnico aplicado)'
  },
  {
    day: 'Quinta',
    platforms: '-',
    content: 'Sem postagem fixa (Gestão de comunidade)'
  },
  {
    day: 'Sexta',
    platforms: 'IG + LinkedIn',
    content: 'Estratégico / autoridade / institucional'
  }
];

export const DETAILED_MONTHLY_PLANS: MonthlyDetailedPlan[] = [
  {
    month: 'FEVEREIRO 2026',
    theme: 'POSICIONAMENTO TÉCNICO',
    objective: 'Estabelecer o padrão de qualidade técnica, focando nas luvas "Carro-Chefe" para demonstrar versatilidade e tecnologias base (AIRtech, GripTech).',
    overview: {
      meta: [
        'Segunda: Educacional',
        'Quarta: Vídeo Produto (MaxiFlex, MaxiDry, MaxiCut)',
        'Sexta: Institucional'
      ],
      linkedin: [
        'Terça/Quinta: Técnico e Gestão',
        'Sexta: Adaptação'
      ]
    },
    results: [
      'Clareza sobre modelos principais',
      'Diferenciação por tecnologia',
      'Aprovação dos nomes corretos'
    ],
    weeks: [
      {
        title: 'SEMANA 1 - A REFERÊNCIA EM PRECISÃO',
        days: [
          {
            day: '03/02 – Terça-feira',
            platform: 'linkedin',
            exclusive: true,
            type: 'Texto técnico',
            theme: 'MaxiFlex® AD-APT™ (Endurance)',
            // ADICIONADO: Exemplo de imagem já carregada via código
            initialImageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=2070&auto=format&fit=crop' 
          },
          {
            day: '04/02 – Quarta-feira',
            platform: 'meta',
            type: 'Vídeo (Reel - Produto)',
            theme: 'Luva: MaxiFlex Ultimate',
            bullets: ['Destaque: Tecnologia AD-APT (Mãos secas e frescas)', 'Aplicação: Montagem precisa', 'Modelo: 42.874']
            // SEM IMAGEM -> Aparecerá como "Em Produção"
          },
          {
            day: '05/02 – Quinta-feira',
            platform: 'linkedin',
            exclusive: true,
            type: 'Texto analítico',
            theme: 'MaxiFlex Ultimate'
          },
          {
            day: '06/02 – Sexta-feira',
            platform: 'meta',
            type: 'Estático / Carrossel',
            theme: 'Critérios para escolher uma luva de precisão',
            bullets: ['Respirabilidade 360º', 'Durabilidade vs. Preço']
          }
        ]
      },
      {
        title: 'SEMANA 2 - CONTROLE EM AMBIENTE OLEOSO',
        days: [
          {
            day: '09/02 – Segunda-feira',
            platform: 'meta',
            type: 'Carrossel educacional',
            theme: 'O perigo do "efeito sabonete" em peças oleosas'
          },
          {
            day: '10/02 – Terça-feira',
            platform: 'linkedin',
            exclusive: true,
            type: 'Post técnico',
            theme: 'Gestão de risco em ambientes com óleo e graxa'
          },
          {
            day: '11/02 – Quarta-feira',
            platform: 'meta',
            type: 'Vídeo (Reel - Produto)',
            theme: 'Luva: MaxiDry Total',
            bullets: ['Destaque: Banho Total (Roxa/Preta)', 'Feature: Repelência a óleos + GripTech', 'Modelo: 56-426']
          },
          {
            day: '12/02 – Quinta-feira',
            platform: 'linkedin',
            exclusive: true,
            type: 'Texto estratégico',
            theme: 'Como a aderência (Grip) impacta a fadiga muscular'
          },
          {
            day: '13/02 – Sexta-feira',
            platform: 'meta',
            type: 'Estático técnico',
            theme: 'Diferença entre luva "banho palma" e "banho total"'
          },
          {
            day: '13/02 – Sexta-feira',
            platform: 'linkedin',
            repurposed: true,
            type: 'Post adaptado',
            theme: 'MaxiDry Total: Segurança em imersão e manuseio oleoso'
          }
        ]
      },
      {
        title: 'SEMANA 3 - CORTE COM CONFORTO',
        days: [
          {
            day: '16/02 – Segunda-feira',
            platform: 'meta',
            type: 'Carrossel educacional',
            theme: 'Mito: "Luva de corte precisa ser grossa e rígida"'
          },
          {
            day: '17/02 – Terça-feira',
            platform: 'linkedin',
            exclusive: true,
            type: 'Post técnico',
            theme: 'Entendendo a norma EN 388 para riscos mecânicos (Corte TDM)'
          },
          {
            day: '18/02 – Quarta-feira',
            platform: 'meta',
            type: 'Vídeo (Reel - Produto)',
            theme: 'Luva: MaxiCut Ultra',
            bullets: ['Destaque: Proteção Corte Nível 5/C com espessura fina', 'Reforço entre polegar e indicador', 'Modelo: 44-3745']
          },
          {
            day: '19/02 – Quinta-feira',
            platform: 'linkedin',
            exclusive: true,
            type: 'Texto consultivo',
            theme: 'Equilíbrio entre proteção ao corte e destreza fina'
          },
          {
            day: '20/02 – Sexta-feira',
            platform: 'meta',
            type: 'Estático produto + contexto',
            theme: 'Reforço onde você mais precisa: a anatomia da MaxiCut'
          },
          {
            day: '20/02 – Sexta-feira',
            platform: 'linkedin',
            repurposed: true,
            type: 'Post adaptado',
            theme: 'MaxiCut Ultra: A evolução da proteção contra cortes'
          }
        ]
      },
      {
        title: 'SEMANA 4 - ROBUSTEZ E IMPACTO',
        days: [
          {
            day: '23/02 – Segunda-feira',
            platform: 'meta',
            type: 'Carrossel educacional',
            theme: 'Riscos de impacto no dorso da mão: o perigo invisível'
          },
          {
            day: '24/02 – Terça-feira',
            platform: 'linkedin',
            exclusive: true,
            type: 'Texto técnico',
            theme: 'Norma ANSI/ISEA 138: Como avaliar proteção contra impacto'
          },
          {
            day: '25/02 – Quarta-feira',
            platform: 'meta',
            type: 'Vídeo (Reel - Produto)',
            theme: 'Luva: Mack Force',
            bullets: ['Destaque: Proteção contra impacto no dorso', 'Palma antiderrapante', 'Modelo: Cód. 70.300']
          },
          {
            day: '26/02 – Quinta-feira',
            platform: 'linkedin',
            exclusive: true,
            type: 'Post estratégico',
            theme: 'Reduzindo lesões por esmagamento com o EPI correto'
          },
          {
            day: '27/02 – Sexta-feira',
            platform: 'meta',
            type: 'Estático institucional estratégico',
            theme: 'Next Safety: Portfólio completo para riscos mecânicos'
          },
          {
            day: '27/02 – Sexta-feira',
            platform: 'linkedin',
            repurposed: true,
            type: 'Post adaptado',
            theme: 'Conheça a Mack Force: Robusta e Técnica'
          }
        ]
      }
    ]
  },
  {
    month: 'MARÇO 2026',
    theme: 'AUTORIDADE & RISCOS COMPLEXOS',
    objective: 'Aprofundar em luvas para riscos combinados (Químico+Corte, Impacto+Corte) e reforçar a linha NexSafe e Mack.',
    overview: {
      meta: [
        'Segunda: Educacional Complexo',
        'Quarta: Vídeo Produto (Mack, NexSafe, MaxiChem)',
        'Sexta: Técnico'
      ],
      linkedin: [
        'Terça/Quinta: Normas e Gestão',
        'Sexta: Adaptação'
      ]
    },
    results: [
      'Demonstração de portfólio robusto',
      'Solução para riscos mistos',
      'Posicionamento de especialista'
    ],
    weeks: [
      {
        title: 'SEMANA 1 - TRABALHO PESADO COM PRECISÃO',
        days: [
          {
            day: '02/03 – Segunda-feira',
            platform: 'meta',
            type: 'Carrossel técnico',
            theme: 'Diferença entre luva de raspa comum e luva técnica de couro sintético'
          },
          {
            day: '03/03 – Terça-feira',
            platform: 'linkedin',
            exclusive: true,
            type: 'Texto técnico',
            theme: 'Modernizando a proteção em ambientes de construção e montagem pesada'
          },
          {
            day: '04/03 – Quarta-feira',
            platform: 'meta',
            type: 'Vídeo (Reel - Produto)',
            theme: 'Luva: Mack Driller',
            bullets: ['Destaque: Palma em couro sintético', 'Proteção Anti-Impacto', 'Modelo: Cód. 70.900']
          },
          {
            day: '05/03 – Quinta-feira',
            platform: 'linkedin',
            exclusive: true,
            type: 'Post estratégico',
            theme: 'Substituindo luvas tradicionais por tecnologias de alta performance'
          },
          {
            day: '06/03 – Sexta-feira',
            platform: 'meta',
            type: 'Estático institucional',
            theme: 'Linha Mack: Força bruta com inteligência técnica'
          },
          {
            day: '06/03 – Sexta-feira',
            platform: 'linkedin',
            repurposed: true,
            type: 'Post adaptado',
            theme: 'Mack Driller em ação: aplicações reais'
          }
        ]
      },
      {
        title: 'SEMANA 2 - CUSTO-BENEFÍCIO EM CORTE',
        days: [
          {
            day: '09/03 – Segunda-feira',
            platform: 'meta',
            type: 'Carrossel educacional',
            theme: 'Como democratizar a proteção ao corte na sua fábrica'
          },
          {
            day: '10/03 – Terça-feira',
            platform: 'linkedin',
            exclusive: true,
            type: 'Post técnico',
            theme: 'Gestão de budget em EPIs: Onde investir mais, onde economizar com inteligência'
          },
          {
            day: '11/03 – Quarta-feira',
            platform: 'meta',
            type: 'Vídeo (Reel - Produto)',
            theme: 'Luva: NexSafe Alpha 2',
            bullets: ['Destaque: Nitrílico Sand Finish', 'Proteção Corte com Grip excelente', 'Modelo: Cód. 32.500']
          },
          {
            day: '12/03 – Quinta-feira',
            platform: 'linkedin',
            exclusive: true,
            type: 'Texto consultivo',
            theme: 'NexSafe: A resposta da Next Safety para o mercado brasileiro'
          },
          {
            day: '13/03 – Sexta-feira',
            platform: 'meta',
            type: 'Estático técnico',
            theme: 'Entendendo o revestimento "Sand Finish" (Acabamento Areia)'
          },
          {
            day: '13/03 – Sexta-feira',
            platform: 'linkedin',
            repurposed: true,
            type: 'Post adaptado',
            theme: 'Conheça a NexSafe Alpha 2'
          }
        ]
      },
      {
        title: 'SEMANA 3 - QUÍMICA + CORTE (RISCO DUPLO)',
        days: [
          {
            day: '16/03 – Segunda-feira',
            platform: 'meta',
            type: 'Carrossel educacional',
            theme: 'O desafio dos riscos combinados: Corte e Química juntos'
          },
          {
            day: '17/03 – Terça-feira',
            platform: 'linkedin',
            exclusive: true,
            type: 'Texto técnico',
            theme: 'Análise de compatibilidade química e resistência mecânica simultânea'
          },
          {
            day: '18/03 – Quarta-feira',
            platform: 'meta',
            type: 'Vídeo (Reel - Produto)',
            theme: 'Luva: MaxiChem Cut',
            bullets: ['Destaque: Proteção Química Tipo A + Corte', 'Tecnologia TRItech (3 camadas)', 'Modelo: 76.100']
          },
          {
            day: '19/03 – Quinta-feira',
            platform: 'linkedin',
            exclusive: true,
            type: 'Post analítico',
            theme: 'Por que usar duas luvas (sobreposição) quando você pode usar uma MaxiChem Cut?'
          },
          {
            day: '20/03 – Sexta-feira',
            platform: 'meta',
            type: 'Estático institucional técnico',
            theme: 'Simplificando o EPI sem reduzir a segurança'
          },
          {
            day: '20/03 – Sexta-feira',
            platform: 'linkedin',
            repurposed: true,
            type: 'Post adaptado',
            theme: 'MaxiChem Cut: A solução para riscos mistos'
          }
        ]
      },
      {
        title: 'SEMANA 4 - AMBIENTE ÚMIDO/OLEOSO',
        days: [
          {
            day: '23/03 – Segunda-feira',
            platform: 'meta',
            type: 'Carrossel educacional',
            theme: 'Dermatites de contato por óleos solúveis: como evitar'
          },
          {
            day: '24/03 – Terça-feira',
            platform: 'linkedin',
            exclusive: true,
            type: 'Texto técnico',
            theme: 'Vedação contra líquidos vs. Saúde da pele'
          },
          {
            day: '25/03 – Quarta-feira',
            platform: 'meta',
            type: 'Vídeo (Reel - Produto)',
            theme: 'Luva: MaxiDry Plus',
            bullets: ['Destaque: Punho longo para proteção extra', 'Impermeável a óleos', 'Modelo: 56-530']
          },
          {
            day: '26/03 – Quinta-feira',
            platform: 'linkedin',
            exclusive: true,
            type: 'Post estratégico',
            theme: 'A importância do punho de segurança em imersão parcial'
          },
          {
            day: '27/03 – Sexta-feira',
            platform: 'meta',
            type: 'Estático estratégico',
            theme: 'Linha MaxiDry: Mantendo o contaminante fora da luva'
          },
          {
            day: '27/03 – Sexta-feira',
            platform: 'linkedin',
            repurposed: true,
            type: 'Post adaptado',
            theme: 'MaxiDry Plus em detalhes'
          }
        ]
      }
    ]
  },
  {
    month: 'ABRIL 2026',
    theme: 'INOVAÇÃO & ESPECIALIDADES (PROTEMINAS)',
    objective: 'Focar em produtos inovadores e específicos durante o mês da feira Proteminas. Destaque para MaxiDex (Vírus) e PuraChem.',
    overview: {
      meta: [
        'Segunda: Tendências',
        'Quarta: Vídeo Produto (MaxiDex, PuraChem, Especialidades)',
        'Sexta: Feira/Institucional'
      ],
      linkedin: [
        'Terça/Quinta: Inovação e Feiras',
        'Sexta: Adaptação'
      ]
    },
    results: [
      'Imagem de inovação',
      'Atração para estande (físico/virtual)',
      'Destaque para produtos únicos'
    ],
    weeks: [
      {
        title: 'SEMANA 1 - QUÍMICA ESPECÍFICA',
        days: [
          {
            day: '01/04 – Quarta-feira',
            platform: 'meta',
            type: 'Vídeo (Reel - Produto)',
            theme: 'Luva: PuraChem Latex Neoprene',
            bullets: ['Destaque: Mix de materiais para proteção ampliada', 'Proteção Química Tipo A', 'Modelo: Cód. 10.700']
          },
          {
            day: '02/04 – Quinta-feira',
            platform: 'linkedin',
            exclusive: true,
            type: 'Post técnico',
            theme: 'Neoprene + Látex: Quando essa combinação é a ideal?'
          },
          {
            day: '03/04 – Sexta-feira',
            platform: 'meta',
            type: 'Estático técnico',
            theme: 'Interpretando a tabela de permeação química'
          },
          {
            day: '03/04 – Sexta-feira',
            platform: 'linkedin',
            repurposed: true,
            type: 'Post adaptado',
            theme: 'PuraChem Latex Neoprene: Detalhes técnicos'
          }
        ]
      },
      {
        title: 'SEMANA 2 - INOVAÇÃO TOTAL (VÍRUS/TOUCH)',
        days: [
          {
            day: '06/04 – Segunda-feira',
            platform: 'meta',
            type: 'Carrossel educacional',
            theme: 'O que é a norma ISO 374-5 (Vírus e Bactérias)'
          },
          {
            day: '07/04 – Terça-feira',
            platform: 'linkedin',
            exclusive: true,
            type: 'Post técnico',
            theme: 'Inovação em EPI: Proteção biológica integrada ao tecido'
          },
          {
            day: '08/04 – Quarta-feira',
            platform: 'meta',
            type: 'Vídeo (Reel - Produto)',
            theme: 'Luva: MaxiDex',
            bullets: ['Destaque: Tecnologia Virosan (Antiviral)', 'Touchscreen total e destreza extrema', 'Modelo: 19-007']
          },
          {
            day: '09/04 – Quinta-feira',
            platform: 'linkedin',
            exclusive: true,
            type: 'Texto estratégico',
            theme: 'MaxiDex: O primeiro EPI híbrido (Mecânico + Biológico + Conforto)'
          },
          {
            day: '10/04 – Sexta-feira',
            platform: 'meta',
            type: 'Estático institucional',
            theme: 'Next Safety na Proteminas: Venha conhecer a MaxiDex'
          },
          {
            day: '10/04 – Sexta-feira',
            platform: 'linkedin',
            repurposed: true,
            type: 'Post adaptado',
            theme: 'A revolução MaxiDex'
          }
        ]
      },
      {
        title: 'SEMANA 3 - PROTEMINAS (GRIP + CORTE)',
        days: [
          {
            day: '13/04 – Segunda-feira',
            platform: 'meta',
            type: 'Estático pré-evento',
            theme: 'Estamos na Proteminas! Foco em tecnologia.'
          },
          {
            day: '14/04 – Terça-feira',
            platform: 'linkedin',
            exclusive: true,
            type: 'Post institucional estratégico',
            theme: 'O setor de SST se encontra na Proteminas'
          },
          {
            day: '15/04 – Quarta-feira',
            platform: 'meta',
            type: 'Vídeo (Reel - Produto)',
            theme: 'Luva: MaxiCut Ultra DT 3/4',
            bullets: ['Destaque: Banho 3/4 para maior proteção', 'Dots (pontos) na palma para Grip extremo', 'Modelo: 44-3445']
          },
          {
            day: '16/04 – Quinta-feira',
            platform: 'linkedin',
            exclusive: true,
            type: 'Texto técnico',
            theme: 'A função dos "Dots" (pontos) na aderência e durabilidade'
          },
          {
            day: '17/04 – Sexta-feira',
            platform: 'meta',
            type: 'Estático institucional',
            theme: 'Resumo da Proteminas: O que o mercado está buscando?'
          },
          {
            day: '17/04 – Sexta-feira',
            platform: 'linkedin',
            repurposed: true,
            type: 'Post adaptado',
            theme: 'MaxiCut Ultra DT 3/4: Grip e Proteção'
          }
        ]
      },
      {
        title: 'SEMANA 4 - DURABILIDADE CLÁSSICA',
        days: [
          {
            day: '20/04 – Segunda-feira',
            platform: 'meta',
            type: 'Carrossel educacional',
            theme: 'Durabilidade x Sustentabilidade: Usar mais tempo é poluir menos'
          },
          {
            day: '21/04 – Terça-feira',
            platform: 'linkedin',
            exclusive: true,
            type: 'Post técnico',
            theme: 'Análise de ciclo de vida de uma luva nitrílica'
          },
          {
            day: '22/04 – Quarta-feira',
            platform: 'meta',
            type: 'Vídeo (Reel - Produto)',
            theme: 'Luva: MaxiFlex Endurance',
            bullets: ['Destaque: Pigmentos nitrílicos para alta abrasão', 'Durabilidade estendida', 'Modelo: 42-844']
          },
          {
            day: '23/04 – Quinta-feira',
            platform: 'linkedin',
            exclusive: true,
            type: 'Texto estratégico',
            theme: 'Reduzindo o descarte de EPIs com luvas de alta durabilidade (Endurance)'
          },
          {
            day: '24/04 – Sexta-feira',
            platform: 'meta',
            type: 'Estático institucional',
            theme: 'Next Safety: Soluções que duram mais'
          },
          {
            day: '24/04 – Sexta-feira',
            platform: 'linkedin',
            repurposed: true,
            type: 'Post adaptado',
            theme: 'Conheça a MaxiFlex Endurance'
          }
        ]
      },
      {
        title: 'SEMANA 5',
        days: [
          {
            day: '27/04 – Segunda-feira',
            platform: 'meta',
            type: 'Carrossel institucional',
            theme: 'Fechando abril: Inovação e Durabilidade'
          },
          {
            day: '28/04 – Terça-feira',
            platform: 'linkedin',
            exclusive: true,
            type: 'Post de transição',
            theme: 'Preparando o terreno para Maio: Mês da Indústria e SST'
          }
        ]
      }
    ]
  },
  {
    month: 'MAIO 2026',
    theme: 'SST EM FOCO + TEASER FISP #1',
    objective: 'Mês forte de SST. Introduzir o primeiro teaser da FISP de forma analítica (sem TBT clichê). Introduzir MaxiFlex Cut.',
    overview: {
      meta: [
        'Segunda: SST Geral',
        'Quarta: Vídeo Produto (MaxiFlex Cut)',
        'Sexta: Teaser FISP / Inst.'
      ],
      linkedin: [
        'Terça/Quinta: Análise de Mercado',
        'Sexta: Adaptação'
      ]
    },
    results: [
      'Autoridade máxima em SST',
      'Início da narrativa FISP',
      'Foco na MaxiFlex Cut'
    ],
    weeks: [
      {
        title: 'SEMANA 1 - TEASER FISP (EVOLUÇÃO)',
        days: [
          {
            day: '01/05 – Sexta-feira',
            platform: 'meta',
            type: 'Estático Especial (FISP Teaser)',
            theme: 'A evolução da segurança: O que mudou desde a última FISP?',
            bullets: ['Comparativo técnico 2024 vs 2026', 'Nada de "TBT", foco em evolução']
          },
          {
            day: '01/05 – Sexta-feira',
            platform: 'linkedin',
            repurposed: true,
            type: 'Post adaptado',
            theme: 'Trajetória da tecnologia de proteção: Rumo à FISP 2026'
          }
        ]
      },
      {
        title: 'SEMANA 2 - PRECISÃO COM CORTE',
        days: [
          {
            day: '04/05 – Segunda-feira',
            platform: 'meta',
            type: 'Carrossel educacional',
            theme: 'Por que o risco de corte aumentou na indústria moderna?'
          },
          {
            day: '06/05 – Quarta-feira',
            platform: 'meta',
            type: 'Vídeo (Reel - Produto)',
            theme: 'Luva: MaxiFlex Cut 3/4',
            bullets: ['Destaque: Proteção ao corte mantendo a destreza da MaxiFlex', 'Banho 3/4 para proteção dorso parcial', 'Modelo: 34-8753']
          },
          {
            day: '08/05 – Sexta-feira',
            platform: 'meta',
            type: 'Estático técnico',
            theme: 'Unindo o mundo da Precisão com o mundo do Corte (MaxiFlex Cut)'
          }
        ]
      },
      {
        title: 'SEMANA 3 - PREVENSUL AQUECIMENTO',
        days: [
          {
            day: '13/05 – Quarta-feira',
            platform: 'meta',
            type: 'Vídeo (IA - Conceito)',
            theme: 'SST no Sul do Brasil: Preparando para a PrevenSul'
          },
          {
            day: '15/05 – Sexta-feira',
            platform: 'meta',
            type: 'Estático Institucional',
            theme: 'Next Safety na estrada: Levando tecnologia para todos os polos'
          }
        ]
      },
      {
        title: 'SEMANA 4 - CULTURA DE SEGURANÇA',
        days: [
          {
            day: '20/05 – Quarta-feira',
            platform: 'meta',
            type: 'Vídeo (Reel - Aplicação)',
            theme: 'Cultura de segurança: Quando o EPI é desejado pelo usuário'
          },
          {
            day: '22/05 – Sexta-feira',
            platform: 'meta',
            type: 'Estático',
            theme: 'O papel da Next Safety na educação do mercado'
          }
        ]
      },
      {
        title: 'SEMANA 5 - EVENTOS',
        days: [
          {
            day: '27/05 – Quarta-feira',
            platform: 'meta',
            type: 'Vídeo (Cobertura)',
            theme: 'Cobertura PrevenSul: Destaques técnicos'
          }
        ]
      }
    ]
  },
  {
    month: 'JUNHO 2026',
    theme: 'CONSOLIDAÇÃO & TEASER FISP #2',
    objective: 'Manter a régua técnica alta e soltar o segundo teaser da FISP, focado em normativa ou tendência de mercado.',
    overview: {
      meta: [
        'Foco: Exposeg, Pós-evento, Teaser FISP 2'
      ],
      linkedin: [
        'Foco: Análise técnica'
      ]
    },
    results: [
      'Marca sólida',
      'Expectativa para FISP criada sutilmente'
    ],
    weeks: [
      {
        title: 'SEMANA 1 - EXPOSEG',
        days: [
          {
            day: '03/06 – Quarta-feira',
            platform: 'meta',
            type: 'Vídeo (Cobertura/Conceito)',
            theme: 'Exposeg: O termômetro do mercado de segurança'
          }
        ]
      },
      {
        title: 'SEMANA 2 - TEASER FISP (NORMATIVAS)',
        days: [
          {
            day: '10/06 – Quarta-feira',
            platform: 'meta',
            type: 'Vídeo (Reel - Educativo)',
            theme: 'O que mudou nas normas de luvas desde a última FISP?',
            bullets: ['Análise técnica evolutiva', 'Preparação de terreno para outubro']
          }
        ]
      },
      {
        title: 'SEMANA 3 - REFORÇO MACK',
        days: [
          {
            day: '17/06 – Quarta-feira',
            platform: 'meta',
            type: 'Vídeo (Reel - Produto)',
            theme: 'Luva: Mack Force (Reforço)',
            bullets: ['Foco em durabilidade extrema', 'Review técnico pós-uso']
          }
        ]
      },
      {
        title: 'SEMANA 4 - REFORÇO QUÍMICO',
        days: [
          {
            day: '24/06 – Quarta-feira',
            platform: 'meta',
            type: 'Vídeo (Reel - Produto)',
            theme: 'Luva: PuraChem (Reforço)',
            bullets: ['Foco em manuseio químico seguro']
          }
        ]
      }
    ]
  }
  // Os demais meses (Julho a Dezembro) seguem a lógica macro definida no ANNUAL_PLAN, 
  // mas detalhamos profundamente até Junho conforme a necessidade imediata de produção.
];

export const AD_SETS: AdSetData[] = [];
