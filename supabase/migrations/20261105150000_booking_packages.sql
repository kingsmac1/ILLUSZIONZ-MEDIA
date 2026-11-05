-- Packages and add-ons the studio adds from Dashboard → Prices → "+ Add package", on top of the standard ones in
-- src/booking/catalog.ts. They appear on the chosen page's price cards and booking form, and the server prices them
-- (functions/api/booking.ts), so the browser can never choose its own price. Only adds things; safe to run again.

create table if not exists public.booking_packages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- which booking form / page: a flow id from the catalog (portrait, wedding, maternity …)
  flow_id text not null check (flow_id ~ '^[a-z0-9-]{1,40}$'),
  kind text not null default 'option' check (kind in ('option', 'extra')),
  label text not null check (char_length(btrim(label)) between 1 and 120),
  note text not null default '' check (char_length(note) <= 200),
  includes text[] not null default '{}',
  -- GBP; 0 = quoted later
  price numeric(10,2) not null default 0 check (price >= 0 and price <= 1000000),
  -- packages priced per look / hour …: { "label": "hour", "plural": "hours", "min": 1, "max": 12, "def": 1 }
  unit jsonb,
  -- add-ons: the client chooses a quantity up to this; empty = a simple tick box
  max_qty integer check (max_qty is null or max_qty between 1 and 100),
  sort_order integer not null default 0,
  active boolean not null default true
);
create index if not exists booking_packages_flow_idx on public.booking_packages (flow_id, kind, sort_order);

alter table public.booking_packages enable row level security;
-- the website reads them through /api/prices with the server key; only admins touch the table directly
drop policy if exists "admin all" on public.booking_packages;
create policy "admin all" on public.booking_packages for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on public.booking_packages from anon;
grant select, insert, update, delete on public.booking_packages to authenticated;
grant all on public.booking_packages to service_role;
