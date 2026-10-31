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

## Update — 31 Oct 2026: link access + password accounts (Macauley's new flow)

29. **Galleries open from the emailed link, no sign-in.** Each gallery has a private key (`galleries.share_token`, 64 random hex
    characters); the link is `/gallery/<id>/?k=<key>`. This is how Pixieset and Pic-Time work. The key is checked on the server
    (constant-time) by every gallery function; picks, notes, submitting and downloads all work with the link alone. The key is
    remembered on that device, so a bookmark without it still opens. The page sends no referrer, so the key doesn't leak to other sites.
30. **Signed-in clients still get in without the key**, if they're signed in with the gallery's email (account area links carry the key too).
31. **"Reset link"** in the Gallery Manager makes a new key. It is the answer to "the link was forwarded to the wrong person".
32. **Picks now go through a new function (`gallery-pick`)** instead of straight to the database, because link visitors aren't signed in.
    Picks are stored against the gallery's email either way, so link picks show up in the account later. The limit is still enforced by the
    database trigger.
33. **The save-to-account prompt** shows 6 seconds after the gallery opens, only to people who aren't signed in, never on top of the
    lightbox or another sheet, on both previews and finals. "Not now" snoozes it for 3 days on that device. The email is pre-filled with the
    gallery's email, with a note to use it so the gallery attaches automatically. A link in the gallery footer reopens it.
34. **Accounts are email + password only** (8+ characters). No more email codes. New accounts must confirm their email before signing in.
35. **Every account email links to our own `/account/` page** with a one-time token (`token_hash`), not through Supabase's redirect.
    Why: it works on any device, it can't send people to a wrong address (the old emails sent people to `localhost:3000` because Supabase's
    "Site URL" was never changed), and email security scanners that pre-open links can't use them up.
36. **Account emails are sent by Supabase through Resend** (custom SMTP, sender "Illuszionz Media" <mail@illuszionzmedia.com>), with our own
    templates (confirm email, reset password, change email), so nothing comes from "Supabase Auth" any more. Templates live in
    `scripts/gallery-auth-config.py`; `python3 scripts/gallery-auth-config.py https://illuszionzmedia.com --preview /tmp/emails` saves them as
    HTML to look at.
37. **The go-live script no longer `source`s `.env.local`** (the `EMAIL_FROM=ILLUSZIONZ MEDIA <mail@…>` line breaks that), and it now prints
    Supabase's own error message if a step is refused, instead of stopping silently. The previous run stopped at step 4, so the site URL,
    email templates, SMTP and the nightly preview clean-up were never set.
38. **Live changes were blocked again** by Claude Code's safety check (writing to the live database), so the new migration, the 10 functions
    and the account settings go live with `npm run gallery:go-live`, like last time.
39. **Tested:** `npm run test:gallery` now has 97 checks (link access without sign-in, picks sent with the key, the prompt after a few seconds,
    sign up → check your email, wrong password, forgot password, the reset link → new password, the confirm link), all passing at 375 px and
    desktop; the site's own 71 checks pass on a production build; all 10 functions type-check with Deno.

## Update — 31 Oct 2026: cancel uploads, selection deadline, unedited images, feedback on finals

40. **Cancel upload** aborts the transfers in progress and deletes what that file already put in storage (its database row too).
    Finished photos are kept on purpose: cancelling half-way shouldn't throw away work that arrived; delete those from the grid.
41. **Previews are deleted 30 days after the first send** (`previews_purge_at` is set when the gallery is sent; the nightly clean-up
    already deletes on that date). When finals are delivered, the later of "30 days after sending" and "30 days after delivery" wins.
    The email shows the date in a red-edged box, the gallery shows "Please make your selection by …", and **+30 days** extends it.
42. **The unedited price is set per preview gallery** (there was no unedited option or price anywhere on the site). Empty = the tick box
    isn't shown. The client's choice is saved when they submit (`galleries.wants_unedited`) and goes into both emails, the WhatsApp text
    and the timeline. Payment is handled by you as today (invoice / WhatsApp); the site shows the amount, it doesn't take payment.
43. **Unedited images live in the same finals gallery** as a second set (`gallery_images.image_set = 'unedited'`), so one link, one
    account entry and one delivery email cover both. They upload like finals (full resolution, no watermark) and have their own
    Download all. Feedback buttons are only on the edited photos.
44. **Feedback is per photo (👍 / 👎 / comment) and sent in one go**, not one email per tap. It is saved as the client goes
    (`gallery_feedback`, written only through the `gallery-feedback` function) so nothing is lost if they close the page, and they can
    send again after changing it.
45. **Tested:** `npm run test:gallery` now has 124 checks (cancel mid-upload removes the files, the tick box with its price and summary,
    the choice sent with the selection, the edited / unedited switch, 👎 + comment saved, feedback sent); all 11 functions type-check.

## Update — 31 Oct 2026: lighter watermark
46. **Previews now carry only the faint diagonal tile of small logos** (10 % opacity), as asked. The big bold centre logo (item 15) is
    switched off with `watermark.size: 0` in `gallery.config.ts`; set it back to e.g. `0.6` to bring it back. The tile still covers the
    whole photo, so it can't simply be cropped out. Previews already uploaded keep the old watermark; re-upload a gallery to change it.

## Update — 31 Oct 2026: deleting galleries
47. **Galleries can be deleted from Dashboard → Galleries**: a ⋯ menu on each card (Manage, Open as the client sees it, Copy client link,
    Rename, Delete) and checkboxes with a bulk bar (Send reminder, Keep previews +30 days, Delete), like the bookings list. Delete removes
    the photos from storage too, through the same `gallery-delete` function the Gallery Manager uses.
48. **Deleting a booking now deletes its galleries and their photos** (single and bulk delete, and the confirm text says so). Before, the
    galleries stayed behind without a booking; any that are already like that show a "Booking deleted" badge and can be deleted from the
    Galleries page.
