-- Documentos internos (manual da marca, time, plano): guides com audience = 'interno'.
-- Só a equipe e os sócios da agência leem (guides_staff_read já cobre). O link /g/ deles não abre sem login.
alter table public.guides drop constraint if exists guides_audience_check;
alter table public.guides add constraint guides_audience_check check (audience = any (array['socio','cliente','equipe','interno']));
drop policy if exists guides_public_read on public.guides;
create policy guides_public_read on public.guides for select to anon, authenticated using (is_published and audience <> 'interno');
