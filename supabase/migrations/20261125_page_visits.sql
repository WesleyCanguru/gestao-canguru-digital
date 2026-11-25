-- Visitas das páginas comerciais com portão de nome (ex.: /advocacia). APLICADA em 25/11/2026.
-- Grava só pela função page-track (service role). Equipe lê pela política staff_read.
create table if not exists public.page_visits (
  id bigint generated always as identity primary key,
  agency_id integer not null default 1,
  page_slug text not null,
  visitor_id text not null,
  visitor_name text,
  session_id text not null,
  event_type text not null check (event_type in ('open','read_time','whatsapp_click')),
  seconds integer,
  visit_number integer,
  notified_seconds integer not null default 0,
  user_agent text,
  city text, region text, country text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists page_visits_page_idx on public.page_visits (page_slug, created_at desc);
create index if not exists page_visits_visitor_idx on public.page_visits (visitor_id, event_type);
create unique index if not exists page_visits_session_event_uq on public.page_visits (session_id, event_type) where event_type in ('open','read_time');
alter table public.page_visits enable row level security;
create policy staff_read on public.page_visits for select using (agency_id = any (app.staff_agencies()));
