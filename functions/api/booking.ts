/** POST /api/booking — validates + re-prices a multi-step booking, stores it (+ CRM records) and sends the emails (Cloudflare Pages Function). */
import { computeQuote, flows, validateSelection, type Selection } from '../../src/booking/catalog'
import { applyOverrides, evaluatePromo, type PriceOverride, type PromoRow } from '../../src/booking/overrides'
import { deliver, type MailEnv } from '../../src/server/mail'
import { buildSummary } from '../../src/server/summary'
import { db, dbReady, q, type DbEnv } from '../../src/server/db'
import { recordBooking } from '../../src/server/crm'

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })

export const onRequestPost = async ({ request, env }: { request: Request; env: MailEnv & DbEnv }) => {
  let sel: Selection & { website?: string }
  try {
    sel = (await request.json()) as Selection & { website?: string }
  } catch {
    return json({ ok: false, error: 'Invalid request.' }, 400)
  }
  if (sel.website) return json({ ok: true }) // honeypot
  const base = flows[sel.flowId]
  if (!base) return json({ ok: false, error: 'Unknown service.' }, 400)

  // dashboard price overrides (re-priced here, so the browser can never choose its own price)
  let flow = base
  if (dbReady(env)) {
    try {
      flow = applyOverrides(base, (await db.select(env, 'price_overrides', `flow_id=eq.${q(base.id)}`)) as PriceOverride[])
    } catch (err) {
      console.error('overrides failed', err)
    }
  }
  sel = { ...sel, optionIds: sel.optionIds ?? [], units: sel.units ?? {}, extras: sel.extras ?? {}, fields: sel.fields ?? {} }
  const problems = validateSelection(flow, sel)
  if (problems.length) return json({ ok: false, error: problems.join('; ') }, 422)

  let quote: ReturnType<typeof computeQuote>
  try {
    quote = computeQuote(flow, sel)
  } catch (err) {
    console.error('Quote failed', err)
    return json({ ok: false, error: 'Could not price this booking.' }, 422)
  }
  let promo: { code: string; amount: number } | undefined
  const code = (sel.promo ?? '').trim().toUpperCase()
  if (code && dbReady(env)) {
    try {
      const row = ((await db.select(env, 'promo_codes', `code=eq.${q(code)}&limit=1`)) as PromoRow[])[0]
      const r = evaluatePromo(row, flow.id, quote.total)
      if (r.ok) {
        promo = { code, amount: r.discount }
        await db.update(env, 'promo_codes', `code=eq.${q(code)}`, { used: row.used + 1 })
      }
    } catch (err) {
      console.error('promo failed', err)
    }
  }

  try {
    const summary = buildSummary(flow, sel, promo)
    const packages = sel.optionIds.map((id) => flow.options.find((o) => o.id === id)!.label).join(', ')
    const ref = await recordBooking(env, flow, sel, summary, quote, { discount: promo?.amount, promo: promo?.code, packages })
    if (ref) summary.details.unshift(['Reference', ref])
    const result = await deliver(env, summary)
    return json({ ok: true, total: summary.total, ref, ...(result.dryRun ? { dryRun: true, emails: { customer: result.customer, owner: result.owner } } : {}) })
  } catch (err) {
    console.error('Booking failed', err)
    return json({ ok: false, error: err instanceof Error ? err.message : 'Could not send.' }, 502)
  }
}
