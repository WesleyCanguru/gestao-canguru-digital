-- Estratégia como página pública (link para o grupo do WhatsApp), com registro de abertura e aprovação na página.
alter table public.client_strategies
  add column if not exists public_token text,
  add column if not exists open_count integer not null default 0,
  add column if not exists first_opened_at timestamptz,
  add column if not exists last_opened_at timestamptz,
  add column if not exists read_seconds integer not null default 0,
  add column if not exists responded_via text,
  add column if not exists responded_name text;

update public.client_strategies set public_token = replace(gen_random_uuid()::text, '-', '') where public_token is null;
alter table public.client_strategies alter column public_token set default replace(gen_random_uuid()::text, '-', '');
alter table public.client_strategies alter column public_token set not null;
create unique index if not exists client_strategies_public_token_key on public.client_strategies(public_token);

create table if not exists public.strategy_events (
  id uuid primary key default gen_random_uuid(),
  strategy_id uuid not null references public.client_strategies(id) on delete cascade,
  agency_id integer not null,
  event_type text not null check (event_type in ('open','read_time','whatsapp_click','approved','changes')),
  session_id text,
  seconds integer,
  detail text,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists strategy_events_strategy_idx on public.strategy_events(strategy_id, event_type);

alter table public.strategy_events enable row level security;
create policy strategy_events_staff_read on public.strategy_events
  for select to authenticated using (public.i_am_staff_of(agency_id));
-- Escrita só pela função strategy-page (service role).
