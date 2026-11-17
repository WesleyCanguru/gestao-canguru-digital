-- Guias da Joey em inglês: mesmos ajustes feitos nos guias PT em 17/11/2026.
-- Rodar DEPOIS de 20261113_guias_joey_en.sql. Idempotente: só muda o que ainda não mudou.
-- Para desfazer: em Operação › Guias, Versões anteriores › voltar para a versão 1.
DO $$
DECLARE g record; c jsonb; lead jsonb; site jsonb; secs jsonb; steps jsonb;
BEGIN
FOR g IN SELECT * FROM public.guides WHERE agency_id = 7 AND slug IN ('joey-trafego-en','joey-trafego-e-redes-en','joey-trafego-site-e-redes-en','joey-redes-sociais-en') LOOP
  c := g.content;
  c := replace(c::text, 'Budget usage: how much of the monthly budget has been spent and how much is left.',
                        'Ad budget usage: how much of this month''s ad budget has been spent and how much is left.')::jsonb;

  IF g.slug IN ('joey-trafego-en','joey-trafego-e-redes-en','joey-trafego-site-e-redes-en')
     AND NOT (c::text LIKE '%New leads land in your CRM on their own%') THEN
    lead := jsonb_build_object('who','Team','tone','equipe','title','New leads land in your CRM on their own',
      'text','The landing pages we use in your ads come connected to the Pouch CRM. Nobody has to copy contacts from spreadsheets, emails or WhatsApp.',
      'cards', jsonb_build_array(
        jsonb_build_object('title','1. Form','text','Someone clicks your ad, lands on the page and leaves their name and phone number.'),
        jsonb_build_object('title','2. CRM','text','The contact goes straight into your CRM, with its source tagged.'),
        jsonb_build_object('title','3. Instant alert','text','You get a new lead alert by email and on Telegram.'),
        jsonb_build_object('title','4. Your website too','text','Forms on the website we build or set up for you follow the same path.')));
    SELECT jsonb_agg(x ORDER BY o) INTO secs FROM (
      SELECT s x, (i*10) o FROM jsonb_array_elements(c->'sections') WITH ORDINALITY t(s,i)
      UNION ALL SELECT lead, (SELECT i*10-5 FROM jsonb_array_elements(c->'sections') WITH ORDINALITY t(s,i) WHERE s->>'title'='CRM: log every contact that comes in')) q;
    c := jsonb_set(c,'{sections}',secs);
    SELECT jsonb_agg(x ORDER BY o) INTO steps FROM (
      SELECT s x, (i*10) o FROM jsonb_array_elements(c->'steps') WITH ORDINALITY t(s,i)
      UNION ALL SELECT jsonb_build_object('who','Team','tone','equipe','title','Leads'), (SELECT i*10-5 FROM jsonb_array_elements(c->'steps') WITH ORDINALITY t(s,i) WHERE s->>'title'='CRM')) q;
    c := jsonb_set(c,'{steps}',steps);
  END IF;

  IF g.slug = 'joey-trafego-site-e-redes-en' THEN
    site := jsonb_build_object('who','Team','tone','equipe','title','Your website',
      'text','Your website is built in stages, and you approve each one before we move on. You don''t need to write anything or have professional photos: we take care of it.',
      'cards', jsonb_build_array(
        jsonb_build_object('title','1. Copy','text','Our copywriters, specialists in your type of business, write the copy with the help of AI. Already have copy? Send it and we''ll build on it. Don''t have any? We write it from scratch and you just approve.'),
        jsonb_build_object('title','2. Photos','text','Send the photos you have. We enhance them with AI and create new ones, always as close as possible to the reality of your business.'),
        jsonb_build_object('title','3. Layout','text','We send the first version as a link. You approve it or ask for changes.'),
        jsonb_build_object('title','4. Tracking','text','Before launch, we make your website trackable: Google Analytics plus the Google, Instagram and Facebook, TikTok and LinkedIn pixels, depending on the channels you use. Every visit and every lead is recorded.'),
        jsonb_build_object('title','5. Live','text','We publish it on your domain, with WhatsApp and the contact form connected to your CRM.')));
    SELECT jsonb_agg(CASE WHEN s->>'title'='Your website' THEN site ELSE s END ORDER BY i) INTO secs FROM jsonb_array_elements(c->'sections') WITH ORDINALITY t(s,i);
    c := jsonb_set(c,'{sections}',secs);
  END IF;

  IF c IS DISTINCT FROM g.content THEN
    INSERT INTO public.guide_versions(guide_id, version, content, instructions, created_at)
      VALUES (g.id, g.version, g.content, '17/11 Wesley: ad budget, leads into CRM with alerts, website (copy, photos, tracking)', now());
    UPDATE public.guides SET content = c, version = g.version + 1, updated_at = now() WHERE id = g.id;
  END IF;
END LOOP;
END $$;
