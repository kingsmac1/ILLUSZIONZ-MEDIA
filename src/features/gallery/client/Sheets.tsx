/** Bottom sheets / dialogs of the client gallery: note editor, submit review, success + WhatsApp hand-off. */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { ViewImage } from '../types'

/**
 * `inside`: render into this element instead of the page — used over the lightbox, which makes everything outside itself
 * inert. Keys and pointer events stop here so typing ← → in a note doesn't change the photo.
 */
function Sheet({ title, onClose, children, wide, inside }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean; inside?: Element | null }) {
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    box.current?.querySelector<HTMLElement>('textarea, button.cg-btn, [autofocus]')?.focus()
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = overflow; prev?.focus?.() }
  }, [])
  const ui = (
    <div
      className="cg-sheet-wrap cg"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape') onClose() }}
      onPointerDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      <div className={'cg-sheet' + (wide ? ' wide' : '')} role="dialog" aria-modal="true" aria-label={title} ref={box}>
        <div className="cg-sheet-h">
          <h2>{title}</h2>
          <button className="cg-x" onClick={onClose} aria-label="Close">×</button>
        </div>
        {children}
      </div>
    </div>
  )
  return inside ? createPortal(ui, inside) : ui
}

export function NoteSheet({ filename, initial, readOnly, onClose, onSave, inside }: { filename: string; initial: string; readOnly: boolean; onClose: () => void; onSave: (t: string) => void; inside?: Element | null }) {
  const [t, setT] = useState(initial)
  return (
    <Sheet title={readOnly ? 'Your note' : 'Note for the editor'} onClose={onClose} inside={inside}>
      <p className="cg-sheet-sub">{filename}</p>
      <textarea rows={4} value={t} readOnly={readOnly} maxLength={1000} onChange={(e) => setT(e.target.value)} placeholder="e.g. Please remove the person in the background, or make this one black & white." />
      {!readOnly && (
        <div className="cg-sheet-f">
          <button className="cg-btn line" onClick={onClose}>Cancel</button>
          <button className="cg-btn solid" onClick={() => onSave(t)}>{initial ? 'Save note' : 'Pick photo and save note'}</button>
        </div>
      )}
    </Sheet>
  )
}

export function SubmitSheet({ images, picks, limit, extrasNote, onClose, onSubmit, onNote }: {
  images: ViewImage[]
  picks: Map<string, string | null>
  limit: number | null
  extrasNote: string | null
  onClose: () => void
  onSubmit: () => Promise<boolean>
  onNote: (id: string) => void
}) {
  const [busy, setBusy] = useState(false)
  const n = images.length
  const notes = images.filter((i) => picks.get(i.id)).length
  const left = limit ? limit - n : 0
  return (
    <Sheet title={`Send ${n} photo${n === 1 ? '' : 's'} for editing?`} onClose={onClose} wide>
      <p className="cg-sheet-sub">
        {limit && left > 0 ? `You can still pick ${left} more. You can submit now anyway.` : limit && left < 0 ? `That’s ${-left} more than the ${limit} included.${extrasNote ? ` ${extrasNote}` : ''}` : 'Check your picks, then send them to us.'}
        {notes ? ` ${notes} with a note.` : ''} Once sent, your selection is locked while we edit.
      </p>
      <div className="cg-review">
        {images.map((i) => (
          <figure key={i.id}>
            {i.thumb ? <img src={i.thumb} alt={i.filename} loading="lazy" draggable={false} /> : null}
            <figcaption>
              <span>{i.filename}</span>
              <button className="cg-link" onClick={() => onNote(i.id)}>{picks.get(i.id) ? `“${picks.get(i.id)}”` : 'Add note'}</button>
            </figcaption>
          </figure>
        ))}
      </div>
      <div className="cg-sheet-f">
        <button className="cg-btn line" onClick={onClose}>Keep picking</button>
        <button className="cg-btn solid red" disabled={busy || !n} onClick={async () => { setBusy(true); await onSubmit(); setBusy(false) }}>{busy ? 'Sending…' : `Submit ${n} photo${n === 1 ? '' : 's'}`}</button>
      </div>
    </Sheet>
  )
}

/** After a successful submit: confirmation, then WhatsApp opens with a pre-filled message (the client still taps Send). */
export function SuccessScreen({ count, whatsappUrl, onClose }: { count: number; whatsappUrl: string; onClose: () => void }) {
  const [left, setLeft] = useState(3)
  useEffect(() => {
    // window.location (not window.open): popup blockers stop window.open after an async call
    const t = setTimeout(() => { window.location.href = whatsappUrl }, 1200)
    const i = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 400)
    return () => { clearTimeout(t); clearInterval(i) }
  }, [whatsappUrl])
  return (
    <div className="cg-success" role="alertdialog" aria-labelledby="cg-success-h">
      <div>
        <h2 id="cg-success-h">Selection sent! 🎉</h2>
        <p>We’ve received your {count} photo{count === 1 ? '' : 's'} and emailed you a confirmation. We’ll let you know when your edited photos are ready.</p>
        <p className="cg-success-wa">{left ? 'Opening WhatsApp so you can let us know…' : 'Tap Send in WhatsApp to message us.'}</p>
        <div className="cg-sheet-f center">
          <a className="cg-btn solid" href={whatsappUrl}>Open WhatsApp</a>
          <button className="cg-btn line light" onClick={onClose}>Back to the gallery</button>
        </div>
      </div>
    </div>
  )
}
