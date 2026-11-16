-- Desfaz 20261116_propostas_resumo_aprovacao (só rodar se não houver linhas com status 'summary').
update public.proposals set status = 'draft' where status = 'summary';
alter table public.proposals drop constraint if exists proposals_status_check;
alter table public.proposals add constraint proposals_status_check
  check (status = any (array['draft'::text, 'sent'::text, 'accepted'::text, 'declined'::text]));
drop index if exists public.proposals_agency_source_ref_key;
-- As colunas novas podem ficar (sem uso). Para remover:
-- alter table public.proposals drop column summary, drop column summary_instructions, drop column summary_created_at,
--   drop column summary_approved_at, drop column summary_approved_by, drop column source_ref;
