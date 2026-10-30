/** Cover thumbnail + photo count for a gallery card (cached for the session; signed URLs last 6 hours). */
import { useEffect, useState } from 'react'
import { callFn } from './api'
import type { ViewResponse } from './types'

type Cover = { url: string | null; total: number }
const cache = new Map<string, Promise<Cover>>()

export function useCover(galleryId: string, enabled = true) {
  const [cover, setCover] = useState<Cover | null>(null)
  useEffect(() => {
    if (!enabled) return
    let live = true
    if (!cache.has(galleryId)) {
      cache.set(galleryId, callFn<ViewResponse>('gallery-view-urls', { gallery_id: galleryId, cover_only: true }).then((r) => (r.ok ? { url: r.cover?.url ?? null, total: r.total ?? 0 } : { url: null, total: 0 })))
    }
    cache.get(galleryId)!.then((c) => live && setCover(c))
    return () => { live = false }
  }, [galleryId, enabled])
  return cover
}
