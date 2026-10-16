# Illuszionz Media – WordPress/Elementor → React migration notes

**Status: migration finished and verified (all pages built + checked).**
If you are resuming: everything below is done; "Needs your decision" lists the only open items.

## How the build works
- `My Site Reference/` – snapshot of the live site: `pages/` rendered HTML (+ popup/lightbox states), `assets/` CSS/JS/fonts as the
  browser loaded them, `images/` every image (CSS backgrounds + the full WordPress Media Library at original size in
  `images/media-library/`), `content/` WordPress REST JSON (pages, posts, 159 media items), SEO/title data, testimonials,
  `screenshots/` full-page 1440 px + 390 px of every page, plus popup / submenu / lightbox / hover / form-dropdown / slider frames.
- The React pages in `src/generated/*.tsx` + `*.css` were produced from the rendered page (computed styles at 1440 / 820 / 390 px) by
  the scripts in `tools/` (`extract.mjs` → `gen.mjs`/`build-pages.mjs`). The output is plain React + plain CSS with **no WordPress or
  Elementor code, classes or scripts**; it is normal hand-editable source now. (Re-running the tools overwrites hand edits – don't.)
- Hand-written, behaviour-bearing components live in `src/components/` (menu popup + nav, gallery + lightbox, hero slideshow,
  testimonial slider, careers accordion, form shell/conditional fields/custom select, links, layout).
- TanStack Start + React 19 + Vite + Tailwind v4 (theme + utilities only, no preflight so nothing restyles the page).
  `npm run build` pre-renders every page to static HTML in `dist/client` (Cloudflare Pages: build `npm run build`, output `dist/client`).
- Fonts self-hosted in `public/fonts` (6 files: Inter, Playfair Display, Roboto ×2, Roboto Slab, Poppins – all Google Fonts, latin subset).
  Images in `public/images` (76 files, full-size originals as used by the original site). System font Georgia is used on some pages.

## Page checklist (built AND checked against the original screenshots at 1440 px and 390 px)
- [x] Shared header, footer, menu popup (slide-in, submenus, Esc / overlay / link closes)
- [x] Home `/`
- [x] About `/about-us/`
- [x] Photography `/photography-services/`
- [x] Wedding `/wedding/`
- [x] Videography `/videography-services/`
- [x] 360 Photo Booth `/360-photo-booth/`
- [x] Academy `/academy/`
- [x] Agency `/agency/`
- [x] Careers `/careers/`
- [x] Contact `/contact/`
- [x] Form `/form/`
- [x] Store `/store/`
- [x] Extra pages found in the sitemap, built too: `/media/`, `/review/`

### Verification result (production build vs original, pixels differing by >40/255)
All 28 page/width comparisons are within 0.0–1.6 % of pixels and have **the same page height**, except 3 px (Agency, 390) and
1 px (Photography, 390). The remaining differences are sub-pixel text anti-aliasing and animated frames (hero slideshow,
testimonial). Checked at 11 widths from 320 to 1920 px: no horizontal overflow at any of them.
`npm run typecheck` is clean and `node tests/e2e.mjs` runs 49 automated checks (all pass against the production build):
every page loads, every internal link resolves, menu popup + submenus + navigation + Esc + overlay, testimonial next/previous,
hero slideshow advance, gallery lightbox (home + wedding), careers accordion, conditional form field, and all 6 forms submit.

## Facts found
- Sitemap `wp-sitemap.xml` works. Pages: contact, home, about-us, media, academy, agency, store, careers, photography-services,
  videography-services, form, wedding, review, 360-photo-booth. Also the default post `/2025/12/31/hello-world/`,
  `/category/uncategorized/` and two author archives – **not migrated** (default WordPress leftovers).
- WP REST API was **not** blocked: pages, posts and all 159 media items (original size) saved in `My Site Reference/content` and `images/media-library`.
- **No SEO plugin output**: every page has only `<title>`, `robots: max-image-preview:large` and a canonical link – no meta description and no
  Open Graph / Twitter tags. They were copied exactly (title, robots, canonical); nothing was invented.
- The only "popup" on the site is Elementor popup #1170 = the slide-in menu. The header's "Book Now" button exists in the markup but is hidden
  on every breakpoint and has no popup attached, so there was nothing to rebuild.
- Home hero = 3-image background slideshow (fade 0.5 s, 5 s per slide, slow zoom) – rebuilt. Home + Wedding portfolio = masonry gallery
  (3/2/2 and 4/2/1 columns, 10 px gap, hover darkens, lightbox with counter / fullscreen / zoom / share / download) – rebuilt; column placement
  is copied from the original layout. Testimonials (5 quotes, auto every 6 s, ❮ ❯) – rebuilt. Careers "Open Roles" accordion – rebuilt.
- Page-level custom CSS on the original also leaked into the footer paragraph on `/photography-services/`, `/wedding/`, `/academy/`,
  `/store/`, `/media/` (footer text shows in Georgia there). This was reproduced on purpose.
- `/contact/` has a ‑24 px margin compensation (`.con-43`) that mimics a browser margin quirk of the original form wrapper.

## Forms, bookings and emails (v2 — implemented)
- Services pages no longer contain forms. Every card (Photography ×6, Wedding ×4, Academy ×5, Videography ×7, Agency ×8, Store, plus the 360 booth
  button) slides a **multi-step booking form** open directly underneath: package → about you → session details → add-ons → review.
  Modelled on the DMI / Uforo Abia flows: live total, quantity steppers, remembered contact details, WhatsApp hand-off after submit.
- `/contact/`, `/form/` (service enquiry with conditional fields) and `/review/` (with image attachment) post to `/api/form`.
- Branded HTML + text emails (customer confirmation and owner notification) for bookings, enquiries, contact and reviews — `src/server/mail.ts`,
  modelled on the Uforo Abia template. Store purchases include a "Pay now" (Selar) button.
- **Needs your keys to send real mail:** `RESEND_API_KEY`, `EMAIL_FROM` (verified Resend domain), `OWNER_EMAIL`, `SITE_URL` — see README.
- The old WPForms pages (#716 Photography, #918 Wedding, #1225 360, #713 Academy) were removed. `/contact/`, `/form/`, `/review/` keep their layout.

## Design changes requested after the first migration (all done)
Full-screen black menu (slides in from the right, out to the right, large type, contact + socials + booking button, built with `motion`);
black footer with quick links; home service icons turn black on hover and link to their pages; price cards with bold prices
(everywhere a price appears it is bold); SEO titles, descriptions, Open Graph/Twitter tags, canonical, JSON-LD, `robots.txt`, `sitemap.xml`, `og-image.jpg`;
brand typo fixes (title "Illuszionz Media", email `info@illuszionzmedia.com`, "IlluszionzMedia" in testimonials); the header Facebook link is used everywhere;
videography descriptions rewritten; leftover WordPress pages dropped.

## Store
- WooCommerce plugin scripts load on every page but `/store/` has **no WooCommerce products, cart or checkout** – it is one static card
  ("To talk about clarity and scaling in Photography Business", 45min, £25). Rebuilt as the same static card. Nothing for cart/checkout was built.
- The only purchase link on the site is an external Selar link on the Store page (kept exactly as is).

## Contact details (kept exactly as on the original)
Phone/WhatsApp `+447864748937` (header link is `wa.me/+447864748937`, popup link is `wa.me/447864748937` – both kept), e-mail shown as
`illuszionzphotos@gmail .com`, careers e-mail `info@illuszionzmedia.com`, Facebook `web.facebook.com/Illuszionzweddings`,
Instagram `instagram.com/illuszionzphotostudio` (+ the `?igsh=` variant in the popup), X `x.com/illuszionzfoto`, `instagram.com/illuszionzweddings` on Wedding.

## Typos / content oddities noticed (listed, NOT fixed)
- `<title>` brand is "Illiszionz Media" on every page (everywhere else it is "Illuszionz").
- Footer e-mail is written `illuszionzphotos@gmail .com` (space before `.com`).
- Testimonials spell the brand "IllusionzMedia" (Illusion…).
- Videography page: "Consult with US"; the service descriptions under "Drone Coverage", "Live Streaming Production", "Event Coverage",
  "Reels Podcast & Interview", "Movie/Music Video Production" are copied photography text (maternity, headshots, family, couples).
- Photography: "Naming , Birthday Parties etc", "( 4 Edited Pictures )", "£200( 7 images per look )", "Starts at £150 pounds per hour",
  payment line starts lower-case ("we accept, visa, mastercard…").
- Academy: "1 Months", "2 Months"; the "AI content for Juniors" option vs "Creative AI Classes for Juniors" course name.
- Popup menu: the Facebook icon in the menu popup has no link (the header's Facebook icon does).

## Could not copy / limits
- WPForms server-side behaviour (spam checks, e-mail notification text, confirmation text, entries) – see Forms. The confirmation message
  shown now is WPForms' default wording "Thanks for contacting us! We will be in touch with you shortly."
- The 360 form's date picker is the browser's native date/time input (original used a JS calendar plugin).
- Only 1440 px and 390 px reference screenshots exist; the tablet layout is generated from an 820 px snapshot and was only checked for overflow/overlap.
- Elementor sticky-header is reproduced with `position: sticky` (same result: header stays on top while scrolling).
- Images are the original full-size files (≈20 MB). Resizing them to responsive sizes would speed the site up but would change files you supplied.

## Needs your decision (v2)
1. Resend: create the API key, verify the sending domain and set the four environment variables in Cloudflare Pages (until then forms return an "email is not configured" error).
2. Deposit/payment wording in the emails is generic ("we send payment details") — tell me if you want bank details or payment links added.
3. Wedding/Photography prices are those on the old site; the 360 booth, videography and agency are quote-based.

## Older decisions (superseded)
1. **Form backend** – pick a service/endpoint and set `VITE_FORM_ENDPOINT` (see Forms). Until then forms fall back to the visitor's mail app.
2. **Meta descriptions / Open Graph tags** – the original has none; send the text (and a share image) if you want them.
3. **Typos** above – tell me which to correct.
4. **Facebook link in the menu popup** – add the header's Facebook URL?
5. Whether to migrate the leftover WordPress pages (hello-world post, category, author archives) – I assumed no.

## Dashboard + CRM (turn 3)

- Added `/dashboard/` (client-only, `noindex`): Overview, Bookings (manual entry, payments, status → pipeline sync), Schedule (month calendar), Inbox,
  Finance (payments, expenses, other income, P&L, balances), Prices (overrides applied to forms + server), Promo codes, Emails (11 automations,
  editable templates, campaigns, send log), Settings (admins, pipeline stages, expense categories).
- CRM: Contacts (lifecycle, source, tags, lead score, segments, CSV import/export, bulk actions, timeline drawer with notes/calls/emails),
  Pipeline (kanban, drag & drop, weighted forecast, win rate), Tasks (auto-created follow-ups), Companies, Reports (funnel, sources, revenue,
  lost reasons, follow-up health, birthdays). Structure follows common CRM models: contacts + companies + deals + activities + tasks,
  lifecycle stages, source tracking, stage probability.
- Ported DMI automations (exactly-once `dedupe_key` claims, manual bookings not announced, birthday incl. 29 Feb, owner digests). Scheduler is Supabase
  pg_cron → `POST /api/cron` because Cloudflare Pages has no cron triggers. **Staff check-in/attendance was deliberately not built.**
- Decisions: Supabase backend (matches DMI); public submissions are written by the Pages Functions with the service-role key (no anon write access);
  headline prices printed on the static pages are still page content — only the booking forms read dashboard prices.
- Not verified against a real Supabase project (none available here): `schema.sql` was written carefully but not executed; everything else was
  tested against `tests/fake-supabase.mjs`. Run `schema.sql` once and check the dashboard loads; if a table errors, the dashboard shows which.
- Gotcha: never edit files in `src/routes/` while `vite dev` is running — the route generator can overwrite a file that is momentarily empty with a stub.

## Email builder + demo data
- Campaigns have two modes: Simple message, and a DMI-style block builder (`src/admin/builder/`, model + HTML renderer in `src/server/emailBlocks.ts`,
  shared by the live preview and the sender). `email_campaigns.blocks`, `email_sections` (saved layouts) and the `email-images` storage bucket are in `schema.sql`.
- `supabase/demo-data.sql` / `remove-demo-data.sql`: test data (remove before launch). Verified on a real Postgres engine (PGlite): runs twice cleanly, removal leaves 0 rows.
  Price overrides are deliberately not seeded. Addresses ending `.test` are never emailed (logged as skipped).

## Website CMS + blog
- New: `supabase/cms.sql` (blog_posts, store_products, testimonials, site_images, page_seo, `site-media` bucket, 4 starter posts) and Dashboard → Website.
- Blog is edge-rendered (functions/blog/*) into prerendered shells (`_shell/index`, `_shell/post`, created by `scripts/postbuild.mjs`) so crawlers get full HTML and the
  client router hydrates cleanly (shell prerendered at `/blog/__post__/`, slug swapped at request time; `BlogSlot` hands React the DOM's own innerHTML).
  Blog links use plain anchors (`A` skips `/blog`). `public/sitemap.xml` was replaced by the `functions/sitemap.xml.ts` endpoint.
- Content that used to be constants inside the generated pages now lives in `src/cms/builtin.ts` (hero slides, galleries, testimonials, store product).
- Dev note: `vite dev` does not run the blog functions — use `npm run preview` (wrangler) to see `/blog/`.
