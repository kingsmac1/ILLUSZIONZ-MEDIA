-- Invoices made in the dashboard (Business → Invoices). Additive only.
-- `doc` holds every field of the invoice exactly as the studio edited it. `number` sits outside it so the database can
-- refuse a number that is already used. Bank details are not seeded here: the studio saves them from the dashboard, into
-- the admin-only settings table (key `invoice_defaults`).
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  number text not null unique,
  booking_id uuid references public.bookings(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  doc jsonb not null default '{}'::jsonb,
  sent_at timestamptz,
  sent_to text,
  sent_stage text check (sent_stage in ('before','part','paid')),
  sent_count integer not null default 0
);
create index if not exists invoices_created_idx on public.invoices (created_at desc);
create index if not exists invoices_booking_idx on public.invoices (booking_id);

alter table public.invoices enable row level security;
drop policy if exists "admin all" on public.invoices;
create policy "admin all" on public.invoices for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on public.invoices from anon;
grant select, insert, update, delete on public.invoices to authenticated;
grant all on public.invoices to service_role;
