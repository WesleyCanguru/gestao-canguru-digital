-- Desfaz 20261125_page_visits_site_click.sql (apaga os cliques no site antes de voltar a regra antiga).
delete from public.page_visits where event_type = 'site_click';
alter table public.page_visits drop constraint if exists page_visits_event_type_check;
alter table public.page_visits add constraint page_visits_event_type_check
  check (event_type in ('open','read_time','whatsapp_click'));
