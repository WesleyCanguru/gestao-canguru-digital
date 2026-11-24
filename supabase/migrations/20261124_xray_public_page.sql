-- Página pública do Raio-X (/x/<token>): um link por cliente, que mostra sempre o Raio-X mais recente.
alter table public.clients add column if not exists xray_public_token text unique;
