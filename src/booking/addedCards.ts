/**
 * Puts the packages added in Dashboard → Prices onto a page's price cards.
 *  - a page whose card lists its packages as rows (Portrait: 1 Look, 2 Looks …) gets one more row on that card
 *  - a page with one card per package (Wedding: Silver, Gold …) gets one more card, with the page's first photo
 */
import { formatGBP, type Option } from './catalog'
import { addedFor, packageItemId, packageToOption, type BookingPackage } from './overrides'
import type { CardDef } from '../components/BookableGrid'

const priceText = (o: Option) => (o.price > 0 ? `${formatGBP(o.price)}${o.unit && !o.unit.quoteExtra ? ` / ${o.unit.label}` : ''}` : undefined)
/** "Book Gold" style buttons name their package, so a new card gets a plain one instead */
const genericCta = (cta: string, title: string) => (/^book\b/i.test(cta) && !/this|now/i.test(cta) && cta.toLowerCase().includes(title.toLowerCase().split(' ')[0]) ? 'Book now' : cta)

export function withAddedPackages(cards: CardDef[], packages: BookingPackage[] | undefined): CardDef[] {
  if (!packages?.length) return cards
  const out = [...cards]
  for (const flowId of [...new Set(cards.filter((c) => !c.href).map((c) => c.flowId))]) {
    const added = addedFor(flowId, packages, 'option').map(packageToOption)
    if (!added.length) continue
    const mine = out.map((c, i) => ({ c, i })).filter(({ c }) => c.flowId === flowId && !c.href)
    const withRows = mine.filter(({ c }) => c.rows?.length)
    if (withRows.length) {
      const { c, i } = withRows[withRows.length - 1]
      out[i] = { ...c, rows: [...(c.rows ?? []), ...added.map((o) => ({ label: o.label, note: o.note, price: priceText(o) ?? 'Quoted', optionId: o.id }))] }
      continue
    }
    const first = mine[0].c
    const at = mine[mine.length - 1].i + 1
    const descriptionOf = (id: string) => packages.find((p) => packageItemId(p) === id)?.description?.trim() || undefined
    const extra: CardDef[] = added.map((o) => ({
      flowId,
      optionId: o.id,
      photoKey: `${flowId}:${o.id}`,
      title: o.label,
      image: first.image,
      price: priceText(o),
      priceNote: o.price > 0 && !o.unit ? o.note : undefined,
      quoteLabel: o.price > 0 ? undefined : first.quoteLabel || 'Price on request',
      description: descriptionOf(o.id) ?? (o.price > 0 && !o.unit ? undefined : o.note),
      bullets: o.includes?.length ? o.includes : undefined,
      cta: o.price > 0 ? genericCta(first.cta, first.title) : first.quoteLabel ? first.cta : 'Get a quote',
    }))
    out.splice(at, 0, ...extra)
  }
  return out
}
