-- Onboarding automático: acessos às plataformas, estratégia com aprovação, etapa do cliente.

alter table public.agencies add column if not exists access_email text;
update public.agencies set access_email = 'contato@cangurudigital.com.br' where access_email is null;

alter table public.clients add column if not exists campaign_live_at timestamptz;

create table if not exists public.client_platform_access (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  agency_id integer not null references public.agencies(id),
  platform text not null check (platform in ('meta','google')),
  situation text not null default 'unknown' check (situation in ('has_account','needs_account','unknown')),
  status text not null default 'pending' check (status in ('pending','client_done','help','agency_creating','verified')),
  account_ref text,
  notes text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (client_id, platform)
);
alter table public.client_platform_access enable row level security;

create policy cpa_staff_all on public.client_platform_access for all to authenticated
  using (agency_id = any (app.staff_agencies()))
  with check (agency_id = any (app.staff_agencies()));
create policy cpa_client_read on public.client_platform_access for select to authenticated
  using (client_id = any (app.member_clients()));

create table if not exists public.client_strategies (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  agency_id integer not null references public.agencies(id),
  version integer not null default 1,
  status text not null default 'draft' check (status in ('draft','sent','approved','changes')),
  content jsonb not null default '{}'::jsonb,
  model text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,
  responded_at timestamptz,
  responded_by uuid,
  client_feedback text
);
create index if not exists client_strategies_client_idx on public.client_strategies (client_id, created_at desc);
alter table public.client_strategies enable row level security;

create policy cs_staff_all on public.client_strategies for all to authenticated
  using (agency_id = any (app.staff_agencies()))
  with check (agency_id = any (app.staff_agencies()));
create policy cs_client_read on public.client_strategies for select to authenticated
  using (client_id = any (app.member_clients()) and status in ('sent','approved','changes'));

-- Cliente responde à estratégia (aprova ou pede ajuste) sem poder editar o conteúdo
create or replace function public.respond_strategy(p_id uuid, p_decision text, p_feedback text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare s public.client_strategies;
begin
  if p_decision not in ('approved','changes') then raise exception 'decisão inválida'; end if;
  select * into s from public.client_strategies where id = p_id;
  if s.id is null or not (s.client_id = any (app.member_clients())) then raise exception 'sem acesso'; end if;
  if s.status <> 'sent' then raise exception 'esta estratégia não está aguardando resposta'; end if;
  update public.client_strategies
     set status = p_decision, responded_at = now(), responded_by = auth.uid(),
         client_feedback = nullif(trim(coalesce(p_feedback,'')), ''), updated_at = now()
   where id = p_id;
  return jsonb_build_object('ok', true, 'status', p_decision);
end $$;
revoke all on function public.respond_strategy(uuid, text, text) from public, anon;
grant execute on function public.respond_strategy(uuid, text, text) to authenticated;

-- Cliente marca que já deu o acesso (ou que precisa de ajuda) pelo portal
create or replace function public.client_mark_access(p_client uuid, p_platform text, p_status text, p_account_ref text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not (p_client = any (app.member_clients()) or app.can_client(p_client)) then raise exception 'sem acesso'; end if;
  if p_platform not in ('meta','google') or p_status not in ('client_done','help','pending') then raise exception 'valor inválido'; end if;
  insert into public.client_platform_access (client_id, agency_id, platform, status, account_ref)
  values (p_client, app.client_agency(p_client), p_platform, p_status, nullif(trim(coalesce(p_account_ref,'')),''))
  on conflict (client_id, platform) do update
    set status = case when public.client_platform_access.status = 'verified' then 'verified' else excluded.status end,
        account_ref = coalesce(excluded.account_ref, public.client_platform_access.account_ref),
        updated_at = now();
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.client_mark_access(uuid, text, text, text) from public, anon;
grant execute on function public.client_mark_access(uuid, text, text, text) to authenticated;
