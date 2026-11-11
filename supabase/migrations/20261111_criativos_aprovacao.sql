-- Aprovação de criativos de anúncio (estáticos, carrosséis e vídeos) — 11/11/2026
-- Lote = um envio para o cliente (ex.: "Campanha novembro"). Peça = um criativo dentro do lote.
-- Quem vê: equipe da agência do cliente; o cliente logado (lotes já enviados); quem abriu o link do lote (12h, sessão anônima).
-- Quem decide (aprovar / pedir ajuste): só pela função decide_creative, que confere o acesso. Ninguém de fora edita as peças.

-- 1) Tabelas ---------------------------------------------------------------
create table if not exists public.creative_batches (
  id uuid primary key default gen_random_uuid(),
  agency_id integer not null references public.agencies(id),
  client_id uuid not null references public.clients(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'draft' check (status in ('draft','sent','reviewed','closed')),
  public_token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  created_by uuid default auth.uid(),
  sent_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.creative_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.creative_batches(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  position integer not null default 0,
  kind text not null check (kind in ('image','carousel','video')),
  title text,
  caption text,
  placement text,
  -- [{ "type": "image"|"video"|"link", "path": "<cliente>/<lote>/<arquivo>" ou null, "url": link externo ou null, "name": "..." }]
  media jsonb not null default '[]'::jsonb,
  status text not null default 'pending' check (status in ('pending','approved','changes')),
  feedback text,
  decided_by_name text,
  decided_at timestamptz,
  version integer not null default 1,
  -- versões anteriores: [{ "version": 1, "media": [...], "feedback": "...", "decided_at": "..." }]
  history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists creative_batches_client_idx on public.creative_batches(client_id, created_at desc);
create index if not exists creative_items_batch_idx on public.creative_items(batch_id, position);

-- 2) Acesso por link (escopo 'criativos') -------------------------------------
create or replace function app.creative_grant_batches()
returns uuid[] language sql stable security definer set search_path to '' as $$
  select coalesce(array_agg(app.try_uuid(resource_id)), '{}') from public.public_link_grants
  where user_id = auth.uid() and expires_at > now() and scope = 'criativos';
$$;

-- Quem pode ver o lote
create or replace function app.can_see_creative_batch(p_batch uuid)
returns boolean language sql stable security definer set search_path to '' as $$
  select exists (
    select 1 from public.creative_batches b
    where b.id = p_batch and (
      b.agency_id = any (app.staff_agencies())
      or (b.status <> 'draft' and b.client_id = any (app.member_clients()))
      or (b.status <> 'draft' and b.id = any (app.creative_grant_batches()))
    )
  );
$$;

alter table public.public_link_grants drop constraint if exists public_link_grants_scope_check;
alter table public.public_link_grants add constraint public_link_grants_scope_check
  check (scope = any (array['mapa','post','temas','roteiro','nps','contrato','criativos']));

-- claim_public_link ganha o escopo 'criativos' (resto igual ao da Parte 4a)
create or replace function public.claim_public_link(p_scope text, p_token text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare v_client uuid; v_res text;
begin
  if auth.uid() is null then raise exception 'Sessão necessária' using errcode = '42501'; end if;
  if p_token is null or length(p_token) < 8 then raise exception 'Link inválido' using errcode = '22023'; end if;
  if p_scope = 'mapa' then
    select id into v_client from public.clients where id::text = p_token and coalesce(client_status,'active') <> 'cancelled';
    v_res := case when v_client is not null then p_token end;
  elsif p_scope = 'post' then
    select client_id into v_client from public.posts where date_key = p_token limit 1;
    v_res := case when v_client is not null then p_token end;
  elsif p_scope = 'temas' then
    select client_id, id::text into v_client, v_res from public.theme_sessions where session_token = p_token;
  elsif p_scope = 'roteiro' then
    select client_id, id::text into v_client, v_res from public.scripts where id::text = p_token;
  elsif p_scope = 'nps' then
    select client_id, id::text into v_client, v_res from public.client_nps where token::text = p_token;
  elsif p_scope = 'contrato' then
    select client_id, id::text into v_client, v_res from public.contract_forms where form_token = p_token;
  elsif p_scope = 'criativos' then
    select client_id, id::text into v_client, v_res from public.creative_batches where public_token = p_token and status <> 'draft';
  else
    raise exception 'Escopo inválido' using errcode = '22023';
  end if;
  if v_res is null then raise exception 'Link não encontrado' using errcode = 'P0002'; end if;
  insert into public.public_link_grants (user_id, scope, client_id, resource_id)
  values (auth.uid(), p_scope, v_client, v_res)
  on conflict (user_id, scope, resource_id) do update set expires_at = now() + interval '12 hours';
  return jsonb_build_object('client_id', v_client, 'resource_id', v_res);
end $function$;

-- 3) Decisão do cliente (aprovar / pedir ajuste / voltar para pendente) -----------
create or replace function public.decide_creative(p_item uuid, p_status text, p_feedback text default null, p_name text default null)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare v_batch uuid; v_left int;
begin
  if p_status not in ('approved','changes','pending') then raise exception 'Status inválido' using errcode = '22023'; end if;
  if p_status = 'changes' and coalesce(btrim(p_feedback), '') = '' then raise exception 'Escreva o que precisa ajustar' using errcode = '22023'; end if;
  select batch_id into v_batch from public.creative_items where id = p_item;
  if v_batch is null or not app.can_see_creative_batch(v_batch) then raise exception 'Sem acesso' using errcode = '42501'; end if;
  if exists (select 1 from public.creative_batches where id = v_batch and status in ('draft','closed')) then
    raise exception 'Este lote não está aberto para aprovação' using errcode = '22023';
  end if;
  update public.creative_items set
    status = p_status,
    feedback = case when p_status = 'changes' then left(btrim(p_feedback), 4000) when p_status = 'approved' then nullif(left(btrim(coalesce(p_feedback,'')), 4000), '') else null end,
    decided_by_name = case when p_status = 'pending' then null else nullif(left(btrim(coalesce(p_name,'')), 120), '') end,
    decided_at = case when p_status = 'pending' then null else now() end,
    updated_at = now()
  where id = p_item;
  select count(*) into v_left from public.creative_items where batch_id = v_batch and status = 'pending';
  return jsonb_build_object('ok', true, 'pending', v_left);
end $$;

-- Cliente conclui a revisão do lote (avisa a agência)
create or replace function public.finish_creative_review(p_batch uuid, p_name text default null)
returns jsonb language plpgsql security definer set search_path to '' as $$
begin
  if not app.can_see_creative_batch(p_batch) then raise exception 'Sem acesso' using errcode = '42501'; end if;
  update public.creative_batches set status = 'reviewed', reviewed_at = now(),
    reviewed_by_name = nullif(left(btrim(coalesce(p_name,'')), 120), ''), updated_at = now()
  where id = p_batch and status = 'sent';
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.decide_creative(uuid, text, text, text) from public;
revoke all on function public.finish_creative_review(uuid, text) from public;
grant execute on function public.decide_creative(uuid, text, text, text) to authenticated;
grant execute on function public.finish_creative_review(uuid, text) to authenticated;

-- 4) RLS ---------------------------------------------------------------
alter table public.creative_batches enable row level security;
alter table public.creative_items enable row level security;

create policy staff_all on public.creative_batches for all to authenticated
  using (agency_id = any (app.staff_agencies()) and app.is_real_user())
  with check (agency_id = any (app.staff_agencies()) and app.is_real_user() and app.client_agency(client_id) = agency_id);
create policy viewer_read on public.creative_batches for select to authenticated
  using (status <> 'draft' and (client_id = any (app.member_clients()) or id = any (app.creative_grant_batches())));

create policy staff_all on public.creative_items for all to authenticated
  using (app.client_agency(client_id) = any (app.staff_agencies()) and app.is_real_user())
  with check (app.client_agency(client_id) = any (app.staff_agencies()) and app.is_real_user()
              and client_id = (select b.client_id from public.creative_batches b where b.id = batch_id));
create policy viewer_read on public.creative_items for select to authenticated
  using (app.can_see_creative_batch(batch_id));

-- 5) Arquivos: bucket privado ad-creatives, caminho <cliente>/<lote>/<arquivo> ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ad-creatives', 'ad-creatives', false, 52428800,
        array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/quicktime','video/webm'])
on conflict (id) do nothing;

create policy creatives_read on storage.objects for select to authenticated
  using (bucket_id = 'ad-creatives' and (
    app.can_client(app.file_client(name))
    or app.try_uuid((storage.foldername(name))[2]) = any (app.creative_grant_batches())
  ));
create policy creatives_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'ad-creatives' and app.is_real_user() and app.client_agency(app.file_client(name)) = any (app.staff_agencies()));
create policy creatives_update on storage.objects for update to authenticated
  using (bucket_id = 'ad-creatives' and app.is_real_user() and app.client_agency(app.file_client(name)) = any (app.staff_agencies()));
create policy creatives_delete on storage.objects for delete to authenticated
  using (bucket_id = 'ad-creatives' and app.is_real_user() and app.client_agency(app.file_client(name)) = any (app.staff_agencies()));
