-- Pessoas sem login (freelancers) para responsável de tarefa e cobrança no WhatsApp
create table if not exists public.agency_people (
  id uuid primary key default gen_random_uuid(),
  agency_id integer not null,
  name text not null,
  role_label text,
  whatsapp text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists agency_people_agency on public.agency_people (agency_id);
alter table public.agency_people enable row level security;
drop policy if exists agency_people_staff_all on public.agency_people;
create policy agency_people_staff_all on public.agency_people for all to authenticated
  using (public.i_am_staff_of(agency_id)) with check (public.i_am_staff_of(agency_id));

-- Etapa da entrega e registro de cobrança na tarefa
alter table public.agency_tasks add column if not exists stage text;
alter table public.agency_tasks add column if not exists stage_changed_at timestamptz;
alter table public.agency_tasks add column if not exists last_nudged_at timestamptz;
alter table public.agency_tasks add column if not exists nudge_count integer not null default 0;
