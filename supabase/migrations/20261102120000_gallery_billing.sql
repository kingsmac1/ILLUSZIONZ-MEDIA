-- Gallery billing (studio side). Applied by the migration runner, or paste in Supabase → SQL Editor. Safe to re-run.
-- Holds the last answer from the Emkay Digitals dashboard so a short outage never locks the studio (72 hours of grace),
-- and gives the hourly sync one cheap way to total the stored photos.

create table if not exists billing_cache (
  id            integer primary key check (id = 1),
  payload       jsonb not null,
  fetched_at    timestamptz not null default now(),
  purge_objects bigint not null default 0,   -- running count while a purge spans several runs
  purge_bytes   bigint not null default 0
);
alter table billing_cache enable row level security;
revoke all on billing_cache from anon, authenticated;

create or replace function gallery_total_bytes() returns bigint
language sql security definer set search_path = public as $$
  select coalesce(sum(bytes), 0)::bigint from gallery_images
$$;
revoke all on function gallery_total_bytes() from public, anon, authenticated;
grant execute on function gallery_total_bytes() to service_role;
