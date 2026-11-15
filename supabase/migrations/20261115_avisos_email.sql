-- Avisos por e-mail (Resend). Tudo passa pela fila email_outbox; a edge function notify-dispatch envia a cada 5 minutos.
-- Começa DESLIGADO para clientes: cada cliente tem notify_enabled (padrão false) e notify_emails.
-- Equipe: notification_settings por agência (ligado para Canguru e Joey; destinatários = masters ativos se team_emails vazio).

alter table public.clients add column if not exists notify_enabled boolean not null default false;
alter table public.clients add column if not exists notify_emails text[] not null default '{}';
alter table public.clients add column if not exists city text;

create table if not exists public.notification_settings (
  agency_id int primary key references public.agencies(id) on delete cascade,
  team_enabled boolean not null default false,
  team_emails text[] not null default '{}',
  client_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.notification_settings enable row level security;
drop policy if exists ns_staff on public.notification_settings;
create policy ns_staff on public.notification_settings for all to authenticated
  using (agency_id = any (app.staff_agencies())) with check (agency_id = any (app.staff_agencies()));
insert into public.notification_settings (agency_id, team_enabled) values (1, true), (7, true) on conflict do nothing;

create table if not exists public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  agency_id int not null,
  client_id uuid,
  audience text not null check (audience in ('client','team')),
  kind text not null,
  ref_id uuid,
  payload jsonb not null default '{}',
  dedupe_key text unique,
  status text not null default 'queued' check (status in ('queued','sent','skipped','failed','merged')),
  to_emails text[],
  subject text,
  error text,
  send_after timestamptz not null default now(),
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index if not exists email_outbox_queue on public.email_outbox (status, send_after);
create index if not exists email_outbox_ref on public.email_outbox (ref_id, kind);
alter table public.email_outbox enable row level security;
drop policy if exists eo_staff_read on public.email_outbox;
create policy eo_staff_read on public.email_outbox for select to authenticated using (agency_id = any (app.staff_agencies()));

create or replace function public._is_staff_of(ag int) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.agency_members where user_id = auth.uid() and agency_id = ag and is_active)
$$;

-- Post: entrou em "esperando aprovação" -> e-mail ao cliente (espera 3 min para juntar lote).
--       cliente aprovou / pediu ajuste / reprovou -> e-mail à equipe.
create or replace function public.trg_posts_notify() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is not distinct from old.status then return new; end if;
  if new.status = 'pending_approval' then
    insert into public.email_outbox (agency_id, client_id, audience, kind, ref_id, send_after, dedupe_key)
    values (new.agency_id, new.client_id, 'client', 'post_pending', new.id, now() + interval '3 minutes',
            'post_pending:' || new.id || ':' || to_char(now(), 'YYYYMMDDHH24MI'))
    on conflict (dedupe_key) do nothing;
  elsif old.status = 'pending_approval' and new.status in ('approved','changes_requested','rejected')
        and not public._is_staff_of(new.agency_id) then
    insert into public.email_outbox (agency_id, client_id, audience, kind, ref_id, dedupe_key)
    values (new.agency_id, new.client_id, 'team', 'post_' || new.status, new.id,
            'team_post:' || new.id || ':' || new.status || ':' || to_char(now(), 'YYYYMMDDHH24MI'))
    on conflict (dedupe_key) do nothing;
  end if;
  return new;
end $$;
drop trigger if exists posts_notify on public.posts;
create trigger posts_notify after update of status on public.posts for each row execute function public.trg_posts_notify();

-- Onboarding: cliente pediu ajuda com a conta do Meta/Google -> e-mail à equipe na hora.
create or replace function public.trg_access_help_notify() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'help' and (tg_op = 'INSERT' or old.status is distinct from 'help') then
    insert into public.email_outbox (agency_id, client_id, audience, kind, payload, dedupe_key)
    values (new.agency_id, new.client_id, 'team', 'access_help', jsonb_build_object('platform', new.platform),
            'access_help:' || new.client_id || ':' || new.platform || ':' || to_char(now(), 'YYYYMMDDHH24'))
    on conflict (dedupe_key) do nothing;
  end if;
  return new;
end $$;
drop trigger if exists access_help_notify on public.client_platform_access;
create trigger access_help_notify after insert or update of status on public.client_platform_access for each row execute function public.trg_access_help_notify();
