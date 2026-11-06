/** GET /api/prices — live price overrides, added packages and card photos set in the dashboard (public, short cache). */
import { db, dbReady, type DbEnv } from '../../src/server/db'
import { safePhoto } from '../../src/booking/cardPhotos'
import { cleanCardEdits, cleanOptionEdits, type CardEdits, type OptionEdits } from '../../src/booking/cardEdits'

const PACKAGE_COLUMNS = 'select=id,flow_id,kind,label,note,description,includes,price,unit,max_qty,sort_order,active&active=eq.true&order=sort_order.asc'
// every column, so this keeps working before and after the add-ons and looks columns exist
const SERVICE_COLUMNS = 'select=*&active=eq.true&order=sort_order.asc'

export const onRequestGet = async ({ env }: { env: DbEnv }) => {
  let rows: unknown[] = []
  let packages: unknown[] = []
  let cardPhotos: Record<string, string> = {}
  let services: unknown[] = []
  let cardEdits: CardEdits = {}
  let optionEdits: OptionEdits = {}
  if (dbReady(env)) {
    // read separately, so prices keep working before the booking_packages table exists
    const [o, p, s, sv] = await Promise.allSettled([
      db.select(env, 'price_overrides', 'select=flow_id,kind,item_id,price,active'),
      // before the description column exists this read fails, so it falls back to the older columns
      db.select(env, 'booking_packages', PACKAGE_COLUMNS).catch(() => db.select(env, 'booking_packages', PACKAGE_COLUMNS.replace('description,', ''))),
      db.select(env, 'settings', 'key=in.(card_photos,card_edits,option_edits)&select=key,value'),
      db.select(env, 'booking_services', SERVICE_COLUMNS),
    ])
    if (sv.status === 'fulfilled') services = sv.value as unknown[]
    else console.error('services failed', sv.reason)
    if (o.status === 'fulfilled') rows = o.value as unknown[]
    else console.error('prices failed', o.reason)
    if (p.status === 'fulfilled') packages = p.value as unknown[]
    else console.error('packages failed', p.reason)
    if (s.status === 'fulfilled') {
      const byKey = Object.fromEntries((s.value as { key: string; value?: unknown }[]).map((r) => [r.key, r.value]))
      const v = byKey.card_photos
      // only plain links go out to the website
      if (v && typeof v === 'object' && !Array.isArray(v))
        for (const [k, u] of Object.entries(v as Record<string, unknown>)) if (safePhoto(u)) cardPhotos[k] = safePhoto(u)
      cardEdits = cleanCardEdits(byKey.card_edits)
      optionEdits = cleanOptionEdits(byKey.option_edits)
    } else console.error('card photos failed', s.reason)
  }
  return new Response(JSON.stringify({ overrides: rows, packages, cardPhotos, services, cardEdits, optionEdits }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' } })
}
