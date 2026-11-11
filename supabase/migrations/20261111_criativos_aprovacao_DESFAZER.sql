-- DESFAZER: aprovação de criativos (20261111_criativos_aprovacao.sql)
-- Atenção: apaga os lotes e peças cadastrados. Os arquivos do bucket ad-creatives precisam ser apagados pela tela/painel do Supabase
-- (o Supabase não deixa apagar storage.objects por SQL); o bucket só some depois de vazio.

drop policy if exists creatives_read on storage.objects;
drop policy if exists creatives_insert on storage.objects;
drop policy if exists creatives_update on storage.objects;
drop policy if exists creatives_delete on storage.objects;

drop function if exists public.decide_creative(uuid, text, text, text);
drop function if exists public.finish_creative_review(uuid, text);

-- claim_public_link volta a ser exatamente o da Parte 4a (sem 'criativos')
create or replace function public.claim_public_link(p_scope text, p_token text)
 returns jsonb language plpgsql security definer set search_path to ''
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
  else
    raise exception 'Escopo inválido' using errcode = '22023';
  end if;
  if v_res is null then raise exception 'Link não encontrado' using errcode = 'P0002'; end if;
  insert into public.public_link_grants (user_id, scope, client_id, resource_id)
  values (auth.uid(), p_scope, v_client, v_res)
  on conflict (user_id, scope, resource_id) do update set expires_at = now() + interval '12 hours';
  return jsonb_build_object('client_id', v_client, 'resource_id', v_res);
end $function$;

delete from public.public_link_grants where scope = 'criativos';
alter table public.public_link_grants drop constraint if exists public_link_grants_scope_check;
alter table public.public_link_grants add constraint public_link_grants_scope_check
  check (scope = any (array['mapa','post','temas','roteiro','nps','contrato']));

drop table if exists public.creative_items;
drop table if exists public.creative_batches;
drop function if exists app.can_see_creative_batch(uuid);
drop function if exists app.creative_grant_batches();
-- Bucket (só depois de vazio): delete from storage.buckets where id = 'ad-creatives';
