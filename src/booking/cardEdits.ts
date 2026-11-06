/**
 * Changes the studio makes in Dashboard → Prices → Packages on the website to the built-in package cards (Portrait
 * Photography, Silver Package …) and their price lines. Saved in settings:
 *   card_edits   { [cardKey]: { title, description, priceNote, bullets, cta, hidden } }  (hidden = removed from the site)
 *   option_edits { ["flowId:optionId"]: { label, note } }                                  (the price lines' wording)
 * Prices and showing/hiding a price line stay in price_overrides. Used by the website and the server alike.
 */
import { flows, formatGBP, type Flow, type Option } from './catalog'
import { PAGE_CARDS } from './cards'
import { cardKey } from './cardPhotos'
import type { PriceOverride } from './overrides'
import type { CardDef } from '../components/BookableGrid'

export type CardEdit = { title?: string; description?: string; priceNote?: string; bullets?: string[]; cta?: string; hidden?: boolean }
export type CardEdits = Record<string, CardEdit>
export type OptionEdit = { label?: string; note?: string }
export type OptionEdits = Record<string, OptionEdit>
export const optionKey = (flowId: string, optionId: string) => `${flowId}:${optionId}`

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : undefined)

/** only the expected fields, as plain text, reach the website */
export function cleanCardEdits(v: unknown): CardEdits {
  const out: CardEdits = {}
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out
  for (const [k, raw] of Object.entries(v as Record<string, unknown>)) {
    if (!raw || typeof raw !== 'object') continue
    const e = raw as Record<string, unknown>
    const c: CardEdit = {}
    const title = str(e.title, 120); if (title) c.title = title
    const description = str(e.description, 600); if (description !== undefined) c.description = description
    const priceNote = str(e.priceNote, 120); if (priceNote !== undefined) c.priceNote = priceNote
    const cta = str(e.cta, 40); if (cta) c.cta = cta
    if (Array.isArray(e.bullets)) c.bullets = e.bullets.map((b) => str(b, 200)).filter((b): b is string => !!b).slice(0, 20)
    if (e.hidden === true) c.hidden = true
    out[k.slice(0, 200)] = c
  }
  return out
}
export function cleanOptionEdits(v: unknown): OptionEdits {
  const out: OptionEdits = {}
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out
  for (const [k, raw] of Object.entries(v as Record<string, unknown>)) {
    if (!raw || typeof raw !== 'object') continue
    const e = raw as Record<string, unknown>
    const label = str(e.label, 120)
    const note = str(e.note, 200)
    if (label || note !== undefined) out[k.slice(0, 200)] = { ...(label ? { label } : {}), ...(note !== undefined ? { note } : {}) }
  }
  return out
}

const BUILT_IN = PAGE_CARDS.flatMap((p) => p.cards)
/** the card that is a whole booking form (Portrait, Maternity …: one card, a line per price) */
export const flowCard = (flowId: string) => BUILT_IN.find((c) => c.flowId === flowId && c.rows?.some((r) => r.optionId))
/** Is this booking form's card removed from the website? Then it cannot be booked either. */
export const isFlowRemoved = (flowId: string, edits: CardEdits | undefined) => {
  const c = flowCard(flowId)
  return !!c && !!edits?.[cardKey(c)]?.hidden
}

/** The booking form with the studio's wording: price line names and details, and a renamed card's title. */
export function applyEdits(flow: Flow, optionEdits: OptionEdits | undefined, cardEdits: CardEdits | undefined): Flow {
  const card = flowCard(flow.id)
  const title = card ? cardEdits?.[cardKey(card)]?.title : undefined
  const anyOption = flow.options.some((o) => optionEdits?.[optionKey(flow.id, o.id)])
  if (!title && !anyOption) return flow
  return {
    ...flow,
    ...(title ? { title, kind: `${title} booking` } : {}),
    options: flow.options.map((o) => {
      const e = optionEdits?.[optionKey(flow.id, o.id)]
      return e ? { ...o, ...(e.label ? { label: e.label } : {}), ...(e.note !== undefined ? { note: e.note || undefined } : {}) } : o
    }),
  }
}

const optionOf = (flowId: string, optionId?: string): Option | undefined => (optionId ? flows[flowId]?.options.find((o) => o.id === optionId) : undefined)
const priceTextOf = (o: Option | undefined, price: number) => `${formatGBP(price)}${o?.unit && !o.unit.quoteExtra ? `/${o.unit.label === 'hour' ? 'hr' : o.unit.label}` : ''}`

/** The built-in cards with the studio's changes: wording, price lines, prices and removed cards. */
export function applyCardEdits(cards: CardDef[], o: { edits?: CardEdits; optionEdits?: OptionEdits; overrides?: PriceOverride[] }): CardDef[] {
  const { edits = {}, optionEdits = {}, overrides = [] } = o
  if (!Object.keys(edits).length && !Object.keys(optionEdits).length && !overrides.length) return cards
  const ov = (flowId: string, id?: string) => (id ? overrides.find((r) => r.flow_id === flowId && r.kind === 'option' && r.item_id === id) : undefined)
  const out: CardDef[] = []
  for (const c of cards) {
    if (c.href || c.photoKey) { out.push(c); continue } // shop products and dashboard-added packages are edited elsewhere
    const key = cardKey(c)
    const e = edits[key]
    if (e?.hidden) continue
    let next: CardDef = { ...c, photoKey: key } // the photo stays with the card if it is renamed
    if (e) {
      if (e.title) next.title = e.title
      if (e.description !== undefined) next.description = e.description || undefined
      if (e.priceNote !== undefined) next.priceNote = e.priceNote || undefined
      if (e.bullets) next.bullets = e.bullets.length ? e.bullets : undefined
      if (e.cta) next.cta = e.cta
    }
    if (c.rows?.length) {
      const rows = c.rows.flatMap((r) => {
        if (!r.optionId) return [r]
        const r2 = { ...r }
        const oe = optionEdits[optionKey(c.flowId, r.optionId)]
        if (oe?.label) r2.label = oe.label
        if (oe && oe.note !== undefined) r2.note = oe.note || undefined
        const p = ov(c.flowId, r.optionId)
        if (p && !p.active) return []
        if (p) r2.price = Number(p.price) > 0 ? priceTextOf(optionOf(c.flowId, r.optionId), Number(p.price)) : 'Quoted'
        return [r2]
      })
      // the "From £…" follows the lines' prices once any was changed
      if (overrides.some((r) => r.flow_id === c.flowId && r.kind === 'option') && c.price) {
        const prices = c.rows.filter((r) => r.optionId && rows.some((x) => x.optionId === r.optionId)).map((r) => { const p = ov(c.flowId, r.optionId); return p ? Number(p.price) : optionOf(c.flowId, r.optionId)?.price ?? 0 }).filter((n) => n > 0)
        if (prices.length) next.price = formatGBP(Math.min(...prices))
      }
      if (!rows.some((r) => r.optionId) && c.rows.some((r) => r.optionId)) continue // every price line hidden: nothing left to book
      next = { ...next, rows }
    } else if (c.optionId) {
      // one card per package (Silver, Gold …): its price is its booking option's price
      const p = ov(c.flowId, c.optionId)
      if (p && !p.active) continue
      if (p && c.price) next.price = Number(p.price) > 0 ? formatGBP(Number(p.price)) : next.price
      const oe = optionEdits[optionKey(c.flowId, c.optionId)]
      if (oe?.label && !e?.title) next.title = oe.label
    }
    out.push(next)
  }
  return out
}
