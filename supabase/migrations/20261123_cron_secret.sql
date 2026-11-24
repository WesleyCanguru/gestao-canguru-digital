-- 23/11/2026: segredo do pg_cron para as Edge Functions agendadas (aplicado pelo Claude).
-- O valor é gerado no banco e fica só no Vault; nunca aparece em código.
select vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'), 'cron_secret',
  'Segredo enviado pelo pg_cron no header x-cron-secret para as Edge Functions agendadas');

create or replace function public.check_cron_secret(p_secret text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(length(p_secret), 0) >= 32 and exists (
    select 1 from vault.decrypted_secrets where name = 'cron_secret' and decrypted_secret = p_secret
  );
$$;
revoke all on function public.check_cron_secret(text) from public, anon, authenticated;
grant execute on function public.check_cron_secret(text) to service_role;
