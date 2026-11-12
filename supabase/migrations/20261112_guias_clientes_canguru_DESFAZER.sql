-- Desfaz os guias de cliente da Canguru.
delete from public.guide_versions where guide_id in (select id from public.guides where agency_id = 1 and slug in ('trafego','trafego-e-redes','trafego-site-e-redes','redes-sociais'));
delete from public.guides where agency_id = 1 and slug in ('trafego','trafego-e-redes','trafego-site-e-redes','redes-sociais');
