/**
 * Card photos chosen in Dashboard → Prices → Card photos. Saved in settings.card_photos as { [cardKey]: url };
 * a card with no entry keeps the photo built into src/booking/cards.ts.
 */
import type { CardDef } from '../components/BookableGrid'

export type CardPhotos = Record<string, string>

const slug = (t: string) => t.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)

/** "wedding:silver-package" for a built-in card, "wedding:added-<id>" for a package added in the dashboard */
export const cardKey = (c: Pick<CardDef, 'flowId' | 'title' | 'photoKey'>) => c.photoKey ?? `${c.flowId}:${slug(c.title)}`

/** only https links and the site's own paths are used as photos (plain http only for a local test server) */
export const PHOTO_URL = /^(https:\/\/|http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/|\/(?!\/))[^\s"'<>]+$/
export const safePhoto = (v: unknown): string => {
  const s = typeof v === 'string' ? v.trim() : ''
  return PHOTO_URL.test(s) ? s : ''
}

export function applyCardPhotos(cards: CardDef[], photos: CardPhotos | undefined): CardDef[] {
  if (!photos || !Object.keys(photos).length) return cards
  return cards.map((c) => {
    const url = safePhoto(photos[cardKey(c)])
    return url ? { ...c, image: url } : c
  })
}
