#!/usr/bin/env bash
# =====================================================================================================
# Client gallery — switch it on in Supabase + Cloudflare R2. Safe to run again (every step is idempotent).
#   bash scripts/gallery-go-live.sh
# Reads .env.local (never prints a secret). Steps:
#   1. database migrations (supabase/migrations)      4. accounts: site URL, password sign-up with a confirmation
#   2. Edge Function secrets (R2 keys, owner details)     link, forgot-password, branded emails sent through Resend
#   3. deploy the 10 gallery Edge Functions            5. daily clean-up of old previews (pg_cron)
#                                                      6. R2 upload rules (CORS) — needs an R2-enabled API token
# RESEND_API_KEY + EMAIL_FROM in .env.local make every account email come from Illuszionz Media (via Resend SMTP).
# =====================================================================================================
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .env.local ] || { echo "✗ .env.local not found (see CLIENT_GALLERY_PROMPT.md, part A4)"; exit 1; }
# read .env.local without running it as shell code (values like "Name <mail@…>" break `source`)
eval "$(python3 scripts/read-env.py .env.local)"

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
# Management API call; on failure prints Supabase's own error message (never the token) and stops.
api() { local code; code=$(curl -s -o "$TMP/out" -w '%{http_code}' -X "$1" -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" --data @"$3" "$API$2"); [[ "$code" == 2* ]] || { echo "  ✗ Supabase said ($code): $(head -c 600 "$TMP/out")"; exit 1; }; }
sql() { python3 -c 'import json,sys; print(json.dumps({"query": sys.stdin.read()}))' > "$TMP/q.json"; api POST /database/query "$TMP/q.json"; }

echo "→ 1/6 Database migrations"
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

echo "→ 4/6 Accounts: password sign-up, confirmation + reset emails, site URL"
python3 scripts/gallery-auth-config.py "$SITE" > "$TMP/auth.json"
api PATCH /config/auth "$TMP/auth.json"
echo "  ✓ account settings updated${RESEND_API_KEY:+ — emails now come from Illuszionz Media via Resend}"

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
