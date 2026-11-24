drop function if exists public.check_cron_secret(text);
delete from vault.secrets where name = 'cron_secret';
