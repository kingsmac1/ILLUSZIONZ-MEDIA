-- =====================================================================
-- Booking -> Google Calendar sync.   Full walkthrough: supabase/CALENDAR_SYNC.md
--
-- Sends every new, edited or deleted booking (website bookings AND ones you add by hand in the
-- dashboard) to your Google Apps Script web app, which creates / moves / removes the calendar event.
--
-- Use this file OR a Database Webhook (Database -> Webhooks), never both: bookings would be sent twice.
--
-- BEFORE YOU RUN IT — do step 1 only:
--   1. In the ONE line below that says  url := '...'  replace everything between the quotes with
--        <your Apps Script web app URL>?key=<your SECRET>
--      e.g.  https://script.google.com/macros/s/AKfycb.../exec?key=my-long-secret
--      (the SECRET is the one you save in the script's "Script properties"; the guide shows where).
--   2. Paste the whole file into Supabase -> SQL Editor -> Run. Safe to run again whenever the URL changes.
-- =====================================================================
create extension if not exists pg_net;

create or replace function public.notify_calendar()
returns trigger
language plpgsql security definer set search_path = public, extensions
as $$
begin
  perform net.http_post(
    url := 'PASTE-YOUR-WEB-APP-URL-HERE?key=YOUR-SECRET',   -- <<< step 1: the only line you edit
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := jsonb_build_object(
      'type', TG_OP,
      'table', TG_TABLE_NAME,
      'record', case when TG_OP = 'DELETE' then null else to_jsonb(NEW) end,
      'old_record', case when TG_OP = 'INSERT' then null else to_jsonb(OLD) end
    )
  );
  return coalesce(NEW, OLD);
exception when others then
  return coalesce(NEW, OLD); -- a calendar hiccup must never block a booking
end;
$$;

drop trigger if exists bookings_calendar_sync on public.bookings;
create trigger bookings_calendar_sync
  after insert or update or delete on public.bookings
  for each row execute function public.notify_calendar();

-- ---------------------------------------------------------------------
-- OPTIONAL, run separately AFTER the script is deployed and tested:
-- add every booking you already have to the calendar in one go (a no-change update fires the trigger).
-- Don't run it twice — the second time it only refreshes the same events, nothing is duplicated.
--
--   update public.bookings set notes = notes;
--
-- To see whether Supabase reached Google (status 200/302 = delivered):
--
--   select id, status_code, created from net._http_response order by created desc limit 10;
-- ---------------------------------------------------------------------
