-- Correção 4/6, parte 2: quem entra por LINK PÚBLICO (não é equipe nem login do cliente)
-- só consegue aprovar / reprovar / pedir ajuste. Qualquer outra mudança em posts e temas é ignorada.
-- Link de um post ('post') só alcança aquele post e as versões vinculadas (mesmo final do date_key).
-- Equipe, cliente logado e service_role (cron) não são afetados.

create or replace function app.is_link_only(p_client uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null
     and not (p_client = any (app.member_clients()))
     and not exists (select 1 from public.clients c where c.id = p_client and c.agency_id = any (app.staff_agencies()));
$$;

create or replace function app.link_reaches_post(p_client uuid, p_date_key text) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_client = any (app.scope_clients('mapa'))
      or exists (select 1 from unnest(app.grant_resources('post')) r
                 where regexp_replace(r, '^.*-', '') = regexp_replace(p_date_key, '^.*-', ''));
$$;

create or replace function app.guard_link_posts() returns trigger
language plpgsql security definer set search_path = '' as $$
declare r public.posts;
begin
  if tg_op = 'INSERT' then
    if app.is_link_only(new.client_id) and not app.link_reaches_post(new.client_id, new.date_key) then
      raise exception 'Link sem acesso a este post' using errcode = '42501';
    end if;
    return new;
  end if;
  if not app.is_link_only(old.client_id) then return new; end if;
  if not app.link_reaches_post(old.client_id, old.date_key) then return null; end if; -- ignora a linha
  r := old;
  if new.status is distinct from old.status and old.status not in ('published','deleted') and new.status in
     ('approved','rejected','changes_requested','theme_approved','theme_rejected','theme_approved_with_notes','interested') then
    r.status := new.status;
  end if;
  r.theme_rejection_reason := new.theme_rejection_reason;
  r.theme_client_notes := new.theme_client_notes;
  r.last_updated := coalesce(new.last_updated, now());
  return r;
end $$;

create or replace function app.guard_link_post_themes() returns trigger
language plpgsql security definer set search_path = '' as $$
declare r public.post_themes;
begin
  if not app.is_link_only(old.client_id) then return new; end if;
  if not (old.client_id = any (app.scope_clients('mapa'))) then return null; end if;
  r := old;
  r.status := new.status;
  r.client_comment := new.client_comment;
  r.reviewed_at := new.reviewed_at;
  r.reviewed_by := new.reviewed_by;
  return r;
end $$;

revoke all on function app.is_link_only(uuid), app.link_reaches_post(uuid, text), app.guard_link_posts(), app.guard_link_post_themes() from public, anon;
grant execute on function app.is_link_only(uuid), app.link_reaches_post(uuid, text) to authenticated;

drop trigger if exists aa_guard_link_posts on public.posts;
create trigger aa_guard_link_posts before insert or update on public.posts
  for each row execute function app.guard_link_posts();
drop trigger if exists aa_guard_link_post_themes on public.post_themes;
create trigger aa_guard_link_post_themes before update on public.post_themes
  for each row execute function app.guard_link_post_themes();

-- DESFAZER:
-- drop trigger if exists aa_guard_link_posts on public.posts;
-- drop trigger if exists aa_guard_link_post_themes on public.post_themes;
-- drop function if exists app.guard_link_posts(); drop function if exists app.guard_link_post_themes();
-- drop function if exists app.link_reaches_post(uuid, text); drop function if exists app.is_link_only(uuid);
