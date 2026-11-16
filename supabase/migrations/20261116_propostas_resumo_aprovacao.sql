-- Propostas: parada de aprovação ("Resumo para aprovar") antes de gerar a landing page.
-- Aditiva: novas colunas, índice e o status 'summary' somado aos que já existem. Nada é apagado.
alter table public.proposals
  add column if not exists summary jsonb,
  add column if not exists summary_instructions text,
  add column if not exists summary_created_at timestamptz,
  add column if not exists summary_approved_at timestamptz,
  add column if not exists summary_approved_by uuid,
  add column if not exists source_ref text;

comment on column public.proposals.summary is 'Resumo para aprovar: destinatário, decisor, serviço, investimento, opcionais, prazo, validade, pontos a confirmar.';
comment on column public.proposals.source_ref is 'Origem da reunião (ex.: gdrive:<id do arquivo de Anotações do Gemini>). Evita resumo duplicado.';

create unique index if not exists proposals_agency_source_ref_key
  on public.proposals (agency_id, source_ref) where source_ref is not null;

-- Status novo 'summary' (amplia a lista; os valores antigos continuam válidos).
alter table public.proposals drop constraint if exists proposals_status_check;
alter table public.proposals add constraint proposals_status_check
  check (status = any (array['summary'::text, 'draft'::text, 'sent'::text, 'accepted'::text, 'declined'::text]));
