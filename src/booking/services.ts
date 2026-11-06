/**
 * Packages added to the Photography services page in the dashboard (table booking_services), e.g. Graduate Photography.
 * Each becomes a card like Portrait or Maternity and a booking form with the same questions, add-ons and terms as the
 * other photo shoots. Used by the website (cards + form) and by the server (to re-price the booking), so they agree.
 */
import { LOOKS, flows, formatGBP, type Extra, type Flow } from './catalog'
import type { CardDef } from '../components/BookableGrid'
import { safePhoto } from './cardPhotos'

/** hidden: kept in the dashboard but not offered on the page or the booking form */
export type ServiceOption = { label: string; note?: string; price: number | string; hidden?: boolean }
export type ServiceExtra = { label: string; note?: string; price: number | string; max?: number | string | null; hidden?: boolean }
export type BookingService = {
  id: string
  page: 'photography'
  title: string
  description?: string | null
  options: ServiceOption[] | null
  cta?: string | null
  /** the most looks a client can choose (1 = no looks counter); the price is for one look */
  max_looks?: number | null
  /** the package's own add-ons */
  extras?: ServiceExtra[] | null
  /** also offer the usual photo add-ons (extra edited pictures, express turnaround …) */
  standard_extras?: boolean | null
  sort_order?: number | null
  active: boolean
}

export const SERVICE_PAGES = { photography: 'Photography services' } as const
export const serviceFlowId = (s: Pick<BookingService, 'id'>) => `svc-${s.id}`
export const isServiceFlowId = (v: unknown): v is string => typeof v === 'string' && /^svc-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
/** the photo key of a service's card (settings.card_photos) */
export const servicePhotoKey = (s: Pick<BookingService, 'id'>) => `service:${s.id}`

// a line's number counts the lines before it with a name (hidden ones too), so hiding a line never renumbers the others
const cleanOptions = (s: BookingService) => {
  let n = 0
  return (Array.isArray(s.options) ? s.options : [])
    .map((o) => ({ label: String(o?.label ?? '').trim().slice(0, 120), note: String(o?.note ?? '').trim().slice(0, 200), price: Math.max(0, Math.round((Number(o?.price) || 0) * 100) / 100), hidden: o?.hidden === true }))
    .filter((o) => o.label)
    .map((o) => ({ ...o, n: ++n }))
    .filter((o) => !o.hidden)
}

const maxLooks = (s: BookingService) => Math.min(20, Math.max(1, Math.round(Number(s.max_looks ?? 5)) || 5))

/** the package's own add-ons, cleaned; ids are stable by position */
export const serviceExtras = (s: BookingService): Extra[] =>
  (Array.isArray(s.extras) ? s.extras : [])
    .map((e, n) => {
      if (e?.hidden === true) return { id: '', label: '', price: 0 }
      const price = Math.max(0, Math.round((Number(e?.price) || 0) * 100) / 100)
      const max = Math.round(Number(e?.max) || 0)
      return { id: `${serviceFlowId(s)}-x${n + 1}`, label: String(e?.label ?? '').trim().slice(0, 120), note: String(e?.note ?? '').trim().slice(0, 200) || undefined, price, max: max > 1 ? Math.min(max, 100) : undefined, priceNote: price > 0 ? undefined : 'Quoted' }
    })
    .filter((e) => e.label)

/** The booking form for a service: the Portrait form's questions and terms, with the service's own prices and add-ons. */
export function serviceFlow(s: BookingService): Flow {
  const base = flows.portrait
  const id = serviceFlowId(s)
  const title = s.title.trim()
  const looks = maxLooks(s)
  return {
    ...base,
    id,
    kind: `${title} booking`,
    title,
    intro: s.description?.trim() || base.intro,
    options: cleanOptions(s).map((o) => ({ id: `${id}-${o.n}`, label: o.label, price: o.price, note: o.note || undefined, unit: looks > 1 ? LOOKS(looks) : undefined })),
    extras: [...serviceExtras(s), ...(s.standard_extras === false ? [] : base.extras)],
  }
}

/** The card on the page, in the same style as Portrait, Maternity …: photo, "From £…", a line per price. */
export function serviceCard(s: BookingService, photo: string | undefined): CardDef {
  const flow = serviceFlow(s)
  const priced = flow.options.filter((o) => o.price > 0)
  const from = priced.length ? Math.min(...priced.map((o) => o.price)) : 0
  return {
    flowId: flow.id,
    optionId: flow.options[0]?.id,
    photoKey: servicePhotoKey(s),
    title: flow.title,
    image: photo || undefined,
    fromLabel: from && (flow.options.length > 1 || maxLooks(s) > 1) ? 'From' : undefined,
    price: from ? formatGBP(from) : undefined,
    quoteLabel: from ? undefined : 'Price on request',
    description: s.description?.trim() || undefined,
    rows: [
      ...flow.options.map((o) => ({ label: o.label, note: o.note, price: o.price > 0 ? formatGBP(o.price) : 'Quoted', optionId: o.id })),
      ...(maxLooks(s) > 1 ? [{ label: 'More looks?', note: 'Choose how many when you book. We agree the price for extra looks with you on WhatsApp.' }] : []),
    ],
    cta: s.cta?.trim() || 'Book this shoot',
  }
}

/** a page's added services, shown ones only, in order */
export const servicesFor = (page: string | undefined, services: BookingService[] | undefined) =>
  (services ?? []).filter((s) => s.page === page && s.active && s.title?.trim() && cleanOptions(s).length).sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0))

/** Adds the page's services after its own cards. */
export function withServices(cards: CardDef[], page: string | undefined, services: BookingService[] | undefined, photos: Record<string, string> = {}): CardDef[] {
  const mine = servicesFor(page, services)
  return mine.length ? [...cards, ...mine.map((s) => serviceCard(s, safePhoto(photos[servicePhotoKey(s)])))] : cards
}
