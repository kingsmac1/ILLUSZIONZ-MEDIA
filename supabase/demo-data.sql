-- =====================================================================
-- DEMO / TEST DATA for the Illuszionz dashboard + CRM.  >>> DELETE BEFORE GOING LIVE <<<
-- Run AFTER schema.sql. Everything here is identifiable and is removed by supabase/remove-demo-data.sql.
--   • contacts/bookings/submissions use the reserved address domain  demo.illuszionz.test  (can never receive email;
--     the automations and campaigns log them as "skipped" instead of sending)
--   • dates are relative to today, so the dashboard always looks alive
--   • price overrides are NOT seeded (they would change real prices)
-- Safe to run more than once (it clears its own previous demo rows first).
-- =====================================================================

-- 0) clear any previous demo rows
delete from public.email_log where to_email like '%@demo.illuszionz.test' or template_key = 'campaign' and campaign_id in (select id from public.email_campaigns where name like '[DEMO]%');
delete from public.email_campaigns where name like '[DEMO]%';
delete from public.email_sections where name like '[DEMO]%';
delete from public.segments where name like '[DEMO]%';
delete from public.promo_codes where description like '[DEMO]%';
delete from public.expenses where note like '[DEMO]%';
delete from public.other_income where note like '[DEMO]%';
delete from public.submissions where email like '%@demo.illuszionz.test';
delete from public.bookings where email like '%@demo.illuszionz.test';
delete from public.contacts where email like '%@demo.illuszionz.test';
delete from public.companies where notes like '[DEMO]%';

-- helper: stable ids so rows can reference each other
create or replace function pg_temp.cid(n int) returns uuid language sql immutable as $$ select ('c0000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid $$;
create or replace function pg_temp.coid(n int) returns uuid language sql immutable as $$ select ('c1000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid $$;

-- 1) companies
insert into public.companies (id, name, website, industry, phone, email, address, notes) values
  (pg_temp.coid(1), 'Lagos & Co Weddings', 'https://lagosandco.example', 'Wedding planning', '+447700900301', 'hello@lagosandco.demo.illuszionz.test', 'Shoreditch, London', '[DEMO] Refers a lot of brides.'),
  (pg_temp.coid(2), 'Northbridge Financial', 'https://northbridge.example', 'Finance', '+447700900302', 'events@northbridge.demo.illuszionz.test', 'Canary Wharf, London', '[DEMO] Annual conference + headshots.'),
  (pg_temp.coid(3), 'Pulse Events Agency', 'https://pulseevents.example', 'Events', '+447700900303', 'bookings@pulse.demo.illuszionz.test', 'Brixton, London', '[DEMO] Hires the 360 booth for corporate parties.');

-- 2) contacts  (n, name, email-local, phone, lifecycle, source, tags, city, instagram, birthday in N days (null = none), created N days ago, last activity N days ago, company, marketing opt-in)
insert into public.contacts (id, name, email, phone, company_id, lifecycle, source, tags, city, instagram, birthday, marketing_opt_in, created_at, last_activity_at, last_contacted_at, notes)
select pg_temp.cid(n), name, lcl || '@demo.illuszionz.test', phone, case when co > 0 then pg_temp.coid(co) end, life, src, tags, city, ig,
       case when bday is null then null else ((current_date + bday) - interval '31 years')::date end,
       optin, now() - (created || ' days')::interval, now() - (act || ' days')::interval, case when act < 60 then now() - ((act + 1) || ' days')::interval end, note
from (values
  (1,  'Ada Okafor',       'ada.okafor',      '+447700900101', 'vip',         'referral',  array['bride','repeat','demo'],        'London',        '@ada.okafor',   12,   150, 3,   1, true,  'Wedding Gold package, then a maternity shoot. Loves natural light.'),
  (2,  'Tobi Adeyemi',     'tobi.adeyemi',    '+447700900102', 'client',      'instagram', array['groom','demo'],                 'Croydon',       '@tobi.a',       40,   140, 9,   0, true,  'Pre-wedding shoot done; wedding next spring.'),
  (3,  'Chioma Eze',       'chioma.eze',      '+447700900103', 'client',      'booking',   array['maternity','demo'],             'Peckham',       '@chioma_eze',   20,   95,  20,  0, true,  ''),
  (4,  'Femi Balogun',     'femi.balogun',    '+447700900104', 'client',      'website',   array['corporate','demo'],             'Canary Wharf',  '',              null, 120, 30,  2, true,  'Books team headshots every quarter.'),
  (5,  'Ngozi Obi',        'ngozi.obi',       '+447700900105', 'lead',        'website',   array['demo'],                         'Lewisham',      '',              null, 4,   4,   0, true,  ''),
  (6,  'Samuel Johnson',   'samuel.johnson',  '+447700900106', 'opportunity', 'whatsapp',  array['wedding','demo'],               'Watford',       '@sam.j',        75,   12,  2,   0, true,  'Wedding 14 months away — comparing two photographers.'),
  (7,  'Amara Nwosu',      'amara.nwosu',     '+447700900107', 'client',      'booking',   array['baby','family','demo'],         'Woolwich',      '@amara.n',      8,    80,  14,  0, true,  ''),
  (8,  'David Mensah',     'david.mensah',    '+447700900108', 'lead',        'facebook',  array['events','demo'],                'Barking',       '',              null, 9,   9,   0, true,  ''),
  (9,  'Blessing Udoh',    'blessing.udoh',   '+447700900109', 'client',      'referral',  array['academy','demo'],               'Stratford',     '@blessing.u',   55,   60,  6,   0, true,  'Enrolled in Zero to Pro.'),
  (10, 'Kemi Adebayo',     'kemi.adebayo',    '+447700900110', 'vip',         'referral',  array['bride','repeat','demo'],        'Ealing',        '@kemi.a',       25,   200, 21,  1, true,  'Wedding + baby shoot + family session.'),
  (11, 'Jide Alabi',       'jide.alabi',      '+447700900111', 'inactive',    'instagram', array['demo'],                         'Hackney',       '',              null, 380, 300, 0, true,  ''),
  (12, 'Precious Ikenna',  'precious.ikenna', '+447700900112', 'opportunity', 'booking',   array['prewedding','demo'],            'Greenwich',     '@preciousi',    null, 15,  5,   0, true,  ''),
  (13, 'Michael Brown',    'michael.brown',   '+447700900113', 'lead',        'website',   array['videography','demo'],           'Brixton',       '',              null, 7,   3,   3, true,  'Wants a promo video for a product launch.'),
  (14, 'Sarah Williams',   'sarah.williams',  '+447700900114', 'client',      'event',     array['booth','corporate','demo'],     'Brixton',       '',              null, 90,  40,  3, true,  'Pulse Events — books the 360 booth monthly.'),
  (15, 'Oluwaseun Bello',  'seun.bello',      '+447700900115', 'lost',        'website',   array['demo'],                         'Slough',        '',              null, 70,  60,  0, true,  'Went with a cheaper photographer.'),
  (16, 'Grace Thompson',   'grace.thompson',  '+447700900116', 'subscriber',  'website',   array['newsletter','demo'],            'Bromley',       '',              null, 30,  30,  0, true,  ''),
  (17, 'Daniel Osei',      'daniel.osei',     '+447700900117', 'client',      'walk-in',   array['demo'],                         'Catford',       '',              null, 45,  25,  0, false, 'Asked not to receive marketing emails.')
) as t(n, name, lcl, phone, life, src, tags, city, ig, bday, created, act, co, optin, note);

-- 3) bookings  (ref, contact, flow, kind, packages, total, status, payment, paid, session in N days, time, created N days ago, source)
insert into public.bookings (ref, flow_id, kind, contact_id, name, email, phone, packages, details, items, total_text, total, quoted, event_date, event_time, status, payment_status, amount_paid, source, created_at, confirmed_at, completed_at, notes)
select ref, flow, kind, pg_temp.cid(n), c.name, c.email, c.phone, pkgs,
       jsonb_build_array(jsonb_build_array('Service', kind), jsonb_build_array('Package', pkgs), jsonb_build_array('Setting', setting)),
       jsonb_build_array(jsonb_build_object('label', pkgs, 'amount', case when total > 0 then '£' || total else 'Quoted' end)),
       case when total > 0 then '£' || total else 'To be quoted' end, total, total = 0,
       (current_date + ev)::date, tm, status, pay, paid, src, now() - (created || ' days')::interval,
       case when status in ('confirmed','completed') then now() - ((created - 1) || ' days')::interval end,
       case when status = 'completed' then ((current_date + ev) + time '18:00')::timestamptz end,
       b.notes
from (values
  ('DM0001', 1,  'wedding',     'Wedding enquiry',                    'Gold · 1 event + extra photographer',   1650, 'completed', 'Paid',         1650, -120, '11:00', 160, 'website', 'Studio',        'Church ceremony + reception.'),
  ('DM0002', 2,  'prewedding',  'Prewedding / engagement booking',    '2 Looks',                                400, 'completed', 'Paid',          400, -100, '15:00', 125, 'website', 'Outdoor',        ''),
  ('DM0003', 3,  'maternity',   'Maternity booking',                  'Couple · 1 Look',                        200, 'completed', 'Paid',          200,  -60, '13:00',  95, 'website', 'Studio',         ''),
  ('DM0004', 4,  'portrait',    'Portrait booking',                   '2 Looks + 24-hour express',              350, 'completed', 'Paid',          350,  -45, '10:00',  80, 'website', 'Studio',         'Team headshots.'),
  ('DM0005', 7,  'baby',        'Baby shoot booking',                 '2 Looks',                                250, 'completed', 'Paid',          250,  -30, '12:00',  60, 'website', 'Home / venue',   ''),
  ('DM0006', 10, 'wedding',     'Wedding enquiry',                    'Diamond · 2 events',                    2100, 'completed', 'Paid',         2100,  -75, '09:00', 190, 'website', 'Outdoor',        'Traditional + white wedding.'),
  ('DM0007', 14, 'booth',       '360 Booth booking',                  '360 Photo Booth · 4 hours',                0, 'completed', 'Paid',          480,  -20, '19:00',  50, 'website', 'Home / venue',   'Quoted £480 for the evening.'),
  ('DM0008', 9,  'academy',     'Academy enrolment',                  'Zero to Pro Photography',             1500, 'confirmed', 'Deposit Paid',   750,  -10, '10:00',  58, 'website', 'Online',         'Second instalment due next month.'),
  ('DM0009', 1,  'family',      'Family session booking',             'Family · 1 Look',                        220, 'confirmed', 'Deposit Paid',   110,    2, '14:00',   9, 'website', 'Studio',         ''),
  ('DM0010', 3,  'portrait',    'Portrait booking',                   '1 Look',                                 170, 'confirmed', 'Not Paid',         0,    4, '11:30',   6, 'website', 'Studio',         ''),
  ('DM0011', 12, 'prewedding',  'Prewedding / engagement booking',    '3 Looks',                                500, 'confirmed', 'Deposit Paid',   250,    9, '16:00',  10, 'website', 'Outdoor',        'Golden-hour shoot at Greenwich Park.'),
  ('DM0012', 4,  'portrait',    'Portrait booking',                   '2 Looks',                                300, 'new',       'Not Paid',         0,   14, '10:00',   1, 'website', 'Studio',         ''),
  ('DM0013', 6,  'wedding',     'Wedding enquiry',                    'Silver · 1 event',                      1100, 'new',       'Not Paid',         0,  420, '10:00',   2, 'website', 'Outdoor',        ''),
  ('DM0014', 13, 'videography', 'Videography enquiry',                'Event Coverage, Reels, Podcast & Interview', 0, 'new',     'Not Paid',         0,   35, '09:30',   3, 'website', 'Home / venue',   'Product launch promo.'),
  ('DM0015', 17, 'events',      'Event photography booking',          'Event photography · 3 hours',            450, 'confirmed', 'Paid',          450,    6, '17:00',  12, 'manual',  'Home / venue',   'Birthday party — booked by phone.'),
  ('DM0016', 10, 'baby',        'Baby shoot booking',                 '1 Look',                                 150, 'completed', 'Paid',          150,  -40, '11:00',  70, 'website', 'Studio',         ''),
  ('DM0017', 14, 'agency',      'Agency consultation',                'Brand content retainer',                   0, 'new',       'Not Paid',         0,   11, '14:00',   2, 'website', 'Online',         'Consultation call.'),
  ('DM0018', 15, 'portrait',    'Portrait booking',                   '1 Look',                                 170, 'cancelled', 'Refunded',         0,  -55, '12:00',  75, 'website', 'Studio',         'Cancelled — went elsewhere.'),
  ('DM0019', 2,  'maternity',   'Maternity booking',                  '1 Look',                                 170, 'completed', 'Paid',          170,  -15, '14:00',  35, 'website', 'Studio',         ''),
  ('DM0020', 14, 'booth',       '360 Booth booking',                  '360 Photo Booth · 3 hours',                0, 'confirmed', 'Not Paid',         0,   18, '20:00',   8, 'website', 'Home / venue',   'Awaiting deposit.'),
  ('DM0021', 7,  'family',      'Family session booking',             'Family · 1 Look + extra member',         240, 'completed', 'Paid',          240, -150, '13:00', 180, 'website', 'Outdoor',        ''),
  ('DM0022', 17, 'store',       'Store purchase',                     'Photo session voucher',                   25, 'completed', 'Paid',           25,  -25, null,    25, 'website', 'Online',         '')
) as b(ref, n, flow, kind, pkgs, total, status, pay, paid, ev, tm, created, src, setting, notes)
join public.contacts c on c.id = pg_temp.cid(b.n);

-- bookings whose session was in the past but never completed would confuse the demo: none seeded.

-- 4) payments (one per paid booking; a second instalment for the big weddings so the history has depth)
insert into public.payments (booking_id, contact_id, amount, method, paid_at, note)
select id, contact_id, case when ref in ('DM0001','DM0006') then round(amount_paid * 0.5) else amount_paid end,
       case when ref = 'DM0022' then 'Selar' when ref = 'DM0015' then 'Cash' when amount_paid >= 400 then 'Bank transfer' else 'Card' end,
       created_at::date + 1, case when ref in ('DM0001','DM0006') then '[DEMO] 50% deposit' else '[DEMO]' end
from public.bookings where ref like 'DM%' and amount_paid > 0;
insert into public.payments (booking_id, contact_id, amount, method, paid_at, note)
select id, contact_id, amount_paid - round(amount_paid * 0.5), 'Bank transfer', event_date - 3, '[DEMO] balance'
from public.bookings where ref in ('DM0001','DM0006');

-- 5) deals — one per booking, plus open enquiries across the pipeline
insert into public.deals (title, contact_id, booking_id, service, value, stage, expected_close, event_date, lost_reason, source, created_at, updated_at, closed_at)
select kind || ' — ' || name, contact_id, id, replace(kind, ' booking', ''), total,
       case status when 'new' then 'new' when 'confirmed' then 'booked' when 'completed' then 'delivered' else 'lost' end,
       null, event_date, case when status = 'cancelled' then 'Cancelled booking' else '' end, 'booking', created_at,
       greatest(created_at, now() - (abs(least(0, event_date - current_date)) % 20 || ' days')::interval),
       case when status in ('completed','cancelled') then now() - interval '10 days' end
from public.bookings where ref like 'DM%';
insert into public.deals (title, contact_id, service, value, stage, expected_close, event_date, lost_reason, source, created_at, updated_at, closed_at) values
  ('Wedding photography — Samuel Johnson', pg_temp.cid(6),  'Wedding Photography',  1300, 'negotiation', current_date + 10, current_date + 420, '', 'whatsapp', now() - interval '12 days', now() - interval '2 days', null),
  ('Pre-wedding shoot — Ngozi Obi',        pg_temp.cid(5),  'Pre-wedding',           400, 'new',         current_date + 7,  null,                 '', 'website',  now() - interval '4 days',  now() - interval '4 days', null),
  ('Birthday coverage — David Mensah',     pg_temp.cid(8),  'Event Photography',     450, 'contacted',   current_date + 5,  current_date + 40,    '', 'facebook', now() - interval '9 days',  now() - interval '8 days', null),
  ('Product launch video — Michael Brown', pg_temp.cid(13), 'Videography',          1800, 'quoted',      current_date + 8,  current_date + 35,    '', 'website',  now() - interval '7 days',  now() - interval '3 days', null),
  ('Annual conference — Northbridge',      pg_temp.cid(4),  'Event Photography',    2400, 'quoted',      current_date + 20, current_date + 80,    '', 'referral', now() - interval '18 days', now() - interval '9 days', null),
  ('Studio headshots — Oluwaseun Bello',   pg_temp.cid(15), 'Portrait Photography',  170, 'lost',        null,              null,                 'Went with a cheaper photographer', 'website', now() - interval '70 days', now() - interval '60 days', now() - interval '60 days'),
  ('Family photos — Jide Alabi',           pg_temp.cid(11), 'Family Photography',    220, 'lost',        null,              null,                 'No response after quote', 'instagram', now() - interval '310 days', now() - interval '300 days', now() - interval '300 days');

-- 6) activity timeline
insert into public.activities (contact_id, booking_id, type, subject, body, auto, created_by, created_at)
select contact_id, id, 'booking', kind || ' submitted' || case when total > 0 then ' (£' || total || ')' else '' end, 'Package: ' || packages, true, 'website', created_at from public.bookings where ref like 'DM%' and source = 'website';
insert into public.activities (contact_id, type, subject, body, auto, created_by, created_at) values
  (pg_temp.cid(1),  'call',     'Call logged',     'Walked through the family-session options. She prefers a Saturday morning.', false, 'illuszionzphotos@gmail.com', now() - interval '12 days'),
  (pg_temp.cid(1),  'note',     'Note',            'Referred her cousin Kemi — send a thank-you gift card.', false, 'illuszionzphotos@gmail.com', now() - interval '5 days'),
  (pg_temp.cid(6),  'whatsapp', 'WhatsApp logged', 'Sent the Gold package PDF. Asked about the extra photographer add-on.', false, 'illuszionzphotos@gmail.com', now() - interval '6 days'),
  (pg_temp.cid(6),  'meeting',  'Meeting logged',  'Video call 30 min — loves the "golden hour" portfolio. Decision after visiting the venue.', false, 'illuszionzphotos@gmail.com', now() - interval '2 days'),
  (pg_temp.cid(13), 'email',    'Email logged',    'Sent a rough quote for a 60-second promo + 3 reels.', false, 'illuszionzphotos@gmail.com', now() - interval '3 days'),
  (pg_temp.cid(5),  'form',     'Service enquiry received', 'Service interested in: Pre-wedding\nMessage: Looking for a relaxed outdoor shoot in May.', true, 'website', now() - interval '4 days'),
  (pg_temp.cid(8),  'form',     'Contact message received', 'Asked about event photography rates for a 40th birthday.', true, 'website', now() - interval '9 days'),
  (pg_temp.cid(10), 'note',     'Note',            'Prefers WhatsApp over email. Birthday in ~3 weeks — send a note.', false, 'illuszionzphotos@gmail.com', now() - interval '21 days'),
  (pg_temp.cid(15), 'stage',    'Deal moved: Quote / proposal → Lost', 'Went with a cheaper photographer', true, 'system', now() - interval '60 days'),
  (pg_temp.cid(4),  'email',    'Email logged',    'Sent the conference coverage proposal (2 photographers, 8 hours).', false, 'illuszionzphotos@gmail.com', now() - interval '9 days'),
  (pg_temp.cid(14), 'call',     'Call logged',     'Confirmed the next booth date; deposit invoice to follow.', false, 'illuszionzphotos@gmail.com', now() - interval '7 days'),
  (pg_temp.cid(9),  'payment',  'Payment received £750 (Bank transfer)', '[DEMO] first instalment', true, 'system', now() - interval '57 days');

-- 7) tasks (mix of overdue, today, upcoming, done)
insert into public.tasks (title, type, priority, due_at, done, done_at, contact_id, auto, notes) values
  ('Confirm Portrait booking with Femi Balogun',     'whatsapp',  'high',   now() - interval '1 day',   false, null, pg_temp.cid(4),  true,  ''),
  ('Reply to Ngozi Obi''s enquiry',                  'email',     'high',   now() + interval '2 hours', false, null, pg_temp.cid(5),  true,  ''),
  ('Follow up with Samuel Johnson — venue visit?',   'follow-up', 'high',   now() + interval '4 hours', false, null, pg_temp.cid(6),  false, 'He said he would decide after the venue visit.'),
  ('Send Michael Brown the revised video quote',     'quote',     'normal', now() + interval '1 day',   false, null, pg_temp.cid(13), false, ''),
  ('Call David Mensah about birthday coverage',      'call',      'normal', now() + interval '2 days',  false, null, pg_temp.cid(8),  false, ''),
  ('Send deposit invoice — Sarah Williams (booth)',  'email',     'high',   now() - interval '2 days',  false, null, pg_temp.cid(14), false, ''),
  ('Deliver edited gallery — Amara Nwosu',           'deliver',   'normal', now() + interval '3 days',  false, null, pg_temp.cid(7),  false, ''),
  ('Birthday note for Ada Okafor',                   'whatsapp',  'low',    now() + interval '10 days', false, null, pg_temp.cid(1),  false, ''),
  ('Chase second Academy instalment — Blessing Udoh','whatsapp',  'normal', now() + interval '14 days', false, null, pg_temp.cid(9),  false, ''),
  ('Send thank-you gift card to Ada',                'other',     'low',    now() - interval '4 days',  true,  now() - interval '3 days', pg_temp.cid(1), false, ''),
  ('Quote sent to Northbridge',                      'quote',     'normal', now() - interval '9 days',  true,  now() - interval '9 days', pg_temp.cid(4), false, '');

-- 8) inbox: messages, enquiries, reviews, applications
insert into public.submissions (form_name, contact_id, name, email, phone, fields, status, rating, featured, created_at) values
  ('contact', pg_temp.cid(8), 'David Mensah', 'david.mensah@demo.illuszionz.test', '+447700900108', '[{"label":"Full Name","value":"David Mensah"},{"label":"Subject","value":"Event photography rates"},{"label":"Message","value":"Hi, I am planning a 40th birthday party for about 60 guests in Barking. Could you share your hourly rate and availability for 12 December?"}]', 'new', null, false, now() - interval '9 days'),
  ('contact', pg_temp.cid(16), 'Grace Thompson', 'grace.thompson@demo.illuszionz.test', '', '[{"label":"Full Name","value":"Grace Thompson"},{"label":"Subject","value":"Newsletter"},{"label":"Message","value":"Please add me to your newsletter — I love your portrait work!"}]', 'replied', null, false, now() - interval '30 days'),
  ('enquiry', pg_temp.cid(5), 'Ngozi Obi', 'ngozi.obi@demo.illuszionz.test', '+447700900105', '[{"label":"Full Name","value":"Ngozi Obi"},{"label":"Service interested in","value":"Pre-wedding"},{"label":"Message","value":"Looking for a relaxed outdoor shoot in May. We would love 3 outfits and a few photos with family."}]', 'new', null, false, now() - interval '4 days'),
  ('enquiry', pg_temp.cid(13), 'Michael Brown', 'michael.brown@demo.illuszionz.test', '+447700900113', '[{"label":"Full Name","value":"Michael Brown"},{"label":"Service interested in","value":"Videography"},{"label":"Message","value":"We need a 60-second promo and three vertical reels for a product launch on 20 November."}]', 'read', null, false, now() - interval '7 days'),
  ('enquiry', pg_temp.cid(6), 'Samuel Johnson', 'samuel.johnson@demo.illuszionz.test', '+447700900106', '[{"label":"Full Name","value":"Samuel Johnson"},{"label":"Service interested in","value":"Wedding Photography"},{"label":"Message","value":"Getting married next December in Watford. Do you travel, and can we see a full gallery?"}]', 'replied', null, false, now() - interval '12 days'),
  ('review', pg_temp.cid(1), 'Ada Okafor', 'ada.okafor@demo.illuszionz.test', '', '[{"label":"Full Name","value":"Ada Okafor"},{"label":"Rating","value":"5"},{"label":"Your review","value":"Illuszionz captured our wedding so beautifully. Every photo feels like a film still, and the team was calm and kind all day. We cry every time we scroll the gallery."}]', 'read', 5, true, now() - interval '100 days'),
  ('review', pg_temp.cid(3), 'Chioma Eze', 'chioma.eze@demo.illuszionz.test', '', '[{"label":"Full Name","value":"Chioma Eze"},{"label":"Rating","value":"5"},{"label":"Your review","value":"My maternity session was effortless. They made me feel confident and the pictures are stunning — already booked the baby shoot!"}]', 'read', 5, true, now() - interval '50 days'),
  ('review', pg_temp.cid(14), 'Sarah Williams', 'sarah.williams@demo.illuszionz.test', '', '[{"label":"Full Name","value":"Sarah Williams"},{"label":"Rating","value":"4"},{"label":"Your review","value":"The 360 booth was the hit of our corporate party. Setup was quick and guests loved the videos."}]', 'new', 4, false, now() - interval '19 days'),
  ('review', pg_temp.cid(10), 'Kemi Adebayo', 'kemi.adebayo@demo.illuszionz.test', '', '[{"label":"Full Name","value":"Kemi Adebayo"},{"label":"Rating","value":"5"},{"label":"Your review","value":"Third time booking and they never disappoint. Professional, punctual and so creative."}]', 'new', 5, false, now() - interval '3 days'),
  ('careers', null, 'Tunde Ojo', 'tunde.ojo@demo.illuszionz.test', '+447700900401', '[{"label":"Full Name","value":"Tunde Ojo"},{"label":"Role","value":"Photographer / Videographer"},{"label":"Message","value":"I have 4 years of wedding and event experience and shoot on Sony. Portfolio: instagram.com/tunde.shoots"}]', 'new', null, false, now() - interval '2 days'),
  ('careers', null, 'Mary Anderson', 'mary.anderson@demo.illuszionz.test', '', '[{"label":"Full Name","value":"Mary Anderson"},{"label":"Role","value":"Photo editor"},{"label":"Message","value":"Freelance retoucher, fast turnaround, Lightroom + Photoshop."}]', 'archived', null, false, now() - interval '40 days');

-- 9) finance: expenses + other income across the last ~6 months
insert into public.expenses (spent_on, category, vendor, amount, note) values
  (current_date - 4,   'Equipment',                'Wex Photo Video',   389.00, '[DEMO] 50mm lens'),
  (current_date - 9,   'Marketing & ads',          'Meta Ads',          120.00, '[DEMO] Instagram campaign'),
  (current_date - 12,  'Studio & rent',            'Brixton Studios',   450.00, '[DEMO] Studio rent'),
  (current_date - 20,  'Software & subscriptions', 'Adobe',              49.94, '[DEMO] Creative Cloud'),
  (current_date - 27,  'Travel',                   'TfL / Uber',         62.40, '[DEMO] Client travel'),
  (current_date - 33,  'Assistants & freelancers', 'Tunde O.',          180.00, '[DEMO] Second shooter — wedding'),
  (current_date - 41,  'Studio & rent',            'Brixton Studios',   450.00, '[DEMO] Studio rent'),
  (current_date - 52,  'Props & backdrops',        'Etsy',               96.00, '[DEMO] Backdrop + props'),
  (current_date - 63,  'Printing & albums',        'Loxley Colour',     215.00, '[DEMO] Wedding album'),
  (current_date - 72,  'Studio & rent',            'Brixton Studios',   450.00, '[DEMO] Studio rent'),
  (current_date - 85,  'Marketing & ads',          'Google Ads',         95.00, '[DEMO] Search campaign'),
  (current_date - 101, 'Equipment',                'Park Cameras',      640.00, '[DEMO] Speedlight'),
  (current_date - 118, 'Studio & rent',            'Brixton Studios',   450.00, '[DEMO] Studio rent'),
  (current_date - 140, 'Software & subscriptions', 'Squarespace',        29.00, '[DEMO] Portfolio site'),
  (current_date - 160, 'Studio & rent',            'Brixton Studios',   450.00, '[DEMO] Studio rent');
insert into public.other_income (received_on, source, amount, note) values
  (current_date - 6,   'Print sales',           145.00, '[DEMO] 4 framed prints'),
  (current_date - 23,  'Studio hire',           200.00, '[DEMO] Half-day hire to a makeup artist'),
  (current_date - 48,  'Brand collaboration',   350.00, '[DEMO] Skincare shoot (content)'),
  (current_date - 77,  'Print sales',            90.00, '[DEMO] Wedding canvas'),
  (current_date - 105, 'Photobook upgrade',     180.00, '[DEMO] Album upgrade'),
  (current_date - 130, 'Workshop ticket sales', 275.00, '[DEMO] Portrait masterclass');

-- 10) promo codes
insert into public.promo_codes (code, description, percent_off, amount_off, flows, active, starts_on, expires_on, max_uses, used) values
  ('WELCOME10', '[DEMO] 10% off first sessions',        10, null, '{}',                         true,  null,                 null,                 100, 7),
  ('BRIDE50',   '[DEMO] £50 off wedding bookings',      null, 50, array['wedding','prewedding'], true,  current_date - 30,    current_date + 120,   20,  3),
  ('SPRING15',  '[DEMO] Spring mini-session offer',     15, null, array['portrait','family'],    true,  current_date - 200,   current_date - 120,   null, 12),
  ('VIP20',     '[DEMO] Returning client thank-you',    20, null, '{}',                         false, null,                 null,                 10,  10)
on conflict (code) do nothing;

-- 11) segments, saved layouts, campaigns
insert into public.segments (name, filter) values
  ('[DEMO] Brides & grooms',        '{"tag":"bride"}'),
  ('[DEMO] Quiet for 90+ days',     '{"inactiveDays":90,"lifecycle":["client","vip"]}'),
  ('[DEMO] Never booked',           '{"booked":"no","lifecycle":["lead","subscriber"]}');

insert into public.email_sections (name, blocks) values
  ('[DEMO] Monthly newsletter', '[
    {"id":"s1","type":"heading","text":"This month at Illuszionz","level":"h1","align":"left"},
    {"id":"s2","type":"paragraph","html":"Hi {{first_name}},<br><br>Here is what we have been up to — plus a little something for you."},
    {"id":"s3","type":"divider","color":"#dcdad2","thickness":1,"spacing":20},
    {"id":"s4","type":"button","label":"See the latest work","link":"https://illuszionzmedia.com/media/","color":"#0a0a0a","align":"left"},
    {"id":"s5","type":"social","align":"center"}]'::jsonb),
  ('[DEMO] Offer announcement', '[
    {"id":"o1","type":"heading","text":"A little offer, just for you","level":"h2","align":"center"},
    {"id":"o2","type":"paragraph","html":"<b>Book before the end of the month</b> and enjoy 10% off any session."},
    {"id":"o3","type":"button","label":"Book now","link":"https://illuszionzmedia.com/photography-services/","color":"#b8941f","align":"center"}]'::jsonb);

insert into public.email_campaigns (id, name, subject, eyebrow, title, body, button_label, button_url, audience, blocks, status, recipients, sent_count, failed_count, sent_at, created_at) values
  ('e0000000-0000-4000-8000-000000000001', '[DEMO] Autumn mini sessions', 'Autumn mini sessions are here', 'News from the studio', 'Autumn mini sessions', E'Hi {{first_name}},\n\nOur autumn mini sessions are open — 20 minutes, 4 edited pictures, one price.', 'Book a slot', 'https://illuszionzmedia.com/photography-services/', '{"lifecycle":["client","vip","lead"]}', '[]', 'sent', 12, 12, 0, now() - interval '35 days', now() - interval '36 days'),
  ('e0000000-0000-4000-8000-000000000002', '[DEMO] October newsletter', 'Your October update from Illuszionz', '', 'October newsletter', 'Newsletter built with the email builder.', '', '', '{"tag":"bride"}',
    '[{"id":"n1","type":"heading","text":"Hi {{first_name}},","level":"h2","align":"left"},
      {"id":"n2","type":"paragraph","html":"Thank you for being part of our story. This month we photographed <b>six weddings</b>, launched our new 360 booth packages and opened Academy applications."},
      {"id":"n3","type":"columns","columns":[[{"id":"n3a","type":"heading","text":"Weddings","level":"h3","align":"left"},{"id":"n3b","type":"paragraph","html":"Gold and Diamond dates for next year are filling fast."}],[{"id":"n3c","type":"heading","text":"360 Booth","level":"h3","align":"left"},{"id":"n3d","type":"paragraph","html":"Now available for corporate events and parties."}]]},
      {"id":"n4","type":"button","label":"See availability","link":"https://illuszionzmedia.com/wedding/","color":"#0a0a0a","align":"left"},
      {"id":"n5","type":"social","align":"center"}]', 'sent', 3, 3, 0, now() - interval '9 days', now() - interval '10 days'),
  ('e0000000-0000-4000-8000-000000000003', '[DEMO] Black Friday draft', 'Black Friday — early access', '', 'Black Friday', 'Draft campaign.', '', '', '{"lifecycle":["client","vip"]}',
    '[{"id":"b1","type":"heading","text":"Black Friday, early access","level":"h1","align":"center"},{"id":"b2","type":"paragraph","html":"As a past client you get first pick — 15% off every session booked this week."},{"id":"b3","type":"button","label":"Claim your offer","link":"https://illuszionzmedia.com/","color":"#b8941f","align":"center"}]', 'draft', 0, 0, 0, null, now() - interval '1 day')
on conflict (id) do nothing;

-- 12) email log: a believable history (demo addresses, so nothing real was sent)
insert into public.email_log (template_key, booking_id, contact_id, to_email, subject, status, sent_at, created_at)
select 'booking_confirmed', b.id, b.contact_id, b.email, 'Your booking is confirmed · Illuszionz Media', 'sent', b.confirmed_at + interval '8 minutes', b.confirmed_at + interval '8 minutes'
from public.bookings b where b.ref like 'DM%' and b.confirmed_at is not null and b.source = 'website';
insert into public.email_log (template_key, booking_id, contact_id, to_email, subject, status, sent_at, created_at)
select 'thank_you', b.id, b.contact_id, b.email, 'Thank you · Illuszionz Media', 'sent', (b.event_date + 1)::timestamptz + interval '9 hours', (b.event_date + 1)::timestamptz + interval '9 hours'
from public.bookings b where b.ref like 'DM%' and b.status = 'completed' and b.event_date < current_date - 1 and b.source = 'website';
insert into public.email_log (template_key, booking_id, contact_id, to_email, subject, status, sent_at, created_at)
select 'review_request', b.id, b.contact_id, b.email, 'How did we do? · Illuszionz Media', 'sent', (b.event_date + 14)::timestamptz + interval '9 hours', (b.event_date + 14)::timestamptz + interval '9 hours'
from public.bookings b where b.ref like 'DM%' and b.status = 'completed' and b.event_date < current_date - 15 and b.source = 'website';
insert into public.email_log (template_key, campaign_id, contact_id, to_email, subject, status, sent_at, created_at)
select 'campaign', 'e0000000-0000-4000-8000-000000000001', c.id, c.email, 'Autumn mini sessions are here · Illuszionz Media', 'sent', now() - interval '35 days', now() - interval '35 days'
from public.contacts c where c.email like '%@demo.illuszionz.test' and c.lifecycle in ('client','vip','lead') limit 12;
insert into public.email_log (template_key, contact_id, to_email, subject, status, error, created_at) values
  ('birthday', pg_temp.cid(7), 'amara.nwosu@demo.illuszionz.test', 'Happy birthday, Amara!', 'failed', 'Resend rejected the email (422): demo address', now() - interval '20 days');

-- 13) recompute lead scores
select public.rescore_contact(id) from public.contacts where email like '%@demo.illuszionz.test';
