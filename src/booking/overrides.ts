/** Dashboard price overrides and added packages: shared by the browser (to show live prices) and the server (to re-price). */
import type { Extra, Flow, Option } from './catalog'

export type PriceOverride = { flow_id: string; kind: 'option' | 'extra'; item_id: string; price: number; active: boolean }

/** A package or add-on added in Dashboard → Prices (table booking_packages). */
export type BookingPackage = {
  id: string
  flow_id: string
  kind: 'option' | 'extra'
  label: string
  note?: string | null
  /** a short description shown on the package's card (Wedding, Videography, Academy) */
  description?: string | null
  includes?: string[] | null
  price: number | string
  /** quoteExtra: a looks counter (price per look, multi-look discount taken off on the invoice) */
  unit?: { label?: string; plural?: string; min?: number; max?: number; def?: number; quoteExtra?: boolean } | null
  max_qty?: number | null
  sort_order?: number | null
  active: boolean
}

/** the id a added package has in a booking (kept apart from the standard ids such as "portrait-1") */
export const packageItemId = (p: Pick<BookingPackage, 'id'>) => `added-${p.id}`

const int = (v: unknown, lo: number, hi: number, d: number) => {
  const n = Math.round(Number(v))
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d
}

export function packageToOption(p: BookingPackage): Option {
  const u = p.unit && String(p.unit.label ?? '').trim() ? p.unit : null
  const min = u ? int(u.min, 1, 99, 1) : 1
  const max = u ? Math.max(min, int(u.max, 1, 99, 10)) : 1
  return {
    id: packageItemId(p),
    label: p.label.trim(),
    price: Math.max(0, Number(p.price) || 0),
    note: p.note?.trim() || undefined,
    includes: (p.includes ?? []).map((x) => x.trim()).filter(Boolean),
    unit: u ? { label: String(u.label).trim(), plural: String(u.plural ?? '').trim() || `${String(u.label).trim()}s`, min, max, def: int(u.def, min, max, min), ...(u.quoteExtra ? { quoteExtra: true } : {}) } : undefined,
  }
}

export function packageToExtra(p: BookingPackage): Extra {
  const price = Math.max(0, Number(p.price) || 0)
  return {
    id: packageItemId(p),
    label: p.label.trim(),
    price,
    note: p.note?.trim() || undefined,
    max: p.max_qty ? int(p.max_qty, 1, 100, 1) : undefined,
    priceNote: price > 0 ? undefined : 'Quoted',
  }
}

/** The added packages of one page, in their order, shown ones only. */
export const addedFor = (flowId: string, packages: BookingPackage[] | undefined, kind: BookingPackage['kind']) =>
  (packages ?? [])
    .filter((p) => p.flow_id === flowId && p.kind === kind && p.active && p.label?.trim())
    .sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0))

export function applyOverrides(flow: Flow, rows: PriceOverride[] | undefined, packages?: BookingPackage[]): Flow {
  const mine = (rows ?? []).filter((r) => r.flow_id === flow.id)
  const addedOptions = addedFor(flow.id, packages, 'option').map(packageToOption)
  const addedExtras = addedFor(flow.id, packages, 'extra').map(packageToExtra)
  if (!mine.length && !addedOptions.length && !addedExtras.length) return flow
  const find = (kind: PriceOverride['kind'], id: string) => mine.find((r) => r.kind === kind && r.item_id === id)
  const withAdded = (f: Flow): Flow => ({ ...f, options: [...f.options, ...addedOptions], extras: [...f.extras, ...addedExtras] })
  return withAdded({
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
  })
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
