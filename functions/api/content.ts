/** GET /api/content — dashboard-managed website content (store, testimonials, image sets, banner). Public, short cache. */
import { db, dbReady, type DbEnv } from '../../src/server/db'

export const onRequestGet = async ({ env }: { env: DbEnv }) => {
  const out: Record<string, unknown> = { managed: {}, notice: null, store: [], testimonials: [], images: {} }
  if (dbReady(env)) {
    try {
      const [settings, store, tests, imgs] = await Promise.all([
        db.select(env, 'settings', 'key=in.(cms_managed,notice)&select=key,value'),
        db.select(env, 'store_products', 'active=eq.true&order=sort_order.asc,created_at.asc'),
        db.select(env, 'testimonials', 'active=eq.true&order=sort_order.asc,created_at.asc'),
        db.select(env, 'site_images', 'order=sort_order.asc,created_at.asc'),
      ])
      const s = Object.fromEntries(settings.map((r) => [r.key, r.value]))
      const managed = (s.cms_managed ?? {}) as Record<string, boolean>
      out.managed = managed
      out.notice = s.notice?.enabled && s.notice?.text ? s.notice : null
      if (managed.store) out.store = store
      if (managed.testimonials) out.testimonials = tests
      const images: Record<string, unknown[]> = {}
      for (const r of imgs) if (managed[r.section]) (images[r.section] ??= []).push(r)
      out.images = images
    } catch (err) {
      console.error('content failed', err)
    }
  }
  return new Response(JSON.stringify(out), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=15' } })
}
