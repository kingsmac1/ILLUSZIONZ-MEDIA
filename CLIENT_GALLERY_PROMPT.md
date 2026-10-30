# Illuszionz Media — Client Gallery & Client Area
### Build guide (for Macauley) + full build prompt (for Claude Code)

This file has two parts:

- **Part A — Your guide.** Plain-language steps *you* do: accounts, keys, the `.env.local` file, how to start Claude Code, how to test.
- **Part B — The prompt.** Instructions *Claude Code* follows. You don't need to understand every line of Part B.

Put this file in the root of the project (`~/Documents/website-codes/illuszionzmedia/CLIENT_GALLERY_PROMPT.md`), then follow Part A.

---

# PART A — YOUR GUIDE (do these yourself, in order)

## A1. The big picture in one minute

| Job | Tool | Why |
|---|---|---|
| Website + admin dashboard | Your existing React/TanStack site | Gallery is added *inside* it, not a separate app |
| Database (clients, galleries, selections) + logins | **Supabase** (free tier is fine) | You already use it |
| Photo storage | **Cloudflare R2** | 10 GB free; afterwards about $0.015 per GB per month, so 1 TB costs about $15. Clients downloading photos costs **nothing extra** (no "egress" fees) |
| Emails | Whatever your booking emails already use (likely Resend) | Re-use what already works |
| WhatsApp alert | A pre-filled `wa.me` link | Free, no WhatsApp Business API needed |

**What a typical shoot costs in storage:** a wedding with 600 watermarked previews is about 0.3 GB. 300 full-resolution finals is about 4 GB. So the free 10 GB is enough for testing. On the $15/month plan, you can hold roughly 200+ weddings' finals.

## A2. The flow (improved version of yours)

Your flow was good. I kept it and tightened a few things (marked ★).

1. **Admin** opens **Dashboard → Bookings**, clicks **"Gallery"** on a booking.
2. Admin drags in the preview photos. ★ The watermark is added **in the browser before upload**, so un-watermarked previews never leave your computer. ★ The original filename (e.g. `DSC_4512.jpg`) is kept, so you can find the RAW later.
3. Admin sets ★ **how many photos the client can pick** (e.g. 40, from their package), then clicks **"Send to client"**. Client gets an email with the link.
4. **Client** opens the link. ★ If they don't have an account yet, they sign up with **the same email the booking used**. They type a 6-digit code sent to their email (no password to forget), with an optional password. A different email can't open it.
5. Client browses a beautiful full-screen gallery, ♥ hearts the ones they want, ★ can leave a note on a photo ("remove the person in the back"), and ★ sees a counter like "23 of 40 selected". Picks are saved automatically as they go.
6. Client clicks **"Submit selection"**. ★ The selection locks so it can't change mid-editing.
   - Photographer gets an **email** with a link to the selection and ★ **a copy-ready filename list for Lightroom** (this is the biggest time-saver; Pixieset and ShootProof both do it).
   - Client's phone/browser **opens WhatsApp with a pre-filled message** to the photographer. ⚠️ The client still has to tap "Send" in WhatsApp. No free tool can send a WhatsApp message silently.
7. Admin edits, then on the same booking opens the **Finals** tab and uploads the edited photos (no watermark, full resolution). Clicks **"Deliver"**. Client gets an email.
8. Client downloads single photos or ★ **"Download all"** (as a zip, in parts for big galleries).
9. **Client Area** (`/account`): all their bookings, every gallery (previews + finals) across all their shoots, selections, downloads and an activity timeline, as long as they use the same email.
10. **Admin → Gallery** section: every client listed, with all their galleries grouped under them. ★ It also shows "Viewed", "Selecting (12/40)", "Submitted", "Delivered" status at a glance.

★ **Other upgrades over Pixieset included:** "Client viewed the gallery" tracking. Admin can **unlock** a selection if the client wants to change it. Auto-delete of watermarked previews 30 days after finals are delivered, to save storage. The admin sees which finals belong to which picked preview.

## A3. Get your keys ready (about 20 minutes)

You'll collect these and paste them into one file. **Never send these keys to anyone, never paste them into chat, and never commit them to GitHub.**

### Supabase (3 things)
1. **Personal access token** (lets Claude Code create tables and deploy functions for you):
   Go to **supabase.com → click your avatar (top right) → Account preferences → Access Tokens → Generate new token**. Name it `claude-code-illuszionz`. Copy it (starts with `sbp_`).
2. **Project URL and project ref:** open your Illuszionz project → **Project Settings → General**. The **Reference ID** is the ref (looks like `abcdxyzqwerty`). The URL is `https://<ref>.supabase.co`.
3. **Database password:** the one you set when creating the project. If you forgot it, go to **Project Settings → Database → Reset database password**. Resetting is safe for your site, because the website uses keys, not this password.

### Cloudflare (4 things)
1. **Account ID:** Cloudflare dashboard → click **R2** in the left menu. The Account ID is shown on the right side.
2. **Turn on R2:** first time only, click **R2 → Purchase/Enable R2**. It asks for a card, but the free tier is free.
3. **Create the bucket** (this is just a folder in the cloud): **R2 → Create bucket** → name `illuszionz-galleries` → location Automatic → **Create**. Leave it **private** (do NOT enable public access).
4. **R2 access keys:** **R2 → Manage R2 API Tokens → Create API token** →
   - Permissions: **Object Read & Write**
   - Specify bucket: `illuszionz-galleries`
   - Create. Copy the **Access Key ID** and **Secret Access Key**. The secret is shown **once only**.
5. *(Optional, makes it "stress-free")* **Cloudflare API token** so Claude Code can set the bucket's upload rules (CORS) for you: **My Profile → API Tokens → Create Token → Custom token** → Permissions: `Account → Workers R2 Storage → Edit`. Copy it.
   If you skip this, Claude Code will give you a small block of text to paste into **R2 → your bucket → Settings → CORS policy**.

### Email
Check your Supabase project → **Edge Functions → Secrets**. If you see `RESEND_API_KEY`, you're set and Claude Code will reuse it. If not, sign up at resend.com, verify your domain `illuszionzmedia.com`, and create an API key.

## A4. Create the `.env.local` file

1. In VS Code, open the project folder.
2. In the left file list, right-click on empty space at the **root** (same level as `package.json`) → **New File** → name it exactly `.env.local`.
3. Paste this and fill in your values (no quotes, no spaces around `=`):

```
# ---- Server/admin secrets: used by Claude Code only, NEVER start these with VITE_ ----
SUPABASE_ACCESS_TOKEN=sbp_xxxxxxxxxxxxxxxxx
SUPABASE_PROJECT_REF=your_project_ref
SUPABASE_DB_PASSWORD=your_database_password

CLOUDFLARE_ACCOUNT_ID=xxxxxxxxxxxxxxxxxxxx
CLOUDFLARE_API_TOKEN=xxxxxxxxxxxxxxxx          # optional
R2_BUCKET=illuszionz-galleries
R2_ACCESS_KEY_ID=xxxxxxxxxxxxxxxx
R2_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxx

# ---- Public values the website is allowed to see ----
VITE_SUPABASE_URL=https://your_project_ref.supabase.co
VITE_SUPABASE_ANON_KEY=your_existing_anon_key
VITE_SITE_URL=https://illuszionzmedia.com
VITE_OWNER_EMAIL=photographer@email.com
VITE_OWNER_WHATSAPP=234XXXXXXXXXX
```

4. Open `.gitignore` and make sure it contains a line `.env.local` (and `.env`). If not, add them. Claude Code will double-check this too.

> Why two kinds? Anything starting with `VITE_` gets baked into the public website, so anyone could see it. The secret keys stay on your Mac. Claude Code moves the R2 keys into Supabase's secure "Secrets" storage, where only the server functions can read them.

## A5. Start the build

1. Back up first: in the VS Code terminal run `git add -A && git commit -m "before client gallery"` (or copy the folder somewhere).
2. In the VS Code terminal, inside the project folder, type `claude` and press Enter.
3. Paste this message:

> Read `CLIENT_GALLERY_PROMPT.md` in the project root. Follow PART B exactly and build everything from Phase 0 to Phase 6 in one go without stopping to ask me. When it's all done, give me the final report described in B7.

4. Leave it running. Claude Code may still ask you to approve some commands (for example, deploying to Supabase). To avoid that, start it with `claude --permission-mode acceptEdits`, or choose "Yes, and don't ask again" the first time each kind of command comes up.
5. When it finishes, read its final report. It will include a short **"Things only you can do"** list (for example, pasting a setting into Cloudflare if it couldn't do it itself). Then run through the A6 checklist.

## A6. Things to test before going live
- [ ] Upload 10 previews, open one: the logo watermark is big and visible.
- [ ] Send to a test email you own (use a Gmail different from the admin's).
- [ ] Open the link logged out: it asks you to sign up/sign in with that email.
- [ ] Try signing in with a *different* email: access is refused.
- [ ] Pick photos, add a note, refresh the page: the picks are still there.
- [ ] Submit: photographer email arrives with the filename list, and WhatsApp opens with the message.
- [ ] Upload finals, deliver: client gets the email and can download single photos and "Download all".
- [ ] Client Area shows the booking, both galleries and the timeline.
- [ ] Admin → Gallery shows the client with all their galleries.
- [ ] Everything works on your phone.

## A7. After the build (security)
- When everything works, go back to **Supabase → Access Tokens** and **delete** the `claude-code-illuszionz` token. Make a new one next time you need Claude Code to change the database.
- Keep `.env.local` off GitHub. If you ever pushed it by mistake, regenerate every key in it.

---
---

# PART B — PROMPT FOR CLAUDE CODE

You are adding a **client proofing & delivery gallery** (Pixieset-class, but better) and a **client account area** to the existing Illuszionz Media website and admin dashboard in this repository. The user (Macauley) is a non-technical founder. **Build the whole thing, Phase 0 through Phase 6, in one continuous run. Do not stop between phases and do not ask for approval.** He will review everything at the end. When a decision is needed, choose the safest sensible option that fits the existing code and record it in `docs/gallery/DECISIONS.md`. If something truly needs him (a dashboard click you can't do with the available tokens, a missing logo file, an unknown admin email), don't wait. Use a reasonable placeholder or fallback, add the item to `docs/gallery/TODO_FOR_MACAULEY.md` with click-by-click steps, and keep going. Never print secret values in the chat.

## B0. Hard rules
1. **Integrate, don't rebuild.** Reuse the existing design system, components, fonts, colours, layout, router, Supabase client, auth/admin-guard pattern and email Edge Function. New screens must look native to this site and its dashboard. Do not change existing pages' design or content except to add entry points (a "Gallery" action on booking rows, a "Gallery" item in the admin nav, "My Account" in the site header).
2. **Secrets:** read credentials from `.env.local` (load it in your shell with `set -a; source .env.local; set +a` before CLI commands). Never prefix secrets with `VITE_`. Never write secrets into source files, migrations, logs or commits. Make sure `.env`, `.env.local` and `supabase/.temp` are in `.gitignore`.
3. **Database changes** go in versioned files under `supabase/migrations/`. Also save a copy of each migration's SQL as `docs/gallery/sql/<n>_<name>.sql`, so the user can paste it into the Supabase SQL Editor himself if he prefers. **Never drop or alter existing tables/columns destructively.** Only add.
4. **Security is non-negotiable:** Row Level Security on every new table. A private R2 bucket. Short-lived signed URLs. Un-watermarked proof images must never be uploaded. Finals/originals are only reachable by the owning client (matched by verified email) or an admin.
5. Work through the phases (B5) in order without pausing. Run the build after each phase and fix errors before moving on. Commit after each phase with a clear message, so any phase can be rolled back.

## B1. Phase 0 — Understand the project first (no code changes)
Read the codebase and write `docs/gallery/PROJECT_NOTES.md` covering:
- Framework and build: TanStack Start vs TanStack Router + Vite, SSR or static/SPA. Where it's hosted (look for `wrangler.toml`, `_redirects`, `netlify.toml`, Cloudflare Pages config). Package manager (bun/npm).
- Routing structure. Where the **admin dashboard** lives, and **how admin access is protected today**: Supabase Auth user? Hardcoded email check? Password-only gate? Role table? This decides how clients and admins coexist in one Supabase Auth.
- The **bookings** table: name, columns (especially client name, **email**, phone, shoot type/date, package, status), how the dashboard lists them, and where row actions are rendered.
- Existing Supabase usage: client setup file, generated types, existing Edge Functions (e.g. `send-booking-email`), which email provider they use (Resend? SMTP?), and how they're invoked.
- UI kit (shadcn/ui? Tailwind tokens?), toast system, modal/drawer components, icon set, brand logo files available in `public/` or `src/assets/`.
- Then connect and inspect the live project: `npx supabase@latest link --project-ref $SUPABASE_PROJECT_REF -p $SUPABASE_DB_PASSWORD`, then list existing tables, RLS policies and functions (use `npx supabase db dump --schema public --linked -f /tmp/schema.sql` or `npx supabase inspect` and read the result; do not commit the dump).

Record any risks found in the notes (e.g. "admin login is only a password in the browser code"). **If admin protection is weak, fix it in Phase 1 with real Supabase Auth + `profiles.role`, because the gallery depends on real admin roles.** Keep the admin login screen looking the same. Treat the existing admin login email(s), or `VITE_OWNER_EMAIL` if none exist, as the admin(s), and list them in `TODO_FOR_MACAULEY.md` so he can confirm. Then continue straight into Phase 1.

## B2. Architecture (implement this; adapt names to the codebase)

### Storage — Cloudflare R2 (private bucket `R2_BUCKET`)
Object key layout:
```
galleries/{gallery_id}/proof/thumb/{image_id}.jpg     (≈600px long edge, watermarked)
galleries/{gallery_id}/proof/preview/{image_id}.jpg   (≈2048px long edge, watermarked)
galleries/{gallery_id}/final/thumb/{image_id}.jpg     (≈600px, no watermark)
galleries/{gallery_id}/final/web/{image_id}.jpg       (≈2560px, no watermark, for viewing)
galleries/{gallery_id}/final/original/{image_id}.{ext} (untouched full-res file)
```
- Uploads: the browser `PUT`s directly to R2 using **presigned URLs** created by an Edge Function. Files never pass through Supabase, which avoids size limits and cost.
- Viewing/downloading: **presigned GET URLs** (thumbs/previews 6 h, originals 15 min with `response-content-disposition=attachment; filename="<original_filename>"`).
- Sign with **`aws4fetch`** inside Supabase Edge Functions (Deno). Endpoint `https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}/${key}`, `service: "s3"`, `region: "auto"`, `signQuery: true`, `X-Amz-Expires`. For PUT, sign with the exact `Content-Type` the browser will send.
- **CORS on the bucket:** allow `PUT, GET, HEAD` from `http://localhost:*` (the dev port in use), the production domain(s) and the Pages preview domain. Allow headers `content-type`, expose `ETag`, max-age 3600. Apply with `npx wrangler r2 bucket cors set` if `CLOUDFLARE_API_TOKEN` exists; otherwise output the JSON and tell the user exactly where to paste it.
- Store R2 secrets as Supabase Edge Function secrets: `npx supabase secrets set R2_ACCOUNT_ID=… R2_ACCESS_KEY_ID=… R2_SECRET_ACCESS_KEY=… R2_BUCKET=… SITE_URL=… OWNER_EMAIL=… OWNER_WHATSAPP=…` (values from env, never echoed).

### Image processing — in the browser, before upload
- Use a **Web Worker + OffscreenCanvas** (fallback: main-thread canvas) with `createImageBitmap(file, { imageOrientation: "from-image" })` to respect EXIF rotation.
- **Proofs:** produce `thumb` + `preview` only, both watermarked. The full-res file is never uploaded for proofs.
- **Watermark:** the brand logo, ideally the white/transparent PNG version (find it in the repo; if only a dark logo exists, ask the user or generate a white version via canvas). Draw it **large and centred, about 55–65% of the image width, at about 35% opacity**, plus a subtle diagonal repeated small logo/wordmark tile at about 10% opacity, so it can't be cropped out. Make size and opacity constants in one config file. Show a live watermark preview of the first image in the upload modal.
- **Finals:** upload the untouched original + generated `web` + `thumb` (no watermark).
- JPEG quality about 0.82 for generated versions. Accept jpg/jpeg/png/webp. Reject others with a friendly message.
- Upload queue: concurrency 3. Per-file progress + overall progress bar. Retry each file up to 3× with backoff. Uploading must survive switching tabs, and warn on page close mid-upload. Show a "x of y uploaded" summary with a "retry failed" button.
- Capture per image: `original_filename`, width, height, bytes, and `taken_at` from EXIF if cheaply available (optional, via `exifr`). Default sort is by filename (camera order).

### Database (Supabase Postgres) — new tables
Adapt FK names to the real bookings table. Use `uuid` PKs, `created_at timestamptz default now()`.
- **`profiles`**: `id uuid PK references auth.users`, `email` (lower-case, unique), `full_name`, `phone`, `role text default 'client' check (role in ('client','admin'))`. A trigger creates a profile on signup. Seed the existing admin user(s) as `role='admin'` (confirm emails with the user).
- Helper SQL functions (security definer, stable): `is_admin()` and `current_email()` (`lower(auth.jwt()->>'email')`), and only trust *confirmed* emails.
- **`galleries`**: `id`, `booking_id` FK, `client_email` (lower-cased copy from booking, the access key), `client_name`, `title` (default "<Shoot type> — <date>"), `kind text check (kind in ('proof','final'))`, `status text check (status in ('draft','sent','viewed','selecting','submitted','delivered','archived'))`, `selection_limit int null` (null = unlimited), `allow_extra_selections bool default false`, `extra_price_note text null`, `cover_image_id uuid null`, `message_to_client text null`, `parent_gallery_id uuid null` (final → its proof gallery), `sent_at`, `first_viewed_at`, `submitted_at`, `delivered_at`, `expires_at null`, `previews_purge_at null`.
- **`gallery_images`**: `id`, `gallery_id` FK (cascade), `original_filename`, `thumb_key`, `display_key` (preview or web), `original_key null` (finals only), `width`, `height`, `bytes`, `sort_order`, `taken_at null`, `source_proof_image_id null` (final ↔ picked proof match), `status text default 'uploading' check (status in ('uploading','ready','failed'))`.
- **`gallery_selections`**: `gallery_id`, `image_id`, `client_email`, `note text null`, `created_at`, PK (`image_id`, `client_email`).
- **`gallery_downloads`**: `id`, `gallery_id`, `image_id null` (null = zip/all), `client_email`, `created_at`.
- **`activity_log`**: `id`, `client_email`, `booking_id null`, `gallery_id null`, `actor text` ('client'|'admin'|'system'), `event text` (e.g. `booking_created`, `gallery_sent`, `gallery_viewed`, `selection_submitted`, `selection_unlocked`, `finals_delivered`, `downloaded`), `meta jsonb`, `created_at`. Add a trigger on bookings insert to log `booking_created` (and backfill existing bookings once).
- Indexes on `galleries(client_email)`, `galleries(booking_id)`, `gallery_images(gallery_id, sort_order)`, `activity_log(client_email, created_at desc)`.
- **RLS:**
  - Admin (`is_admin()`): full access to all new tables.
  - Client: `select` on `galleries` where `client_email = current_email()` and `status <> 'draft'`. `select` on that gallery's ready images. `select` on own bookings (add a policy on the bookings table **only if** it doesn't break existing behaviour; check carefully, because the public booking form must still be able to insert). `select/insert/update/delete` own `gallery_selections` **only while** the gallery is `kind='proof'` and status in (`sent`,`viewed`,`selecting`). `select` own `activity_log` and `gallery_downloads`.
  - Never expose `original_key` paths in a way that bypasses signing. Keys alone are useless without a signed URL, but still restrict the column by RLS on rows.
- Generate/update TypeScript types after migrations.

### Auth for clients
- Supabase Auth **email OTP (6-digit code)** as the primary sign-up/sign-in method: "Enter your email → enter the code". Optional "Set a password" in account settings. Same email = same account = sees every past and future shoot.
- **Important:** Supabase's built-in email sender is heavily rate-limited and not for production. Configure **custom SMTP** (Resend SMTP: host `smtp.resend.com`, port 465, user `resend`, password = Resend API key) in Supabase Auth settings. Do it via the Management API with `SUPABASE_ACCESS_TOKEN` if possible (`PATCH /v1/projects/{ref}/config/auth`); otherwise give the user click-by-click steps. Brand the OTP email template.
- Set Auth **Site URL** and **redirect URLs** (localhost + production).
- Admins and clients share Supabase Auth; **route guards use `profiles.role`**. A client hitting `/admin/*` is redirected to `/account`.

### Edge Functions (Deno, in `supabase/functions/`, shared helpers in `_shared/`)
All verify the caller's JWT. Admin-only ones also check `is_admin()`. Use the service role **inside functions only**. Return friendly errors.
1. **`gallery-upload-urls`** (admin): input `{ gallery_id, files: [{ client_ref, original_filename, content_type, bytes, width, height, variants: ['thumb','preview'] | ['thumb','web','original'] }] }`. Inserts `gallery_images` rows (`status='uploading'`), returns presigned PUT URLs per variant.
2. **`gallery-confirm-uploads`** (admin): marks images `ready` (optionally `HEAD`-checks objects); marks failures.
3. **`gallery-view-urls`** (admin or owning client): returns signed thumb + display URLs for a gallery, paginated (e.g. 200 per page). On first client view, sets `first_viewed_at`, status → `viewed`, logs activity.
4. **`gallery-download-url`** (owning client of a **final** gallery, or admin): signed original URL with attachment disposition. Logs to `gallery_downloads`.
5. **`gallery-send`** (admin): validates the gallery has ready images. Sets status `sent` (proof) or `delivered` (final), timestamps. Emails the client. Logs. Supports "resend".
6. **`gallery-submit-selection`** (client): validates count vs `selection_limit` (unless extras allowed). Sets status `submitted`, locks. Emails the photographer (OWNER_EMAIL) with client name, shoot, count, admin link, the notes, and the **filename list in two forms**: one per line, and a Lightroom-ready filter string (`DSC_0012 OR DSC_0045 …`, extensions stripped). Emails the client a confirmation. Logs. Returns the WhatsApp prefill text.
7. **`gallery-unlock-selection`** (admin): status back to `selecting`, emails the client "you can edit your selection", logs.
8. **`gallery-delete`** (admin): deletes images (R2 objects + rows) or a whole gallery.
9. **`gallery-purge-previews`** (scheduled daily via `pg_cron` + `pg_net`, or Supabase scheduled function): deletes proof R2 objects where `previews_purge_at < now()` (set to delivered_at + 30 days). Keeps the rows + selections history and marks the proof gallery `archived`. Make the 30 days a constant. Show "Previews expire on …" to clients.
- Email: **reuse the existing email function's provider and sending code** (refactor into `_shared/email.ts` if needed without breaking the existing booking email). Build branded, mobile-friendly HTML templates (logo, brand colours, one big button, plain-text fallback) in `_shared/email-templates.ts`: *Previews ready*, *Selection received (to photographer)*, *Selection confirmation (to client)*, *Selection unlocked*, *Your final photos are ready*, *Gallery reminder* (optional).
- Deploy with `npx supabase functions deploy <name> --project-ref $SUPABASE_PROJECT_REF`. Never use `--no-verify-jwt` for these.

### WhatsApp
After a successful submit, show a success screen: "Selection sent! 🎉". Then open `https://wa.me/${VITE_OWNER_WHATSAPP}?text=${encodeURIComponent(msg)}` using `window.location.href` after about 1.2 s (popup blockers stop `window.open` after async calls), with a visible "Open WhatsApp" button as a fallback. Message example:
`Hi Illuszionz Media 👋 I've submitted my photo selection — {count} photos from "{gallery title}". Name: {name}. Email: {email}. Link: {admin_link}`
Tell the user plainly in your summary that WhatsApp requires the client to tap Send.

## B3. Screens to build

### Admin (inside the existing dashboard, same look)
1. **Bookings list → row action "Gallery"** (icon + label; badge showing gallery status). Opens a **Gallery Manager** (full-width drawer or page `/admin/bookings/:id/gallery`):
   - Header: client name, email, shoot, date, status chips for Proofs and Finals.
   - **Tabs: Proofs | Finals.**
   - **Proofs tab:** big drag-and-drop zone (+ "Choose files"). Watermark preview. Upload queue with progress. Grid of uploaded thumbs (select, delete, set cover, reorder by drag). Fields: gallery title, message to client, **selection limit** (prefill from booking package if one exists), allow extras + note. Buttons: **Save draft**, **Send to client** (confirm dialog shows the client's email), **Resend email**, **Copy client link**. After submission it shows the selected images highlighted with notes, a **"Copy filenames"** and **"Copy Lightroom filter"** button, a **"Download selection list (.txt/.csv)"** and an **Unlock selection** button.
   - **Finals tab:** same uploader (no watermark, originals kept). Auto-match finals to picked proofs by filename stem when possible (`DSC_0012-edit.jpg` ↔ `DSC_0012.jpg`); show unmatched ones. Button **Deliver to client**.
   - Status timeline for this booking (from `activity_log`).
2. **New nav item "Galleries"** (`/admin/galleries`): search bar + filters (status, shoot type, date). **Grouped by client** (accordion/cards). Each client shows name, email, number of shoots, storage used, and each gallery as a card (cover, title, kind, status, counts, last activity), linking to the manager. Total storage-used meter at the top (sum of bytes) against a configurable budget.
3. Dashboard home widget (if a home exists): "Selections waiting for you" list.

### Client-facing
1. **Gallery page** `/gallery/:galleryId`:
   - If not signed in: an elegant cover screen (cover image blurred, title, photographer branding). Below it: "This gallery is private. Sign in or create your account with the email this gallery was sent to." Then email → 6-digit code inline → straight into the gallery (no page hops). If the signed-in email doesn't match: a polite message + "Sign in with another email".
   - **Design bar: better than Pixieset.** Full-bleed cover hero with title, date and a "View gallery" scroll cue. Then a **justified/masonry grid** that respects aspect ratios (e.g. `react-photo-album`), lazy-loaded with blur-up placeholders, and fast on mobile data. A sticky top bar with the brand logo, a **selection counter "23 / 40"**, a filter toggle **All | Selected**, and the **Submit selection** button.
   - **Lightbox:** swipe on mobile, arrow keys on desktop, pinch-zoom, ♥ toggle, note button, filename shown small, preloads the next/previous image.
   - ♥ on hover/tap in the grid. Optimistic UI. Auto-saves to `gallery_selections`.
   - Reaching the limit: a gentle notice (or the "extra photos" note if extras are allowed).
   - Submit: a review sheet of selected thumbnails + notes → confirm → success screen → WhatsApp redirect.
   - After submit: a read-only view "Selection submitted on {date}. We're editing your photos ✨".
   - **Finals view:** same grid without hearts or watermark. Per-photo **Download**. **Download all** builds a zip in the browser with `client-zip`, streamed, **in parts of ~100 photos / ~2 GB** with clear progress. Also a **favourites-for-sharing** option is fine but optional.
   - Right-click/long-press save is discouraged on proofs (CSS `user-select:none`, no `<a>` to the image, `draggable=false`). Note: this is cosmetic; the watermark is the real protection.
   - Fully responsive, accessible (alt text = filename, focus states, keyboard navigation), and respects `prefers-reduced-motion`. Use the project's animation libraries/skills tastefully (subtle fades, no gimmicks).
2. **Client Area** `/account` (header shows "Sign in" / "My Account"):
   - **Overview:** greeting, next upcoming shoot, "action needed" cards (e.g. "Your previews are ready, pick 40 photos").
   - **Bookings:** all bookings matched by email (date, type, package, status).
   - **Galleries:** grouped per shoot, with Previews + Finals cards, status and expiry info.
   - **Activity timeline:** from `activity_log`, human-readable ("You submitted 38 photos for editing · 3 Nov").
   - **Downloads history.**
   - **Profile:** name, phone, optional password, sign out.
   - When someone signs up, everything previously linked to their email appears automatically (no manual linking).
3. Add `/account` and `/gallery/*` to the router. Add `noindex` meta to both. Make sure the host's SPA fallback/redirect rules serve these routes on refresh (e.g. a Cloudflare Pages `_redirects` / SPA mode).

## B4. Quality checklist (verify before saying a phase is done)
- `npm run build` (or bun) passes. No TypeScript errors. Existing pages are unchanged (spot-check the home page, booking form and dashboard bookings list).
- Run the Supabase advisors (`npx supabase db lint` / security advisors) and fix any warnings on the new tables.
- Test with two accounts: an admin and a client. Also try access with a second, wrong client email (must be refused at both the UI and the function level).
- Proof uploads: confirm by downloading a preview's signed URL that it's watermarked, and that no `original` object exists for proofs.
- Mobile check at 375px width (use Playwright if available) for the gallery, lightbox, submit flow and client area.
- Emails render correctly (send to the user's test address).
- Write `docs/gallery/HOW_IT_WORKS.md`: a plain-language manual for the photographer (how to send previews, read selections, unlock, deliver finals, storage tips) and a short "how to reuse this for another photography site" section.

## B5. Phases (run all of them back-to-back, no stopping)
- **Phase 0 — Inspect** (B1). No code changes, only notes.
- **Phase 1 — Foundations:** `.gitignore` check, Supabase link, migrations (profiles/roles, galleries, images, selections, downloads, activity_log, RLS, helpers, backfill), admin role seeding/hardening, R2 CORS, Edge Function secrets, custom SMTP + OTP email template, generated types.
- **Phase 2 — Admin upload & send:** watermark/resize worker, uploader, `gallery-upload-urls`, `gallery-confirm-uploads`, `gallery-view-urls`, `gallery-send`, Gallery Manager Proofs tab, "Gallery" action on booking rows, emails.
- **Phase 3 — Client proofing:** sign-in gate (OTP), gallery page, lightbox, hearts/notes, submit flow, `gallery-submit-selection`, photographer email with the filename list, WhatsApp redirect, admin selection view + unlock.
- **Phase 4 — Finals & downloads:** Finals tab, matching, deliver, finals view, single + zip download, `gallery-download-url`.
- **Phase 5 — Client Area & admin Galleries section:** `/account` (overview, bookings, galleries, timeline, downloads, profile), `/admin/galleries` grouped by client, storage meter, dashboard widget.
- **Phase 6 — Polish & housekeeping:** preview purge schedule, empty/error/loading states, design pass (match brand, "better than Pixieset"), accessibility, mobile QA, `HOW_IT_WORKS.md`, final security review. Then run the full B4 checklist one last time and fix anything that fails.

## B7. Final report (only message to the user, at the very end)
In plain language, no jargon:
1. **What was built:** a short list of the new screens, with the exact URLs to open (local and live).
2. **How to test it:** a click-by-click walkthrough matching Part A, section A6.
3. **Things only you can do:** the contents of `TODO_FOR_MACAULEY.md`. Always include: confirm the admin email(s); add the needed `VITE_` variables in the Cloudflare Pages (or Netlify) dashboard and redeploy; **delete the Supabase access token** once happy.
4. **Decisions I made for you:** a short summary of `DECISIONS.md`.
5. **Anything that didn't work** and why, with the fallback used.
6. Where the docs are: `docs/gallery/HOW_IT_WORKS.md`, `PROJECT_NOTES.md`, `DECISIONS.md`, `TODO_FOR_MACAULEY.md`.

## B6. Make it reusable
Keep all gallery code in clear folders (e.g. `src/features/gallery/`, `src/features/account/`, `supabase/functions/gallery-*`, `supabase/migrations/*gallery*`). Put brand-specific values (logo path, watermark settings, colours, purge days, owner contacts) in **one config file** (`src/features/gallery/gallery.config.ts`). That way the same feature can be dropped into other photography sites (e.g. DMI Photography) by copying the folders, running the migrations and changing the config.
