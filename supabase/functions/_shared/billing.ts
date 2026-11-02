/**
 * Gallery billing: what the Emkay Digitals dashboard says about this studio's plan.
 * Asked with the studio's own site key (BILLING_SITE_KEY), cached for 60 seconds in memory and in the one-row
 * billing_cache table. If the dashboard cannot be reached the last good answer is used for up to 72 hours, so a short
 * outage never locks anyone. With no BILLING_SITE_KEY set, billing is off and nothing is ever blocked.
 */
import { HttpError } from './http.ts'
import { service } from './auth.ts'

export type Billing = {
  studio_name: string
  status: string
  plan: { code: string; name: string; limit_gb: number; price_usd: number; price_ngn: number } | null
  limit_bytes: number
  used_bytes: number
  paid_until: string | null
  grace_ends_at: string | null
  locked_at: string | null
  purge_due_at: string | null
  signup_deadline: string | null
  trial_ends_at: string | null
  uploads_allowed: boolean
  gallery_enabled: boolean
  purged: boolean
  purge_enabled: boolean
  pay_url: string | null
  manage_card_url: string | null
  banner: { level: 'info' | 'warning' | 'danger'; message: string; cta: string } | null
  payments: { created_at: string; amount_ngn: number; channel: string; status: string; period_end: string | null }[]
  checked_at: string
  /** set here, not by the dashboard */
  stale?: boolean
}

const FRESH_MS = 60_000
const OFFLINE_MAX_MS = 72 * 3600_000

export const billingConfigured = () => !!Deno.env.get('BILLING_SITE_KEY')
const baseUrl = () => (Deno.env.get('BILLING_BASE_URL') || 'https://emkaydigitals.com/api/billing').replace(/\/+$/, '')
const authHeader = () => ({ Authorization: `Bearer ${Deno.env.get('BILLING_SITE_KEY')}` })

type Snapshot = { data: Billing; at: number }
let mem: Snapshot | null = null

async function readCache(): Promise<Snapshot | null> {
  const { data, error } = await service().from('billing_cache').select('payload, fetched_at').eq('id', 1).maybeSingle()
  if (error || !data?.payload) return null
  return { data: data.payload as Billing, at: new Date(data.fetched_at as string).getTime() }
}

async function writeCache(data: Billing, at: number) {
  try {
    await service().from('billing_cache').upsert({ id: 1, payload: data, fetched_at: new Date(at).toISOString() })
  } catch (err) {
    console.error('billing: could not store the cache', err instanceof Error ? err.message : err)
  }
}

/** Calls the dashboard. Throws when it cannot be reached or does not accept the key. */
async function fetchStatus(): Promise<Billing> {
  const res = await fetch(`${baseUrl()}/status`, { headers: authHeader(), signal: AbortSignal.timeout(8000) })
  if (!res.ok) throw new Error(`billing status HTTP ${res.status}`)
  const data = (await res.json()) as Billing
  if (!data || typeof data.status !== 'string') throw new Error('billing status: unexpected answer')
  return data
}

/**
 * The studio's billing state, or null when billing is off / the dashboard has never answered (never lock then).
 * `fresh` is true only when this very call heard from the dashboard (the purge relies on that).
 */
export async function getBilling(force = false): Promise<{ billing: Billing | null; fresh: boolean }> {
  if (!billingConfigured()) return { billing: null, fresh: false }
  const now = Date.now()
  if (!force && mem && now - mem.at < FRESH_MS) return { billing: mem.data, fresh: true }
  const cached = await readCache().catch(() => null)
  if (!force && cached && now - cached.at < FRESH_MS) {
    mem = cached
    return { billing: cached.data, fresh: true }
  }
  try {
    const data = await fetchStatus()
    mem = { data, at: now }
    await writeCache(data, now)
    return { billing: data, fresh: true }
  } catch (err) {
    console.error('billing: dashboard unreachable, using the last answer', err instanceof Error ? err.message : err)
    const last = [mem, cached].filter(Boolean).sort((a, b) => b!.at - a!.at)[0] ?? null
    if (!last) return { billing: null, fresh: false }
    const view: Billing = { ...last.data, stale: true }
    // only after 72 hours of silence does a paying/trial studio count as locked
    if (now - last.at > OFFLINE_MAX_MS && last.data.status !== 'not_activated') return { billing: { ...view, gallery_enabled: false, uploads_allowed: false, banner: null }, fresh: false }
    return { billing: view, fresh: false }
  }
}

/** The dashboard's cheap call: the studio's real usage, so billing and storage rules use the true figure. */
export async function reportUsage(bytes: number) {
  const res = await fetch(`${baseUrl()}/usage`, { method: 'POST', headers: { ...authHeader(), 'Content-Type': 'application/json' }, body: JSON.stringify({ bytes }), signal: AbortSignal.timeout(8000) })
  if (!res.ok) throw new Error(`billing usage HTTP ${res.status}`)
}
export async function reportPurgeDone(objects: number, bytes: number) {
  const res = await fetch(`${baseUrl()}/purge-done`, { method: 'POST', headers: { ...authHeader(), 'Content-Type': 'application/json' }, body: JSON.stringify({ objects, bytes }), signal: AbortSignal.timeout(8000) })
  if (!res.ok) throw new Error(`billing purge-done HTTP ${res.status}`)
}

/** Client-facing calls: neutral wording, never a word about payment. */
const paused = (name?: string) => new HttpError(`This gallery is temporarily unavailable. Please contact ${name || 'the studio'}.`, 402, 'GALLERY_PAUSED')

export async function requireGalleryEnabled() {
  const { billing: b } = await getBilling()
  if (b && !b.gallery_enabled) throw paused(b.studio_name)
}

/** Studio-facing (uploads are admin only), so these may say what to do. */
export async function requireUploadsAllowed() {
  const { billing: b } = await getBilling()
  if (!b) return
  if (!b.gallery_enabled) throw new HttpError('Galleries are paused on this account. Open Billing in the dashboard to see why.', 402, 'GALLERY_PAUSED')
  if (!b.uploads_allowed) throw new HttpError('Your gallery storage is full, so uploads are paused. Open Billing in the dashboard to upgrade your plan.', 402, 'STORAGE_FULL')
}
