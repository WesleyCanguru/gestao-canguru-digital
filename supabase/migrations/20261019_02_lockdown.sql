-- =====================================================================
-- Bolsa: CORTE DE SEGURANÇA (RLS em todas as tabelas)
-- Rodar SOMENTE depois que o front novo (login por e-mail) estiver no ar.
-- Reverter: ver 20261019_02_lockdown_ROLLBACK.sql
-- =====================================================================

-- Auxiliares extras ----------------------------------------------------
create or replace function app.any_grant_clients() returns uuid[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(distinct client_id), '{}') from public.public_link_grants
  where user_id = auth.uid() and expires_at > now();
$$;

create or replace function app.try_uuid(p text) returns uuid
language plpgsql immutable as $$
begin return p::uuid; exception when others then return null; end $$;

create or replace function app.is_real_user() returns boolean
language sql stable as $$
  select auth.uid() is not null and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false;
$$;

grant execute on all functions in schema app to anon, authenticated, service_role;

-- 1. Liga RLS e remove TODAS as políticas antigas (eram "liberado para todos")
do $$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies where schemaname = 'public' loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
  for r in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', r.tablename);
  end loop;
end $$;

-- 2. Tabelas internas da agência (só equipe da agência) ----------------
do $$
declare t text;
begin
  foreach t in array array[
    'agency_commercial_actions','agency_crms','agency_goals','agency_leads','agency_tasks','leads',
    'notebooks','notes','process_templates','process_instances','process_checklist','task_sessions',
    'referral_partners','client_health_scores'
  ] loop
    execute format($p$create policy staff_all on public.%I for all to authenticated
      using (agency_id = any ((select app.staff_agencies())))
      with check (agency_id = any ((select app.staff_agencies())))$p$, t);
  end loop;
end $$;

-- 3. Financeiro (ver exige view_finance; lançar exige edit_finance) ----
do $$
declare t text;
begin
  foreach t in array array['agency_billing','agency_expenses','client_revenue_events','referral_commissions'] loop
    execute format($p$create policy finance_read on public.%I for select to authenticated
      using (agency_id = any ((select app.staff_agencies())) and app.has_perm(agency_id::integer, 'view_finance'))$p$, t);
    execute format($p$create policy finance_write on public.%I for insert to authenticated
      with check (app.has_perm(agency_id::integer, 'edit_finance'))$p$, t);
    execute format($p$create policy finance_update on public.%I for update to authenticated
      using (app.has_perm(agency_id::integer, 'edit_finance')) with check (app.has_perm(agency_id::integer, 'edit_finance'))$p$, t);
    execute format($p$create policy finance_delete on public.%I for delete to authenticated
      using (app.has_perm(agency_id::integer, 'edit_finance'))$p$, t);
  end loop;
end $$;

-- 4. Dados do cliente: equipe da agência + login do próprio cliente ----
--    (agency_id pode ser nulo em linhas antigas: usa a agência do cliente)
do $$
declare t text;
begin
  foreach t in array array[
    'posts','comments','post_themes','post_ideas','ai_photos','scripts','theme_sessions',
    'client_briefings','briefings','client_onboarding','onboarding_checklist','client_credentials',
    'client_leads','client_lead_configs','client_quick_links','client_tutorials','documents','client_folders',
    'website_tasks','website_feedbacks','client_nps'
  ] loop
    execute format($p$create policy client_scope_all on public.%I for all to authenticated
      using (app.can_client(client_id)) with check (app.can_client(client_id))$p$, t);
  end loop;

  -- cliente só lê; equipe escreve
  foreach t in array array[
    'paid_traffic_daily','paid_traffic_reports','social_metrics','client_media_budgets',
    'client_paid_traffic_strategies','client_monthly_plans','client_weekly_schedules',
    'client_annual_overview','onboarding_phases','onboarding_steps','website_reports'
  ] loop
    execute format($p$create policy client_scope_read on public.%I for select to authenticated
      using (app.can_client(client_id))$p$, t);
    execute format($p$create policy staff_write on public.%I for all to authenticated
      using (app.client_agency(client_id) = any ((select app.staff_agencies())))
      with check (app.client_agency(client_id) = any ((select app.staff_agencies())))$p$, t);
  end loop;
end $$;

-- contratos: equipe (com guardas no trigger) e cliente lê o próprio
create policy staff_all on public.contract_forms for all to authenticated
  using (coalesce(agency_id, app.client_agency(client_id)) = any ((select app.staff_agencies())))
  with check (coalesce(agency_id, app.client_agency(client_id)) = any ((select app.staff_agencies())));
create policy client_read on public.contract_forms for select to authenticated
  using (client_id = any ((select app.member_clients())));
create policy link_read on public.contract_forms for select to authenticated
  using (id::text = any ((select app.grant_resources('contrato'))));
create policy link_fill on public.contract_forms for update to authenticated
  using (id::text = any ((select app.grant_resources('contrato'))) and status in ('pending','submitted'))
  with check (id::text = any ((select app.grant_resources('contrato'))));

-- histórico de versões de post (post_id -> posts.id)
create policy staff_or_client on public.post_revisions for all to authenticated
  using (exists (select 1 from public.posts p where p.id = post_revisions.post_id and app.can_client(p.client_id)))
  with check (exists (select 1 from public.posts p where p.id = post_revisions.post_id and app.can_client(p.client_id)));

-- itens de tema (session_id -> theme_sessions)
create policy staff_or_client on public.theme_items for all to authenticated
  using (exists (select 1 from public.theme_sessions s where s.id = theme_items.session_id and app.can_client(s.client_id)))
  with check (exists (select 1 from public.theme_sessions s where s.id = theme_items.session_id and app.can_client(s.client_id)));

-- 5. Links públicos (sessão anônima com acesso liberado só àquele item) --
-- mapa / aprovação de post: conteúdo editorial do cliente
create policy link_read on public.posts for select to authenticated using (client_id = any ((select app.grant_clients())));
create policy link_approve on public.posts for update to authenticated
  using (client_id = any ((select app.grant_clients()))) with check (client_id = any ((select app.grant_clients())));
create policy link_read on public.comments for select to authenticated using (client_id = any ((select app.grant_clients())));
create policy link_comment on public.comments for insert to authenticated with check (client_id = any ((select app.grant_clients())));
create policy link_read on public.post_themes for select to authenticated using (client_id = any ((select app.grant_clients())));
create policy link_review on public.post_themes for update to authenticated
  using (client_id = any ((select app.grant_clients()))) with check (client_id = any ((select app.grant_clients())));
create policy link_read on public.post_ideas for select to authenticated using (client_id = any ((select app.grant_clients())));
create policy link_read on public.client_monthly_plans for select to authenticated using (client_id = any ((select app.grant_clients())));
create policy link_read on public.post_revisions for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_revisions.post_id and p.client_id = any ((select app.grant_clients()))));
create policy link_log on public.post_revisions for insert to authenticated
  with check (exists (select 1 from public.posts p where p.id = post_revisions.post_id and p.client_id = any ((select app.grant_clients()))));
-- temas
create policy link_read on public.theme_sessions for select to authenticated
  using (id::text = any ((select app.grant_resources('temas'))) or client_id = any ((select app.grant_clients())));
create policy link_review on public.theme_sessions for update to authenticated
  using (id::text = any ((select app.grant_resources('temas')))) with check (id::text = any ((select app.grant_resources('temas'))));
create policy link_read on public.theme_items for select to authenticated
  using (session_id::text = any ((select app.grant_resources('temas')))
         or exists (select 1 from public.theme_sessions s where s.id = theme_items.session_id and s.client_id = any ((select app.grant_clients()))));
create policy link_review on public.theme_items for update to authenticated
  using (session_id::text = any ((select app.grant_resources('temas')))) with check (session_id::text = any ((select app.grant_resources('temas'))));
-- roteiro
create policy link_read on public.scripts for select to authenticated using (id::text = any ((select app.grant_resources('roteiro'))));
create policy link_review on public.scripts for update to authenticated
  using (id::text = any ((select app.grant_resources('roteiro')))) with check (id::text = any ((select app.grant_resources('roteiro'))));
-- NPS
create policy link_read on public.client_nps for select to authenticated using (id::text = any ((select app.grant_resources('nps'))));
create policy link_answer on public.client_nps for update to authenticated
  using (id::text = any ((select app.grant_resources('nps')))) with check (id::text = any ((select app.grant_resources('nps'))));

-- 6. Clientes ----------------------------------------------------------
create policy read_own on public.clients for select to authenticated
  using (agency_id = any ((select app.staff_agencies()))
         or id = any ((select app.member_clients()))
         or id = any ((select app.any_grant_clients())));
create policy staff_insert on public.clients for insert to authenticated
  with check (agency_id = any ((select app.staff_agencies())));
create policy staff_or_member_update on public.clients for update to authenticated
  using (agency_id = any ((select app.staff_agencies())) or id = any ((select app.member_clients())))
  with check (agency_id = any ((select app.staff_agencies())) or id = any ((select app.member_clients())));
create policy staff_delete on public.clients for delete to authenticated
  using (agency_id = any ((select app.staff_agencies())));

-- 7. Configurações da agência (equipe edita; clientes da agência leem) -
do $$
declare t text;
begin
  foreach t in array array['agency_settings','tutorials','agency_briefing_templates','onboarding_templates'] loop
    execute format($p$create policy staff_all on public.%I for all to authenticated
      using (agency_id = any ((select app.staff_agencies())))
      with check (agency_id = any ((select app.staff_agencies())))$p$, t);
    execute format($p$create policy client_read on public.%I for select to authenticated
      using (agency_id is null or agency_id = any ((select app.member_client_agencies())))$p$, t);
  end loop;
end $$;

create policy public_read on public.agencies for select to anon, authenticated using (true);
create policy master_write on public.agencies for all to authenticated using (app.is_master()) with check (app.is_master());

-- 8. Identidade e histórico -------------------------------------------
create policy read_team on public.agency_members for select to authenticated
  using (user_id = auth.uid() or agency_id = any ((select app.staff_agencies())));
create policy read_logins on public.client_members for select to authenticated
  using (user_id = auth.uid() or app.client_agency(client_id) = any ((select app.staff_agencies())));
create policy read_self on public.platform_admins for select to authenticated using (user_id = auth.uid());
create policy read_self on public.public_link_grants for select to authenticated using (user_id = auth.uid());
create policy staff_read on public.activity_log for select to authenticated
  using (agency_id = any ((select app.staff_agencies())));
create policy staff_insert on public.activity_log for insert to authenticated
  with check (user_id = auth.uid() and agency_id = any ((select app.staff_agencies())));
-- agency_users / client_users (login antigo): sem políticas = ninguém acessa pelo navegador.

-- 9. Funções antigas que expunham dados
revoke execute on function public.authenticate_client(text, text) from anon, authenticated, public;
revoke execute on function public.hash_password(text) from anon, authenticated, public;

-- 10. Arquivos ----------------------------------------------------------
update storage.buckets set public = false where id = 'client-documents';

do $$
declare r record;
begin
  for r in select policyname from pg_policies where schemaname = 'storage' and tablename = 'objects'
    and (coalesce(qual,'') || coalesce(with_check,'')) ~ '(client-documents|post-uploads)' loop
    execute format('drop policy if exists %I on storage.objects', r.policyname);
  end loop;
end $$;

create policy bolsa_docs_read on storage.objects for select to authenticated
  using (bucket_id = 'client-documents' and (
    app.can_client(app.try_uuid((storage.foldername(name))[2]))
    or app.try_uuid((storage.foldername(name))[2]) = any ((select app.any_grant_clients()))));
create policy bolsa_docs_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'client-documents' and (
    app.can_client(app.try_uuid((storage.foldername(name))[2]))
    or app.try_uuid((storage.foldername(name))[2]) = any ((select app.any_grant_clients()))));
create policy bolsa_docs_modify on storage.objects for update to authenticated
  using (bucket_id = 'client-documents' and app.client_agency(app.try_uuid((storage.foldername(name))[2])) = any ((select app.staff_agencies())));
create policy bolsa_docs_delete on storage.objects for delete to authenticated
  using (bucket_id = 'client-documents' and app.client_agency(app.try_uuid((storage.foldername(name))[2])) = any ((select app.staff_agencies())));

-- post-uploads continua público para leitura (imagens dos posts); só quem tem login sobe/apaga
create policy bolsa_uploads_read on storage.objects for select to anon, authenticated using (bucket_id = 'post-uploads');
create policy bolsa_uploads_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'post-uploads' and app.is_real_user()
    and (cardinality(app.staff_agencies()) > 0 or cardinality(app.member_clients()) > 0));
create policy bolsa_uploads_update on storage.objects for update to authenticated
  using (bucket_id = 'post-uploads' and cardinality(app.staff_agencies()) > 0);
create policy bolsa_uploads_delete on storage.objects for delete to authenticated
  using (bucket_id = 'post-uploads' and cardinality(app.staff_agencies()) > 0);

-- 11. Limpa segredos em texto aberto de quem já migrou
update public.clients set traffic_strategy_data = traffic_strategy_data - 'client_access_key' - 'password_reset_token' - 'password_reset_expires_at'
  where traffic_strategy_data ?| array['client_access_key','password_reset_token','password_reset_expires_at'];
delete from public.client_credentials where platform = 'portal' and label = 'Chave de Acesso Bolsa';
