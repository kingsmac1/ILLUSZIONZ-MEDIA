# Instagram → homepage gallery sync — setup guide

Your newest Instagram pictures are copied into **Dashboard → Website images → Home — portfolio gallery** and show on the homepage gallery. Pictures you upload yourself are never touched; synced ones can be reordered or deleted like any other (a picture you delete is not brought back). Posts that fall out of the "latest N" — or that you delete on Instagram — leave the gallery.

Instagram's own picture links stop working after a few days, so each picture is **copied** into your Supabase storage (`site-media` bucket, folder `instagram/`).

You need: your Instagram account set to **Professional** (Business or Creator — free: Instagram app → Settings → Account type and tools → Switch to professional account). About 15 minutes.

---

## 1. Database (once)

Supabase → **SQL Editor** → paste [`supabase/instagram.sql`](instagram.sql) → before running, replace `YOUR_CRON_SECRET` in it with your existing Cloudflare `CRON_SECRET` value (the same one the email scheduler uses) → **Run**.
(It needs the `pg_cron` and `pg_net` extensions already enabled — you did this for the email scheduler.)

## 2. Create a Meta app and get the access token

1. Go to <https://developers.facebook.com> and log in with Facebook (create a free developer account if asked).
2. **My Apps** → **Create app** → use case **Other** → app type **Business** → name it `Illuszionz website` → **Create**.
3. In the app, **Add product** → **Instagram** → **API setup with Instagram login**.
4. Section **1. Generate access tokens** → **Add account** → log in with the Instagram account (the Professional one) and approve. (While the app is in development mode this works for accounts that are admins/testers of the app. If it says the account must be a tester: **App roles → Roles → Add People → Instagram Testers**, add your Instagram username, then accept the invite in Instagram → Settings → Website permissions → **Tester invites**.)
5. Click **Generate token** next to the account, approve, and **copy the token** (a very long string starting `IGAA…`). It is already the long-lived (60-day) kind.

## 3. Give the token to the website

Cloudflare → **Workers & Pages** → your project → **Settings** → **Variables and Secrets** → **Add**:

- Name: `INSTAGRAM_ACCESS_TOKEN`  
- Value: the token  
- Type: **Secret** (production)

Save, then trigger a new deployment (**Deployments → ⋯ → Retry deployment**, or any new push) so the site picks it up.

The token lasts 60 days, but the site **renews it by itself** each time a sync runs after it is 20 days old, so you don't have to touch it again as long as the site keeps syncing. If sync is off for more than ~60 days it expires: repeat step 2.5 and update the Cloudflare value.

## 4. Switch it on in the dashboard

1. **Dashboard → Website images → Home — portfolio gallery**.
2. If the green bar doesn't say "the website is showing your dashboard…", click **Start managing — import current content** first (otherwise the website keeps showing the built-in photos).
3. In the **Instagram sync** card tick **Sync automatically**, choose how many posts (latest 6–30) and how often (hourly, 6-hourly, daily), then press **Sync now**.
4. A toast says how many pictures were added. They appear at the **start** of the gallery, newest first; reorder with the ← → buttons if you want. The homepage updates within about a minute.

The card also shows when it last synced, or the reason it failed (usually an expired or missing token).

## What gets synced

- Photos and carousels (the first picture of a carousel) — and a video's cover image.
- The caption becomes the picture's alt text (shorter than 140 characters).
- Each synced card has a **From Instagram ↗** link to the original post.

## Troubleshooting

| You see | Do this |
|---|---|
| "No Instagram access token yet" | Step 3 — add `INSTAGRAM_ACCESS_TOKEN` in Cloudflare and redeploy. |
| "Instagram said: … token …" | The token expired/was revoked: generate a new one (step 2.5), update Cloudflare, redeploy. |
| Sync says "up to date" but the homepage still shows old photos | Gallery not managed — step 4.2. |
| Only 8 pictures arrived at first | Normal: it copies 8 per run to stay inside Cloudflare's limits; **Sync now** keeps going automatically until all are in, and the hourly job finishes the rest. |
| You deleted a synced picture and want it back | It is remembered as "deleted" so it won't return by itself. Download it from Instagram and upload it with **⬆ Upload**. |

To stop syncing, untick **Sync automatically**; the pictures already copied stay. To remove the schedule entirely: `select cron.unschedule('illuszionz-instagram');`
