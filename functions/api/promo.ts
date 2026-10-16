/** GET /api/promo?code=&flow=&subtotal= — checks a promo code against a subtotal (the booking endpoint re-checks it). */
import { db, dbReady, q, type DbEnv } from '../../src/server/db'
import { evaluatePromo, type PromoRow } from '../../src/booking/overrides'

export const onRequestGet = async ({ request, env }: { request: Request; env: DbEnv }) => {
  const u = new URL(request.url)
  const code = (u.searchParams.get('code') ?? '').trim().toUpperCase()
  const out = (data: unknown) => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
  if (!code || !dbReady(env)) return out({ ok: false, error: 'That code is not valid.' })
  const row = ((await db.select(env, 'promo_codes', `code=eq.${q(code)}&limit=1`).catch(() => [])) as PromoRow[])[0]
  const r = evaluatePromo(row, u.searchParams.get('flow') ?? '', Number(u.searchParams.get('subtotal')) || 0)
  return out(r.ok ? { ok: true, code, discount: r.discount, label: row.percent_off != null ? `${row.percent_off}% off` : `£${row.amount_off} off` } : r)
}
