import { useCallback, useEffect, useRef, useState } from 'react'

export type GalleryImage = { href: string; thumb: string; w: number; h: number; alt: string }

/**
 * Distribute items into the shortest column (same rule as a masonry layout).
 * Heights are rounded up to whole pixels so near-ties resolve to the left-most column (fallback when no placement is given).
 */
function columnsFor(images: GalleryImage[], count: number, containerWidth: number, gap: number) {
  const colWidth = (containerWidth - gap * (count - 1)) / count
  const cols: { item: GalleryImage; index: number }[][] = Array.from({ length: count }, () => [])
  const heights = new Array(count).fill(0)
  images.forEach((item, index) => {
    const px = Math.ceil(colWidth * (item.w && item.h ? item.h / item.w : 1))
    let c = 0
    for (let i = 1; i < count; i++) if (heights[i] < heights[c]) c = i
    cols[c].push({ item, index })
    heights[c] += px + gap
  })
  return cols
}

/** placement[i][n] = column of image n in the desktop (0) / tablet (1) / mobile (2) layout, as laid out on the original site. */
function columnsFromPlacement(images: GalleryImage[], count: number, cols: number[]) {
  const out: { item: GalleryImage; index: number }[][] = Array.from({ length: count }, () => [])
  images.forEach((item, index) => out[Math.min(cols[index] ?? 0, count - 1)].push({ item, index }))
  return out
}

type Props = { images: GalleryImage[]; className?: string; columns?: [number, number, number]; gap?: number; placement?: number[][] }

export function Gallery({ images, className, columns = [3, 2, 2], gap = 10, placement }: Props) {
  const GAP = gap
  const wrapRef = useRef<HTMLDivElement>(null)
  // container width used for the layout maths (a typical value until measured in the browser)
  const [width, setWidth] = useState(1140)
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const update = () => setWidth(el.clientWidth || 1140)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const [current, setCurrent] = useState<number | null>(null)
  const close = useCallback(() => setCurrent(null), [])
  const step = useCallback(
    (d: number) => setCurrent((c) => (c === null ? c : (c + d + images.length) % images.length)),
    [images.length],
  )

  useEffect(() => {
    if (current === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      else if (e.key === 'ArrowRight') step(1)
      else if (e.key === 'ArrowLeft') step(-1)
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [current, close, step])

  const layout = (count: number, cls: string, which: number) => (
    <div className={`gallery__cols ${cls}`} style={{ gap: GAP }}>
      {(placement?.[which] ? columnsFromPlacement(images, count, placement[which]) : columnsFor(images, count, width, GAP)).map((col, ci) => (
        <div className="gallery__col" key={ci} style={{ gap: GAP }}>
          {col.map(({ item, index }) => (
            <a
              key={index}
              href={item.href}
              className="gallery__item"
              style={{ aspectRatio: item.w && item.h ? `${item.w} / ${item.h}` : undefined }}
              onClick={(e) => { e.preventDefault(); setCurrent(index) }}
            >
              <img src={item.thumb} alt={item.alt} loading="lazy" decoding="async" />
              <span className="gallery__overlay" />
            </a>
          ))}
        </div>
      ))}
    </div>
  )

  return (
    <div className={className}>
      <div className="gallery" ref={wrapRef}>
        {layout(columns[0], 'gallery__cols--d', 0)}
        {layout(columns[1], 'gallery__cols--t', 1)}
        {layout(columns[2], 'gallery__cols--m', 2)}
      </div>
      {current !== null && (
        <Lightbox images={images} index={current} onClose={close} onStep={step} />
      )}
    </div>
  )
}

const Icon = ({ d, size = '1em' }: { d: string; size?: string }) => (
  <svg viewBox="0 0 1000 1000" width={size} height={size} fill="currentColor" aria-hidden="true"><path d={d} /></svg>
)
const ICONS = {
  close: 'M742 167L500 408 258 167C246 154 233 150 217 150 196 150 179 158 167 167 154 179 150 196 150 212 150 229 154 242 171 254L408 500 167 742C138 771 138 800 167 829 196 858 225 858 254 829L496 587 738 829C750 842 767 846 783 846 800 846 817 842 829 829 842 817 846 804 846 783 846 767 842 750 829 737L588 500 833 258C863 229 863 200 833 171 804 142 775 142 746 171L742 167Z',
  prev: 'M646 125C629 125 613 133 604 142L308 442C296 454 292 471 292 487 292 504 296 521 308 533L604 854C617 867 629 875 646 875 663 875 679 871 692 858 704 846 713 829 713 812 713 796 708 779 692 767L438 487 692 225C700 217 708 204 708 187 708 171 704 154 692 142 679 129 663 125 646 125Z',
  next: 'M696 533C708 521 713 504 713 487 713 471 708 454 696 442L400 142C388 129 371 125 354 125 338 125 321 129 308 142 296 154 292 171 292 187 292 204 296 217 308 225L563 487 308 767C296 779 292 796 292 812 292 829 296 846 308 858 321 871 338 875 354 875 371 875 388 867 400 854L696 533Z',
  zoom: 'M850 804L679 633C723 576 750 504 750 425 750 242 600 92 417 92 233 92 83 242 83 425 83 608 233 758 417 758 496 758 567 731 625 688L796 858C804 867 817 871 829 871 842 871 854 867 862 858 879 842 879 821 862 804L850 804ZM417 675C279 675 167 563 167 425 167 288 279 175 417 175 554 175 667 288 667 425 667 563 554 675 417 675ZM458 258L375 258 375 383 250 383 250 467 375 467 375 592 458 592 458 467 583 467 583 383 458 383 458 258Z',
  fullscreen: 'M125 125L125 375 208 375 208 208 375 208 375 125 125 125ZM625 125L625 208 792 208 792 375 875 375 875 125 625 125ZM125 625L125 875 375 875 375 792 208 792 208 625 125 625ZM792 625L792 792 625 792 625 875 875 875 875 625 792 625Z',
  share: 'M792 458L792 292 1000 500 792 708 792 542C500 542 292 625 125 833 167 542 333 333 792 458Z',
}

function Lightbox({ images, index, onClose, onStep }: { images: GalleryImage[]; index: number; onClose: () => void; onStep: (d: number) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(false)
  const [share, setShare] = useState(false)
  const img = images[index]
  const page = typeof window !== 'undefined' ? window.location.href : ''
  const abs = typeof window !== 'undefined' ? new URL(img.href, window.location.origin).href : img.href
  useEffect(() => { setZoom(false) }, [index])
  const title = img.alt
  return (
    <div className="lightbox" role="dialog" aria-modal="true" ref={ref} onClick={onClose}>
      <div className="lightbox__bar" onClick={(e) => e.stopPropagation()}>
        <span className="lightbox__count">{index + 1} / {images.length}</span>
        <span className="lightbox__tools">
          <button aria-label="Fullscreen" onClick={() => (document.fullscreenElement ? document.exitFullscreen() : ref.current?.requestFullscreen?.())}><Icon d={ICONS.fullscreen} /></button>
          <button aria-label="Zoom" onClick={() => setZoom((z) => !z)}><Icon d={ICONS.zoom} /></button>
          <span className="lightbox__share">
            <button aria-label="Share" onClick={() => setShare((s) => !s)}><Icon d={ICONS.share} /></button>
            {share && (
              <span className="lightbox__share-menu">
                <a href={`https://www.facebook.com/sharer.php?u=${encodeURIComponent(page)}`} target="_blank" rel="noreferrer">Share on Facebook</a>
                <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(page)}`} target="_blank" rel="noreferrer">Tweet</a>
                <a href={`https://www.pinterest.com/pin/create/button/?url=${encodeURIComponent(page)}&media=${encodeURIComponent(abs)}`} target="_blank" rel="noreferrer">Pin it</a>
                <a href={img.href} download>Download image</a>
              </span>
            )}
          </span>
          <button aria-label="Close" onClick={onClose}><Icon d={ICONS.close} /></button>
        </span>
      </div>
      {images.length > 1 && (
        <>
          <button className="lightbox__nav lightbox__nav--prev" aria-label="Previous" onClick={(e) => { e.stopPropagation(); onStep(-1) }}><Icon d={ICONS.prev} /></button>
          <button className="lightbox__nav lightbox__nav--next" aria-label="Next" onClick={(e) => { e.stopPropagation(); onStep(1) }}><Icon d={ICONS.next} /></button>
        </>
      )}
      <img className={'lightbox__img' + (zoom ? ' is-zoomed' : '')} src={img.href} alt={img.alt} onClick={(e) => { e.stopPropagation(); setZoom((z) => !z) }} />
      {title && <div className="lightbox__title">{title}</div>}
    </div>
  )
}
