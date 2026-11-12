-- Desfaz os clientes de demonstração.
delete from public.social_metrics where client_id in (select id from public.clients where is_demo);
delete from public.paid_traffic_daily where client_id in (select id from public.clients where is_demo);
delete from public.client_media_budgets where client_id in (select id from public.clients where is_demo);
delete from public.client_health_scores where client_id in (select id from public.clients where is_demo);
delete from public.clients where is_demo;
alter table public.clients drop column if exists is_demo;
