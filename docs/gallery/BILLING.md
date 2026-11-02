# Gallery billing (studio side)

Illuszionz Media's client gallery is billed by Emkay Digitals through the Emkay dashboard (Gallery billing). This site asks the dashboard
"is this studio paid up?" and acts on the answer. Nothing happens until the studio's **site key** is added (step 2), and a
studio the dashboard calls `not_activated` is never blocked or shown anything.

## Switch it on
1. In the Emkay dashboard → **Gallery billing → Studios → Add studio** (name, site URL, R2 bucket `illuszionz-galleries`). Copy the **site key** shown once.
2. Add it to this project's `.env.local` as `BILLING_SITE_KEY=ebk_…`, then run `npm run gallery:go-live` (it stores the key in Supabase, runs
   the migration `supabase/migrations/20261102120000_gallery_billing.sql`, deploys `gallery-billing-status` and `gallery-billing-sync`, and schedules the hourly sync).
   Or by hand: apply the migration, `supabase secrets set BILLING_SITE_KEY=ebk_…`, deploy the two functions.
3. In the Emkay dashboard press **Activate billing** for the studio. The trial starts and a banner appears in this site's admin.

## What it does
| Dashboard says | This site |
|---|---|
| `not_activated`, or no key set | nothing changes |
| trial / awaiting payment / active / grace | works; a banner from the dashboard shows above every admin page, plus a **Billing** page |
| `uploads_allowed = false` (storage full) | uploads return 402 `STORAGE_FULL`; the uploader shows "Storage is full" |
| `gallery_enabled = false` (locked) | every gallery function except delete and purge-previews returns 402 `GALLERY_PAUSED`; clients see "This gallery is temporarily unavailable. Please contact <studio>." (never a word about payment); **Galleries** shows a pay card |
| `purged` and `purge_enabled` | the hourly job deletes every object in the R2 bucket and the gallery rows, then confirms to the dashboard |

* The hourly `gallery-billing-sync` also reports the live total of `gallery_images.bytes`.
* The last answer is cached 60 s in memory and in the one-row `billing_cache` table. If the dashboard cannot be reached, the last
  answer is used for **72 hours**; only after that does an activated studio count as locked. A site that has never heard from the dashboard is never locked.
* The purge only runs on an answer fetched in that same call (never from the cache) and only when the dashboard has the global deletion switch on.
* Tests: `DENO_NO_PACKAGE_JSON=1 npx deno@latest test --no-lock --allow-env --allow-net --allow-read tests/billing.test.ts`
