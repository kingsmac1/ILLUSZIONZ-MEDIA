/** Dashboard price overrides: shared by the browser (to show live prices) and the server (to re-price). */
import type { Flow } from './catalog'

export type PriceOverride = { flow_id: string; kind: 'option' | 'extra'; item_id: string; price: number; active: boolean }

export function applyOverrides(flow: Flow, rows: PriceOverride[] | undefined): Flow {
  const mine = (rows ?? []).filter((r) => r.flow_id === flow.id)
  if (!mine.length) return flow
  const find = (kind: PriceOverride['kind'], id: string) => mine.find((r) => r.kind === kind && r.item_id === id)
  return {
    ...flow,
    options: flow.options.flatMap((o) => {
      const r = find('option', o.id)
      if (!r) return [o]
      return r.active ? [{ ...o, price: Number(r.price) }] : []
    }),
    extras: flow.extras.flatMap((e) => {
      const r = find('extra', e.id)
      if (!r) return [e]
      return r.active ? [{ ...e, price: Number(r.price), priceNote: Number(r.price) > 0 ? undefined : e.priceNote }] : []
    }),
  }
}

export type PromoRow = {
  code: string
  percent_off: number | null
  amount_off: number | null
  flows: string[]
  active: boolean
  starts_on: string | null
  expires_on: string | null
  max_uses: number | null
  used: number
}

/** Returns a discount in GBP (never more than the subtotal) or an error message. */
export function evaluatePromo(p: PromoRow | undefined, flowId: string, subtotal: number, today = new Date().toISOString().slice(0, 10)): { ok: true; discount: number } | { ok: false; error: string } {
  if (!p || !p.active) return { ok: false, error: 'That code is not valid.' }
  if (p.starts_on && today < p.starts_on) return { ok: false, error: 'That code is not active yet.' }
  if (p.expires_on && today > p.expires_on) return { ok: false, error: 'That code has expired.' }
  if (p.max_uses != null && p.used >= p.max_uses) return { ok: false, error: 'That code has been fully used.' }
  if (p.flows.length && !p.flows.includes(flowId)) return { ok: false, error: 'That code does not apply to this service.' }
  if (subtotal <= 0) return { ok: false, error: 'Choose a priced package first.' }
  const raw = p.percent_off != null ? (subtotal * Number(p.percent_off)) / 100 : Number(p.amount_off ?? 0)
  const discount = Math.min(subtotal, Math.round(raw * 100) / 100)
  return discount > 0 ? { ok: true, discount } : { ok: false, error: 'That code gives no discount here.' }
}
