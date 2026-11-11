-- Volta a regra de leitura dos arquivos de criativos ao que foi aplicado em 20261111_criativos_aprovacao.sql
drop policy if exists creatives_read on storage.objects;
create policy creatives_read on storage.objects for select to authenticated
  using (bucket_id = 'ad-creatives' and (
    app.can_client(app.file_client(name))
    or app.try_uuid((storage.foldername(name))[2]) = any (app.creative_grant_batches())
  ));
