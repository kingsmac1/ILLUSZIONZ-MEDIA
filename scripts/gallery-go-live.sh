#!/usr/bin/env bash
# =====================================================================================================
# Client gallery — switch it on in Supabase + Cloudflare R2. Safe to run again (every step is idempotent).
#   bash scripts/gallery-go-live.sh
# Reads .env.local (never prints a secret). Steps:
#   1. database migration (supabase/migrations)       4. sign-in settings: 6-digit codes, branded email, site URL
#   2. Edge Function secrets (R2 keys, owner details)  5. daily clean-up of old previews (pg_cron)
#   3. deploy the 9 gallery Edge Functions             6. R2 upload rules (CORS) — needs an R2-enabled API token
# Optional in .env.local: RESEND_API_KEY + EMAIL_FROM (emails + reliable sign-in codes via Resend SMTP).
# =====================================================================================================
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .env.local ] || { echo "✗ .env.local not found (see CLIENT_GALLERY_PROMPT.md, part A4)"; exit 1; }
set -a; source .env.local; set +a

REF=$(printf '%s' "${SUPABASE_PROJECT_REF:-}" | sed -E 's#^https?://([a-z0-9]+)\.supabase\.co/?$#\1#')
[[ "$REF" =~ ^[a-z0-9]{20}$ ]] || { echo "✗ SUPABASE_PROJECT_REF must be the 20-letter project ref (or the project URL)"; exit 1; }
for v in SUPABASE_ACCESS_TOKEN SUPABASE_DB_PASSWORD CLOUDFLARE_ACCOUNT_ID R2_BUCKET R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY VITE_SUPABASE_ANON_KEY; do
  [ -n "${!v:-}" ] || { echo "✗ $v is missing in .env.local"; exit 1; }
done
export SUPABASE_ACCESS_TOKEN
SB="npx --yes supabase@2.84.2"
API="https://api.supabase.com/v1/projects/$REF"
SITE="${VITE_SITE_URL:-https://illuszionzmedia.com}"
TMP=$(mktemp -d); chmod 700 "$TMP"; trap 'rm -rf "$TMP"' EXIT
sql() { python3 -c 'import json,sys; print(json.dumps({"query": sys.stdin.read()}))' > "$TMP/q.json"; curl -sf -X POST -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" --data @"$TMP/q.json" "$API/database/query" > /dev/null; }

echo "→ 1/6 Database migration"
$SB link --project-ref "$REF" -p "$SUPABASE_DB_PASSWORD" > /dev/null
$SB db push --yes -p "$SUPABASE_DB_PASSWORD"

echo "→ 2/6 Edge Function secrets"
CRON_SECRET=$(python3 -c 'import secrets; print(secrets.token_hex(32))')
{
  echo "R2_ACCOUNT_ID=$CLOUDFLARE_ACCOUNT_ID"
  echo "R2_ACCESS_KEY_ID=$R2_ACCESS_KEY_ID"
  echo "R2_SECRET_ACCESS_KEY=$R2_SECRET_ACCESS_KEY"
  echo "R2_BUCKET=$R2_BUCKET"
  echo "SITE_URL=$SITE"
  [ -n "${VITE_OWNER_EMAIL:-}" ] && echo "OWNER_EMAIL=$VITE_OWNER_EMAIL"
  [ -n "${VITE_OWNER_WHATSAPP:-}" ] && echo "OWNER_WHATSAPP=$VITE_OWNER_WHATSAPP"
  [ -n "${RESEND_API_KEY:-}" ] && echo "RESEND_API_KEY=$RESEND_API_KEY"
  [ -n "${EMAIL_FROM:-}" ] && echo "EMAIL_FROM=$EMAIL_FROM"
  echo "GALLERY_CRON_SECRET=$CRON_SECRET"
} > "$TMP/secrets.env"
chmod 600 "$TMP/secrets.env"
$SB secrets set --project-ref "$REF" --env-file "$TMP/secrets.env" > /dev/null
echo "  ✓ secrets stored in Supabase (values not shown)"
[ -n "${RESEND_API_KEY:-}" ] || echo "  ! RESEND_API_KEY not in .env.local — gallery emails stay off until you add it (see TODO_FOR_MACAULEY.md)"

echo "→ 3/6 Deploying Edge Functions"
for dir in supabase/functions/gallery-*/; do
  name=$(basename "$dir")
  $SB functions deploy "$name" --project-ref "$REF" > /dev/null && echo "  ✓ $name"
done

echo "→ 4/6 Sign-in settings (6-digit email code, branded email, site URL)"
python3 - "$SITE" > "$TMP/auth.json" <<'PY'
import json, os, sys
site = sys.argv[1].rstrip('/')
tpl = lambda title, line: f"""<div style="margin:0;padding:32px 12px;background:#f4f3ef;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif">
<div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #dcdad2;border-radius:18px;overflow:hidden">
<div style="background:#0a0a0a;padding:28px 34px;color:#fff;font-family:'Playfair Display',Georgia,serif;font-size:20px;letter-spacing:.14em">ILLUSZIONZ MEDIA</div>
<div style="padding:34px">
<h1 style="margin:0 0 12px;font-family:'Playfair Display',Georgia,serif;font-weight:700;font-size:28px;color:#0a0a0a">{title}</h1>
<p style="margin:0 0 22px;font-size:15px;line-height:1.7;color:#0a0a0a">{line}</p>
<div style="font-size:36px;font-weight:700;letter-spacing:.35em;color:#0a0a0a;padding:18px 0;text-align:center;background:#f4f3ef;border-radius:12px">{{{{ .Token }}}}</div>
<p style="margin:22px 0 0;font-size:12.5px;line-height:1.7;color:#85847e">The code works for 10 minutes. If you didn't ask for it, you can ignore this email.</p>
</div></div></div>"""
cfg = {
  "site_url": site,
  "uri_allow_list": ",".join([f"{site}/**", "http://localhost:3000/**", "http://localhost:4173/**", "https://*.pages.dev/**"]),
  "mailer_otp_length": 6,
  "mailer_otp_exp": 600,
  "mailer_subjects_magic_link": "Your Illuszionz Media sign-in code",
  "mailer_templates_magic_link_content": tpl("Your sign-in code", "Enter this code to open your gallery and client area:"),
  "mailer_subjects_confirmation": "Your Illuszionz Media sign-in code",
  "mailer_templates_confirmation_content": tpl("Welcome", "Enter this code to finish creating your account and open your gallery:"),
}
key = os.environ.get("RESEND_API_KEY", "").strip()
sender = os.environ.get("EMAIL_FROM", "").strip()
if key and sender:
    import re
    m = re.search(r"<([^>]+)>", sender)
    cfg.update({"smtp_host": "smtp.resend.com", "smtp_port": "465", "smtp_user": "resend", "smtp_pass": key,
                "smtp_admin_email": m.group(1) if m else sender, "smtp_sender_name": "Illuszionz Media", "rate_limit_email_sent": 60})
print(json.dumps(cfg))
PY
curl -sf -X PATCH -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" --data @"$TMP/auth.json" "$API/config/auth" > /dev/null
echo "  ✓ auth settings updated${RESEND_API_KEY:+ (custom SMTP via Resend)}"

echo "→ 5/6 Daily preview clean-up (03:15 every day)"
sql <<SQL
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.unschedule(jobid) from cron.job where jobname = 'gallery-purge-previews';
select cron.schedule('gallery-purge-previews', '15 3 * * *', \$job\$
  select net.http_post(
    url := 'https://$REF.supabase.co/functions/v1/gallery-purge-previews',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer $VITE_SUPABASE_ANON_KEY', 'x-cron-secret', '$CRON_SECRET'),
    body := '{}'::jsonb);
\$job\$);
SQL
echo "  ✓ scheduled"

echo "→ 6/6 R2 upload rules (CORS)"
cat > "$TMP/cors.json" <<JSON
{"rules":[{"allowed":{"origins":["$SITE","https://www.${SITE#https://}","http://localhost:3000","http://localhost:4173"],"methods":["PUT","GET","HEAD"],"headers":["content-type"]},"exposeHeaders":["ETag"],"maxAgeSeconds":3600}]}
JSON
if [ -n "${CLOUDFLARE_API_TOKEN:-}" ] && npx --yes wrangler@4 r2 bucket cors set "$R2_BUCKET" --file "$TMP/cors.json" --force > /dev/null 2>&1; then
  echo "  ✓ CORS set on $R2_BUCKET"
else
  echo "  ! Could not set CORS automatically (the token needs R2 edit rights)."
  echo "    Paste docs/gallery/r2-cors.json into Cloudflare → R2 → $R2_BUCKET → Settings → CORS policy."
fi

echo ""
echo "✓ Done. Open $SITE/dashboard/#/galleries — then follow docs/gallery/TODO_FOR_MACAULEY.md for the last checks."
