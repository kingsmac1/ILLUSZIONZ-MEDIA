/** The dashboard's live prices (overrides + added packages), fetched once per visit and shared by the cards and the forms. */
import { useEffect, useState } from 'react'
import type { BookingPackage, PriceOverride } from './overrides'
import type { CardPhotos } from './cardPhotos'

export type LivePrices = { overrides: PriceOverride[]; packages: BookingPackage[]; cardPhotos: CardPhotos }
const EMPTY: LivePrices = { overrides: [], packages: [], cardPhotos: {} }

let cache: LivePrices | null = null
let pending: Promise<LivePrices> | null = null

export function loadLivePrices(): Promise<LivePrices> {
  if (cache) return Promise.resolve(cache)
  pending ??= fetch('/api/prices')
    .then((r) => (r.ok ? r.json() : EMPTY))
    .then((d: Partial<LivePrices>) => (cache = { overrides: Array.isArray(d.overrides) ? d.overrides : [], packages: Array.isArray(d.packages) ? d.packages : [], cardPhotos: d.cardPhotos && typeof d.cardPhotos === 'object' && !Array.isArray(d.cardPhotos) ? d.cardPhotos : {} }))
    .catch(() => (cache = EMPTY))
  return pending
}

export function useLivePrices(): LivePrices {
  const [v, setV] = useState<LivePrices>(cache ?? EMPTY)
  useEffect(() => {
    let live = true
    loadLivePrices().then((x) => live && setV(x))
    return () => { live = false }
  }, [])
  return v
}
