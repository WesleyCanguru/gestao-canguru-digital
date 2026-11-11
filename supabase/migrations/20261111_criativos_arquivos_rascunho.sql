-- Arquivos de criativos: o cliente logado só vê arquivos de lotes já enviados (rascunho fica só para a equipe).
-- Equipe e link do lote continuam iguais (app.can_see_creative_batch cobre os três casos).
drop policy if exists creatives_read on storage.objects;
create policy creatives_read on storage.objects for select to authenticated
  using (bucket_id = 'ad-creatives' and app.can_see_creative_batch(app.try_uuid((storage.foldername(name))[2])));
