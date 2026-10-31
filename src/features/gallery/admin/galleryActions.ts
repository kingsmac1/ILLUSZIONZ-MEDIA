/** Gallery actions shared by the Galleries page (one card or many) and the Bookings page (deleting a booking). */
import { supabase } from '../../../admin/supabase'
import { callFn } from '../api'
import { refreshGalleries } from './useGalleryIndex'

/** Deletes whole galleries: their photos in storage and their rows (picks, notes, feedback go with them). */
export async function deleteGalleries(ids: string[]) {
  const errors: string[] = []
  for (const id of ids) {
    const r = await callFn('gallery-delete', { gallery_id: id })
    if (!r.ok) errors.push(r.error)
  }
  await refreshGalleries()
  return { deleted: ids.length - errors.length, errors }
}

/** The galleries that belong to these bookings. */
export async function galleriesOfBookings(bookingIds: string[]): Promise<string[]> {
  if (!bookingIds.length || !supabase) return []
  const { data } = await supabase.from('galleries').select('id').in('booking_id', bookingIds)
  return (data ?? []).map((g: { id: string }) => g.id)
}

/** Sends the "your previews are waiting" reminder for each gallery still open for picks. */
export async function remindGalleries(ids: string[]) {
  const errors: string[] = []
  for (const id of ids) {
    const r = await callFn('gallery-send', { gallery_id: id, reminder: true })
    if (!r.ok) errors.push(r.error)
  }
  await refreshGalleries()
  return { sent: ids.length - errors.length, errors }
}

/** Keeps previews 30 more days (from today, or from their current date if later). */
export async function extendPreviewsMany(rows: { id: string; previews_purge_at: string | null }[]) {
  const errors: string[] = []
  for (const g of rows) {
    const from = Math.max(Date.now(), new Date(g.previews_purge_at ?? Date.now()).getTime())
    const { error } = await supabase!.from('galleries').update({ previews_purge_at: new Date(from + 30 * 86_400_000).toISOString() }).eq('id', g.id)
    if (error) errors.push(error.message)
  }
  await refreshGalleries()
  return { done: rows.length - errors.length, errors }
}
