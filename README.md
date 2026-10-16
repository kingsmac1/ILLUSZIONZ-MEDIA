# Illuszionz Media – React site

Static React site (TanStack Start + Vite + Tailwind) migrated from the WordPress/Elementor site
`https://illuszionzmedia.com/`. Every page is pre-rendered to plain HTML at build time, so the output can be hosted on
Cloudflare Pages (or any static host).

## Commands

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # pre-renders every page into dist/client
npm run preview    # Cloudflare runtime (wrangler) serving dist/client + the /api functions on :4173
BASE=http://localhost:3000 node tests/e2e.mjs   # links, SEO tags, menu, booking flows, API, forms (server in MAIL_DRY_RUN mode)
```

## Deploy to Cloudflare Pages

| Setting | Value |
|---|---|
| Framework preset | None |
| Build command | `npm run build` |
| Build output directory | `dist/client` |
| Node version | 20 or newer |

Pages are written as `dist/client/<page>/index.html`, so the original URLs (`/about-us/`, `/wedding/` …) work unchanged.

## Forms, bookings and emails

Everything submits to two Cloudflare Pages Functions (`functions/api/booking.ts`, `functions/api/form.ts`) that send
branded emails through **Resend** — the same approach as the Uforo Abia project:

- every booking sends a **confirmation to the customer** and a **notification to the owner** (`info@illuszionzmedia.com`);
- prices are **re-calculated on the server** from `src/booking/catalog.ts`, so a tampered form cannot change a price;
- bots are filtered with a honeypot field; after a booking the visitor's WhatsApp opens with a pre-filled summary;
- templates live in `src/server/mail.ts` (HTML + plain text, built from one summary object).

Set these in **Cloudflare Pages → Settings → Environment variables** (Production, as secrets):

| Variable | Example |
|---|---|
| `RESEND_API_KEY` | `re_…` |
| `EMAIL_FROM` | `Illuszionz Media <bookings@illuszionzmedia.com>` (domain verified in Resend) |
| `OWNER_EMAIL` | `info@illuszionzmedia.com` (default) |
| `SITE_URL` | `https://illuszionzmedia.com` (used for the logo in emails) |

Locally copy `.dev.vars.example` to `.dev.vars`. With `MAIL_DRY_RUN=1` nothing is sent and the API returns the rendered emails
(used by the tests). Remove that line to send real emails.

## Dashboard + CRM (`/dashboard/`)

A private studio dashboard (Overview, Bookings, Schedule, Inbox, Finance, Prices, Promo codes, Emails, Settings) with a full CRM
(Contacts, Pipeline, Tasks, Companies, CRM reports). It is a client-side app on the same site (`noindex`, blocked in `robots.txt`),
backed by **Supabase** (Postgres + Auth + row level security) — the same stack as the DMI project. There is **no staff check-in feature**.

**Set up once**
1. Create a Supabase project. Run [supabase/schema.sql](supabase/schema.sql) in the SQL editor (safe to re-run).
   Change the admin email at the top of the file, then create that user in *Authentication → Users*.
2. Cloudflare Pages → *Environment variables* (Production): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (secret), `CRON_SECRET` (any long random string),
   plus the build-time `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (public anon key). Redeploy.
3. Automations: in Supabase enable the `pg_cron` and `pg_net` extensions, then run the `cron.schedule(...)` snippet at the bottom of
   `schema.sql` (put the same `CRON_SECRET` in it). It calls `POST /api/cron` every 10 minutes.

**How it works**
- `/api/booking` and `/api/form` now also store every submission and feed the CRM: contact (matched by email/phone) → deal in the pipeline →
  timeline entry → a follow-up task. Emails are still sent first-class; a database hiccup never blocks them.
- Prices edited in *Prices* and codes created in *Promo codes* apply to the booking forms and are re-checked on the server.
- Email automations (`src/server/automations.ts`, ported from DMI): booking confirmed, reminders 24 h / 2 h before, balance reminder, thank-you,
  review request, re-engagement, birthday greeting, lead follow-up nudge (+ task), and owner digests (birthdays, morning summary). Each send is
  *claimed* in `email_log.dedupe_key` first so nothing is ever sent twice; bookings added by hand are never announced; templates are editable
  in *Emails → Templates*; *Campaigns* send to saved CRM segments in small batches.
- Free Cloudflare plans allow ~50 sub-requests per call, so each run sends at most 14 emails (the rest go out on the next run).
- `src/server/audience.ts` evaluates segments identically in the browser and on the server.

**Test without Supabase:** `node tests/fake-supabase.mjs` is an in-memory stand-in; `tests/admin-e2e.mjs` drives the dashboard, the APIs and the
automations against it (see the header of that file).

## Layout

```
src/routes/            one file per page (head tags copied from the original)
src/generated/         page markup + CSS rebuilt from the original design (plain React/CSS, hand-editable)
src/components/        header/footer layout, full-screen menu (motion), gallery + lightbox, slideshow, testimonial slider,
                       careers accordion, price cards + slide-down booking (BookableGrid), form helpers
src/booking/           catalog of every service (packages, extras, questions, policies) + the multi-step BookingPanel
src/server/            email templates + Resend delivery (used by functions/api)
functions/api/         Cloudflare Pages Functions: booking, form, prices, promo, admin (email actions), cron (automations)
src/admin/                 the dashboard + CRM (React, client-only)
supabase/schema.sql    database schema, RLS, default email templates, scheduler snippet
public/images, fonts   every image and font used by the site
My Site Reference/     snapshot of the original site (HTML, CSS, images, screenshots, WordPress API data)
MIGRATION-NOTES.md     progress log, open decisions, content typos
```
