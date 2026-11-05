-- Inspiration images clients upload with the booking form. Additive only.
-- The files live in the private R2 bucket under inspiration/. This table remembers who sent what, so that the public upload
-- can be rate-limited, a booking only attaches files that were really uploaded and not already used, and uploads that never
-- became a booking are cleaned up. No policies on purpose: only the server (service role) reads or writes it.
create table if not exists public.booking_inspiration_images (
  key text primary key,
  ip_hash text not null,
  bytes integer not null default 0,
  booking_ref text,
  created_at timestamptz not null default now()
);
create index if not exists booking_inspiration_ref_idx on public.booking_inspiration_images (booking_ref);
create index if not exists booking_inspiration_ip_idx on public.booking_inspiration_images (ip_hash, created_at desc);
alter table public.booking_inspiration_images enable row level security;
revoke all on public.booking_inspiration_images from anon, authenticated;
grant all on public.booking_inspiration_images to service_role;
