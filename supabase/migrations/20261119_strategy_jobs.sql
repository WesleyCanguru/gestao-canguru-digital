-- Fila da estratégia de tráfego: o botão cria um pedido; o Claude trabalha em lote (Message Batches)
-- e a função strategy-jobs-tick (pg_cron, a cada minuto) acompanha: rascunho -> revisão -> estratégia salva.
create table if not exists public.strategy_jobs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  agency_id integer not null references public.agencies(id),
  created_by uuid,
  instructions text,
  status text not null default 'queued' check (status in ('queued','drafting','reviewing','done','error')),
  batch_id text,
  attempts integer not null default 0,
  system_prompt text,
  user_prompt text,
  review_system_prompt text,
  draft jsonb,
  xray_id uuid,
  base_version integer not null default 0,
  strategy_id uuid,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists strategy_jobs_open_idx on public.strategy_jobs (status) where status in ('queued','drafting','reviewing');
create index if not exists strategy_jobs_client_idx on public.strategy_jobs (client_id, created_at desc);
alter table public.strategy_jobs enable row level security;
drop policy if exists strategy_jobs_staff_read on public.strategy_jobs;
create policy strategy_jobs_staff_read on public.strategy_jobs
  for select to authenticated using (public.i_am_staff_of(agency_id));
