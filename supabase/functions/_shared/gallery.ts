/** Gallery constants + links. Keep PURGE_DAYS in sync with src/features/gallery/gallery.config.ts. */
import type { Gallery } from './auth.ts'
import { mailConfig } from './email.ts'

/** Watermarked previews are deleted this many days after the finals are delivered. */
export const PURGE_DAYS = 30
export const PAGE_SIZE = 200
/** At most this many files per upload-URL request (the browser asks in batches). */
export const MAX_FILES_PER_CALL = 50

/** The private link emailed to the client: opens the gallery without signing in. */
export const clientLink = (g: Pick<Gallery, 'id' | 'share_token'>) => `${mailConfig().siteUrl}/gallery/${g.id}/?k=${g.share_token}`
export const adminLink = (g: Pick<Gallery, 'booking_id'>) =>
  `${mailConfig().siteUrl}/dashboard/#/${g.booking_id ? `bookings/${g.booking_id}/gallery` : 'galleries'}`

export const OPEN_FOR_PICKS = ['sent', 'viewed', 'selecting']

export const addDays = (iso: string, days: number) => new Date(new Date(iso).getTime() + days * 86_400_000).toISOString()
