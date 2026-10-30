# Things only you can do

The gallery is fully built and tested, but it is **not switched on yet**. Claude Code wasn't allowed to change the live
Supabase project (database, functions, sign-in settings) without your OK. So everything that touches the live project is
packed into **one command** for you (step 2). Do the steps in this order.

## 1. Add the email key to `.env.local` (2 minutes)
The booking emails use Resend, but the key only lives in Cloudflare, not on your Mac. The gallery needs it in Supabase too.
1. Go to **resend.com → API Keys → Create API key**. Name it `supabase-gallery`, permission **Sending access**. Copy it.
2. Open `.env.local` and add these two lines at the bottom (use the same sender as your booking emails):
   ```
   RESEND_API_KEY=re_xxxxxxxxxxxx
   EMAIL_FROM=Illuszionz Media <bookings@illuszionzmedia.com>
   ```
   Without this, galleries still work, but no emails go out, and sign-in codes are limited to **2 per hour** for the whole site.

## 2. Switch the gallery on (one command, about 3 minutes)
In the VS Code terminal, in the project folder:
```
npm run gallery:go-live
```
It installs the database tables, stores the keys in Supabase, deploys the 9 gallery functions, sets up sign-in codes
(6 digits, branded email, sent through Resend), schedules the daily clean-up, and tries to set the upload rules on R2.
It never prints your keys. You can run it again any time; nothing is duplicated.
*(Or tell Claude Code: "run npm run gallery:go-live", and approve it when asked.)*

## 3. Paste the upload rules into Cloudflare R2 (1 minute) — needed, uploads fail without it
Your Cloudflare API token can't change bucket settings, so the script will most likely say "Could not set CORS automatically".
1. Cloudflare dashboard → **R2** → **illuszionz-galleries** → **Settings** → **CORS policy** → **Add CORS policy** (or Edit).
2. Delete what is in the box, paste the contents of `docs/gallery/r2-cors.json`, then **Save**.
   *(If you use a `*.pages.dev` preview address to test, add it to the `AllowedOrigins` list too.)*

## 4. Add three settings in Cloudflare Pages and redeploy (2 minutes)
Cloudflare → **Workers & Pages** → your site → **Settings** → **Variables and Secrets** (Production) → **Add**:

| Name | Value |
|---|---|
| `VITE_SITE_URL` | `https://illuszionzmedia.com` |
| `VITE_OWNER_EMAIL` | the email that should receive selections |
| `VITE_OWNER_WHATSAPP` | your WhatsApp number, digits only, e.g. `447864748937` |

Then **Deployments → Retry deployment** (or push any change). Until you do, the site falls back to the details in `src/site.ts`
(info@illuszionzmedia.com and +44 7864 748937), so nothing breaks in the meantime.

## 5. Confirm the admin email
The dashboard admin is **illuszionzphotos@gmail.com** (it is in the `admin_users` table twice, in upper and lower case; that is harmless).
If anyone else should manage galleries, add them in **Dashboard → Settings → Dashboard admins**.

## 6. Test it (see HOW_IT_WORKS.md → "Test before going live")
Use a test booking with an email you own that is **not** your admin email. Don't use a real client's booking for the first test.

## 7. When everything works — delete the Supabase access token
supabase.com → your avatar → **Account preferences → Access Tokens** → delete **claude-code-illuszionz**.
Make a new one next time Claude Code needs to change the database. Keep `.env.local` off GitHub (it is already ignored).
