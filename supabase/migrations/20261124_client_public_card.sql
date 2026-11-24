-- Correção 4/6, passo 1 (aditivo, não muda nada do que existe):
-- vitrine do cliente só com o que as páginas públicas mostram.
create or replace function app.scope_clients(p_scope text) returns uuid[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(distinct client_id), '{}') from public.public_link_grants
  where user_id = auth.uid() and expires_at > now() and scope = p_scope;
$$;
revoke all on function app.scope_clients(text) from public, anon;
grant execute on function app.scope_clients(text) to authenticated, service_role;

create or replace view public.client_public_card
with (security_barrier = true) as
  select c.id, c.name, c.logo_url, c.initials, c.color, c.agency_id, c.responsible,
         c.instagram, c.linkedin, c.tiktok, c.social_networks,
         c.traffic_strategy_data->>'language' as lang
  from public.clients c
  where c.id = any(app.any_grant_clients())
     or c.id = any(app.member_clients())
     or c.agency_id = any(app.staff_agencies());
revoke all on public.client_public_card from public, anon;
grant select on public.client_public_card to authenticated;
comment on view public.client_public_card is 'Campos públicos do cliente para links (/nps, /temas, /roteiro, /criativos, mapa, aprovação). Sem dados financeiros nem tokens.';

-- DESFAZER: drop view public.client_public_card; drop function app.scope_clients(text);
