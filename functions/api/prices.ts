/** GET /api/prices — live price overrides, added packages and card photos set in the dashboard (public, short cache). */
import { db, dbReady, type DbEnv } from '../../src/server/db'
import { safePhoto } from '../../src/booking/cardPhotos'

const PACKAGE_COLUMNS = 'select=id,flow_id,kind,label,note,includes,price,unit,max_qty,sort_order,active&active=eq.true&order=sort_order.asc'

export const onRequestGet = async ({ env }: { env: DbEnv }) => {
  let rows: unknown[] = []
  let packages: unknown[] = []
  let cardPhotos: Record<string, string> = {}
  if (dbReady(env)) {
    // read separately, so prices keep working before the booking_packages table exists
    const [o, p, s] = await Promise.allSettled([
      db.select(env, 'price_overrides', 'select=flow_id,kind,item_id,price,active'),
      db.select(env, 'booking_packages', PACKAGE_COLUMNS),
      db.select(env, 'settings', 'key=eq.card_photos&select=value'),
    ])
    if (o.status === 'fulfilled') rows = o.value as unknown[]
    else console.error('prices failed', o.reason)
    if (p.status === 'fulfilled') packages = p.value as unknown[]
    else console.error('packages failed', p.reason)
    if (s.status === 'fulfilled') {
      const v = (s.value as { value?: unknown }[])[0]?.value
      // only plain links go out to the website
      if (v && typeof v === 'object' && !Array.isArray(v))
        for (const [k, u] of Object.entries(v as Record<string, unknown>)) if (safePhoto(u)) cardPhotos[k] = safePhoto(u)
    } else console.error('card photos failed', s.reason)
  }
  return new Response(JSON.stringify({ overrides: rows, packages, cardPhotos }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' } })
}
