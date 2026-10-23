# Google Calendar ↔ bookings sync — setup guide

Every booking (from the website **or** added by hand in the dashboard) appears on your Google Calendar, and moves or disappears when you change the date, cancel or delete it.

| Booking status | On the calendar |
|---|---|
| New (not yet confirmed) | `? Portrait — Ada Obi`, yellow |
| Confirmed | `Portrait — Ada Obi`, green |
| Completed | `✓ Portrait — Ada Obi`, grey |
| Cancelled / deleted / no date | removed |

Timed bookings last 2 hours (change `DEFAULT_HOURS`). If the booking has no usable time, it becomes an all-day event. The description holds the reference, client contact details, package, price, paid status, every answer from the booking form, and a link back to the dashboard. Pop-up reminders: 1 day and 1 hour before.

You do three things: **A** deploy the script in Google, **B** run `calendar-sync.sql` in Supabase, **C** test. About 10 minutes.

---

## A. Create the script in Google (use the Google account whose calendar you want)

1. Go to <https://script.google.com> → **New project**. Name it `Illuszionz bookings → calendar`.
2. Delete the sample code, then paste in the **entire** contents of [`supabase/google-calendar.gs`](google-calendar.gs).
3. Set the time zone (important — otherwise events land at the wrong hour): left sidebar **Project Settings** (⚙) → tick **Show "appsscript.json" manifest file in editor** → go back to **Editor** → open `appsscript.json` → set `"timeZone": "Europe/London"` → save.
4. Choose a secret: invent a long random word, e.g. `wd3-Kp82-lemon-ranch-77`. In **Project Settings** → **Script Properties** → **Add script property**: name `SECRET`, value = your secret → **Save script properties**.
5. (Optional) Different calendar than your main one? In Google Calendar → the calendar's ⋮ → **Settings and sharing** → **Integrate calendar** → copy the **Calendar ID**, and paste it over `'primary'` on the `CALENDAR_ID` line at the top of the script.
6. Test it: in the editor choose the function **`testSync`** in the dropdown → **Run**. Google asks for permission the first time: **Review permissions** → pick your account → **Advanced** → **Go to … (unsafe)** → **Allow** (it is your own script; it only needs your calendar). A test event appears on your calendar 3 days from now at 14:00 and removes itself after 20 seconds. If you see it, the script works.
7. Deploy: **Deploy** → **New deployment** → gear icon → **Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone**   *(the secret key in the URL is what protects it)*
   - **Deploy** → copy the **Web app URL** (ends in `/exec`).
   - Check it: open that URL in a browser. You should see `Booking calendar sync is running`.

> If you later edit the script, use **Deploy → Manage deployments → ✏ → Version: New version → Deploy**. The URL stays the same.

## B. Connect Supabase

1. Open [`calendar-sync.sql`](../calendar-sync.sql) (project root).
2. Find the single line `url := 'PASTE-YOUR-WEB-APP-URL-HERE?key=YOUR-SECRET'` and replace it with your URL, then `?key=` and your secret:
   `url := 'https://script.google.com/macros/s/AKfycb…/exec?key=wd3-Kp82-lemon-ranch-77',`
3. Supabase → **SQL Editor** → **New query** → paste the whole file → **Run**. ("Success. No rows returned" is right.)

Do **not** also create a Database Webhook — use one or the other, or every booking would be sent twice.

## C. Check it end to end

1. In the dashboard add a booking by hand (Bookings → **+ Add booking**) with a date and time. Within about 10 seconds it appears on your Google Calendar.
2. Change its date in the dashboard → the event moves. Set the status to **Cancelled** → it disappears.
3. If nothing happens, in the Supabase SQL Editor run
   `select id, status_code, content, created from net._http_response order by created desc limit 10;`
   - `status_code` 200/302 and no error text → Supabase delivered it; check the script's **Executions** page (left sidebar) for errors.
   - `content` mentions `bad key` → the `?key=` in the SQL does not match the `SECRET` script property.
   - Nothing listed → the SQL was not run, or the trigger is missing: re-run `calendar-sync.sql`.

## D. Put the bookings you already have on the calendar (once)

After the test in C works, in the SQL Editor run:

```sql
update public.bookings set notes = notes where event_date >= current_date;
```

That re-sends every upcoming booking. Running it again is harmless — events are updated, not duplicated. If you have more than ~25 upcoming bookings, do it in slices so Google isn't overloaded, e.g. one month at a time:
`... where event_date >= '2026-11-01' and event_date < '2026-12-01';`
For past bookings, change the `where` to match (`event_date < current_date`).

## Good to know

- The sync is one-way: dashboard → calendar. Moving an event on the calendar does **not** change the booking; change dates in the dashboard.
- Deleting a calendar event by hand won't bring it back until that booking is edited again.
- Changing the URL/secret later: edit the line in `calendar-sync.sql` and run it again.
- The script's `SECRET` is not in your site code; keep the URL private.
- Removing the sync: `drop trigger if exists bookings_calendar_sync on public.bookings;`
