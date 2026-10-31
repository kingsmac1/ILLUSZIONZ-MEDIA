/** Bottom sheets / dialogs of the client gallery: note editor, submit review, success + WhatsApp hand-off, save-to-account. */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { ViewImage } from '../types'
import { AuthPanel, type AuthMode } from '../../account/AuthPanel'

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

const money = (n: number) => `£${Number.isInteger(n) ? n : n.toFixed(2)}`

export function SubmitSheet({ images, picks, limit, extrasNote, uneditedPrice, onClose, onSubmit, onNote }: {
  images: ViewImage[]
  picks: Map<string, string | null>
  limit: number | null
  extrasNote: string | null
  /** the studio offers "all unedited images" on this gallery for this price (null = not offered) */
  uneditedPrice: number | null
  onClose: () => void
  onSubmit: (o: { wantsUnedited: boolean }) => Promise<boolean>
  onNote: (id: string) => void
}) {
  const [busy, setBusy] = useState(false)
  const [unedited, setUnedited] = useState(false)
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
      <div className="cg-summary" aria-live="polite">
        <div className="cg-summary-row"><span>Photos for editing</span><b>{n}{limit ? ` of ${limit}` : ''}</b></div>
        {uneditedPrice != null && (
          <label className={'cg-unedited' + (unedited ? ' on' : '')}>
            <input type="checkbox" checked={unedited} onChange={(e) => setUnedited(e.target.checked)} />
            <span><b>I want all unedited images</b><small>Every photo from the shoot, as shot, in full resolution, delivered with your edited photos.</small></span>
            <em>{money(uneditedPrice)}</em>
          </label>
        )}
        {unedited && uneditedPrice != null && <div className="cg-summary-row total"><span>To pay for the unedited images</span><b>{money(uneditedPrice)}</b></div>}
      </div>
      <div className="cg-sheet-f">
        <button className="cg-btn line" onClick={onClose}>Keep picking</button>
        <button className="cg-btn solid red" disabled={busy || !n} onClick={async () => { setBusy(true); await onSubmit({ wantsUnedited: unedited }); setBusy(false) }}>{busy ? 'Sending…' : `Submit ${n} photo${n === 1 ? '' : 's'}`}</button>
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

/**
 * "Keep your photos": nudges a visitor who came in by the emailed link to create an account (or sign in), so this gallery
 * and every later one stay in their client area. Never required — "Not now" just closes it.
 */
export function SaveSheet({ email, kind, onClose, onSignedIn }: { email: string; kind: 'proof' | 'final'; onClose: () => void; onSignedIn: () => void }) {
  const [mode, setMode] = useState<AuthMode | null>(null)
  return (
    <Sheet title={mode ? (mode === 'signup' ? 'Create your account' : 'Sign in') : 'Keep your photos in one place'} onClose={onClose}>
      {!mode ? (
        <>
          <p className="cg-sheet-sub">
            {kind === 'final'
              ? 'Create a free account and your final photos stay in your client area, ready to download again any time, on any device. No need to keep this email.'
              : 'Create a free account and this gallery, your picks, and your final photos when they’re ready stay in your client area. Open them any time, on any device. No need to keep this email.'}
          </p>
          <div className="cg-save-actions">
            <button className="cg-btn solid" onClick={() => setMode('signup')}>Create account</button>
            <button className="cg-btn line" onClick={() => setMode('signin')}>I have an account</button>
            <button className="cg-link cg-save-later" onClick={onClose}>Not now</button>
          </div>
        </>
      ) : (
        <div className="cg-save-auth">
          <AuthPanel
            key={mode}
            defaultMode={mode}
            defaultEmail={email}
            onSignedIn={onSignedIn}
            note={email ? <>Use <b>{email}</b>, the address this gallery was sent to, so it’s added to your account automatically.</> : undefined}
          />
        </div>
      )}
    </Sheet>
  )
}

/** A comment on one final photo, for the photographer. */
export function CommentSheet({ filename, initial, onClose, onSave, inside }: { filename: string; initial: string; onClose: () => void; onSave: (t: string) => void; inside?: Element | null }) {
  const [t, setT] = useState(initial)
  return (
    <Sheet title="Comment for the photographer" onClose={onClose} inside={inside}>
      <p className="cg-sheet-sub">{filename}</p>
      <textarea rows={4} value={t} maxLength={2000} onChange={(e) => setT(e.target.value)} placeholder="e.g. Love this! Could it be a little brighter? Or: please soften the skin a touch." />
      <div className="cg-sheet-f">
        <button className="cg-btn line" onClick={onClose}>Cancel</button>
        <button className="cg-btn solid" onClick={() => onSave(t)}>{initial && !t.trim() ? 'Remove comment' : 'Save comment'}</button>
      </div>
    </Sheet>
  )
}

/** Review the 👍 / 👎 / comments, then email them to the studio. */
export function FeedbackSheet({ images, feedback, sentAt, onClose, onSend, onComment }: {
  images: ViewImage[]
  feedback: Map<string, { reaction: 1 | -1 | null; comment: string | null }>
  sentAt: string | null
  onClose: () => void
  onSend: () => Promise<boolean>
  onComment: (id: string) => void
}) {
  const [busy, setBusy] = useState(false)
  const rows = images.filter((i) => feedback.has(i.id))
  const up = rows.filter((i) => feedback.get(i.id)!.reaction === 1).length
  const down = rows.filter((i) => feedback.get(i.id)!.reaction === -1).length
  return (
    <Sheet title="Send your feedback?" onClose={onClose} wide>
      <p className="cg-sheet-sub">{up} 👍 · {down} 👎 · {rows.filter((i) => feedback.get(i.id)!.comment).length} with a comment. We’ll get it by email and come back to you{down ? ' about the photos you marked 👎' : ''}.{sentAt ? ' This sends your latest feedback again.' : ''}</p>
      <div className="cg-review">
        {rows.map((i) => {
          const f = feedback.get(i.id)!
          return (
            <figure key={i.id}>
              {i.thumb ? <img src={i.thumb} alt={i.filename} loading="lazy" draggable={false} /> : null}
              <figcaption>
                <span>{f.reaction === 1 ? '👍 ' : f.reaction === -1 ? '👎 ' : ''}{i.filename}</span>
                <button className="cg-link" onClick={() => onComment(i.id)}>{f.comment ? `“${f.comment}”` : 'Add comment'}</button>
              </figcaption>
            </figure>
          )
        })}
      </div>
      <div className="cg-sheet-f">
        <button className="cg-btn line" onClick={onClose}>Not yet</button>
        <button className="cg-btn solid" disabled={busy || !rows.length} onClick={async () => { setBusy(true); await onSend(); setBusy(false) }}>{busy ? 'Sending…' : 'Send to the photographer'}</button>
      </div>
    </Sheet>
  )
}
