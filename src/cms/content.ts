import { useEffect, useState } from 'react'

export type CmsImage = { id: string; section: string; url: string; thumb_url: string; alt: string; width: number; height: number }
export type SiteContent = {
  managed: Record<string, boolean>
  notice: { enabled: boolean; text: string; link: string; label: string; tone: 'dark' | 'light' | 'gold' } | null
  store: { id: string; title: string; description: string; bullets: string[]; image_url: string; price: string; price_note: string; cta: string; flow_id: string; option_id: string; buy_url: string }[]
  testimonials: { id: string; quote: string; author: string; role: string }[]
  images: Record<string, CmsImage[]>
}

let pending: Promise<SiteContent | null> | null = null
/** One shared request for all components; failures fall back to the built-in content. */
export function loadContent(): Promise<SiteContent | null> {
  if (!pending) pending = fetch('/api/content').then((r) => (r.ok ? (r.json() as Promise<SiteContent>) : null)).catch(() => null)
  return pending
}

export function useContent(): SiteContent | null {
  const [c, setC] = useState<SiteContent | null>(null)
  useEffect(() => {
    let live = true
    loadContent().then((x) => live && setC(x))
    return () => { live = false }
  }, [])
  return c
}

export const toGallery = (list: CmsImage[]) => list.map((i) => ({ href: i.url, thumb: i.thumb_url || i.url, w: i.width || 1200, h: i.height || 1200, alt: i.alt || '' }))

/** Like useContent, plus whether the answer is in (or we gave up waiting), so pages can avoid flashing built-in content that is about to be replaced. */
export function useContentSettled(maxWaitMs = 900): [SiteContent | null, boolean] {
  const c = useContent()
  const [late, setLate] = useState(false)
  useEffect(() => { const t = setTimeout(() => setLate(true), maxWaitMs); return () => clearTimeout(t) }, [maxWaitMs])
  return [c, c !== null || late]
}
