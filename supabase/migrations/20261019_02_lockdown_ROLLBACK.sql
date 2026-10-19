-- Emergência: desfaz o corte de segurança (volta ao comportamento aberto anterior).
do $$
declare r record;
begin
  for r in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I disable row level security', r.tablename);
  end loop;
end $$;
update storage.buckets set public = true where id = 'client-documents';
create policy rollback_docs_all on storage.objects for all to anon, authenticated
  using (bucket_id = 'client-documents') with check (bucket_id = 'client-documents');
create policy rollback_uploads_all on storage.objects for all to anon, authenticated
  using (bucket_id = 'post-uploads') with check (bucket_id = 'post-uploads');
