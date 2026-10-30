# Project notes — written before the client gallery was built (Phase 0)

## Framework, build and hosting
- **TanStack Start + Vite 8 + React 19 + Tailwind v4** (theme/utilities only, no preflight). npm is the package manager (`package-lock.json`).
- **Static prerender, no SSR in production.** `vite.config.ts` lists every page; `npm run build` writes HTML to `dist/client`,
  then `scripts/postbuild.mjs` moves the blog shells to `dist/client/_shell/`.
- **Hosted on Cloudflare Pages** (build `npm run build`, output `dist/client`). `functions/` holds Pages Functions:
  `/api/*` (booking, form, admin, cron, …), `/blog/*` (edge-rendered blog in a prerendered shell), `_middleware.ts` (per-page SEO).
  `public/_routes.json` decides which paths run functions; `public/_headers` sets caching/noindex.
- Dynamic URLs (e.g. `/blog/:slug/`) work by prerendering a placeholder page (`/blog/__post__/`) and having a Pages Function
  serve it with the placeholder swapped, so the client router hydrates on the right route. **The gallery copies this pattern**
  (`/gallery/__gallery__/` → `functions/gallery/[id].ts`).
- Git remote: `github.com/kingsmac1/ILLUSZIONZ-MEDIA`, branch `main` (Cloudflare Pages deploys from it).

## Routing
- File routes in `src/routes/`. The root (`__root.tsx`) wraps every page in `SiteLayout` (header, footer, menu, motion layer)
  except `/dashboard`, which renders bare.
- **Admin dashboard** = `/dashboard/` (`src/routes/dashboard.tsx` → lazy, client-only `src/admin/AdminApp.tsx`).
  Sections are **hash routes** (`#/bookings`, `#/crm/contacts`, `#/cms/blog`, …). So the "admin" URLs in the brief map to
  `/dashboard/#/galleries` and `/dashboard/#/bookings/<id>/gallery`.

## How admin access is protected today
- **Real Supabase Auth** (email + password, `signInWithPassword`). Good: no password in browser code.
- Admin = a row in `public.admin_users` (email). `public.is_admin()` (security definer) checks the JWT email against it, and
  every table has RLS `for all to authenticated using (is_admin())`. Pages Functions (`/api/admin`) check the token + `admin_users` again.
- Live admin user: `illuszionzphotos@gmail.com` (confirmed). `admin_users` holds that email twice (upper- and lower-case).
- Admins are managed in Dashboard → Settings (inserts into `admin_users`).
- **Risk found:** `is_admin()` trusts the JWT email without checking it is *confirmed*. Supabase has "confirm email" on
  (`mailer_autoconfirm = false`), so in practice this is safe, but once clients can sign up it should only trust confirmed
  emails. Hardened in Phase 1 (`current_email()` only returns confirmed emails; `is_admin()` uses it).
- Signed-in non-admins currently get an empty dashboard (RLS returns nothing). Phase 1 sends them to `/account/` instead.

## Bookings table (`public.bookings`)
- Columns used by the gallery: `id uuid`, `ref` (6-char code), `kind` (e.g. "Maternity booking"), `flow_id`, `name`, `email`,
  `phone`, `packages` (text), `details` (jsonb pairs), `event_date`, `event_time`, `status` (new/confirmed/completed/cancelled),
  `total`, `amount_paid`, `payment_status`, `notes` (**internal admin notes — must never be shown to clients**), `source`.
- Inserts come only from Pages Functions with the service-role key (public form) or from the dashboard (admin RLS).
- Listed in `src/admin/sections/Bookings.tsx` (table rows open `BookingDetail`, a modal with action buttons).
- Trigger `bookings_calendar_sync` posts every insert/update/delete to a Google Apps Script (calendar sync).
- One live booking exists (a real client). No test emails go to real client addresses.

## Supabase usage
- Browser client: `src/admin/supabase.ts` (`createClient` with the anon key, persisted session). Reused by the gallery and the account area.
- No generated TypeScript types (tables are typed loosely as `Record<string, any>`).
- Server: `src/server/db.ts` (PostgREST with the service-role key, used by Pages Functions).
- **No Supabase Edge Functions existed** and no Edge Function secrets were set.
- Extensions on: pgcrypto, pg_cron, pg_net. Cron job `illuszionz-automations` calls `https://illuszionzmedia.com/api/cron` every 10 min.

## Email
- **Resend**, called from Cloudflare Pages Functions (`src/server/mail.ts`): table-based, inline-styled HTML + plain-text twin,
  black/white brand (Playfair Display headings, `#0a0a0a` ink, `#f4f3ef` paper), logo embedded inline (CID attachment, `src/server/logo.ts`).
- Env: `RESEND_API_KEY`, `EMAIL_FROM`, `OWNER_EMAIL`, `SITE_URL` in Cloudflare Pages. The Resend key is **not** available locally or in Supabase.
- Supabase Auth email: built-in sender (no custom SMTP), limit 2 emails/hour, OTP length 8, Site URL `http://localhost:3000`.

## UI kit
- Public site: plain CSS per page (`src/generated/*.css`), fonts Inter / Playfair Display / Poppins / Roboto, self-hosted. Motion layer in `src/motion/`
  (GSAP + Lenis + `motion`), pre-hides elements and respects reduced motion.
- Dashboard: own small kit in `src/admin/ui.tsx` + `admin.css` (`ad-*` classes): `Modal` (also `drawer`/`wide`/`xl`), `Tabs`, `Badge`,
  `Field`, `PageHead`, `Stat`, `Empty`, `Pager`, `Confirm`, toasts via `useData().toast`, bulk-select helpers in `bulk.tsx`. Icons are inline SVG paths in `AdminApp.tsx`.
- Logos: `public/images/illuszionz-logo-white.png` (white, transparent, used for the watermark) and `Illusionz-Media-Logo-Black.png`.

## Cloudflare R2
- Bucket `illuszionz-galleries` exists, private, empty. The R2 access keys can read/write objects.
- **Neither the R2 keys nor the Cloudflare API token may change bucket settings (CORS).** CORS has to be pasted in the dashboard (see TODO).

## Other risks noted
- Supabase Auth Site URL was `http://localhost:3000` (would break any email link). Set to the live domain in Phase 1.
- Built-in Supabase email allows 2 sign-in emails per hour for the whole project. Custom SMTP (Resend) is needed before clients use it.
