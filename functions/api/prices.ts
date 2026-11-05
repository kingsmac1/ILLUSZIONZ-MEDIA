/** GET /api/prices — live price overrides and added packages set in the dashboard (public, short cache). */
import { db, dbReady, type DbEnv } from '../../src/server/db'

const PACKAGE_COLUMNS = 'select=id,flow_id,kind,label,note,includes,price,unit,max_qty,sort_order,active&active=eq.true&order=sort_order.asc'

export const onRequestGet = async ({ env }: { env: DbEnv }) => {
  let rows: unknown[] = []
  let packages: unknown[] = []
  if (dbReady(env)) {
    // read separately, so prices keep working before the booking_packages table exists
    const [o, p] = await Promise.allSettled([
      db.select(env, 'price_overrides', 'select=flow_id,kind,item_id,price,active'),
      db.select(env, 'booking_packages', PACKAGE_COLUMNS),
    ])
    if (o.status === 'fulfilled') rows = o.value as unknown[]
    else console.error('prices failed', o.reason)
    if (p.status === 'fulfilled') packages = p.value as unknown[]
    else console.error('packages failed', p.reason)
  }
  return new Response(JSON.stringify({ overrides: rows, packages }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' } })
}
