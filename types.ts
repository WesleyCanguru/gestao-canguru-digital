
export type AdFormat = 'story' | 'feed';

export interface AdSetData {
  id: string;
  title: string;
  objective: string;
  format: string;
  status: 'approved' | 'review' | 'draft';
  content: {
    headline: string;
    primaryText: string;
    cta: string;
    targetAudience: string;
  };
  mockupData: {
    type: AdFormat;
    mainImage?: string;
    secondaryImage?: string;
    title?: string;
    subtitle?: string;
    tagline?: string;
    stats?: {
      leftValue: string;
      leftLabel: string;
      rightValue: string;
      rightLabel: string;
    };
  };
}

export type MonthColor = 'blue' | 'yellow' | 'red' | 'green';

export interface EventData {
  name: string;
  date: string;
  description?: string;
}

export interface MonthPlan {
  month: string;
  title: string;
  function: string;
  color: MonthColor;
  events?: EventData[];
  deliverables: string[];
  takeaways: string[];
}

export interface AnnualStrategy {
  northStar: {
    title: string;
    description: string;
  };
  months: MonthPlan[];
  benefits: string[];
}

export interface DayAnalysis {
  day: string;
  reason: string[];
}

export interface PlatformStrategy {
  id: 'meta' | 'linkedin';
  name: string;
  schedule: string;
  description: string;
  bestDays: DayAnalysis[];
  tip?: string;
}

export interface WeeklyScheduleRow {
  day: string;
  platforms: string;
  content: string;
}

export interface DailyContent {
  day: string;
  platform: 'meta' | 'linkedin';
  type: string;
  theme: string;
  bullets?: string[];
  exclusive?: boolean;
  repurposed?: boolean;
  initialImageUrl?: string | string[]; // Novo campo para link direto
}

export interface WeeklyContent {
  title: string;
  days: DailyContent[];
}

export interface MonthlyDetailedPlan {
  month: string;
  theme: string;
  objective: string;
  overview: {
    meta: string[];
    linkedin: string[];
  };
  weeks: WeeklyContent[];
  results: string[];
}

// --- NOVOS TIPOS PARA APLICAÇÃO DINÂMICA ---

export type UserRole = 'admin' | 'approver' | 'team';

export type PostStatus = 
  | 'draft'               // Cinza (Em Produção)
  | 'pending_approval'    // Laranja (Em Aprovação)
  | 'changes_requested'   // Vermelho (Ajustes Solicitados)
  | 'internal_review'     // Deprecated (Mantido por segurança)
  | 'scheduled'           // Roxo (Programado)
  | 'approved'            // Azul (Aprovado e pronto)
  | 'published'           // Verde (Publicado)
  | 'deleted';            // Removido (Lógica para ocultar posts estáticos)

export interface PostComment {
  id: string;
  post_id: string;
  author_role: UserRole;
  author_name: string; // "Canguru", "Viviane" ou "Equipe Canguru"
  content: string;
  created_at: string;
  visible_to_admin: boolean; // True se for Viviane ou Admin. False se for Equipe.
}

export interface PostData {
  id?: string;
  client_id: string;
  date_key: string; // ID único baseado na data + plataforma (ex: "02-02-2026-linkedin")
  image_url: string | string[] | null;
  caption: string | null;
  status: PostStatus;
  last_updated: string;
  
  // Overrides do Planejamento (Editáveis pelo Admin)
  theme?: string;
  type?: string;
  bullets?: string[];
}

export interface Client {
  id: string;
  name: string;
  segment: string | null;
  responsible: string | null;
  email: string | null;
  instagram: string | null;
  color: string;
  initials: string;
  logo_url: string | null;
  is_active: boolean;
  services: string[];
  social_networks: string[];
  traffic_platforms: string[];
  reportei_url?: string | null;
  organic_reportei_url?: string | null;
  paid_reportei_url?: string | null;
  onboarding_completed?: boolean;
}
