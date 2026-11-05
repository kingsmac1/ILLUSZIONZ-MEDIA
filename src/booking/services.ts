/**
 * Packages added to the Photography services page in the dashboard (table booking_services), e.g. Graduate Photography.
 * Each becomes a card like Portrait or Maternity and a booking form with the same questions, add-ons and terms as the
 * other photo shoots. Used by the website (cards + form) and by the server (to re-price the booking), so they agree.
 */
import { flows, formatGBP, type Flow } from './catalog'
import type { CardDef } from '../components/BookableGrid'
import { safePhoto } from './cardPhotos'

export type ServiceOption = { label: string; note?: string; price: number | string }
export type BookingService = {
  id: string
  page: 'photography'
  title: string
  description?: string | null
  options: ServiceOption[] | null
  cta?: string | null
  sort_order?: number | null
  active: boolean
}

export const SERVICE_PAGES = { photography: 'Photography services' } as const
export const serviceFlowId = (s: Pick<BookingService, 'id'>) => `svc-${s.id}`
export const isServiceFlowId = (v: unknown): v is string => typeof v === 'string' && /^svc-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
/** the photo key of a service's card (settings.card_photos) */
export const servicePhotoKey = (s: Pick<BookingService, 'id'>) => `service:${s.id}`

const cleanOptions = (s: BookingService) =>
  (Array.isArray(s.options) ? s.options : [])
    .map((o) => ({ label: String(o?.label ?? '').trim().slice(0, 120), note: String(o?.note ?? '').trim().slice(0, 200), price: Math.max(0, Math.round((Number(o?.price) || 0) * 100) / 100) }))
    .filter((o) => o.label)

/** The booking form for a service: the Portrait form's questions, add-ons and terms, with the service's own prices. */
export function serviceFlow(s: BookingService): Flow {
  const base = flows.portrait
  const id = serviceFlowId(s)
  const title = s.title.trim()
  return {
    ...base,
    id,
    kind: `${title} booking`,
    title,
    intro: s.description?.trim() || base.intro,
    options: cleanOptions(s).map((o, n) => ({ id: `${id}-${n + 1}`, label: o.label, price: o.price, note: o.note || undefined })),
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
    fromLabel: from && flow.options.length > 1 ? 'From' : undefined,
    price: from ? formatGBP(from) : undefined,
    quoteLabel: from ? undefined : 'Price on request',
    description: s.description?.trim() || undefined,
    rows: flow.options.map((o) => ({ label: o.label, note: o.note, price: o.price > 0 ? formatGBP(o.price) : 'Quoted', optionId: o.id })),
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
