-- Financeiro, entrega 1: recebimento com valor real e motivo, moedas e conversão. (Aplicada em 09/11/2026.)
alter table public.agency_billing
  add column if not exists currency text,
  add column if not exists received_amount numeric,
  add column if not exists received_reason text,
  add column if not exists received_note text,
  add column if not exists fx_rate numeric,
  add column if not exists received_amount_base numeric;

alter table public.agencies
  add column if not exists base_currency text not null default 'BRL';
update public.agencies set base_currency = 'USD' where id = 7 and base_currency = 'BRL';
