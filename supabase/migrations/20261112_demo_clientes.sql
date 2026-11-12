-- Clientes de demonstração (Canguru e Joey) com dados fictícios, para prints dos guias e para mostrar a Bolsa ao vivo.
-- Ficam marcados com clients.is_demo = true: fora das métricas, do financeiro (sem valor), das pendências e do Painel de Conteúdo.
alter table public.clients add column if not exists is_demo boolean not null default false;

do $$
declare
  wesley uuid := '5f8f7e4c-aebc-494c-8377-ec05e467dee8';
  c_bella uuid; c_brazuca uuid; c_dental uuid;
  b uuid; d date; i int; st text; src text; ts bigint := 1794500000000;
  bella_stages text[] := array['Novo Lead','Em conversa','Avaliação agendada','Proposta enviada','Fechado','Perdido'];
  brazuca_stages text[] := array['New lead','Quote sent','Visit scheduled','Booked','Recurring client','Lost'];
  nomes_bella text[] := array['Ana Paula Ribeiro','Juliana Costa','Fernanda Lima','Mariana Alves','Patrícia Souza','Carla Mendes','Beatriz Rocha','Larissa Martins','Gabriela Nunes','Renata Dias','Aline Teixeira','Camila Freitas','Vanessa Moreira','Tatiane Barros','Priscila Gomes','Daniela Araújo','Letícia Cardoso','Isabela Pinto','Natália Ramos','Bruna Castro','Simone Duarte','Lívia Monteiro','Débora Farias','Raquel Batista'];
  nomes_brazuca text[] := array['Jessica Miller','Ashley Johnson','Mariana Souza','Emily Davis','Lucas Pereira','Sarah Wilson','Daniela Santos','Megan Brown','Rafael Lima','Brittany Taylor','Amanda Garcia','Kevin Martinez','Patrícia Oliveira','Lauren Anderson','Thiago Costa','Nicole Thomas','Rachel Moore','Bruno Almeida','Samantha White','Juliana Rocha','Tyler Harris','Kelly Clark','Fernanda Silva','Chris Lewis'];
  servicos_bella text[] := array['Limpeza de pele','Botox','Preenchimento','Peeling','Drenagem','Depilação a laser'];
  servicos_brazuca text[] := array['Standard cleaning','Deep cleaning','Move-out','Recurring weekly','Airbnb turnover','Post-construction'];
  cidades_bella text[] := array['Pinheiros','Vila Madalena','Perdizes','Moema','Itaim Bibi','Butantã'];
  cidades_brazuca text[] := array['Orlando','Kissimmee','Winter Park','Lake Nona','Windermere','Sanford'];
begin
  -- ---------------------------------------------------------------- Canguru · Studio Bella Estética
  insert into public.clients (name, responsible, email, agency_id, client_status, onboarding_status, onboarding_completed, onboarding_completed_at,
    campaign_live_at, is_active, is_demo, services, traffic_platforms, currency, initials, color, acquired_by_user_id, base_value, features_settings, traffic_strategy_data, instagram)
  values ('Studio Bella Estética', 'Camila Rocha', 'demo.studiobella@cangurudigital.com.br', 1, 'active', 'concluido', true, now() - interval '40 days',
    now() - interval '30 days', true, true, array['Tráfego Pago','Social Media'], array['meta','google'], 'BRL', 'SB', '#5C264A', wesley, 0,
    '{"crm": true, "criativos": true, "mapa": true}'::jsonb,
    '{"language": "pt", "created_via": "demo", "website_url": "www.studiobella.com.br", "instagram_url": "@studiobellaestetica"}'::jsonb, '@studiobellaestetica')
  returning id into c_bella;

  -- ---------------------------------------------------------------- Joey · Brazuca Cleaning Co. (Orlando)
  insert into public.clients (name, responsible, email, agency_id, client_status, onboarding_status, onboarding_completed, onboarding_completed_at,
    campaign_live_at, is_active, is_demo, services, traffic_platforms, currency, initials, color, acquired_by_user_id, base_value, features_settings, traffic_strategy_data, instagram)
  values ('Brazuca Cleaning Co.', 'Renata Alves', 'demo.brazuca@joeygrowth.com', 7, 'active', 'concluido', true, now() - interval '40 days',
    now() - interval '30 days', true, true, array['Tráfego Pago','Social Media'], array['meta','google'], 'USD', 'BC', '#10606E', wesley, 0,
    '{"crm": true, "criativos": true, "mapa": true}'::jsonb,
    '{"language": "pt", "created_via": "demo", "website_url": "www.brazucacleaning.com", "instagram_url": "@brazucacleaning"}'::jsonb, '@brazucacleaning')
  returning id into c_brazuca;

  -- ---------------------------------------------------------------- Joey · cliente em onboarding (para o guia do onboarding da Joey)
  insert into public.clients (name, responsible, email, agency_id, client_status, onboarding_status, onboarding_completed_at,
    is_active, is_demo, services, traffic_platforms, currency, initials, color, acquired_by_user_id, acquisition_ref, base_value, features_settings, traffic_strategy_data, instagram)
  values ('Sorriso Orlando Dental', 'Dr. Paulo Mendes', 'demo.sorriso@joeygrowth.com', 7, 'prospect', 'concluido', now() - interval '2 days',
    false, true, array['Tráfego Pago'], array['meta','google'], 'USD', 'SO', '#1A3A5C', wesley, 'wesley7', 0,
    '{"active_briefing_types": []}'::jsonb,
    jsonb_build_object('language','pt','created_via','public_onboarding','agency_slug','joey','registration_step',5,
      'website_url','www.sorrisoorlando.com','phone','+1 407 555 0142','instagram_url','@sorrisoorlando',
      'contract_accepted_at', now() - interval '2 days',
      'servicos_marcados', jsonb_build_array('Tráfego Pago'),
      'onboarding_briefing', jsonb_build_object(
        'oferta','Clínica odontológica para a comunidade brasileira em Orlando: limpeza, clareamento, implantes e lentes de contato dental. Atendimento em português.',
        'ticket_medio','$ 450','objetivo','Receber contatos no WhatsApp',
        'regiao','Orlando, Kissimmee e Winter Garden (FL)',
        'publico','Brasileiros de 25 a 55 anos que moram na região de Orlando e preferem ser atendidos em português.',
        'faixas_etarias', jsonb_build_array('25-34','35-44','45-54'),
        'diferencial','Equipe toda brasileira, aceita os principais seguros e faz orçamento na hora.',
        'concorrentes','Clínicas americanas da região e dentistas brasileiros que atendem em casa.',
        'investimento_mensal','$ 1,500 a $ 3,000/mês','ja_anunciou','Não','historico','Só indicação e Instagram orgânico.',
        'canal_de_venda','WhatsApp e telefone','observacoes','Cliente de demonstração da Joey.','servicos', jsonb_build_array('Tráfego Pago'))),
    '@sorrisoorlando')
  returning id into c_dental;
  insert into public.client_platform_access (client_id, agency_id, platform, situation, status, account_ref, contact_email, updated_at) values
    (c_dental, 7, 'meta', 'has_account', 'verified', 'act_000000000', null, now() - interval '1 day'),
    (c_dental, 7, 'google', 'needs_account', 'agency_creating', null, 'paulo@sorrisoorlando.com', now() - interval '1 day');
  insert into public.client_briefings (client_id, agency_id, briefing_type, responses, is_completed, completed_at)
  select c_dental, 7, 'onboarding', traffic_strategy_data->'onboarding_briefing', true, now() - interval '2 days' from public.clients where id = c_dental;

  -- ---------------------------------------------------------------- planos do mês (Painel de Conteúdo)
  insert into public.client_monthly_plans (client_id, agency_id, month, year, is_released, theme, objectives, key_dates, campaigns) values
    (c_bella, 1, 11, 2026, true, 'Pele pronta para o verão', array['Trazer avaliações pelo WhatsApp','Mostrar resultados reais'], '{}'::text[], '{}'::text[]),
    (c_brazuca, 7, 11, 2026, true, 'Holiday cleaning season', array['Book deep cleanings before the holidays','Show real before & after'], '{}'::text[], '{}'::text[]);

  -- ---------------------------------------------------------------- posts (2 publicados, 1 aprovado, 3 para aprovar)
  insert into public.posts (date_key, client_id, agency_id, status, type, platform, theme, bullets, caption, image_url, scheduled_time, last_updated, is_deleted) values
    ('03-11-2026-meta-' || c_bella || '-' || ts,     c_bella, 1, 'published', 'Estático', 'instagram', '3 cuidados com a pele no verão', '{}'::text[], 'Verão pede cuidado redobrado: protetor todo dia, hidratação e limpeza na medida certa. Salve para lembrar!', '/demo/canguru/post-1.jpg', '18:00', now() - interval '9 days', false),
    ('06-11-2026-meta-' || c_bella || '-' || ts+1,   c_bella, 1, 'published', 'Carrossel', 'instagram', 'Limpeza de pele: antes e depois', '{}'::text[], 'Uma sessão, pele renovada. Arraste para ver o resultado da nossa cliente. Agende sua avaliação pelo link da bio.', '/demo/canguru/post-2.jpg', '12:00', now() - interval '7 days', false),
    ('10-11-2026-meta-' || c_bella || '-' || ts+2,   c_bella, 1, 'approved', 'Reels', 'instagram', 'Conheça quem cuida de você', '{}'::text[], 'Quatro esteticistas, mais de 10 anos de experiência e um cuidado que você sente na primeira visita.', '/demo/canguru/post-3.jpg', '19:00', now() - interval '3 days', false),
    ('14-11-2026-meta-' || c_bella || '-' || ts+3,   c_bella, 1, 'pending_approval', 'Estático', 'instagram', 'Black Friday: 20% off', '{}'::text[], 'Black Friday no Studio Bella: 20% off em todos os protocolos, só até domingo. Vagas limitadas, chame no WhatsApp.', '/demo/canguru/post-4.jpg', '10:00', now() - interval '1 day', false),
    ('18-11-2026-meta-' || c_bella || '-' || ts+4,   c_bella, 1, 'pending_approval', 'Carrossel', 'instagram', 'Mito ou verdade: botox', '{}'::text[], 'Botox deixa o rosto artificial? Feito do jeito certo, ninguém percebe. Só você. Arraste para entender.', '/demo/canguru/post-5.jpg', '18:00', now() - interval '1 day', false),
    ('21-11-2026-meta-' || c_bella || '-' || ts+5,   c_bella, 1, 'pending_approval', 'Estático', 'instagram', 'Depoimento da Camila', '{}'::text[], '"Saí outra pessoa." A Camila fez o protocolo de 4 sessões e contou como foi.', '/demo/canguru/post-6.jpg', '12:00', now() - interval '1 day', false),
    ('03-11-2026-meta-' || c_brazuca || '-' || ts,   c_brazuca, 7, 'published', 'Estático', 'instagram', '3 spots everyone forgets', '{}'::text[], 'Light switches, baseboards and the top of the fridge. Save this for your next cleaning day!', '/demo/joey/post-1.jpg', '18:00', now() - interval '9 days', false),
    ('06-11-2026-meta-' || c_brazuca || '-' || ts+1, c_brazuca, 7, 'published', 'Carrossel', 'instagram', 'Move-out before & after', '{}'::text[], 'Move-out cleaning in Kissimmee. Swipe to see the difference and get your full deposit back.', '/demo/joey/post-2.jpg', '12:00', now() - interval '7 days', false),
    ('10-11-2026-meta-' || c_brazuca || '-' || ts+2, c_brazuca, 7, 'approved', 'Reels', 'instagram', 'Meet the team', '{}'::text[], 'Family owned and Orlando based. Brazilian care, insured and background checked.', '/demo/joey/post-3.jpg', '19:00', now() - interval '3 days', false),
    ('14-11-2026-meta-' || c_brazuca || '-' || ts+3, c_brazuca, 7, 'pending_approval', 'Estático', 'instagram', 'Holiday special: 15% off', '{}'::text[], 'Holiday special: 15% off deep cleaning. Book before Nov 30, limited spots.', '/demo/joey/post-4.jpg', '10:00', now() - interval '1 day', false),
    ('18-11-2026-meta-' || c_brazuca || '-' || ts+4, c_brazuca, 7, 'pending_approval', 'Carrossel', 'instagram', 'Review from Jessica', '{}'::text[], '"Best cleaning in Orlando." Thank you, Jessica! Five stars from Winter Park.', '/demo/joey/post-5.jpg', '18:00', now() - interval '1 day', false),
    ('21-11-2026-meta-' || c_brazuca || '-' || ts+5, c_brazuca, 7, 'pending_approval', 'Estático', 'instagram', 'FAQ: do I need to be home?', '{}'::text[], 'No! Most clients leave a door code and we text you when we finish.', '/demo/joey/post-6.jpg', '12:00', now() - interval '1 day', false);

  -- ---------------------------------------------------------------- CRM
  insert into public.client_lead_configs (client_id, agency_id, is_enabled, crm_profile, kanban_stages, specialty_options, location_options) values
    (c_bella, 1, true, 'padrao', to_jsonb(bella_stages), to_jsonb(servicos_bella), to_jsonb(cidades_bella)),
    (c_brazuca, 7, true, 'padrao', to_jsonb(brazuca_stages), to_jsonb(servicos_brazuca), to_jsonb(cidades_brazuca));
  perform setseed(0.42);
  for i in 1..24 loop
    st := bella_stages[1 + floor(random() * 6)::int];
    src := case when random() < .65 then 'Meta Ads' else 'Google Ads' end;
    insert into public.client_leads (client_id, agency_id, lead_date, lead_name, phone, source, origin, specialty, quality, potential, kanban_stage, closed, deal_value, closed_at, position)
    values (c_bella, 1, current_date - (i * 30 / 24), nomes_bella[i], '(11) 9' || lpad((80000000 + i * 137)::text, 8, '0'), src, cidades_bella[1 + (i % 6)],
      servicos_bella[1 + (i % 6)], case when random() < .75 then 'bom' else 'ruim' end, case when random() < .45 then 'alto' else 'baixo' end,
      st, st = 'Fechado', case when st = 'Fechado' then (array[149,890,1200,350,180,690])[1 + (i % 6)] end, case when st = 'Fechado' then current_date - (i * 30 / 24) + 3 end, i);
    st := brazuca_stages[1 + floor(random() * 6)::int];
    src := case when random() < .55 then 'Meta Ads' else 'Google Ads' end;
    insert into public.client_leads (client_id, agency_id, lead_date, lead_name, phone, source, origin, specialty, quality, potential, kanban_stage, closed, deal_value, closed_at, position)
    values (c_brazuca, 7, current_date - (i * 30 / 24), nomes_brazuca[i], '+1 407 555 ' || lpad((1000 + i * 37)::text, 4, '0'), src, cidades_brazuca[1 + (i % 6)],
      servicos_brazuca[1 + (i % 6)], case when random() < .75 then 'bom' else 'ruim' end, case when random() < .45 then 'alto' else 'baixo' end,
      st, st in ('Booked','Recurring client'), case when st in ('Booked','Recurring client') then (array[129,249,199,480,160,390])[1 + (i % 6)] end,
      case when st in ('Booked','Recurring client') then current_date - (i * 30 / 24) + 2 end, i);
  end loop;

  -- ---------------------------------------------------------------- tráfego: 30 dias, Meta e Google
  for i in 0..29 loop
    d := current_date - 30 + i;
    insert into public.paid_traffic_daily (client_id, agency_id, report_date, platform, investment, impressions, clicks, conversions, cpc, cpm, ctr)
    select c, a, d, p, inv, imp, clk, conv, round(inv / greatest(clk, 1), 2), round(inv / greatest(imp, 1) * 1000, 2), round(clk::numeric / greatest(imp, 1) * 100, 2)
    from (values
      (c_bella, 1, 'meta', round((38 + random() * 14)::numeric, 2), (2600 + floor(random() * 900))::int, (70 + floor(random() * 40))::int, (2 + floor(random() * 4))::int),
      (c_bella, 1, 'google', round((22 + random() * 10)::numeric, 2), (420 + floor(random() * 200))::int, (30 + floor(random() * 18))::int, (1 + floor(random() * 3))::int),
      (c_brazuca, 7, 'meta', round((28 + random() * 10)::numeric, 2), (2100 + floor(random() * 800))::int, (55 + floor(random() * 30))::int, (1 + floor(random() * 4))::int),
      (c_brazuca, 7, 'google', round((24 + random() * 9)::numeric, 2), (380 + floor(random() * 160))::int, (26 + floor(random() * 14))::int, (1 + floor(random() * 3))::int)
    ) v(c, a, p, inv, imp, clk, conv);
  end loop;
  insert into public.client_media_budgets (agency_id, client_id, month_year, platform, budget_amount) values
    (1, c_bella, '2026-11', 'meta', 1500), (1, c_bella, '2026-11', 'google', 900),
    (7, c_brazuca, '2026-11', 'meta', 1000), (7, c_brazuca, '2026-11', 'google', 800);

  -- ---------------------------------------------------------------- criativos para aprovar
  insert into public.creative_batches (agency_id, client_id, title, description, status, public_token, created_by, sent_at)
  values (1, c_bella, 'Campanha Black Friday', 'Três peças para Meta: feed e stories.', 'sent', replace(gen_random_uuid()::text, '-', ''), wesley, now() - interval '1 day') returning id into b;
  insert into public.creative_items (batch_id, client_id, position, kind, title, caption, placement, media, status) values
    (b, c_bella, 1, 'image', 'Oferta limpeza de pele', 'Limpeza de pele por R$ 149, com avaliação inclusa. Chame no WhatsApp.', 'Feed', '[{"type":"image","url":"/demo/canguru/criativo-1.jpg","name":"criativo-1.jpg"}]'::jsonb, 'pending'),
    (b, c_bella, 2, 'image', 'Avaliação gratuita de botox', 'Botox com quem entende. Agende sua avaliação sem custo.', 'Feed', '[{"type":"image","url":"/demo/canguru/criativo-2.jpg","name":"criativo-2.jpg"}]'::jsonb, 'pending'),
    (b, c_bella, 3, 'image', 'Stories verão', 'Sua pele pronta para o verão. Vagas da semana abertas.', 'Stories', '[{"type":"image","url":"/demo/canguru/criativo-3.jpg","name":"criativo-3.jpg"}]'::jsonb, 'pending');
  insert into public.creative_batches (agency_id, client_id, title, description, status, public_token, created_by, sent_at)
  values (7, c_brazuca, 'Holiday campaign', 'Three pieces for Meta: feed and stories.', 'sent', replace(gen_random_uuid()::text, '-', ''), wesley, now() - interval '1 day') returning id into b;
  insert into public.creative_items (batch_id, client_id, position, kind, title, caption, placement, media, status) values
    (b, c_brazuca, 1, 'image', 'House cleaning from $129', 'Free estimate. Recurring discounts, insured team.', 'Feed', '[{"type":"image","url":"/demo/joey/criativo-1.jpg","name":"criativo-1.jpg"}]'::jsonb, 'pending'),
    (b, c_brazuca, 2, 'image', 'Move-out from $199', 'Get your deposit back. Text us for a quote.', 'Feed', '[{"type":"image","url":"/demo/joey/criativo-2.jpg","name":"criativo-2.jpg"}]'::jsonb, 'pending'),
    (b, c_brazuca, 3, 'image', 'Weekly cleaning stories', 'Same team every visit. Book in 2 minutes.', 'Stories', '[{"type":"image","url":"/demo/joey/criativo-3.jpg","name":"criativo-3.jpg"}]'::jsonb, 'pending');
end $$;

-- O cliente de teste do onboarding da Canguru vira demonstração também
update public.clients set is_demo = true, name = 'Hamburgueria do Bairro', responsible = 'Marina Souza'
where id = 'e3c7db15-a1cf-4f83-ae41-0767c45ede61';
