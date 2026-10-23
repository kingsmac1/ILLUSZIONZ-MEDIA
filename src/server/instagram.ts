/**
 * Instagram -> website gallery sync. Pulls the latest posts through the Instagram API (Instagram Login),
 * copies each picture into the public `site-media` bucket (Instagram's own picture links expire after a
 * few days) and adds it to the gallery section chosen in the dashboard as a normal `site_images` row.
 * Free Cloudflare plans allow ~50 subrequests per call, so at most MAX_NEW pictures are copied per run;
 * the next run (or another press of "Sync now") carries on until everything is in.
 */
import { db, q, type DbEnv } from './db'

type Row = Record<string, any>
export type IgEnv = DbEnv & { INSTAGRAM_ACCESS_TOKEN?: string }
export type IgSettings = { enabled?: boolean; section?: string; limit?: number; interval_hours?: number; last_sync?: string; last_attempt?: string; last_error?: string; last_added?: number; seen?: string[]; pending?: boolean }

const MAX_NEW = 8
const COOLDOWN_MS = 60_000
const GRAPH = 'https://graph.instagram.com'
const now = () => new Date().toISOString()

async function getSetting(env: IgEnv, key: string): Promise<Row | null> {
  const [r] = await db.select(env, 'settings', `key=eq.${q(key)}&select=value&limit=1`)
  return (r?.value as Row) ?? null
}
const putSetting = (env: IgEnv, key: string, value: Row) =>
  db.insert(env, 'settings', { key, value, updated_at: now() }).catch(() => db.update(env, 'settings', `key=eq.${q(key)}`, { value, updated_at: now() }))

/** Width and height of a JPEG/PNG/WebP from its first bytes (Instagram serves JPEG). */
export function imageSize(b: Uint8Array): { w: number; h: number } | null {
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue }
      const m = b[i + 1]
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { h: (b[i + 5] << 8) | b[i + 6], w: (b[i + 7] << 8) | b[i + 8] }
      i += 2 + ((b[i + 2] << 8) | b[i + 3])
    }
  }
  if (b[0] === 0x89 && b[1] === 0x50) return { w: ((b[16] << 24) | (b[17] << 16) | (b[18] << 8) | b[19]) >>> 0, h: ((b[20] << 24) | (b[21] << 16) | (b[22] << 8) | b[23]) >>> 0 }
  return null
}

/** Keep the long-lived token alive: Instagram tokens last 60 days and can be renewed once they are a day old. */
async function currentToken(env: IgEnv): Promise<{ token: string; error?: string }> {
  const stored = await getSetting(env, 'instagram_token')
  let token = (stored?.token as string | undefined) || env.INSTAGRAM_ACCESS_TOKEN || ''
  // a token typed into Cloudflare after an older one was stored wins
  if (env.INSTAGRAM_ACCESS_TOKEN && stored?.source !== env.INSTAGRAM_ACCESS_TOKEN) token = env.INSTAGRAM_ACCESS_TOKEN
  if (!token) return { token: '', error: 'No Instagram access token yet. Add INSTAGRAM_ACCESS_TOKEN in Cloudflare (see the guide).' }
  const refreshedAt = stored?.refreshed_at ? Date.parse(stored.refreshed_at) : 0
  if (Date.now() - refreshedAt > 20 * 86_400_000) {
    const res = await fetch(`${GRAPH}/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(token)}`)
    if (res.ok) {
      const j = (await res.json()) as { access_token?: string }
      if (j.access_token) { token = j.access_token; await putSetting(env, 'instagram_token', { token, refreshed_at: now(), source: env.INSTAGRAM_ACCESS_TOKEN ?? '' }) }
    } else if (!stored) await putSetting(env, 'instagram_token', { token, refreshed_at: '', source: env.INSTAGRAM_ACCESS_TOKEN ?? '' })
  }
  return { token }
}

export async function syncInstagram(env: IgEnv, opts: { force?: boolean; visit?: boolean } = {}): Promise<{ ok: boolean; skipped?: string; added: number; removed: number; more: boolean; error?: string }> {
  const cfg = ((await getSetting(env, 'instagram')) ?? {}) as IgSettings
  const fail = async (error: string) => { await putSetting(env, 'instagram', { ...cfg, last_error: error }); return { ok: false, added: 0, removed: 0, more: false, error } }
  if (!opts.force && !cfg.enabled) return { ok: true, skipped: 'Instagram sync is switched off.', added: 0, removed: 0, more: false }
  // a page visit checks Instagram, but never more than once a minute however many people are browsing
  if (opts.visit) {
    if (cfg.last_attempt && Date.now() - Date.parse(cfg.last_attempt) < COOLDOWN_MS) return { ok: true, skipped: 'Checked a moment ago.', added: 0, removed: 0, more: false }
    cfg.last_attempt = now()
    await putSetting(env, 'instagram', cfg)
  }
  const section = cfg.section || 'home-gallery'
  const limit = Math.min(30, Math.max(3, cfg.limit ?? 12))
  const { token, error: tokErr } = await currentToken(env)
  if (tokErr) return fail(tokErr)

  const res = await fetch(`${GRAPH}/me/media?fields=id,media_type,media_url,thumbnail_url,permalink,caption,timestamp&limit=${limit}&access_token=${encodeURIComponent(token)}`)
  const body = (await res.json().catch(() => ({}))) as { data?: Row[]; error?: { message?: string } }
  if (!res.ok || !body.data) return fail(`Instagram said: ${body.error?.message ?? res.status}. The access token may have expired — generate a new one (see the guide).`)

  const posts = body.data.filter((p) => (p.media_type === 'VIDEO' ? p.thumbnail_url : p.media_url))
  const latestIds = new Set(posts.map((p) => String(p.id)))
  const existing = await db.select(env, 'site_images', `section=eq.${q(section)}&select=id,ext_id,source,url,sort_order`)
  const have = new Set(existing.filter((r) => r.ext_id).map((r) => String(r.ext_id)))
  const seen = new Set(cfg.seen ?? [])
  const fresh = posts.filter((p) => !have.has(String(p.id)) && !seen.has(String(p.id)))
  const batch = fresh.slice(0, MAX_NEW)
  const lowest = Math.min(1, ...existing.map((r) => Number(r.sort_order)))

  const rows: Row[] = []
  const base = env.SUPABASE_URL!.replace(/\/$/, '')
  for (const [i, p] of batch.entries()) {
    try {
      const src = p.media_type === 'VIDEO' ? p.thumbnail_url : p.media_url
      const img = await fetch(src)
      if (!img.ok) continue
      const bytes = new Uint8Array(await img.arrayBuffer())
      if (bytes.length > 6_000_000) continue
      const type = img.headers.get('content-type')?.split(';')[0] || 'image/jpeg'
      const path = `instagram/${p.id}.${type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg'}`
      const up = await fetch(`${base}/storage/v1/object/site-media/${path}`, { method: 'POST', headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY!, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': type, 'x-upsert': 'true', 'cache-control': 'max-age=31536000' }, body: bytes })
      if (!up.ok) continue
      const url = `${base}/storage/v1/object/public/site-media/${path}`
      const size = imageSize(bytes) ?? { w: 1080, h: 1080 }
      rows.push({ section, url, thumb_url: url, alt: String(p.caption ?? 'Instagram post from Illuszionz Media').replace(/\s+/g, ' ').slice(0, 140), width: size.w, height: size.h, sort_order: lowest - batch.length + i, source: 'instagram', ext_id: String(p.id), link: p.permalink ?? '' })
    } catch { /* skip this picture, try again next run */ }
  }
  // two visitors syncing at the same instant would hit the unique index; the other one already added them
  if (rows.length) await db.insert(env, 'site_images', rows).catch(() => { rows.length = 0 })

  // posts that fell out of the latest N (or were deleted on Instagram) leave the gallery; manual pictures are never touched
  const stale = existing.filter((r) => r.source === 'instagram' && r.ext_id && !latestIds.has(String(r.ext_id)))
  if (stale.length) await db.remove(env, 'site_images', `id=in.(${stale.map((r) => r.id).join(',')})`)

  const more = fresh.length > batch.length
  const imported = [...seen, ...rows.map((r) => r.ext_id)].filter((id) => latestIds.has(id))
  await putSetting(env, 'instagram', { ...cfg, seen: imported, pending: more, last_sync: now(), last_error: '', last_added: rows.length })
  return { ok: true, added: rows.length, removed: stale.length, more }
}
