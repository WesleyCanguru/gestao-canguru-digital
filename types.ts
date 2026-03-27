
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
  deliverables?: string[];
  takeaways?: string[];
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
  author_name: string; // "Canguru", "Wesley" ou "Equipe Canguru"
  content: string;
  created_at: string;
  visible_to_admin: boolean; // True se for Wesley ou Admin. False se for Equipe.
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
  linkedin?: string | null;
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
  created_at?: string;
}

// --- NOVOS TIPOS PARA GESTÃO DA AGÊNCIA ---

export interface AgencyBilling {
  id: string;
  client_id: string;
  month_year: string; // YYYY-MM
  base_value: number;
  extra_value: number;
  total_value: number;
  due_day: number;
  status: 'paid' | 'pending' | 'overdue';
  notes: string | null;
  paid_at: string | null;
  created_at: string;
  client?: Client;
}

export interface AgencyExpense {
  id: string;
  description: string;
  category: 'fixed' | 'variable';
  amount: number;
  month_year: string; // YYYY-MM
  created_at: string;
}

export type LeadStage = 'lead' | 'first_message' | 'in_conversation' | 'followup_1' | 'followup_2' | 'farewell' | 'converted' | 'lost';

export interface Lead {
  id: string;
  name: string;
  niche: string;
  instagram_url: string;
  instagram_bio: string | null;
  meta_ads_active: 'yes' | 'no';
  posting_frequency: 'none' | '1-2x' | '3-4x' | 'daily' | 'multiple';
  website_url: string | null;
  meta_pixel_installed: 'yes' | 'no' | 'dont_know';
  google_tag_installed: 'yes' | 'no' | 'dont_know';
  preferred_communication: 'whatsapp' | 'instagram_dm' | 'email';
  observations: string | null;
  kanban_stage: LeadStage;
  next_followup_date: string | null;
  stage_changed_at: string;
  created_at: string;
}

export type QuickLinkType = 'google_ads' | 'meta_ads' | 'reportei' | 'instagram' | 'other';

export interface ClientQuickLink {
  id: string;
  client_id: string;
  type: QuickLinkType;
  label: string;
  url: string;
  created_at: string;
}
