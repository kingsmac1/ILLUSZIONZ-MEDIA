# Decisions made during the client-gallery build

Each item: what was decided, and why. Change any of them later if you prefer otherwise.

## Setup & security
1. **Admins stay in `admin_users`.** The dashboard already had real Supabase Auth plus an `admin_users` table (managed in
   Dashboard → Settings). The new `profiles.role` is kept in sync with it automatically by a trigger, so there is one place to add/remove admins.
2. **Only confirmed emails count.** `current_email()` returns the signed-in email only after it has been verified (OTP code), and `is_admin()`
   now uses it. Your admin login is confirmed, so nothing changes for you.
3. **Clients who open `/dashboard/` are redirected to `/account/`** (the brief said `/admin/*`; this site's admin lives at `/dashboard/`).
4. **Admin "pages" live inside the dashboard's hash routes:** `/dashboard/#/galleries` and `/dashboard/#/bookings/<id>/gallery` (the brief's
   `/admin/galleries` and `/admin/bookings/:id/gallery`).
5. **Clients never get the bookings table itself.** Instead of an RLS policy on `bookings` (which would expose your internal notes column),
   the client area calls a safe function `my_bookings()` that returns only date, service, package, status and payment fields.
6. **Deleting a booking keeps its galleries** (`booking_id` becomes empty) so photos are never lost by accident. Delete galleries from the manager.
7. **One proof gallery and one finals gallery per booking** (database rule).
8. **Selection limits are enforced by the database too**, not only the screen: picks beyond the limit are refused unless "allow extras" is on,
   and a submitted selection is locked at the database level.

## Backend
9. **Supabase Edge Functions, as the brief asked** — even though the existing booking emails run as Cloudflare Pages Functions. Reason: the R2 keys and
   the gallery logic stay in Supabase secrets/functions, and the existing booking email code is untouched. The email design was ported 1:1 into
   `supabase/functions/_shared/email-templates.ts` (same Resend provider, sender and inline logo), so it needs `RESEND_API_KEY` + `EMAIL_FROM` as Supabase secrets too.
10. **Emails never block the work.** If email isn't set up yet, sending/delivering still changes the status, and the dashboard shows
    "email not sent — copy the link" so you can WhatsApp it.
11. **View URLs are signed per hour** (valid 6–7 h) so the browser can cache images between visits; download URLs last 15 minutes.
12. **The cover screen is public, the photos aren't.** Anyone with the link sees the gallery title, date, a blurred cover thumbnail and a masked
    hint of the email (`e•••@gmail.com`) so clients know which address to use. Everything else needs the right signed-in email.
13. **Daily preview clean-up** runs at 03:15 UK time through `pg_cron`, 5 galleries per run, and retries anything that fails the next day.

## Photos
14. **Lightroom filter format:** comma-separated stems (`DSC_0012, DSC_0045`). The brief suggested `DSC_0012 OR DSC_0045`, but Lightroom Classic's
    Library filter (Text → Filename → *Contains*) treats every word as a term, so "OR" would match any filename containing "or". Commas work as intended.
15. **Watermark** = the white logo, 60 % of the image width at 35 % opacity, plus a diagonal tile at 10 %, with a soft shadow so it also shows on
    bright photos. All values in `src/features/gallery/gallery.config.ts`.
16. **Finals ↔ picks matching** uses the filename stem, ignoring suffixes like `-edit`, `_final`, ` copy 2`.
17. **Default order is camera order** (natural filename sort: `DSC_2` before `DSC_10`).

## Screens & design
18. **The client gallery is a standalone page** (no site header/footer, like Pixieset): full-screen cover, black top bar, white "contact sheet"
    grid. The only colour besides black and white is a darkroom-safelight red, used just for picks (hearts, picked frames and the progress
    line under the bar that fills as they pick). Titles use the site's Playfair Display; everything else uses Inter.
19. **`/account/` sits inside the normal site** (header + footer), with a person icon next to the menu button ("Sign in" / "My Account").
    The icon only checks whether a sign-in is stored, so public pages don't load any extra code.
20. **The gallery opts out of the site's scroll-reveal animation** (it would hide the photos for 2.6 s on every visit). The only motion is the
    cover title settling in, which is off for visitors who prefer reduced motion.
21. **"Download all" builds zips in the browser**, in parts of up to 100 photos / 2 GB (smaller parts on phones). Each part is started by its
    own tap, because browsers only allow a save dialog right after a click. On Chrome/Edge desktop the zip streams straight to disk.
22. **Notes require a pick**: writing a note on a photo also picks it (a note on an unpicked photo would never reach the editor).
23. **Grid images load the 600 px thumbnail or the 2048 px preview**, whichever fits the screen (`srcset`), and fade in when loaded.

## What could not be done from here
24. **Nothing was changed in the live Supabase project.** Applying the database migration was blocked as a "production deploy" that needs
    your explicit OK, and deploying functions, setting secrets and changing sign-in settings fall under the same rule. Everything is packaged
    in `npm run gallery:go-live` (see TODO_FOR_MACAULEY.md).
25. **R2 CORS could not be set**: neither the R2 keys nor the Cloudflare API token have permission to change bucket settings. The JSON to paste
    is in `docs/gallery/r2-cors.json`.
26. **No Resend key was available locally**, so emails and custom SMTP for sign-in codes are switched on by adding `RESEND_API_KEY` +
    `EMAIL_FROM` to `.env.local` before running the go-live script.
27. **How it was tested instead:** the database migration and every security rule ran on a real Postgres engine (PGlite) with Supabase's auth
    stubbed (46 checks: admins vs clients vs a wrong email vs an unconfirmed email, picks, limits, locking, reordering). The R2 signing code did a
    real upload / download / delete round-trip against your bucket (one tiny test file, deleted). The functions were type-checked with Deno.
    The screens were driven in a fresh browser with Supabase/R2 mocked (`npm run test:gallery`, 58 checks at 375 px and desktop), including the
    real watermark worker: uploaded previews were checked to be JPEGs ≤ 2048 px with a visible watermark, and no original is ever uploaded for proofs.
    The existing site tests still pass (71/71).
28. **R2 doesn't enforce the Content-Type on presigned uploads.** Harmless here (only admins get upload links, and they expire after 2 h).
