# Things only you can do

Claude Code isn't allowed to change the live Supabase project (database, functions, account settings) by itself, so
everything that touches it is packed into **one command** for you (step 2). Do the steps in this order.

## 1. Email key — done
`RESEND_API_KEY` and `EMAIL_FROM` are in `.env.local`. Nothing to do.

## 2. Switch the new flow on (one command, about 3 minutes) — do this first
In the VS Code terminal, in the project folder:
```
npm run gallery:go-live
```
It adds the private-link key to every gallery, deploys the 10 gallery functions (including the new `gallery-pick`), switches client
accounts to email + password with **Confirm your email** and **Reset your password** emails sent from Illuszionz Media through
Resend, fixes the address in those emails (it was still `localhost:3000`), and schedules the nightly preview clean-up.
It never prints your keys, and it is safe to run again. If Supabase refuses a step, it now shows Supabase's reason: send it to Claude Code.
*(Or tell Claude Code: "run npm run gallery:go-live", and approve it when asked.)*

**Until it has run, the live gallery links won't open** (the website update is already live, the server part isn't), so run it
before sending any gallery to a client. Then use **Resend email** on the test gallery: the old email's link has no key.

## 3. R2 upload rules — done (your uploads work)
If you ever test from a `*.pages.dev` address, add it to the CORS policy in Cloudflare → R2 → illuszionz-galleries → Settings.

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
