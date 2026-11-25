-- page_visits passa a aceitar o evento site_click (clique no link do site da Canguru nas páginas de apresentação).
-- Desfazer: 20261125_page_visits_site_click_DESFAZER.sql
alter table public.page_visits drop constraint if exists page_visits_event_type_check;
alter table public.page_visits add constraint page_visits_event_type_check
  check (event_type in ('open','read_time','whatsapp_click','site_click'));
