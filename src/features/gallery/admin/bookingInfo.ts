/** Defaults the Gallery Manager takes from a booking: title and the number of photos the package includes. */
import { flows } from '../../../booking/catalog'
import { fmtDay } from '../status'

type Booking = Record<string, any>

export const shootName = (b: Booking) => String(b.kind ?? 'Photo shoot').replace(/ booking$/i, '')

export const defaultTitle = (b: Booking, kind: 'proof' | 'final') =>
  `${shootName(b)}${b.event_date ? ` — ${fmtDay(b.event_date)}` : ''}${kind === 'final' ? ' · Final photos' : ''}`

/**
 * Photos included in the booked package, e.g. "4 edited pictures" (1 Look), "7 images per look" × looks,
 * plus any "extra edited pictures" add-on. null = no number found (unlimited, set it by hand).
 */
export function suggestLimit(b: Booking): number | null {
  const flow = flows[b.flow_id as string]
  const sel = (b.selection ?? {}) as { optionIds?: string[]; units?: Record<string, number>; extras?: Record<string, number> }
  let total = 0
  for (const id of sel.optionIds ?? []) {
    const opt = flow?.options.find((o) => o.id === id)
    if (!opt) continue
    const text = `${opt.note ?? ''} ${(opt.includes ?? []).join(' ')}`
    const qty = sel.units?.[id] ?? 1
    const perLook = /(\d+)\s*(?:edited\s+)?(?:pictures|images|photos)\s+per\s+look/i.exec(text)
    if (perLook) {
      const looks = /(\d+)\s*looks?/i.exec(opt.label)?.[1]
      total += Number(perLook[1]) * (opt.unit ? qty : Number(looks ?? 1))
      continue
    }
    const flat = /(\d+)\s*(?:edited\s+)?(?:pictures|images|photos)(?!\s*\))/i.exec(text)
    if (flat) total += Number(flat[1]) * (opt.unit ? qty : 1)
  }
  total += Number(sel.extras?.['extra-images'] ?? 0)
  if (!total) {
    // manual bookings: look in the typed package text ("2 Looks + 10 edited pictures")
    const m = /(\d+)\s*(?:edited\s+)?(?:pictures|images|photos)/i.exec(String(b.packages ?? ''))
    if (m) total = Number(m[1])
  }
  return total || null
}
