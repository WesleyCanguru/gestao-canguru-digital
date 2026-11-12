-- Desfaz os guias da Joey.
delete from public.guide_versions where guide_id in (select id from public.guides where agency_id = 7 and slug in ('joey-trafego','joey-trafego-e-redes','joey-trafego-site-e-redes','joey-redes-sociais','joey-onboarding'));
delete from public.guides where agency_id = 7 and slug in ('joey-trafego','joey-trafego-e-redes','joey-trafego-site-e-redes','joey-redes-sociais','joey-onboarding');
