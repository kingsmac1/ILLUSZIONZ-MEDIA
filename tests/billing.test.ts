// Run: DENO_NO_PACKAGE_JSON=1 npx deno@latest test --no-lock --allow-env --allow-net --allow-read tests/billing.test.ts
import { assert, assertEquals, assertRejects } from 'jsr:@std/assert@1'

Deno.env.set('SUPABASE_URL', 'http://127.0.0.1:9')
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test')
const realFetch = globalThis.fetch
let dashboard: (() => Response | Promise<Response>) | null = null
let n = 0
globalThis.fetch = ((input: Request | URL | string, init?: RequestInit) => {
  const url = String(input instanceof Request ? input.url : input)
  if (url.includes('/api/billing/status')) return Promise.resolve(dashboard ? dashboard() : new Response('down', { status: 503 }))
  if (url.includes('127.0.0.1')) return Promise.resolve(new Response('{}', { status: 500 })) // the studio's own database: no cache table in this test
  return realFetch(input as string, init)
}) as typeof fetch

const status = (over: Record<string, unknown> = {}) =>
  new Response(JSON.stringify({ studio_name: 'Test Studio', status: 'active', uploads_allowed: true, gallery_enabled: true, purged: false, purge_enabled: false, payments: [], banner: null, checked_at: new Date().toISOString(), ...over }), { status: 200 })

/** a fresh copy of the module (it keeps a 60-second memory cache) */
const load = () => import(`../supabase/functions/_shared/billing.ts?run=${++n}`)

Deno.test('billing off when no site key: nothing is ever blocked', async () => {
  Deno.env.delete('BILLING_SITE_KEY')
  const m = await load()
  await m.requireGalleryEnabled()
  await m.requireUploadsAllowed()
  assertEquals((await m.getBilling()).billing, null)
})

Deno.test('active studio passes; paused gallery answers 402 GALLERY_PAUSED with neutral wording', async () => {
  Deno.env.set('BILLING_SITE_KEY', 'ebk_test')
  dashboard = () => status()
  let m = await load()
  await m.requireGalleryEnabled()
  await m.requireUploadsAllowed()

  dashboard = () => status({ status: 'locked', gallery_enabled: false, uploads_allowed: false })
  m = await load()
  const e = await assertRejects(() => m.requireGalleryEnabled())
  assertEquals((e as { status: number; code: string }).status, 402)
  assertEquals((e as { code: string }).code, 'GALLERY_PAUSED')
  assert(/temporarily unavailable/.test((e as Error).message))
  assert(!/pay|plan|bill|subscri/i.test((e as Error).message), 'clients must never read about payment')
})

Deno.test('full storage blocks uploads only (STORAGE_FULL), the gallery still opens', async () => {
  Deno.env.set('BILLING_SITE_KEY', 'ebk_test')
  dashboard = () => status({ uploads_allowed: false })
  const m = await load()
  await m.requireGalleryEnabled()
  const e = await assertRejects(() => m.requireUploadsAllowed())
  assertEquals((e as { code: string }).code, 'STORAGE_FULL')
})

Deno.test('a dashboard outage never locks a studio that never heard from it', async () => {
  Deno.env.set('BILLING_SITE_KEY', 'ebk_test')
  dashboard = null
  const m = await load()
  await m.requireGalleryEnabled()
  assertEquals((await m.getBilling()).billing, null)
})

Deno.test('after a good answer, an outage keeps using it for 72 hours, then locks', async () => {
  Deno.env.set('BILLING_SITE_KEY', 'ebk_test')
  dashboard = () => status()
  const m = await load()
  assertEquals((await m.getBilling(true)).fresh, true)
  dashboard = null // the dashboard goes down

  const out = await m.getBilling(true)
  assertEquals(out.fresh, false)
  assertEquals(out.billing.stale, true)
  assertEquals(out.billing.gallery_enabled, true) // still open

  const realNow = Date.now
  Date.now = () => realNow() + 73 * 3600_000
  try {
    const later = await m.getBilling(true)
    assertEquals(later.billing.gallery_enabled, false)
    await assertRejects(() => m.requireGalleryEnabled())
  } finally {
    Date.now = realNow
  }
})

Deno.test('not_activated is never locked, even after a long outage', async () => {
  Deno.env.set('BILLING_SITE_KEY', 'ebk_test')
  dashboard = () => status({ status: 'not_activated' })
  const m = await load()
  await m.getBilling(true)
  dashboard = null
  const realNow = Date.now
  Date.now = () => realNow() + 100 * 3600_000
  try { await m.requireGalleryEnabled() } finally { Date.now = realNow }
})
