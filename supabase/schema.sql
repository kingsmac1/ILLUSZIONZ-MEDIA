-- =====================================================================
-- Illuszionz Media — dashboard + CRM schema (Supabase / Postgres)
-- Paste into Supabase -> SQL Editor -> New query -> Run. Safe to run more than once.
--
-- Public submissions never write to the database directly: the Cloudflare Pages Functions
-- (/api/booking, /api/form) insert with the service-role key. Everything below is therefore
-- locked to signed-in ADMINS (rows in public.admin_users) through row level security.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- Admins ----------
create table if not exists public.admin_users (
  email text primary key,
  name text not null default '',
  created_at timestamptz not null default now()
);
alter table public.admin_users enable row level security;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admin_users where lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;

drop policy if exists "admins read admins" on public.admin_users;
create policy "admins read admins" on public.admin_users for select to authenticated using (public.is_admin());
drop policy if exists "admins manage admins" on public.admin_users;
create policy "admins manage admins" on public.admin_users for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- !! Replace with YOUR sign-in email, then create that user in Authentication -> Users.
insert into public.admin_users (email, name) values ('illuszionzphotos@gmail.com', 'Illuszionz Media') on conflict do nothing;

-- ---------- Business settings (key/value) ----------
create table if not exists public.settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.settings enable row level security;
drop policy if exists "settings admin" on public.settings;
create policy "settings admin" on public.settings for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- CRM: companies ----------
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  website text not null default '',
  industry text not null default '',
  phone text not null default '',
  email text not null default '',
  address text not null default '',
  notes text not null default ''
);

-- ---------- CRM: contacts (people — leads, clients, partners) ----------
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null,
  email text,
  phone text not null default '',
  company_id uuid references public.companies(id) on delete set null,
  job_title text not null default '',
  -- lifecycle: subscriber -> lead -> opportunity -> client -> vip ; inactive / lost sit outside the funnel
  lifecycle text not null default 'lead' check (lifecycle in ('subscriber','lead','opportunity','client','vip','inactive','lost')),
  -- where they came from: website, booking, instagram, facebook, whatsapp, referral, walk-in, event, other
  source text not null default 'website',
  referred_by uuid references public.contacts(id) on delete set null,
  tags text[] not null default '{}',
  city text not null default '',
  instagram text not null default '',
  birthday date,
  marketing_opt_in boolean not null default true,
  do_not_contact boolean not null default false,
  lead_score integer not null default 0,
  last_contacted_at timestamptz,
  last_activity_at timestamptz not null default now(),
  notes text not null default ''
);
create unique index if not exists contacts_email_uq on public.contacts (lower(email)) where email is not null and email <> '';
create index if not exists contacts_phone_idx on public.contacts (phone);
create index if not exists contacts_lifecycle_idx on public.contacts (lifecycle);

-- ---------- CRM: pipeline stages (editable) ----------
create table if not exists public.pipeline_stages (
  key text primary key,
  name text not null,
  sort_order integer not null default 0,
  probability integer not null default 10,   -- % chance a deal in this stage is won (for weighted forecast)
  kind text not null default 'open' check (kind in ('open','won','lost')),
  color text not null default '#64748b'
);
insert into public.pipeline_stages (key, name, sort_order, probability, kind, color) values
  ('new',        'New enquiry',      1, 10, 'open', '#64748b'),
  ('contacted',  'Contacted',        2, 25, 'open', '#0ea5e9'),
  ('quoted',     'Quote / proposal', 3, 45, 'open', '#8b5cf6'),
  ('negotiation','Negotiation',      4, 65, 'open', '#f59e0b'),
  ('booked',     'Booked',           5, 90, 'open', '#10b981'),
  ('delivered',  'Delivered (won)',  6, 100,'won',  '#16a34a'),
  ('lost',       'Lost',             7, 0,  'lost', '#ef4444')
on conflict (key) do nothing;

-- ---------- Bookings (every booking-form submission, plus manual entries) ----------
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique default upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6)),
  created_at timestamptz not null default now(),
  flow_id text not null,
  kind text not null,                    -- e.g. "Portrait booking"
  contact_id uuid references public.contacts(id) on delete set null,
  name text not null,
  email text,
  phone text not null default '',
  packages text not null default '',     -- chosen packages, comma separated
  selection jsonb not null default '{}'::jsonb,
  details jsonb not null default '[]'::jsonb,  -- [[label, value], ...] exactly as in the emails
  items jsonb not null default '[]'::jsonb,    -- priced lines
  total_text text not null default '',
  total numeric(10,2) not null default 0,       -- GBP, 0 when quoted later
  discount numeric(10,2) not null default 0,
  promo_code text,
  quoted boolean not null default false,
  event_date date,
  event_time text,
  status text not null default 'new' check (status in ('new','confirmed','completed','cancelled')),
  payment_status text not null default 'Not Paid' check (payment_status in ('Not Paid','Deposit Paid','Paid','Refunded')),
  amount_paid numeric(10,2) not null default 0,
  source text not null default 'website',       -- website | manual
  notes text not null default '',
  confirmed_at timestamptz,
  completed_at timestamptz
);
create index if not exists bookings_event_idx on public.bookings (event_date);
create index if not exists bookings_status_idx on public.bookings (status);
create index if not exists bookings_contact_idx on public.bookings (contact_id);

-- ---------- Inbox: contact messages, enquiries, reviews, job applications ----------
create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  form_name text not null,               -- contact | enquiry | review | careers ...
  contact_id uuid references public.contacts(id) on delete set null,
  name text not null,
  email text,
  phone text not null default '',
  fields jsonb not null default '[]'::jsonb,   -- [{label, value}]
  attachments text[] not null default '{}',
  status text not null default 'new' check (status in ('new','read','replied','archived')),
  rating integer,
  featured boolean not null default false,     -- reviews approved to show on the site
  notes text not null default ''
);
create index if not exists submissions_status_idx on public.submissions (status, created_at desc);

-- ---------- CRM: deals ----------
create table if not exists public.deals (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  title text not null,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  company_id uuid references public.companies(id) on delete set null,
  booking_id uuid references public.bookings(id) on delete set null,
  service text not null default '',
  value numeric(10,2) not null default 0,
  stage text not null default 'new' references public.pipeline_stages(key) on update cascade,
  position integer not null default 0,
  expected_close date,
  event_date date,
  lost_reason text not null default '',
  source text not null default 'website',
  closed_at timestamptz,
  notes text not null default ''
);
create index if not exists deals_stage_idx on public.deals (stage, position);
create index if not exists deals_contact_idx on public.deals (contact_id);

-- ---------- CRM: activity timeline ----------
create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  contact_id uuid references public.contacts(id) on delete cascade,
  deal_id uuid references public.deals(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete set null,
  type text not null default 'note' check (type in ('note','call','email','whatsapp','meeting','booking','form','payment','stage','task','system')),
  subject text not null default '',
  body text not null default '',
  auto boolean not null default false,
  created_by text not null default ''
);
create index if not exists activities_contact_idx on public.activities (contact_id, created_at desc);
create index if not exists activities_deal_idx on public.activities (deal_id, created_at desc);

-- ---------- CRM: tasks / follow-ups ----------
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  title text not null,
  type text not null default 'follow-up' check (type in ('call','whatsapp','email','follow-up','quote','meeting','deliver','other')),
  priority text not null default 'normal' check (priority in ('low','normal','high')),
  due_at timestamptz,
  done boolean not null default false,
  done_at timestamptz,
  contact_id uuid references public.contacts(id) on delete cascade,
  deal_id uuid references public.deals(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete set null,
  auto boolean not null default false,
  notes text not null default ''
);
create index if not exists tasks_open_idx on public.tasks (done, due_at);

-- ---------- CRM: saved segments (filters) ----------
create table if not exists public.segments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  filter jsonb not null default '{}'::jsonb   -- {lifecycle, source, tag, hasBooked, inactiveDays, optIn, q}
);

-- ---------- Finance ----------
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  booking_id uuid references public.bookings(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  amount numeric(10,2) not null,
  method text not null default 'Bank transfer',
  paid_at date not null default current_date,
  note text not null default ''
);
create table if not exists public.expense_categories (
  name text primary key,
  sort_order integer not null default 0
);
insert into public.expense_categories (name, sort_order) values
  ('Equipment',1),('Studio & rent',2),('Software & subscriptions',3),('Marketing & ads',4),
  ('Travel',5),('Assistants & freelancers',6),('Props & backdrops',7),('Printing & albums',8),('Other',9)
on conflict do nothing;
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  spent_on date not null default current_date,
  category text not null default 'Other',
  vendor text not null default '',
  amount numeric(10,2) not null,
  note text not null default '',
  booking_id uuid references public.bookings(id) on delete set null
);
create table if not exists public.other_income (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  received_on date not null default current_date,
  source text not null default '',
  amount numeric(10,2) not null,
  note text not null default ''
);

-- ---------- Promo codes + price overrides ----------
create table if not exists public.promo_codes (
  code text primary key,
  description text not null default '',
  percent_off numeric(5,2),               -- e.g. 10 = 10 % off
  amount_off numeric(10,2),               -- or a fixed amount in GBP
  flows text[] not null default '{}',     -- empty = every service
  active boolean not null default true,
  starts_on date,
  expires_on date,
  max_uses integer,
  used integer not null default 0,
  created_at timestamptz not null default now(),
  check (percent_off is not null or amount_off is not null)
);
-- Override the built-in catalog price of one package/extra. kind: 'option' | 'extra'.
create table if not exists public.price_overrides (
  flow_id text not null,
  kind text not null check (kind in ('option','extra')),
  item_id text not null,
  price numeric(10,2) not null,
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (flow_id, kind, item_id)
);

-- ---------- Email system ----------
create table if not exists public.email_templates (
  key text primary key,
  name text not null,
  audience text not null default 'customer' check (audience in ('customer','owner')),
  enabled boolean not null default true,
  subject text not null,
  eyebrow text not null default '',
  title text not null,
  body text not null,                      -- plain paragraphs; {{placeholders}} allowed
  button_label text not null default '',
  button_url text not null default '',
  updated_at timestamptz not null default now()
);
create table if not exists public.email_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  dedupe_key text unique,                  -- claim row: an automation can only ever send once per key
  template_key text not null default '',
  campaign_id uuid,
  booking_id uuid references public.bookings(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  to_email text not null,
  subject text not null default '',
  status text not null default 'pending' check (status in ('pending','sent','failed','skipped')),
  error text,
  sent_at timestamptz
);
create index if not exists email_log_created_idx on public.email_log (created_at desc);
create table if not exists public.email_campaigns (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  subject text not null,
  eyebrow text not null default '',
  title text not null,
  body text not null,
  button_label text not null default '',
  button_url text not null default '',
  image_url text not null default '',
  audience jsonb not null default '{}'::jsonb,   -- same shape as segments.filter
  status text not null default 'draft' check (status in ('draft','sending','sent')),
  recipients integer not null default 0,
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  sent_at timestamptz
);

-- ---------- Row level security: admins only ----------
do $$
declare t text;
begin
  foreach t in array array['companies','contacts','pipeline_stages','bookings','submissions','deals','activities','tasks','segments',
                           'payments','expense_categories','expenses','other_income','promo_codes','price_overrides',
                           'email_templates','email_log','email_campaigns']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "admin all" on public.%I', t);
    execute format('create policy "admin all" on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- ---------- Keep contact freshness + lead score current ----------
create or replace function public.touch_contact() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists contacts_touch on public.contacts;
create trigger contacts_touch before update on public.contacts for each row execute function public.touch_contact();

-- Lead score (0-100): fit + engagement. Recomputed by public.rescore_contact(id) and by the nightly job.
create or replace function public.rescore_contact(cid uuid) returns integer language plpgsql security definer set search_path = public as $$
declare s integer := 0; c record; nb integer; spent numeric; recent integer;
begin
  select * into c from contacts where id = cid;
  if not found then return 0; end if;
  if coalesce(c.email,'') <> '' then s := s + 10; end if;
  if c.phone <> '' then s := s + 10; end if;
  if c.marketing_opt_in then s := s + 5; end if;
  if c.source in ('referral','booking') then s := s + 10; end if;
  select count(*), coalesce(sum(total),0) into nb, spent from bookings where contact_id = cid and status <> 'cancelled';
  s := s + least(nb, 3) * 10;
  if spent >= 1000 then s := s + 15; elsif spent >= 300 then s := s + 8; end if;
  select count(*) into recent from activities where contact_id = cid and created_at > now() - interval '30 days' and not auto;
  s := s + least(recent, 4) * 5;
  if exists (select 1 from deals where contact_id = cid and stage in ('quoted','negotiation','booked')) then s := s + 10; end if;
  if c.last_activity_at < now() - interval '120 days' then s := s - 15; end if;
  s := greatest(0, least(100, s));
  update contacts set lead_score = s where id = cid;
  return s;
end $$;

-- ---------- Scheduler: calls the site every 10 minutes (needs pg_cron + pg_net, both built into Supabase) ----------
-- 1) Dashboard -> Database -> Extensions: enable pg_cron and pg_net.
-- 2) Replace YOUR_CRON_SECRET (same value as the CRON_SECRET env var on Cloudflare) and run:
--
-- select cron.schedule('illuszionz-automations', '*/10 * * * *', $job$
--   select net.http_post(
--     url := 'https://illuszionzmedia.com/api/cron',
--     headers := '{"Content-Type":"application/json","x-cron-secret":"YOUR_CRON_SECRET"}'::jsonb,
--     body := '{}'::jsonb);
-- $job$);

-- ---------- Default email templates (editable in Dashboard -> Emails) ----------
-- Placeholders: {{first_name}} {{name}} {{service}} {{date}} {{time}} {{total}} {{ref}} {{site}} {{review_link}} {{whatsapp}}
insert into public.email_templates (key, name, audience, subject, eyebrow, title, body, button_label, button_url) values
('booking_confirmed','Booking confirmed','customer','Your booking is confirmed','Booking confirmed','You are booked in!',
 E'Hi {{first_name}},\n\nGreat news — your {{service}} on {{date}}{{time_suffix}} is now confirmed. Your reference is {{ref}}.\n\nIf anything changes, simply reply to this email or message us on WhatsApp.','Chat on WhatsApp','{{whatsapp}}'),
('reminder_24h','Reminder · 1 day before','customer','See you tomorrow — {{service}}','Friendly reminder','Your session is tomorrow',
 E'Hi {{first_name}},\n\nA quick reminder that your {{service}} is tomorrow, {{date}}{{time_suffix}}.\n\nPlease arrive a few minutes early, bring any outfits or props you planned, and let us know if anything has changed.','Message us on WhatsApp','{{whatsapp}}'),
('reminder_2h','Reminder · 2 hours before','customer','Today is the day — {{service}}','Starting soon','We see you in a couple of hours',
 E'Hi {{first_name}},\n\nYour {{service}} starts at {{time}} today. We are excited to create with you!\n\nRunning late or need directions? Message us on WhatsApp.','Message us on WhatsApp','{{whatsapp}}'),
('payment_reminder','Balance reminder','customer','A quick note about your balance — {{service}}','Payment reminder','Your session is coming up',
 E'Hi {{first_name}},\n\nYour {{service}} on {{date}} is close. Our records show a balance of {{balance}} still to settle ({{ref}}).\n\nIf you have already paid, thank you — just reply with your receipt and we will update it.','Chat on WhatsApp','{{whatsapp}}'),
('payment_receipt','Payment received','customer','Payment received — thank you','Payment received','Thank you, {{first_name}}',
 E'Hi {{first_name}},\n\nWe have received your payment of {{amount}} for {{service}} ({{ref}}). Your balance is now {{balance}}.\n\nThank you for trusting Illuszionz Media.','',''),
('thank_you','Thank you after the session','customer','Thank you, {{first_name}}','Thank you','It was a pleasure',
 E'Hi {{first_name}},\n\nThank you for letting us capture your {{service}}. It was a pleasure working with you, and we hope you love the result.\n\nYour pictures are being prepared — we will be in touch with delivery details soon.','Follow us on Instagram','https://www.instagram.com/illuszionzmedia/'),
('review_request','Review request','customer','How did we do, {{first_name}}?','Your feedback','Tell us about your experience',
 E'Hi {{first_name}},\n\nWe hope you are enjoying your {{service}}. Honest reviews help people decide, and they mean the world to a small studio like ours.\n\nIt takes under two minutes.','Leave a review','{{review_link}}'),
('reengagement','We miss you','customer','It has been a while, {{first_name}}','We miss you','Ready for your next session?',
 E'Hi {{first_name}},\n\nIt has been a little while since your {{service}}, and we would love to create something new with you — a family update, a new look, a milestone worth celebrating.\n\nReply to this email or message us and we will find a date.','Book your next session','{{site}}'),
('birthday','Birthday wishes','customer','Happy birthday, {{first_name}}!','Happy birthday','Wishing you a beautiful day',
 E'Hi {{first_name}},\n\nEveryone at Illuszionz Media is wishing you a very happy birthday. We hope this year brings you moments worth capturing.\n\nWith love,\nIlluszionz Media','Treat yourself — book a session','{{site}}'),
('lead_followup','Lead follow-up nudge','customer','Still thinking about your {{service}}?','Following up','We saved your enquiry',
 E'Hi {{first_name}},\n\nThank you for your interest in {{service}}. We wanted to check whether you have any questions or would like help choosing the right package.\n\nJust reply here and we will get you sorted.','Chat on WhatsApp','{{whatsapp}}'),
('owner_birthdays','Owner · birthdays today','owner','Birthdays today','Birthdays','Clients celebrating today',
 E'These clients have a birthday today — a short personal message goes a long way:\n\n{{list}}','Open CRM','{{site}}/dashboard/#/crm/contacts'),
('owner_daily','Owner · morning digest','owner','Your day at a glance','Daily digest','Good morning',
 E'Here is what needs your attention today:\n\n{{list}}','Open dashboard','{{site}}/dashboard/')
on conflict (key) do nothing;

-- ---------- Default settings ----------
insert into public.settings (key, value) values
  ('automations', '{"booking_confirmed":true,"reminder_24h":true,"reminder_2h":true,"payment_reminder":true,"thank_you":true,"review_request":true,"reengagement":true,"birthday":true,"lead_followup":true,"owner_birthdays":true,"owner_daily":true}'),
  ('email', '{"owner_emails":["info@illuszionzmedia.com"],"reengagement_days":90,"review_request_days":14,"thank_you_hours":24,"lead_followup_days":3,"digest_hour":8}'),
  ('business', '{"name":"Illuszionz Media","currency":"GBP"}')
on conflict (key) do nothing;
