
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
  platform: 'meta' | 'linkedin' | 'tiktok';
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
  | 'pending_approval'    // Laranja (Esperando Aprovação)
  | 'changes_requested'   // Amarelo (Ajustes Solicitados)
  | 'rejected'            // Vermelho Escuro (Reprovado)
  | 'internal_review'     // Deprecated (Mantido por segurança)
  | 'scheduled'           // Roxo (Programado)
  | 'approved'            // Azul (Aprovado)
  | 'published'           // Verde (Publicado)
  | 'deleted'             // Removido (Lógica para ocultar posts estáticos)
  | 'theme_pending'
  | 'theme_rejected'
  | 'theme_approved_with_notes'
  | 'theme_approved';

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
  agency_id?: number;
  image_url: string | string[] | null;
  caption: string | null;
  status: PostStatus;
  last_updated: string;
  scheduled_time?: string | null;
  
  // Overrides do Planejamento (Editáveis pelo Admin)
  theme?: string;
  type?: string;
  bullets?: string[];
  video_thumbnail_url?: string | null;

  // Novos campos de aprovação de Tema
  theme_title?: string | null;
  theme_description?: string | null;
  theme_rejection_reason?: string | null;
  theme_client_notes?: string | null;
}

export interface TrafficStrategyData {
  kpis: {
    monthlyBudget: string;
    budgetDetails: string;
    priorityGoal: string;
    goalDetails: string;
    averageTicket: string;
    ticketDetails: string;
  };
  strategicDecision: {
    title: string;
    items: {
      title: string;
      description: string;
      color: string;
    }[];
  };
  campaignStructure: {
    title: string;
    sets: {
      id: string;
      name: string;
      destination: string;
      destinationUrl: string;
      audience: string;
      keywords: string[];
      preFilledMessage: string;
    }[];
  };
  phase2: {
    title: string;
    description: string;
    campaigns: {
      title: string;
      areas: string;
      budget: string;
    }[];
  };
  alert: {
    title: string;
    message: string;
  };
}

export interface ClientFolder {
  id: string;
  client_id: string;
  parent_id: string | null;
  name: string;
  created_at: string;
}

export interface Client {
  id: string;
  name: string;
  segment: string | null;
  responsible: string | null;
  email: string | null;
  instagram: string | null;
  linkedin?: string | null;
  tiktok?: string | null;
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
  drive_link?: string | null;
  agency_id?: number;
  onboarding_completed?: boolean;
  briefings_waived?: boolean;
  base_value?: number;
  due_day?: number;
  created_at?: string;
  traffic_strategy_data?: TrafficStrategyData | null;
  features_settings?: Record<string, any> | null;
  client_type?: 'recurring' | 'one_time';
  client_status?: 'active' | 'cancelled' | 'completed';
  service_end_date?: string | null;
  cancelled_at?: string | null;
  last_payment_date?: string | null;
  last_payment_value?: number | null;
}

export interface PostTheme {
  id: string;
  client_id: string;
  agency_id: number;
  date: string;
  theme_1: string;
  format_1: string;
  theme_2?: string;
  format_2?: string;
  status: string;
  client_comment?: string;
  reviewed_at?: string;
  reviewed_by?: string;
  created_at: string;
}

export interface PostIdea {
  id: string;
  client_id: string;
  month: string;
  theme: string;
  date: string | null;
  format: string | null;
  created_at: string;
  created_by_name?: string | null;
  created_by_role?: string | null;
}

// --- NOVOS TIPOS PARA GESTÃO DA AGÊNCIA ---

export interface AgencyBilling {
  id: string;
  client_id?: string | null;
  agency_id: number;
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
  is_sporadic?: boolean;
  sporadic_name?: string | null;
}

export interface AgencyExpense {
  id: string;
  description: string;
  category: 'fixed' | 'variable';
  expense_type?: 'tools' | 'freelancers' | 'extras';
  agency_id: number;
  amount: number;
  month_year: string; // YYYY-MM
  due_date?: string | null; // DATE
  paid: boolean;
  paid_at: string | null; // TIMESTAMPTZ
  notes?: string | null;
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

export interface ClientLeadConfig {
  id: string;
  client_id: string;
  is_enabled: boolean;
  location_options: string[];
  kanban_stages?: string[];
  specialty_options?: string[];
  created_at: string;
  updated_at: string;
}

export interface ClientLead {
  id: string;
  client_id: string;
  lead_date: string;
  origin: string;
  lead_name?: string;
  phone?: string;
  source?: string;
  specialty?: string;
  potential?: 'alto' | 'medio' | 'baixo' | null;
  kanban_stage?: string;
  position: number;
  loss_reason?: string;
  quality: 'bom' | 'ruim';
  quote_sent: boolean;
  closed: boolean;
  deal_value: number;
  notes: string | null;
  closed_at?: string | null;
  created_at: string;
}

export type QuickLinkType = 'google_ads' | 'meta_ads' | 'reportei' | 'instagram' | 'other';

export interface ContractForm {
  id: string;
  client_id: string;
  agency_id: number;
  form_token: string;
  status: 'pending' | 'submitted' | 'signed';
  submitted_at: string | null;
  signed_at?: string | null;
  signed_contract_url?: string | null;
  contract_value?: number | null;
  contract_start_date?: string | null;
  form_data: any;
  created_at: string;
}

export interface ClientQuickLink {
  id: string;
  client_id: string;
  agency_id: number;
  type: QuickLinkType;
  label: string;
  url: string;
  sort_order?: number;
  created_at: string;
}

// --- NOVOS TIPOS PARA CRM DA AGÊNCIA ---

export interface KanbanStage {
  id: string;
  name: string;
  color: string;
  auto_advance_days: number | null;
}

export interface FormField {
  key: string;
  label: string;
  type: 'text' | 'select' | 'textarea';
  required: boolean;
  options?: string[];
  placeholder?: string;
}

export interface AgencyCRM {
  id: string;
  name: string;
  description: string | null;
  kanban_stages: KanbanStage[];
  form_fields: FormField[];
  auto_advance_time: string;
  position: number;
  agency_id: number;
  created_at: string;
}

export interface AgencyLead {
  id: string;
  crm_id: string;
  agency_id: number;
  name: string;
  stage: string;
  stage_entered_at: string;
  next_stage_at: string | null;
  auto_advance_paused: boolean;
  kanban_position: number;
  loss_reason: string | null;
  deal_value?: number | null;
  stage_changed_at?: string;
  form_data: Record<string, any>;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// --- NOVOS TIPOS PARA ONBOARDING DA AGÊNCIA ---
export interface OnboardingTemplate {
  id: string;
  agency_id: number;
  phase: number;
  phase_name: string;
  title: string;
  description: string | null;
  required_services: string[];
  position: number;
  is_active: boolean;
  parent_id?: string | null;
  created_at: string;
}

export interface OnboardingChecklist {
  id: string;
  client_id: string;
  agency_id: number;
  phase: number;
  phase_name: string;
  title: string;
  description: string | null;
  is_completed: boolean;
  completed_at: string | null;
  position: number;
  parent_id?: string | null;
  created_at: string;
}

export interface ClientBriefing {
  id: string;
  client_id: string;
  agency_id: number;
  briefing_type: string;
  responses: Record<string, any>;
  is_completed: boolean;
  completed_at: string | null;
  created_at: string;
}

// --- NOVOS TIPOS PARA TAREFAS DA AGÊNCIA ---

export type AgencyTaskPriority = 'urgente' | 'alta' | 'normal' | 'baixa';
export type AgencyTaskStatus = 'pending' | 'completed';
export type AgencyTaskRecurrenceType = 'none' | 'daily' | 'weekly' | 'monthly' | 'custom_days';

export interface AgencyTask {
  id: string;
  client_id?: string | null;
  title: string;
  description?: string;
  priority: AgencyTaskPriority;
  status: AgencyTaskStatus;
  due_date?: string | null;
  is_daily: boolean;
  recurrence_type: AgencyTaskRecurrenceType;
  recurrence_days?: string[] | null;
  agency_id: number;
  created_at: string;
  completed_at?: string | null;
  client?: { id: string; name: string; color: string; initials: string };
  position?: number;
  sort_order?: number | null;
}

export type ProcessResponsible = 'wesley' | 'sarah' | 'client';
export type ProcessStatus = 'active' | 'completed' | 'paused';

export interface ProcessTemplate {
  id: string;
  agency_id: number;
  process_type: string;
  process_name: string;
  service: string | null;
  title: string;
  description: string | null;
  responsible: ProcessResponsible;
  position: number;
  parent_id: string | null;
  is_active: boolean;
}

export interface ProcessInstance {
  id: string;
  agency_id: number;
  client_id: string;
  process_type: string;
  process_name: string;
  status: ProcessStatus;
  created_at: string;
  completed_at: string | null;
  client?: { id: string; name: string; color: string; initials: string };
  total_etapas?: number;
  etapas_concluidas?: number;
}

export interface ProcessChecklist {
  id: string;
  instance_id: string;
  client_id: string;
  agency_id: number;
  title: string;
  description: string | null;
  responsible: ProcessResponsible;
  is_completed: boolean;
  completed_at: string | null;
  position: number;
  parent_id: string | null;
  created_at: string;
}

