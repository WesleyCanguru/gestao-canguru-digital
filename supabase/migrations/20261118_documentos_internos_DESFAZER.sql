-- Desfaz 20261118_documentos_internos.sql. Antes, voltar os documentos internos para 'socio':
update public.guides set audience = 'socio' where audience = 'interno';
alter table public.guides drop constraint if exists guides_audience_check;
alter table public.guides add constraint guides_audience_check check (audience = any (array['socio','cliente','equipe']));
drop policy if exists guides_public_read on public.guides;
create policy guides_public_read on public.guides for select to anon, authenticated using (is_published);
