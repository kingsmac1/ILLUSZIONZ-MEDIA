#!/usr/bin/env node
/**
 * Shrinks the website photos already uploaded through the dashboard (Supabase Storage bucket site-media).
 * Camera files of 5–20 MB were served to every visitor and used up the Supabase plan's bandwidth ("Cached Egress").
 *
 *   node scripts/shrink-site-media.mjs          # shows what it would do, changes nothing
 *   node scripts/shrink-site-media.mjs --apply  # does it
 *
 * For each photo over 600 KB: makes a web-size copy (at most 2400 px on the long side, JPEG quality 80, with macOS sips),
 * uploads it next to the original as <name>-web.jpg, swaps the old link for the new one everywhere in the database
 * (pages, image sets, card photos, blog posts …), then deletes the original. Uses SUPABASE_ACCESS_TOKEN and
 * SUPABASE_PROJECT_REF from .env.local; never prints a key.
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const APPLY = process.argv.includes('--apply')
const MIN_BYTES = 600_000
const BUCKET = 'site-media'

const env = Object.fromEntries(
  fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')
    .map((l) => l.match(/^\s*(?:export\s+)?([A-Za-z_]\w*)\s*=\s*(.*?)\s*$/)).filter(Boolean)
    .map((m) => [m[1], /^(['"]).*\1$/.test(m[2]) ? m[2].slice(1, -1) : m[2]]),
)
const REF = String(env.SUPABASE_PROJECT_REF ?? '').replace(/^https?:\/\/([a-z0-9]+)\.supabase\.co\/?$/, '$1')
const TOKEN = env.SUPABASE_ACCESS_TOKEN
if (!/^[a-z0-9]{20}$/.test(REF) || !TOKEN) { console.error('✗ SUPABASE_PROJECT_REF and SUPABASE_ACCESS_TOKEN are needed in .env.local'); process.exit(1) }
const BASE = `https://${REF}.supabase.co`
const API = `https://api.supabase.com/v1/projects/${REF}`
const mb = (n) => `${(n / 1e6).toFixed(1)} MB`

async function mgmt(p, init = {}) {
  const r = await fetch(API + p, { ...init, headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) } })
  const text = await r.text()
  if (!r.ok) throw new Error(`Supabase said (${r.status}): ${text.slice(0, 300)}`)
  return text ? JSON.parse(text) : null
}
const sql = (query) => mgmt('/database/query', { method: 'POST', body: JSON.stringify({ query }) })
const lit = (s) => `'${String(s).replace(/'/g, "''")}'`

const keys = await mgmt('/api-keys?reveal=true')
const SERVICE = keys.find((k) => k.name === 'service_role')?.api_key
if (!SERVICE) { console.error('✗ could not read the project keys (is the access token current?)'); process.exit(1) }
const storage = (p, init = {}) => fetch(`${BASE}/storage/v1${p}`, { ...init, headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, ...(init.headers ?? {}) } })

// every file in the bucket (folders are listed with id null)
async function list(prefix = '') {
  const out = []
  for (let offset = 0; ; offset += 1000) {
    const r = await storage(`/object/list/${BUCKET}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prefix, limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } }) })
    if (!r.ok) throw new Error(`listing ${prefix || '/'} failed (${r.status})`)
    const page = await r.json()
    for (const o of page) {
      const full = prefix ? `${prefix}/${o.name}` : o.name
      if (o.id === null) out.push(...(await list(full)))
      else out.push({ path: full, size: Number(o.metadata?.size ?? 0), type: String(o.metadata?.mimetype ?? '') })
    }
    if (page.length < 1000) return out
  }
}

const files = await list()
const big = files.filter((f) => f.size > MIN_BYTES && /^image\/(jpeg|png|webp|heic|heif)$/i.test(f.type) && !/-web\.jpg$/.test(f.path))
console.log(`${files.length} files in ${BUCKET}, ${mb(files.reduce((a, f) => a + f.size, 0))} in all; ${big.length} photos over ${mb(MIN_BYTES)} (${mb(big.reduce((a, f) => a + f.size, 0))})`)
if (!big.length) process.exit(0)

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'shrink-'))
let before = 0, after = 0, done = 0
for (const f of big) {
  const oldUrl = `${BASE}/storage/v1/object/public/${BUCKET}/${f.path}`
  const newPath = f.path.replace(/\.[^./]+$/, '') + '-web.jpg'
  const newUrl = `${BASE}/storage/v1/object/public/${BUCKET}/${newPath}`
  const src = path.join(tmp, 'in' + path.extname(f.path)), out = path.join(tmp, 'out.jpg')
  const r = await storage(`/object/${BUCKET}/${f.path.split('/').map(encodeURIComponent).join('/')}`)
  if (!r.ok) { console.log(`  ! ${f.path}: download failed (${r.status}), skipped`); continue }
  fs.writeFileSync(src, Buffer.from(await r.arrayBuffer()))
  try {
    execFileSync('sips', ['-Z', '2400', '-s', 'format', 'jpeg', '-s', 'formatOptions', '80', src, '--out', out], { stdio: 'ignore' })
  } catch { console.log(`  ! ${f.path}: could not be converted, skipped`); continue }
  const size = fs.statSync(out).size
  if (size >= f.size) { console.log(`  = ${f.path}: already small enough`); continue }
  console.log(`  ${APPLY ? '✓' : '→'} ${f.path}: ${mb(f.size)} → ${mb(size)}`)
  before += f.size; after += size
  if (!APPLY) continue

  const up = await storage(`/object/${BUCKET}/${newPath.split('/').map(encodeURIComponent).join('/')}`, { method: 'POST', headers: { 'Content-Type': 'image/jpeg', 'cache-control': 'max-age=31536000', 'x-upsert': 'true' }, body: fs.readFileSync(out) })
  if (!up.ok) { console.log(`    ! upload failed (${up.status}), original kept`); continue }
  // swap the link in every text / json column of the website's tables
  const o = lit(oldUrl), n = lit(newUrl)
  await sql(`do $$ declare c record; begin
    for c in select k.table_name t, k.column_name col, k.data_type dt from information_schema.columns k
             join information_schema.tables b on b.table_schema = k.table_schema and b.table_name = k.table_name and b.table_type = 'BASE TABLE'
             where k.table_schema = 'public' and k.is_generated = 'NEVER' and k.data_type in ('text', 'character varying', 'jsonb', 'json') loop
      execute format(
        case when c.dt in ('jsonb', 'json')
          then 'update public.%1$I set %2$I = replace(%2$I::text, %3$L, %4$L)::' || c.dt || ' where strpos(%2$I::text, %3$L) > 0'
          else 'update public.%1$I set %2$I = replace(%2$I, %3$L, %4$L) where strpos(%2$I, %3$L) > 0' end,
        c.t, c.col, ${o}, ${n});
    end loop; end $$;`)
  const del = await storage(`/object/${BUCKET}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: [f.path] }) })
  if (!del.ok) console.log(`    ! the original could not be deleted (${del.status}); the site already uses the new one`)
  done++
}
fs.rmSync(tmp, { recursive: true, force: true })
console.log(`\n${APPLY ? `Shrunk ${done} photos` : 'Would shrink these photos'}: ${mb(before)} → ${mb(after)}.${APPLY ? '' : '  Run again with --apply to do it.'}`)
