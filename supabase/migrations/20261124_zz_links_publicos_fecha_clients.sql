-- Correção 4/6, passo 3. Aplicar SÓ depois que o PR das páginas públicas (vitrine client_public_card) estiver no ar.
-- 1) Link público deixa de ler o cadastro completo do cliente (fica só a vitrine).
drop policy if exists read_own on public.clients;
create policy read_own on public.clients for select to authenticated
  using ((agency_id = any (app.staff_agencies())) or (id = any (app.member_clients())));

-- 2) Upload na pasta de documentos por link: só quem abriu um link de CONTRATO daquele cliente.
drop policy if exists bolsa_docs_insert on storage.objects;
create policy bolsa_docs_insert on storage.objects for insert to authenticated
  with check ((bucket_id = 'client-documents') and (app.can_client(app.file_client(name)) or (app.file_client(name) = any (app.scope_clients('contrato')))));

-- DESFAZER (volta exatamente ao que estava em 24/11/2026):
-- drop policy if exists read_own on public.clients;
-- create policy read_own on public.clients for select to authenticated
--   using ((agency_id = any (app.staff_agencies())) or (id = any (app.member_clients())) or (id = any (app.any_grant_clients())));
-- drop policy if exists bolsa_docs_insert on storage.objects;
-- create policy bolsa_docs_insert on storage.objects for insert to authenticated
--   with check ((bucket_id = 'client-documents') and (app.can_client(app.file_client(name)) or (app.file_client(name) = any (app.any_grant_clients()))));
