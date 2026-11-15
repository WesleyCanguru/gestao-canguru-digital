-- Desfaz: Brazuca Cleaning Co. (demo Joey) volta para português.
update public.clients set traffic_strategy_data = jsonb_set(coalesce(traffic_strategy_data,'{}'::jsonb), '{language}', '"pt"') where id = 'bd880a7a-0449-490a-ac30-41e4e682d5c6';
