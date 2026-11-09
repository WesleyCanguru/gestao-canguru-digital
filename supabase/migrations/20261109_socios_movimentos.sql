-- Retiradas e aportes dos sócios (Joey). Retirada não é despesa: mexe no caixa e na conta do sócio, não no lucro.
create table if not exists public.agency_partner_moves (
  id uuid primary key default gen_random_uuid(),
  agency_id integer not null,
  partner_user_id uuid,
  partner_name text not null,
  kind text not null check (kind in ('aporte','retirada')),
  amount numeric not null check (amount > 0),
  move_date date not null default current_date,
  note text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists agency_partner_moves_agency_date on public.agency_partner_moves (agency_id, move_date);
alter table public.agency_partner_moves enable row level security;
drop policy if exists partner_moves_staff_all on public.agency_partner_moves;
create policy partner_moves_staff_all on public.agency_partner_moves for all to authenticated
  using (public.i_am_staff_of(agency_id)) with check (public.i_am_staff_of(agency_id));
