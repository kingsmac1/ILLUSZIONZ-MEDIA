-- Packages added to the Photography services page from Dashboard → Prices → "+ Add package" (e.g. Graduate Photography).
-- Each one is a new card with its own booking form (the same questions, add-ons and terms as the other photo shoots)
-- priced from its own lines; the server re-prices every booking from this table. Only adds things; safe to run again.

create table if not exists public.booking_services (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- the website page the card is on
  page text not null default 'photography' check (page in ('photography')),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  description text not null default '' check (char_length(description) <= 600),
  -- the price lines: [{ "label": "1 Look", "note": "4 edited pictures", "price": 150 }]; price 0 = quoted
  options jsonb not null default '[]'::jsonb check (jsonb_typeof(options) = 'array'),
  cta text not null default 'Book this shoot' check (char_length(cta) <= 40),
  sort_order integer not null default 0,
  active boolean not null default true
);
create index if not exists booking_services_page_idx on public.booking_services (page, sort_order);

alter table public.booking_services enable row level security;
-- the website reads them through /api/prices and /api/booking with the server key; only admins touch the table
drop policy if exists "admin all" on public.booking_services;
create policy "admin all" on public.booking_services for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on public.booking_services from anon;
grant select, insert, update, delete on public.booking_services to authenticated;
grant all on public.booking_services to service_role;

-- a short description for packages added to Wedding, Videography or Academy (shown on the card, like the built-in ones)
alter table public.booking_packages add column if not exists description text not null default '';
