/** Full-screen viewer: swipe on phones, arrow keys on desktop, pinch/scroll zoom, heart + note (proofs) or download (finals). */
import { useMemo, useState } from 'react'
import YarLightbox from 'yet-another-react-lightbox'
import Zoom from 'yet-another-react-lightbox/plugins/zoom'
import 'yet-another-react-lightbox/styles.css'
import { galleryConfig } from '../gallery.config'
import type { ViewImage } from '../types'
import { DownloadIcon, Heart } from './icons'

export function Lightbox({ images, index, onClose, proof, picks, locked, onToggle, onNote, onDownload }: {
  images: ViewImage[]
  index: number
  onClose: () => void
  proof: boolean
  picks: Map<string, string | null>
  locked: boolean
  onToggle: (id: string) => void
  onNote: (id: string) => void
  onDownload?: (id: string) => void
}) {
  const [cur, setCur] = useState(index)
  const slides = useMemo(() => images.map((img) => {
    const w = img.width || 1500
    const h = img.height || 1000
    const s = Math.min(1, (proof ? galleryConfig.images.previewEdge : galleryConfig.images.webEdge) / Math.max(w, h))
    const t = Math.min(1, galleryConfig.images.thumbEdge / Math.max(w, h))
    return {
      src: img.display ?? img.thumb ?? '', alt: img.filename, width: Math.round(w * s), height: Math.round(h * s),
      srcSet: img.thumb && img.display ? [{ src: img.thumb, width: Math.round(w * t), height: Math.round(h * t) }, { src: img.display, width: Math.round(w * s), height: Math.round(h * s) }] : undefined,
    }
  }), [images, proof])
  const img = images[cur]
  const picked = img ? picks.has(img.id) : false
  const note = img ? picks.get(img.id) : null

  const buttons = [
    proof && img && (
      <button key="heart" type="button" className={'yarl__button cg-lb-heart' + (picked ? ' on' : '')} aria-pressed={picked} aria-label={picked ? 'Remove from my picks' : 'Pick this photo'} disabled={locked && !picked} onClick={() => onToggle(img.id)}>
        <Heart filled={picked} />
      </button>
    ),
    proof && img && (
      <button key="note" type="button" className={'yarl__button cg-lb-note' + (note ? ' on' : '')} aria-label={note ? 'Read or edit your note' : 'Add a note'} disabled={locked && !note} onClick={() => onNote(img.id)}>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z" />{note ? <path d="M8 9h8M8 12h5" /> : null}</svg>
      </button>
    ),
    !proof && img && onDownload && (
      <button key="dl" type="button" className="yarl__button" aria-label={`Download ${img.filename}`} onClick={() => onDownload(img.id)}><DownloadIcon /></button>
    ),
    'close',
  ].filter(Boolean)

  return (
    <YarLightbox
      open
      close={onClose}
      index={index}
      slides={slides}
      plugins={[Zoom]}
      zoom={{ maxZoomPixelRatio: 2, scrollToZoom: true }}
      carousel={{ preload: 2, finite: false }}
      controller={{ closeOnBackdropClick: true }}
      animation={{ fade: 200, swipe: 260 }}
      on={{ view: ({ index: i }) => setCur(i) }}
      toolbar={{ buttons }}
      className={'cg-lb' + (proof ? ' proof' : '')}
      styles={{ container: { backgroundColor: 'rgba(0,0,0,.97)' } }}
      render={{
        slideFooter: ({ slide }) => {
          const i = slides.indexOf(slide as (typeof slides)[number])
          const im = images[i]
          if (!im) return null
          return (
            <div className="cg-lb-foot">
              <span>{im.filename}</span>
              <span>{i + 1} / {images.length}</span>
              {proof && picks.get(im.id) ? <em>“{picks.get(im.id)}”</em> : null}
            </div>
          )
        },
      }}
    />
  )
}
