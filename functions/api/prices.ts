/** GET /api/prices — live price overrides set in the dashboard (public, short cache). */
import { db, dbReady, type DbEnv } from '../../src/server/db'

export const onRequestGet = async ({ env }: { env: DbEnv }) => {
  let rows: unknown[] = []
  if (dbReady(env)) {
    try {
      rows = await db.select(env, 'price_overrides', 'select=flow_id,kind,item_id,price,active')
    } catch (err) {
      console.error('prices failed', err)
    }
  }
  return new Response(JSON.stringify({ overrides: rows }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' } })
}
