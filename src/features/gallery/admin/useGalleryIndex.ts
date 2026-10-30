/**
 * Dashboard-wide gallery list + per-gallery counts, loaded separately from the main dashboard data so the rest of the
 * dashboard keeps working even before the gallery tables are installed.
 */
import { useEffect, useSyncExternalStore } from 'react'
import { supabase } from '../../../admin/supabase'
import { isMissingTable } from '../api'
import type { GalleryRow } from '../types'

export type GalleryStats = { gallery_id: string; images_ready: number; images_failed: number; bytes: number; picks: number; notes: number; last_activity: string | null }
type State = { galleries: GalleryRow[]; stats: Map<string, GalleryStats>; loading: boolean; error: string; missing: boolean; loadedAt: number }

let state: State = { galleries: [], stats: new Map(), loading: false, error: '', missing: false, loadedAt: 0 }
const listeners = new Set<() => void>()
const set = (p: Partial<State>) => { state = { ...state, ...p }; listeners.forEach((f) => f()) }
let inflight: Promise<void> | null = null

export function refreshGalleries() {
  if (!supabase) return Promise.resolve()
  inflight ??= (async () => {
    set({ loading: true })
    const [g, s] = await Promise.all([
      supabase!.from('galleries').select('*').order('created_at', { ascending: false }).limit(5000),
      supabase!.rpc('gallery_stats'),
    ])
    const err = g.error?.message || s.error?.message || ''
    set({
      galleries: (g.data ?? []) as GalleryRow[],
      stats: new Map(((s.data ?? []) as GalleryStats[]).map((r) => [r.gallery_id, { ...r, bytes: Number(r.bytes), picks: Number(r.picks), images_ready: Number(r.images_ready), images_failed: Number(r.images_failed), notes: Number(r.notes) }])),
      loading: false, error: isMissingTable(err) ? '' : err, missing: isMissingTable(err), loadedAt: Date.now(),
    })
  })().finally(() => { inflight = null })
  return inflight
}

export function useGalleryIndex() {
  const s = useSyncExternalStore((f) => { listeners.add(f); return () => listeners.delete(f) }, () => state, () => state)
  useEffect(() => { if (!state.loadedAt && !inflight) refreshGalleries() }, [])
  return s
}

/** proof + final gallery of each booking */
export function byBooking(galleries: GalleryRow[]) {
  const m = new Map<string, { proof?: GalleryRow; final?: GalleryRow }>()
  for (const g of galleries) {
    if (!g.booking_id) continue
    const e = m.get(g.booking_id) ?? {}
    e[g.kind] = g
    m.set(g.booking_id, e)
  }
  return m
}
