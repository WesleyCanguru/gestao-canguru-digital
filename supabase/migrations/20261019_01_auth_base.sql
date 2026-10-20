-- =====================================================================
-- Bolsa: base de autenticação, permissões e políticas (ADITIVO)
-- Não ativa RLS em nada. Só cria estrutura + políticas que passam a
-- valer quando a migração de corte (20261019_02_lockdown.sql) rodar.
-- =====================================================================

create schema if not exists app;
grant usage on schema app to anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- 1. Tabelas de identidade
-- ---------------------------------------------------------------------
create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.agency_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  agency_id integer not null references public.agencies(id) on delete cascade,
  role text not null default 'partner' check (role in ('master','partner','team')),
  permissions jsonb not null default '{}'::jsonb,
  display_name text,
  email text,
  ref_code text unique,
  is_active boolean not null default true,
  legacy_agency_user_id integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, agency_id)
);
create index if not exists agency_members_user_idx on public.agency_members(user_id);

create table if not exists public.client_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  agency_id integer,
  display_name text,
  email text,
  is_active boolean not null default true,
  legacy_client_user_id uuid,
  created_at timestamptz not null default now(),
  unique (user_id, client_id)
);
create index if not exists client_members_user_idx on public.client_members(user_id);

-- Acesso temporário de links públicos (aprovação de post, mapa, temas, roteiro, NPS, contrato)
create table if not exists public.public_link_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scope text not null check (scope in ('mapa','post','temas','roteiro','nps','contrato')),
  client_id uuid references public.clients(id) on delete cascade,
  resource_id text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '12 hours',
  unique (user_id, scope, resource_id)
);
create index if not exists public_link_grants_user_idx on public.public_link_grants(user_id);

create table if not exists public.activity_log (
  id bigint generated always as identity primary key,
  agency_id integer,
  client_id uuid,
  user_id uuid,
  actor_name text,
  action text not null,
  entity text not null,
  entity_id text,
  details jsonb,
  created_at timestamptz not null default now()
);
create index if not exists activity_log_agency_idx on public.activity_log(agency_id, created_at desc);

alter table public.clients add column if not exists acquired_by_user_id uuid;
alter table public.clients add column if not exists acquisition_ref text;

-- Tarefas: responsável (equipe ou freelancer sem login) e frente (Canguru/Joey)
alter table public.agency_tasks add column if not exists assignee_name text;
alter table public.agency_tasks add column if not exists assignee_user_id uuid;
alter table public.agency_tasks add column if not exists front text;
alter table public.agency_tasks add column if not exists created_by uuid default auth.uid();

-- ---------------------------------------------------------------------
-- 2. Funções auxiliares (SECURITY DEFINER, schema app não exposto)
-- ---------------------------------------------------------------------
create or replace function app.is_master() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid());
$$;

create or replace function app.staff_agencies() returns integer[]
language sql stable security definer set search_path = '' as $$
  select case
    when exists (select 1 from public.platform_admins where user_id = auth.uid())
      then (select coalesce(array_agg(id), '{}') from public.agencies)
    else (select coalesce(array_agg(agency_id), '{}') from public.agency_members
          where user_id = auth.uid() and is_active)
  end;
$$;

create or replace function app.role_default_perms(p_role text) returns jsonb
language sql immutable as $$
  select case p_role
    when 'master' then '{"view_finance":true,"edit_finance":true,"edit_contracts":true,"manage_clients":true,"delete_clients":true,"manage_team":true,"send_signup_links":true,"manage_proposals":true,"manage_crm":true}'::jsonb
    when 'partner' then '{"view_finance":true,"edit_finance":false,"edit_contracts":false,"manage_clients":false,"delete_clients":false,"manage_team":false,"send_signup_links":true,"manage_proposals":true,"manage_crm":true}'::jsonb
    else '{"view_finance":false,"edit_finance":false,"edit_contracts":false,"manage_clients":false,"delete_clients":false,"manage_team":false,"send_signup_links":false,"manage_proposals":false,"manage_crm":false}'::jsonb
  end;
$$;

create or replace function app.has_perm(p_agency integer, p_perm text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid())
      or exists (
        select 1 from public.agency_members m
        where m.user_id = auth.uid() and m.agency_id = p_agency and m.is_active
          and coalesce((m.permissions ->> p_perm)::boolean,
                       (app.role_default_perms(m.role) ->> p_perm)::boolean, false)
      );
$$;

create or replace function app.member_clients() returns uuid[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(client_id), '{}') from public.client_members
  where user_id = auth.uid() and is_active;
$$;

create or replace function app.member_client_agencies() returns integer[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(distinct c.agency_id), '{}')
  from public.client_members m join public.clients c on c.id = m.client_id
  where m.user_id = auth.uid() and m.is_active;
$$;

create or replace function app.grant_clients() returns uuid[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(distinct client_id), '{}') from public.public_link_grants
  where user_id = auth.uid() and expires_at > now() and scope in ('mapa','post');
$$;

create or replace function app.grant_resources(p_scope text) returns text[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(resource_id), '{}') from public.public_link_grants
  where user_id = auth.uid() and expires_at > now() and scope = p_scope;
$$;

create or replace function app.client_agency(p_client uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select agency_id from public.clients where id = p_client;
$$;

-- Acesso a um cliente: equipe da agência dele OU login do próprio cliente
create or replace function app.can_client(p_client uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_client is not null and (
    (select agency_id from public.clients where id = p_client) = any (app.staff_agencies())
    or p_client = any (app.member_clients())
  );
$$;

-- Nome de quem está logado (para histórico)
create or replace function app.actor_name() returns text
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select display_name from public.agency_members where user_id = auth.uid() and display_name is not null limit 1),
    (select display_name from public.client_members where user_id = auth.uid() and display_name is not null limit 1),
    (select email from auth.users where id = auth.uid())
  );
$$;

grant execute on all functions in schema app to anon, authenticated, service_role;

-- ---------------------------------------------------------------------
-- 3. Backfill de agency_id/client_id nulos + trigger para inserts futuros
-- ---------------------------------------------------------------------
update public.comments c set client_id = p.client_id, agency_id = coalesce(c.agency_id, p.agency_id)
  from public.posts p where p.date_key = c.post_id and (c.client_id is null or c.agency_id is null);
update public.client_leads t set agency_id = c.agency_id from public.clients c where c.id = t.client_id and t.agency_id is null;
update public.client_monthly_plans t set agency_id = c.agency_id from public.clients c where c.id = t.client_id and t.agency_id is null;
update public.post_ideas t set agency_id = c.agency_id from public.clients c where c.id = t.client_id and t.agency_id is null;
update public.client_credentials t set agency_id = c.agency_id from public.clients c where c.id = t.client_id and t.agency_id is null;
update public.theme_items i set agency_id = s.agency_id from public.theme_sessions s where s.id = i.session_id and i.agency_id is null;

create or replace function app.fill_agency_id() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.agency_id is null and new.client_id is not null then
    new.agency_id := (select agency_id from public.clients where id = new.client_id);
  end if;
  return new;
end $$;

create or replace function app.fill_comment_ids() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (new.client_id is null or new.agency_id is null) and new.post_id is not null then
    select coalesce(new.client_id, p.client_id), coalesce(new.agency_id, p.agency_id)
      into new.client_id, new.agency_id
      from public.posts p where p.date_key = new.post_id limit 1;
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['client_leads','client_monthly_plans','post_ideas','client_credentials',
    'ai_photos','scripts','post_themes','client_briefings','briefings','onboarding_checklist',
    'client_quick_links','client_lead_configs','paid_traffic_daily','paid_traffic_reports','social_metrics',
    'client_media_budgets','client_annual_overview','website_reports','website_tasks','website_feedbacks',
    'client_folders','client_nps','contract_forms','agency_tasks','agency_billing','client_users']
  loop
    execute format('drop trigger if exists trg_fill_agency on public.%I', t);
    execute format('create trigger trg_fill_agency before insert on public.%I for each row execute function app.fill_agency_id()', t);
  end loop;
end $$;
drop trigger if exists trg_fill_comment on public.comments;
create trigger trg_fill_comment before insert on public.comments for each row execute function app.fill_comment_ids();

-- ---------------------------------------------------------------------
-- 4. Guardas de permissão (só agem para usuários logados; service_role passa)
-- ---------------------------------------------------------------------
create or replace function app.guard_clients() returns trigger
language plpgsql security definer set search_path = '' as $$
declare is_staff boolean;
begin
  if auth.uid() is null then return coalesce(new, old); end if;

  if tg_op = 'DELETE' then
    if not app.has_perm(old.agency_id, 'delete_clients') then
      raise exception 'Sem permissão para excluir clientes' using errcode = '42501';
    end if;
    return old;
  end if;

  is_staff := coalesce(new.agency_id, old.agency_id) = any (app.staff_agencies());

  if tg_op = 'INSERT' then
    if is_staff and not app.has_perm(new.agency_id, 'manage_clients') then
      raise exception 'Sem permissão para cadastrar clientes' using errcode = '42501';
    end if;
    return new;
  end if;

  -- UPDATE
  if not is_staff then
    -- login de cliente: não pode mexer em campos comerciais/administrativos
    if new.agency_id is distinct from old.agency_id or new.base_value is distinct from old.base_value
       or new.due_day is distinct from old.due_day or new.currency is distinct from old.currency
       or new.client_status is distinct from old.client_status or new.is_active is distinct from old.is_active
       or new.services is distinct from old.services or new.features_settings is distinct from old.features_settings
       or new.is_internal is distinct from old.is_internal or new.cancelled_at is distinct from old.cancelled_at
       or new.service_end_date is distinct from old.service_end_date or new.ai_photos_quota is distinct from old.ai_photos_quota
       or new.referral_partner_id is distinct from old.referral_partner_id
       or new.acquired_by_user_id is distinct from old.acquired_by_user_id then
      raise exception 'Campo restrito à agência' using errcode = '42501';
    end if;
    return new;
  end if;

  if new.agency_id is distinct from old.agency_id and not app.is_master() then
    raise exception 'Só o administrador master muda a agência de um cliente' using errcode = '42501';
  end if;
  if (new.base_value is distinct from old.base_value or new.due_day is distinct from old.due_day
      or new.currency is distinct from old.currency or new.last_payment_value is distinct from old.last_payment_value)
     and not app.has_perm(new.agency_id, 'edit_contracts') then
    raise exception 'Sem permissão para alterar valores' using errcode = '42501';
  end if;
  if (new.client_status is distinct from old.client_status and new.client_status in ('cancelled','inactive')
      or new.cancelled_at is distinct from old.cancelled_at)
     and not app.has_perm(new.agency_id, 'delete_clients') then
    raise exception 'Sem permissão para cancelar clientes' using errcode = '42501';
  end if;
  if (new.name is distinct from old.name or new.services is distinct from old.services
      or new.features_settings is distinct from old.features_settings or new.logo_url is distinct from old.logo_url
      or new.is_internal is distinct from old.is_internal)
     and not app.has_perm(new.agency_id, 'manage_clients') then
    raise exception 'Sem permissão para editar o cadastro do cliente' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_clients on public.clients;
create trigger trg_guard_clients before insert or update or delete on public.clients
  for each row execute function app.guard_clients();

create or replace function app.guard_contracts() returns trigger
language plpgsql security definer set search_path = '' as $$
declare ag integer;
begin
  if auth.uid() is null then return coalesce(new, old); end if;
  ag := coalesce(new.agency_id, old.agency_id, app.client_agency(coalesce(new.client_id, old.client_id)));
  -- Não-equipe (cliente/link público) só preenche o formulário pendente
  if not (ag = any (app.staff_agencies())) then
    if tg_op <> 'UPDATE' or old.status not in ('pending','submitted')
       or new.contract_value is distinct from old.contract_value
       or new.signed_contract_url is distinct from old.signed_contract_url
       or new.status not in ('pending','submitted') then
      raise exception 'Operação de contrato restrita à agência' using errcode = '42501';
    end if;
    return new;
  end if;
  if tg_op = 'DELETE' then
    if not app.has_perm(ag, 'edit_contracts') then raise exception 'Sem permissão para excluir contratos' using errcode = '42501'; end if;
    return old;
  end if;
  if tg_op = 'INSERT' then
    -- gerar link de contrato pendente é ação comercial; contrato assinado/valor exige permissão
    if (new.status = 'signed' or new.contract_value is not null or new.signed_contract_url is not null)
       and not app.has_perm(ag, 'edit_contracts') then
      raise exception 'Sem permissão para registrar contratos' using errcode = '42501';
    end if;
    return new;
  end if;
  if (new.status is distinct from old.status and new.status = 'signed'
      or new.contract_value is distinct from old.contract_value
      or new.contract_start_date is distinct from old.contract_start_date
      or new.signed_contract_url is distinct from old.signed_contract_url)
     and not app.has_perm(ag, 'edit_contracts') then
    raise exception 'Sem permissão para alterar contratos' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_contracts on public.contract_forms;
create trigger trg_guard_contracts before insert or update or delete on public.contract_forms
  for each row execute function app.guard_contracts();

-- ---------------------------------------------------------------------
-- 5. Histórico de atividade
-- ---------------------------------------------------------------------
create or replace function app.log_activity() returns trigger
language plpgsql security definer set search_path = '' as $$
declare r record; ag integer; cl uuid; diff jsonb;
begin
  if auth.uid() is null then return coalesce(new, old); end if;
  if tg_op = 'DELETE' then r := old; else r := new; end if;
  ag := (to_jsonb(r) ->> 'agency_id')::integer;
  cl := case when tg_table_name = 'clients' then (to_jsonb(r) ->> 'id')::uuid
             else nullif(to_jsonb(r) ->> 'client_id', '')::uuid end;
  if tg_op = 'UPDATE' then
    select jsonb_object_agg(n.key, jsonb_build_object('de', o.value, 'para', n.value)) into diff
    from jsonb_each(to_jsonb(new)) n join jsonb_each(to_jsonb(old)) o using (key)
    where n.value is distinct from o.value and n.key not in ('updated_at','last_updated');
    if diff is null then return new; end if;
  end if;
  insert into public.activity_log (agency_id, client_id, user_id, actor_name, action, entity, entity_id, details)
  values (ag, cl, auth.uid(), app.actor_name(), lower(tg_op), tg_table_name, to_jsonb(r) ->> 'id', diff);
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['clients','contract_forms','agency_billing','agency_expenses','agency_members','client_members','client_credentials']
  loop
    execute format('drop trigger if exists trg_log_activity on public.%I', t);
    execute format('create trigger trg_log_activity after insert or update or delete on public.%I for each row execute function app.log_activity()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 6. RPCs para o front
-- ---------------------------------------------------------------------
create or replace function public.get_my_context() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'user_id', auth.uid(),
    'email', (select email from auth.users where id = auth.uid()),
    'is_master', app.is_master(),
    'agencies', coalesce((
      select jsonb_agg(jsonb_build_object(
        'agency_id', a.id, 'agency_name', a.name, 'slug', a.slug, 'logo_url', a.logo_url,
        'primary_color', a.primary_color,
        'role', coalesce(m.role, 'master'),
        'display_name', coalesce(m.display_name, (select display_name from public.agency_members x where x.user_id = auth.uid() and x.display_name is not null limit 1)),
        'ref_code', m.ref_code,
        'permissions', case when m.id is null then app.role_default_perms('master')
                            else app.role_default_perms(m.role) || m.permissions end
      ) order by a.id)
      from public.agencies a
      left join public.agency_members m on m.agency_id = a.id and m.user_id = auth.uid() and m.is_active
      where a.is_active and (m.id is not null or app.is_master())
    ), '[]'::jsonb),
    'clients', coalesce((
      select jsonb_agg(jsonb_build_object('client_id', cm.client_id, 'agency_id', c.agency_id, 'display_name', cm.display_name))
      from public.client_members cm join public.clients c on c.id = cm.client_id
      where cm.user_id = auth.uid() and cm.is_active
    ), '[]'::jsonb)
  );
$$;
grant execute on function public.get_my_context() to authenticated;

-- Libera um link público para a sessão anônima atual
create or replace function public.claim_public_link(p_scope text, p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_client uuid; v_res text;
begin
  if auth.uid() is null then raise exception 'Sessão necessária' using errcode = '42501'; end if;
  if p_token is null or length(p_token) < 8 then raise exception 'Link inválido' using errcode = '22023'; end if;

  if p_scope = 'mapa' then
    select id into v_client from public.clients where id::text = p_token and coalesce(client_status,'active') <> 'cancelled';
    v_res := p_token;
  elsif p_scope = 'post' then
    select client_id into v_client from public.posts where date_key = p_token limit 1;
    v_res := p_token;
  elsif p_scope = 'temas' then
    select client_id, id::text into v_client, v_res from public.theme_sessions where session_token = p_token;
  elsif p_scope = 'roteiro' then
    select client_id, id::text into v_client, v_res from public.scripts where id::text = p_token;
  elsif p_scope = 'nps' then
    select client_id, id::text into v_client, v_res from public.client_nps where token::text = p_token;
  elsif p_scope = 'contrato' then
    select client_id, id::text into v_client, v_res from public.contract_forms where form_token = p_token;
  else
    raise exception 'Escopo inválido' using errcode = '22023';
  end if;

  if v_res is null then raise exception 'Link não encontrado' using errcode = 'P0002'; end if;

  insert into public.public_link_grants (user_id, scope, client_id, resource_id)
  values (auth.uid(), p_scope, v_client, v_res)
  on conflict (user_id, scope, resource_id) do update set expires_at = now() + interval '12 hours';

  return jsonb_build_object('client_id', v_client, 'resource_id', v_res);
end $$;
grant execute on function public.claim_public_link(text, text) to authenticated;

-- Marca visual pública (tela de login das fotos, etc.)
create or replace function public.get_public_client_brand(p_client uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', c.id, 'name', c.name, 'logo_url', c.logo_url, 'color', c.color,
    'initials', c.initials, 'agency_id', c.agency_id, 'agency_name', a.name, 'agency_logo_url', a.logo_url)
  from public.clients c left join public.agencies a on a.id = c.agency_id where c.id = p_client;
$$;
grant execute on function public.get_public_client_brand(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 7. Vínculo com logins antigos + RPC de checagem de permissão
-- ---------------------------------------------------------------------
alter table public.agency_users add column if not exists auth_user_id uuid;
alter table public.client_users add column if not exists auth_user_id uuid;

create or replace function public.i_can(p_agency integer, p_perm text) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.has_perm(p_agency, p_perm);
$$;
grant execute on function public.i_can(integer, text) to authenticated;

create or replace function public.i_am_staff_of(p_agency integer) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_agency = any (app.staff_agencies());
$$;
grant execute on function public.i_am_staff_of(integer) to authenticated;

alter table public.clients add column if not exists registration_token_hash text;
