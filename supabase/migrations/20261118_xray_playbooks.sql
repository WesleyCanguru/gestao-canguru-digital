-- Raio-X do cliente (coleta automática antes da estratégia) e playbooks dos agentes.
-- Aditiva: não mexe em nada existente.
create table if not exists public.client_audits (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  agency_id integer not null references public.agencies(id),
  kind text not null default 'xray',
  website text,
  data jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists client_audits_client_idx on public.client_audits (client_id, created_at desc);
alter table public.client_audits enable row level security;
drop policy if exists client_audits_staff_read on public.client_audits;
create policy client_audits_staff_read on public.client_audits
  for select to authenticated using (public.i_am_staff_of(agency_id));

-- Playbooks: o texto que orienta a IA das funções (fonte: supabase/playbooks/*.md no repo).
-- agency_id nulo = vale para todas as agências.
create table if not exists public.agent_playbooks (
  slug text primary key,
  agency_id integer references public.agencies(id),
  title text not null,
  content text not null,
  updated_at timestamptz not null default now()
);
alter table public.agent_playbooks enable row level security;
drop policy if exists agent_playbooks_staff_read on public.agent_playbooks;
create policy agent_playbooks_staff_read on public.agent_playbooks
  for select to authenticated using (agency_id is null or public.i_am_staff_of(agency_id));
