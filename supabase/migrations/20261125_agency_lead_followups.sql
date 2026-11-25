-- Histórico de follow-ups dos leads do CRM da agência.
-- Cada linha = um follow-up feito (ou pulado) numa etapa. A cadência fica em agency_crms.kanban_stages[].followup.
create table if not exists public.agency_lead_followups (
  id uuid primary key default gen_random_uuid(),
  agency_id integer not null,
  crm_id uuid not null references public.agency_crms(id) on delete cascade,
  lead_id uuid not null references public.agency_leads(id) on delete cascade,
  stage text not null,
  step integer not null,
  outcome text not null default 'feito' check (outcome in ('feito', 'pulado')),
  note text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists agency_lead_followups_crm_idx on public.agency_lead_followups (crm_id);
create index if not exists agency_lead_followups_lead_idx on public.agency_lead_followups (lead_id);
alter table public.agency_lead_followups enable row level security;
drop policy if exists staff_all on public.agency_lead_followups;
create policy staff_all on public.agency_lead_followups for all to authenticated
  using (agency_id = any (app.staff_agencies()))
  with check (agency_id = any (app.staff_agencies()));
