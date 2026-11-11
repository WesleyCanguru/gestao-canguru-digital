-- Bolsa · Propostas: ajustar proposta já publicada sem mexer no link até você publicar o ajuste + histórico de versões
-- Desfazer: propostas_ajuste_publicada_DESFAZER.sql
alter table public.proposals
  add column if not exists draft_content jsonb,
  add column if not exists draft_instructions text,
  add column if not exists draft_created_at timestamptz;

create table if not exists public.proposal_versions (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  version integer not null,
  content jsonb not null,
  instructions text,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists proposal_versions_proposal_idx on public.proposal_versions (proposal_id, version desc);
alter table public.proposal_versions enable row level security;
create policy staff_read on public.proposal_versions for select to authenticated
  using (exists (select 1 from public.proposals p where p.id = proposal_versions.proposal_id and p.agency_id = any (app.staff_agencies())));
-- gravação só pela função generate-proposal (service role)
