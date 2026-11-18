-- Decisão do Wesley (18/11/2026): documentos internos continuam no menu próprio, mas o link /g/ abre para qualquer pessoa
-- (ex.: freelancer recebe o manual da marca). Volta a regra de leitura pública para todo guia publicado.
drop policy if exists guides_public_read on public.guides;
create policy guides_public_read on public.guides for select to anon, authenticated using (is_published);
