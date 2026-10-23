-- =====================================================================
-- Sends every new, edited or deleted booking to the Google Calendar script
-- (see supabase/CALENDAR_SYNC.md). OPTIONAL alternative to the Database Webhooks screen:
-- use either this or the webhook, never both (bookings would be sent twice).
-- 1. Replace the URL below with your Apps Script web app URL (ends in /exec)
--    and your secret, keeping the ?key= part:
--      https://script.google.com/macros/s/XXXXXXXX/exec?key=YOUR-SECRET
-- 2. Run the whole file in Supabase -> SQL Editor. Safe to run again.
-- =====================================================================
create extension if not exists pg_net;

create or replace function public.notify_calendar()
returns trigger
language plpgsql security definer set search_path = public, extensions
as $$
begin
  perform net.http_post(
    url := 'PASTE-YOUR-WEB-APP-URL-HERE?key=YOUR-SECRET',
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
