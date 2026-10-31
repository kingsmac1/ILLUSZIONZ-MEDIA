# Client galleries — how it works

A private gallery for every shoot. Clients pick their favourite previews, you edit them, then they download the finals.
Everything is in your dashboard, and clients see all their shoots in one account at **illuszionzmedia.com/account/**.

## The flow at a glance
1. **Upload previews** → 2. **Send to client** → 3. client **picks + submits** → 4. you **edit** → 5. **upload finals + deliver** → 6. client **downloads**.

---

## 1. Send previews
1. Dashboard → **Bookings** → press **Gallery** on the booking. (Or open the booking and press **Gallery**.)
2. Drag the preview photos onto **Upload previews** (or click it to choose files). The first photo shows how the watermark looks.
3. Press **Watermark & upload**. Watermarking happens on your computer, so your full-size files never leave it. Keep the tab open
   until it says "x of x uploaded". You can switch to other dashboard pages meanwhile. Anything that fails gets a **Retry failed** button.
4. Check the **Gallery title**, add a **message to the client** if you like, and set **Photos the client can pick**
   (filled in from the package where possible; leave it empty for no limit). Tick **Allow extra picks** if they may choose more, and say what extras cost.
5. Press **Send to client**. It shows the client's email; confirm. They get an email with the link.
   - **Copy client link** gives you the link to send on WhatsApp yourself.
   - **Send reminder** nudges a client who hasn't finished picking.
   - In the photo grid: click photos to select them (**Delete**, **Set as cover**), drag to reorder, or **Sort by filename** for camera order.

**No sign-in needed.** The link in the email (and from **Copy client link**) is private: it ends in `?k=` and a long secret key, and it
opens the gallery straight away, on any device. Anyone holding the link can see the gallery, so treat it like a key.
- **Reset link** (next to Copy client link) makes a new key and the old link stops working at once. Use it if a link was
  shared with the wrong person, then send the new link (**Resend email** or Copy client link). Picks are kept.
- A few seconds after the gallery opens, a visitor who isn't signed in is invited to **create an account** (or sign in) so the
  gallery stays in their client area. It is optional; "Not now" hides it for 3 days on that device.

**Client accounts** (`/account/`, and **Sign in / Sign up** in the site header and menu) use an email + password:
- *Create account*: name, email, password (8+ characters). They get a **Confirm your email** email from Illuszionz Media; the
  link signs them in. Every booking and gallery under that email then appears in their account.
- *Forgot password?* emails a link to choose a new password (works once, for one hour).
- Clients who signed up earlier with a code have no password yet: they use **Forgot password?** once to set one.

**Cancel an upload:** while photos are uploading, press **Cancel upload** above the progress list (or the × on one file).
Files still waiting or uploading stop and anything half-uploaded is removed; photos that already finished stay.

**Selection deadline:** previews are deleted **30 days after you first send them**, and the email and the gallery tell the client the
date and ask them to choose early. Need longer? Press **+30 days** next to the date in the Gallery Manager.

**All unedited images (optional):** fill in *Price for all unedited images (£)* in the preview gallery settings. The client then sees
an **"I want all unedited images"** tick box with that price when they submit their picks, and the price is added to their summary.
If they tick it, their selection email says so and the Finals tab opens an **All unedited images** upload area. For a client who
paid for all unedited images in their package, tick **"This client gets all the unedited images"** on the Finals tab instead.
The client finds them in the finals gallery under **Unedited**, with their own Download all.

## 2. Read the selection
When the client presses **Submit selection**:
- You get an email with the picks, their notes, and the filenames (one per line, plus a Lightroom filter).
- Their phone opens WhatsApp with a ready-made message to you. **They still have to tap Send**; WhatsApp doesn't allow sending silently.
- In the Gallery Manager the picks are outlined in red with their notes. Buttons:
  - **Copy Lightroom filter** → in Lightroom Classic: Library → filter bar → **Text** → **Filename** → **Contains** → paste.
    Only the picked photos show. Select all, then edit.
  - **Copy filenames**, **Download .txt**, **Download .csv** (filename + note).
- The selection is locked. If the client wants changes, press **Unlock selection**. Their picks stay, and they get an email saying they can edit.

## 3. Deliver the finals
1. Same booking → **Finals** tab → drag in the edited photos (full resolution, no watermark). Keep the camera filenames
   (`DSC_0012-edit.jpg` is fine) and they match the picks automatically. The card shows matched photos, which picks have no final yet,
   and finals with no matching pick.
2. Press **Deliver to client**. They get an email, and can download single photos or **Download all** (zips, in parts for big galleries).
3. The watermarked previews are deleted automatically **30 days later** to save storage. The picks and notes stay.

## Dashboard → Galleries
Every client, with all their galleries grouped together: status at a glance (**Sent, Viewed, Selecting (12/40), Submitted, Delivered**),
counts, storage used and last activity. Filters for status, shoot type and date, plus **Selections waiting** for what needs editing.
The "Storage used" card shows how much space your galleries take up. The **Overview** page also lists "Selections waiting for you".

## The client's side
- **Gallery page**: full-screen cover, then all photos in a clean grid. ♥ to pick, a note on any photo, a counter like "23 / 40",
  **All / Picked** filter, a full-screen viewer (swipe on phones, arrow keys on computers, pinch or scroll to zoom). Picks save as they go.
- **Client area** (`/account/`, "Sign in / Sign up" / "My Account" in the site header and menu): next shoot, "action needed" cards, all bookings,
  galleries per shoot, a timeline ("You submitted 38 photos for editing · 3 Nov"), download history, profile and optional password.
  Anything booked with their email shows up automatically, even bookings made before they signed up.

## Storage tips
- Previews are small (about 0.3 GB for 600 photos). Finals are the big part (about 4 GB for 300 full-size photos).
- The first 10 GB on Cloudflare R2 are free, then about $0.015 per GB per month (1 TB ≈ $15). Client downloads cost nothing extra.
- Export finals as high-quality JPEG (quality 85–90, long edge 4000–6000 px) instead of 50 MB TIFFs. Clients won't see the difference,
  and you will fit roughly 3× more shoots.
- Delete old galleries you no longer need from the Gallery Manager (**Delete gallery**). This removes the files from storage too.

## Feedback on the final photos
In the finals gallery the client can open any edited photo and tap **👍**, **👎** or the comment button, then press **Send feedback**.
You get an email listing the 👎 photos with their comments (plus a Lightroom filter for them), the comments and the 👍 photos;
the Finals tab shows the same in **Client feedback**. They can change their mind and send again.

## Test before going live
1. Upload 10 previews. Open one: the logo watermark is big and visible.
2. Send to a test email you own (a Gmail that isn't your admin email).
3. Open the link in a private window: the gallery opens without signing in. Remove the `?k=…` part from the address: it asks you
   to sign in instead. Wait a few seconds: the "Keep your photos in one place" prompt appears. Create an account with the test
   email and check that the **Confirm your email** email comes from Illuszionz Media and that its link signs you in.
   Then sign out, use **Forgot password?**, and check the reset email and link too.
4. Pick photos, add a note, refresh: the picks are still there. Submit: you get the email with the filenames, and WhatsApp opens.
5. Upload finals, **Deliver**. The client gets the email and can download single photos and "Download all".
6. `/account/` shows the booking, both galleries and the timeline. Dashboard → Galleries shows the client.
7. Do it all once on your phone.

---

## For developers: what's where
| Part | Where |
|---|---|
| Brand settings (logo, watermark size/opacity, image sizes, purge days, owner contacts, storage budget) | `src/features/gallery/gallery.config.ts` |
| Dashboard screens (Gallery Manager, Galleries, uploader, watermark worker) | `src/features/gallery/admin/`, `src/features/gallery/imaging/` |
| Client gallery `/gallery/<id>/` | `src/features/gallery/client/`, route `src/routes/gallery.$galleryId.tsx`, edge shell `functions/gallery/[id].ts` |
| Client area `/account/` | `src/features/account/`, route `src/routes/account.tsx` |
| Server functions (signed R2 URLs, send, picks, submit, unlock, delete, downloads, clean-up) | `supabase/functions/gallery-*`, shared code in `supabase/functions/_shared/` |
| Email templates (brand at the top) | `supabase/functions/_shared/email-templates.ts` |
| Database (tables, security rules, helpers) | `supabase/migrations/20261030120000_gallery_foundations.sql` (copy: `docs/gallery/sql/`) |
| Switch-on script | `scripts/gallery-go-live.sh` (`npm run gallery:go-live`) |
| Tests | `npm run test:gallery` (browser test with Supabase/R2 mocked; needs `npm run dev`) |

Security in one paragraph: photos live in a **private** R2 bucket and are only reachable through short-lived signed links (6 h for viewing,
15 min for full-size downloads). Previews are watermarked **before** upload, and the server refuses originals for proof galleries. Every table has
row-level security: a client only sees galleries sent to their **verified** email, can only change picks while the gallery is open and
within the limit, and never sees your internal booking notes. Admins are the emails in Dashboard → Settings.

## Reusing this on another photography site (e.g. DMI Photography)
1. Copy `src/features/gallery/`, `src/features/account/`, `supabase/functions/gallery-*` + `supabase/functions/_shared/`,
   the migration, `scripts/gallery-go-live.sh`, `functions/gallery/[id].ts` and the two route files.
2. The migration expects a `bookings` table (`id`, `email`, `name`, `kind`, `event_date`, …) and an `admin_users` table with `is_admin()`;
   adapt the column names in `my_bookings()` and the booking trigger if they differ.
3. Edit `gallery.config.ts`, `BRAND` in `_shared/email-templates.ts`, the logo in `_shared/logo.ts`, and `PURGE_DAYS` in `_shared/gallery.ts`.
4. Create an R2 bucket, fill `.env.local`, run the go-live script, paste the CORS rules.
5. Add the "Gallery" button and the "Galleries" nav item to that site's dashboard (see how `src/admin/AdminApp.tsx` and `Bookings.tsx` do it here).
