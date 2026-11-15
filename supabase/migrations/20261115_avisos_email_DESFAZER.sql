-- Desfaz os avisos por e-mail.
select cron.unschedule('avisos-email') where exists (select 1 from cron.job where jobname = 'avisos-email');
drop trigger if exists posts_notify on public.posts;
drop trigger if exists access_help_notify on public.client_platform_access;
drop function if exists public.trg_posts_notify();
drop function if exists public.trg_access_help_notify();
drop table if exists public.email_outbox;
drop table if exists public.notification_settings;
alter table public.clients drop column if exists notify_enabled, drop column if exists notify_emails, drop column if exists city;
