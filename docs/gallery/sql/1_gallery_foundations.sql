-- =====================================================================
-- Client gallery + client area — foundations (profiles, galleries, images, selections, downloads, activity log, RLS)
-- Additive only: no existing table or column is dropped or changed. Safe to run more than once.
-- =====================================================================

-- ---------- Helpers ----------
-- The signed-in user's email, lower-cased, ONLY if it has been confirmed (OTP code / confirmation link).
create or replace function public.current_email() returns text
language sql stable security definer set search_path = public, auth as $$
  select lower(u.email) from auth.users u where u.id = auth.uid() and u.email_confirmed_at is not null;
$$;

-- Admins are still the rows in public.admin_users (managed in Dashboard → Settings); now only confirmed emails count.
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public, auth as $$
  select exists (select 1 from public.admin_users a where lower(a.email) = public.current_email());
$$;

revoke all on function public.current_email() from public, anon;
grant execute on function public.current_email() to authenticated, service_role;

-- ---------- Profiles (one per login; role mirrors admin_users) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null default '',
  phone text not null default '',
  role text not null default 'client' check (role in ('client','admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

drop policy if exists "profiles admin all" on public.profiles;
create policy "profiles admin all" on public.profiles for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists "profiles own read" on public.profiles;
create policy "profiles own read" on public.profiles for select to authenticated using (id = (select auth.uid()));
drop policy if exists "profiles own update" on public.profiles;
create policy "profiles own update" on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- clients may edit their name/phone only; email and role are kept as they were
-- (runs as the caller on purpose, so current_user tells a signed-in browser apart from the server/service role)
create or replace function public.profiles_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user in ('authenticated', 'anon') and not public.is_admin() then
    new.role := old.role;
    new.email := old.email;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before update on public.profiles for each row execute function public.profiles_guard();

-- a profile is created for every new login (and kept in sync when the email changes)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id, lower(new.email), coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    case when exists (select 1 from public.admin_users a where lower(a.email) = lower(new.email)) then 'admin' else 'client' end
  )
  on conflict (id) do update set email = excluded.email;
  return new;
exception when others then
  return new; -- never block a sign-up because of the profile row
end $$;
drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.handle_user_email_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set email = lower(new.email), updated_at = now() where id = new.id;
  return new;
exception when others then
  return new;
end $$;
drop trigger if exists on_auth_user_email_profile on auth.users;
create trigger on_auth_user_email_profile after update of email on auth.users for each row
  when (old.email is distinct from new.email) execute function public.handle_user_email_change();

-- adding/removing an admin in Dashboard → Settings updates the matching profile's role
create or replace function public.sync_admin_role() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then
    update public.profiles set role = 'admin' where email = lower(new.email);
  end if;
  if tg_op in ('DELETE', 'UPDATE') then
    update public.profiles p set role = 'client'
    where p.email = lower(old.email) and not exists (select 1 from public.admin_users a where lower(a.email) = p.email);
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists admin_users_role_sync on public.admin_users;
create trigger admin_users_role_sync after insert or update or delete on public.admin_users for each row execute function public.sync_admin_role();

-- backfill profiles for logins that already exist
insert into public.profiles (id, email, full_name, role)
select u.id, lower(u.email), coalesce(u.raw_user_meta_data ->> 'full_name', ''),
  case when exists (select 1 from public.admin_users a where lower(a.email) = lower(u.email)) then 'admin' else 'client' end
from auth.users u where u.email is not null
on conflict (id) do update set role = excluded.role;

-- ---------- Galleries ----------
create table if not exists public.galleries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  booking_id uuid references public.bookings(id) on delete set null,
  client_email text not null check (client_email = lower(client_email)),
  client_name text not null default '',
  title text not null default '',
  kind text not null check (kind in ('proof','final')),
  status text not null default 'draft' check (status in ('draft','sent','viewed','selecting','submitted','delivered','archived')),
  selection_limit integer check (selection_limit is null or selection_limit > 0),
  allow_extra_selections boolean not null default false,
  extra_price_note text,
  cover_image_id uuid,
  message_to_client text,
  parent_gallery_id uuid references public.galleries(id) on delete set null,
  sent_at timestamptz,
  first_viewed_at timestamptz,
  submitted_at timestamptz,
  delivered_at timestamptz,
  expires_at timestamptz,
  previews_purge_at timestamptz,
  previews_purged_at timestamptz
);
create index if not exists galleries_client_email_idx on public.galleries (client_email);
create index if not exists galleries_booking_idx on public.galleries (booking_id);
create unique index if not exists galleries_booking_kind_uq on public.galleries (booking_id, kind) where booking_id is not null;

-- ---------- Images ----------
create table if not exists public.gallery_images (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  gallery_id uuid not null references public.galleries(id) on delete cascade,
  original_filename text not null,
  thumb_key text,
  display_key text,
  original_key text,
  content_type text not null default 'image/jpeg',
  width integer,
  height integer,
  bytes bigint not null default 0,
  sort_order integer not null default 0,
  taken_at timestamptz,
  source_proof_image_id uuid references public.gallery_images(id) on delete set null,
  status text not null default 'uploading' check (status in ('uploading','ready','failed'))
);
create index if not exists gallery_images_gallery_sort_idx on public.gallery_images (gallery_id, sort_order);

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'galleries_cover_image_fk') then
    alter table public.galleries add constraint galleries_cover_image_fk foreign key (cover_image_id) references public.gallery_images(id) on delete set null;
  end if;
end $$;

-- ---------- Selections (the client's hearts + notes) ----------
create table if not exists public.gallery_selections (
  gallery_id uuid not null references public.galleries(id) on delete cascade,
  image_id uuid not null references public.gallery_images(id) on delete cascade,
  client_email text not null check (client_email = lower(client_email)),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (image_id, client_email)
);
create index if not exists gallery_selections_gallery_idx on public.gallery_selections (gallery_id);

-- ---------- Downloads ----------
create table if not exists public.gallery_downloads (
  id uuid primary key default gen_random_uuid(),
  gallery_id uuid not null references public.galleries(id) on delete cascade,
  image_id uuid references public.gallery_images(id) on delete set null,
  client_email text not null,
  created_at timestamptz not null default now()
);
create index if not exists gallery_downloads_email_idx on public.gallery_downloads (client_email, created_at desc);
create index if not exists gallery_downloads_gallery_idx on public.gallery_downloads (gallery_id);

-- ---------- Activity log (client timeline) ----------
create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  client_email text not null,
  booking_id uuid references public.bookings(id) on delete set null,
  gallery_id uuid references public.galleries(id) on delete set null,
  actor text not null default 'system' check (actor in ('client','admin','system')),
  event text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists activity_log_email_idx on public.activity_log (client_email, created_at desc);
create index if not exists activity_log_booking_idx on public.activity_log (booking_id);
create index if not exists activity_log_gallery_idx on public.activity_log (gallery_id);

-- ---------- Row level security ----------
alter table public.galleries enable row level security;
alter table public.gallery_images enable row level security;
alter table public.gallery_selections enable row level security;
alter table public.gallery_downloads enable row level security;
alter table public.activity_log enable row level security;

do $$ declare t text; begin
  foreach t in array array['galleries','gallery_images','gallery_selections','gallery_downloads','activity_log'] loop
    execute format('drop policy if exists "admin all" on public.%I', t);
    execute format('create policy "admin all" on public.%I for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))', t);
  end loop;
end $$;

-- clients see their own galleries once they have been sent (drafts stay hidden)
drop policy if exists "client read own galleries" on public.galleries;
create policy "client read own galleries" on public.galleries for select to authenticated
  using (client_email = (select public.current_email()) and status <> 'draft');

-- …and the finished images in them
drop policy if exists "client read own images" on public.gallery_images;
create policy "client read own images" on public.gallery_images for select to authenticated
  using (status = 'ready' and exists (
    select 1 from public.galleries g where g.id = gallery_images.gallery_id and g.client_email = (select public.current_email()) and g.status <> 'draft'
  ));

-- open proof galleries: the client may add, change and remove their own picks; once submitted they are locked
create or replace function public.gallery_open_for(gid uuid, email text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.galleries g where g.id = gid and g.kind = 'proof' and g.client_email = email and g.status in ('sent','viewed','selecting'));
$$;
revoke all on function public.gallery_open_for(uuid, text) from public, anon;
grant execute on function public.gallery_open_for(uuid, text) to authenticated, service_role;

drop policy if exists "client read own selections" on public.gallery_selections;
create policy "client read own selections" on public.gallery_selections for select to authenticated
  using (client_email = (select public.current_email()));
drop policy if exists "client add selections" on public.gallery_selections;
create policy "client add selections" on public.gallery_selections for insert to authenticated
  with check (
    client_email = (select public.current_email())
    and public.gallery_open_for(gallery_id, client_email)
    and exists (select 1 from public.gallery_images i where i.id = image_id and i.gallery_id = gallery_selections.gallery_id and i.status = 'ready')
  );
drop policy if exists "client edit selections" on public.gallery_selections;
create policy "client edit selections" on public.gallery_selections for update to authenticated
  using (client_email = (select public.current_email()) and public.gallery_open_for(gallery_id, client_email))
  with check (client_email = (select public.current_email()) and public.gallery_open_for(gallery_id, client_email));
drop policy if exists "client remove selections" on public.gallery_selections;
create policy "client remove selections" on public.gallery_selections for delete to authenticated
  using (client_email = (select public.current_email()) and public.gallery_open_for(gallery_id, client_email));

drop policy if exists "client read own downloads" on public.gallery_downloads;
create policy "client read own downloads" on public.gallery_downloads for select to authenticated
  using (client_email = (select public.current_email()));

drop policy if exists "client read own activity" on public.activity_log;
create policy "client read own activity" on public.activity_log for select to authenticated
  using (client_email = (select public.current_email()));

-- ---------- Selection rules enforced in the database ----------
-- 1) no picks beyond the limit unless extras are allowed  2) first pick moves the gallery to "selecting"
create or replace function public.gallery_selection_rules() returns trigger
language plpgsql security definer set search_path = public as $$
declare g public.galleries;
begin
  select * into g from public.galleries where id = new.gallery_id;
  if tg_op = 'INSERT' and g.selection_limit is not null and not g.allow_extra_selections then
    if (select count(*) from public.gallery_selections s where s.gallery_id = new.gallery_id and s.client_email = new.client_email) >= g.selection_limit then
      raise exception 'You can pick up to % photos.', g.selection_limit using errcode = 'P0001';
    end if;
  end if;
  if g.status in ('sent','viewed') then
    update public.galleries set status = 'selecting', updated_at = now() where id = g.id;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists gallery_selection_rules on public.gallery_selections;
create trigger gallery_selection_rules before insert or update on public.gallery_selections for each row execute function public.gallery_selection_rules();

create or replace function public.touch_updated_at() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists galleries_touch on public.galleries;
create trigger galleries_touch before update on public.galleries for each row execute function public.touch_updated_at();

-- ---------- Activity: every booking starts the client's timeline ----------
create or replace function public.log_booking_created() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(new.email, '') <> '' then
    insert into public.activity_log (client_email, booking_id, actor, event, meta, created_at)
    values (lower(new.email), new.id, case when new.source = 'manual' then 'admin' else 'client' end, 'booking_created',
            jsonb_build_object('ref', new.ref, 'kind', new.kind, 'event_date', new.event_date), new.created_at);
  end if;
  return new;
exception when others then
  return new; -- the timeline must never block a booking
end $$;
drop trigger if exists bookings_activity_log on public.bookings;
create trigger bookings_activity_log after insert on public.bookings for each row execute function public.log_booking_created();

-- backfill once for bookings that already exist
insert into public.activity_log (client_email, booking_id, actor, event, meta, created_at)
select lower(b.email), b.id, case when b.source = 'manual' then 'admin' else 'client' end, 'booking_created',
       jsonb_build_object('ref', b.ref, 'kind', b.kind, 'event_date', b.event_date), b.created_at
from public.bookings b
where coalesce(b.email, '') <> ''
  and not exists (select 1 from public.activity_log a where a.booking_id = b.id and a.event = 'booking_created');

-- ---------- Client area: own bookings (safe columns only — internal notes are never exposed) ----------
create or replace function public.my_bookings()
returns table (id uuid, ref text, name text, kind text, flow_id text, packages text, event_date date, event_time text, status text,
               total numeric, total_text text, amount_paid numeric, payment_status text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select b.id, b.ref, b.name, b.kind, b.flow_id, b.packages, b.event_date, b.event_time, b.status, b.total, b.total_text, b.amount_paid, b.payment_status, b.created_at
  from public.bookings b
  where public.current_email() is not null and lower(b.email) = public.current_email()
  order by coalesce(b.event_date, b.created_at::date) desc;
$$;
revoke all on function public.my_bookings() from public, anon;
grant execute on function public.my_bookings() to authenticated;

-- ---------- Storage meter for the dashboard ----------
create or replace function public.gallery_storage_by_client()
returns table (client_email text, bytes bigint, images bigint)
language sql stable security definer set search_path = public as $$
  select g.client_email, coalesce(sum(i.bytes), 0)::bigint, count(i.id)
  from public.galleries g left join public.gallery_images i on i.gallery_id = g.id
  where public.is_admin()
  group by g.client_email;
$$;
revoke all on function public.gallery_storage_by_client() from public, anon;
grant execute on function public.gallery_storage_by_client() to authenticated;

-- one row per gallery: counts for the dashboard lists (admins only)
create or replace function public.gallery_stats()
returns table (gallery_id uuid, images_ready bigint, images_failed bigint, bytes bigint, picks bigint, notes bigint, last_activity timestamptz)
language sql stable security definer set search_path = public as $$
  select g.id,
    (select count(*) from public.gallery_images i where i.gallery_id = g.id and i.status = 'ready'),
    (select count(*) from public.gallery_images i where i.gallery_id = g.id and i.status = 'failed'),
    (select coalesce(sum(i.bytes), 0)::bigint from public.gallery_images i where i.gallery_id = g.id),
    (select count(*) from public.gallery_selections s where s.gallery_id = g.id),
    (select count(*) from public.gallery_selections s where s.gallery_id = g.id and coalesce(s.note, '') <> ''),
    greatest(g.updated_at, (select max(a.created_at) from public.activity_log a where a.gallery_id = g.id))
  from public.galleries g
  where public.is_admin();
$$;
revoke all on function public.gallery_stats() from public, anon;
grant execute on function public.gallery_stats() to authenticated;

-- reorder a gallery in one call (drag & drop / "sort by filename" in the dashboard)
create or replace function public.gallery_reorder(gid uuid, ids uuid[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Not allowed' using errcode = '42501'; end if;
  update public.gallery_images i set sort_order = o.ord - 1
  from unnest(ids) with ordinality as o(id, ord)
  where i.id = o.id and i.gallery_id = gid;
end $$;
revoke all on function public.gallery_reorder(uuid, uuid[]) from public, anon;
grant execute on function public.gallery_reorder(uuid, uuid[]) to authenticated;

-- table privileges (RLS still applies)
grant select, insert, update, delete on public.profiles, public.galleries, public.gallery_images, public.gallery_selections, public.gallery_downloads, public.activity_log to authenticated;
grant all on public.profiles, public.galleries, public.gallery_images, public.gallery_selections, public.gallery_downloads, public.activity_log to service_role;
