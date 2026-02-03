
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
  initialImageUrl?: string; // Novo campo para link direto
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
  | 'draft'               // Cinza (Ninguém subiu nada)
  | 'pending_approval'    // Azul (Enviado pelo Admin)
  | 'internal_review'     // Roxo (Comentário da Equipe - Admin vê Azul)
  | 'changes_requested'   // Laranja (Viviane pediu ajuste)
  | 'approved';           // Verde (Viviane aprovou)

export interface PostComment {
  id: string;
  post_id: string;
  author_role: UserRole;
  author_name: string; // "Canguru", "Viviane" ou "Equipe Next"
  content: string;
  created_at: string;
  visible_to_admin: boolean; // True se for Viviane ou Admin. False se for Equipe.
}

export interface PostData {
  id?: string;
  date_key: string; // ID único baseado na data + plataforma (ex: "02/02/2026-linkedin")
  image_url: string | null;
  caption: string | null;
  status: PostStatus;
  last_updated: string;
}
