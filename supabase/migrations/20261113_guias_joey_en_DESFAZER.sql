-- Desfaz: remove os guias da Joey em inglês.
delete from public.guide_versions where guide_id in (select id from public.guides where agency_id = 7 and slug like 'joey-%-en');
delete from public.guides where agency_id = 7 and slug in ('joey-trafego-en','joey-trafego-e-redes-en','joey-trafego-site-e-redes-en','joey-redes-sociais-en');
