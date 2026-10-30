/**
 * /gallery/<id>/ — the client's private gallery.
 * Signed out (or wrong email): cover screen + inline email-code sign-in. Proofs: hearts, notes, "23 / 40" counter, submit
 * (review sheet → success → WhatsApp). Finals: per-photo download + "Download all" (zips in parts).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { RowsPhotoAlbum, type Photo } from 'react-photo-album'
import 'react-photo-album/rows.css'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../../../admin/supabase'
import { AuthPanel } from '../../account/AuthPanel'
import { callFn } from '../api'
import { galleryConfig } from '../gallery.config'
import { fmtDay } from '../status'
import type { ViewImage, ViewResponse } from '../types'
import { downloadOne, downloadZipPart, planParts } from './downloads'
import { usePicks } from './usePicks'
import { Lightbox } from './Lightbox'
import { SubmitSheet, NoteSheet, SuccessScreen } from './Sheets'
import { DownloadIcon, Heart } from './icons'
import './gallery.css'

type GPhoto = Photo & { img: ViewImage; tw: number; dw: number }

const OPEN = ['sent', 'viewed', 'selecting']

function useSession() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  useEffect(() => {
    if (!supabase) return setSession(null)
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])
  return session
}

export default function GalleryPage({ id }: { id: string }) {
  const session = useSession()
  const [data, setData] = useState<ViewResponse | null>(null)
  const [error, setError] = useState('')
  const uid = session?.user.id ?? null

  const load = useCallback(async () => {
    setError('')
    const r = await callFn<ViewResponse>('gallery-view-urls', { gallery_id: id, page: 0 })
    if (!r.ok) return setError(r.error)
    setData(r)
    // remaining pages load in the background, in order
    for (let p = 1; p < (r.pages ?? 1); p++) {
      const more = await callFn<ViewResponse>('gallery-view-urls', { gallery_id: id, page: p })
      if (!more.ok) break
      setData((cur) => (cur ? { ...cur, images: [...(cur.images ?? []), ...(more.images ?? [])] } : cur))
    }
  }, [id])

  useEffect(() => { if (session !== undefined) load() }, [session === undefined, uid]) // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <Message title="We couldn’t open this gallery" text={error} action={<button className="cg-btn solid" onClick={load}>Try again</button>} />
  if (!data || session === undefined) return <div className="cg cg-loading" aria-busy="true"><img src={galleryConfig.logoLight} alt={galleryConfig.brandName} /></div>
  if (data.access !== 'full') return <CoverGate data={data} onSignedIn={load} />
  return <GalleryView key={data.gallery.id} data={data} email={session?.user.email?.toLowerCase() ?? ''} reload={load} />
}

function Message({ title, text, action }: { title: string; text: string; action?: React.ReactNode }) {
  return (
    <div className="cg cg-message">
      <a href="/" className="cg-brand"><img src={galleryConfig.logoLight} alt={galleryConfig.brandName} /></a>
      <h1>{title}</h1>
      <p>{text}</p>
      {action}
    </div>
  )
}

/* -------------------------------------------------------------- cover + sign-in */
function CoverGate({ data, onSignedIn }: { data: ViewResponse; onSignedIn: () => void }) {
  const g = data.gallery
  const wrong = data.access === 'wrong_email'
  return (
    <div className="cg cg-gate">
      {data.cover && <div className="cg-gate-bg" style={{ backgroundImage: `url("${data.cover.url}")` }} aria-hidden="true" />}
      <div className="cg-gate-inner">
        <a href="/" className="cg-brand"><img src={galleryConfig.logoLight} alt={galleryConfig.brandName} /></a>
        <h1 className="cg-title">{g.title}</h1>
        <p className="cg-sub">{[g.client_first_name && `For ${g.client_first_name}`, g.event_date && fmtDay(g.event_date)].filter(Boolean).join(', ')}</p>
        {wrong ? (
          <div className="cg-auth dark">
            <h2>This gallery belongs to another email</h2>
            <p className="cg-auth-hint">You’re signed in as <b>{data.signed_in_as}</b>, but it was sent to <b>{data.email_hint}</b>.</p>
            <button className="cg-btn solid" onClick={() => supabase!.auth.signOut()}>Sign in with another email</button>
          </div>
        ) : (
          <>
            <p className="cg-gate-text">This gallery is private. Sign in, or create your account, with the email it was sent to.</p>
            <AuthPanel dark hint={data.email_hint} onSignedIn={onSignedIn} />
          </>
        )}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------- the gallery */
function GalleryView({ data, email, reload }: { data: ViewResponse; email: string; reload: () => void }) {
  const g = data.gallery
  const proof = g.kind === 'proof'
  const images = data.images ?? []
  const [status, setStatus] = useState(g.status!)
  const [submittedAt, setSubmittedAt] = useState(g.submitted_at ?? null)
  const locked = !proof || !OPEN.includes(status) || !!data.is_admin
  const [notice, setNotice] = useState('')
  const noticeTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const say = useCallback((m: string) => { setNotice(m); clearTimeout(noticeTimer.current); noticeTimer.current = setTimeout(() => setNotice(''), 4500) }, [])
  const { picks, toggle, setNote } = usePicks(g.id, email, data.selections ?? [], { limit: g.selection_limit ?? null, extras: !!g.allow_extra_selections, locked, onMessage: say })
  const [filter, setFilter] = useState<'all' | 'picked'>('all')
  const [open, setOpen] = useState<number | null>(null)
  const [noteFor, setNoteFor] = useState<string | null>(null)
  const [review, setReview] = useState(false)
  const [success, setSuccess] = useState<{ count: number; url: string } | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  const shown = useMemo(() => (filter === 'picked' ? images.filter((i) => picks.has(i.id)) : images), [filter, images, picks])
  const photos: GPhoto[] = useMemo(() => shown.map((img) => {
    const w = img.width || 1500
    const h = img.height || 1000
    const thumbScale = Math.min(1, galleryConfig.images.thumbEdge / Math.max(w, h))
    const dispScale = Math.min(1, (proof ? galleryConfig.images.previewEdge : galleryConfig.images.webEdge) / Math.max(w, h))
    return { key: img.id, src: img.thumb ?? '', width: w, height: h, alt: img.filename, label: `Open ${img.filename}`, img, tw: Math.round(w * thumbScale), dw: Math.round(w * dispScale) }
  }), [shown, proof])

  const limit = g.selection_limit ?? null
  const count = picks.size
  const finals = data.related?.find((r) => r.kind === 'final' && r.status === 'delivered')
  const proofsOf = data.related?.find((r) => r.kind === 'proof')
  const cover = images.find((i) => i.id === g.cover_image_id) ?? images[0]

  async function submit() {
    const r = await callFn<{ count: number; whatsapp_text: string; submitted_at: string }>('gallery-submit-selection', { gallery_id: g.id })
    if (!r.ok) { say(r.error); return false }
    setReview(false)
    setStatus('submitted')
    setSubmittedAt(r.submitted_at)
    const url = `https://wa.me/${galleryConfig.ownerWhatsapp}?text=${encodeURIComponent(r.whatsapp_text)}`
    setSuccess({ count: r.count, url })
    return true
  }

  return (
    <div className="cg cg-view">
      <header className="cg-hero" style={cover?.display ? { backgroundImage: `url("${cover.display}")` } : undefined}>
        <div className="cg-hero-shade" />
        <a href="/" className="cg-brand cg-hero-brand"><img src={galleryConfig.logoLight} alt={galleryConfig.brandName} /></a>
        <div className="cg-hero-text">
          <h1 className="cg-title">{g.title}</h1>
          <p className="cg-sub">
            {[g.event_date && fmtDay(g.event_date), `${data.total ?? images.length} photos`, proof && limit ? `pick ${limit}` : null].filter(Boolean).join('   /   ')}
          </p>
          <button className="cg-btn ghost" onClick={() => gridRef.current?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })}>
            View gallery
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6" /></svg>
          </button>
        </div>
      </header>

      <div className="cg-bar" ref={gridRef}>
        <div className="cg-bar-in">
          <a href="/" className="cg-brand small"><img src={galleryConfig.logoLight} alt={galleryConfig.brandName} /></a>
          <span className="cg-bar-title">{g.title}</span>
          {proof ? (
            <>
              <div className="cg-filter" role="group" aria-label="Show">
                <button aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>All</button>
                <button aria-pressed={filter === 'picked'} onClick={() => setFilter('picked')}>Picked</button>
              </div>
              <span className="cg-count" aria-live="polite"><b>{count}</b>{limit ? <> / {limit}</> : null}<span className="cg-count-l"> picked</span></span>
              {!locked && <button className="cg-btn solid red" disabled={!count} onClick={() => setReview(true)}><span className="cg-hide-s">Submit selection</span><span className="cg-show-s">Submit</span></button>}
            </>
          ) : (
            <DownloadAll galleryId={g.id} title={g.title} images={images} onError={say} />
          )}
        </div>
        {proof && <div className="cg-bar-line" style={{ transform: `scaleX(${limit ? Math.min(1, count / limit) : count ? 1 : 0})` }} aria-hidden="true" />}
      </div>

      <main className="cg-main" data-no-motion>
        {data.is_admin && <p className="cg-banner">Studio preview — this is what the client sees. Hearts are read-only for you.</p>}
        {proof && status === 'submitted' && <p className="cg-banner">Selection submitted on {fmtDay(submittedAt)}. We’re editing your photos ✨ {count ? `(${count} picked)` : ''}</p>}
        {proof && status === 'archived' && <p className="cg-banner">The previews were removed after your final photos were delivered.{finals ? <> <a href={`/gallery/${finals.id}/`}>Open your final photos</a></> : null}</p>}
        {proof && finals && status !== 'archived' && <p className="cg-banner strong">Your final photos are ready. <a href={`/gallery/${finals.id}/`}>Open and download them</a></p>}
        {!proof && proofsOf && <p className="cg-banner">These are your edited photos in full resolution, without a watermark.</p>}
        {g.previews_purge_at && proof && status !== 'archived' && <p className="cg-banner muted">Previews are available until {fmtDay(g.previews_purge_at)}.</p>}
        {g.message_to_client && <blockquote className="cg-message-text">{g.message_to_client}</blockquote>}
        {proof && !locked && limit && count < limit && count === 0 && <p className="cg-help">Tap the heart on your {limit} favourite photos. Your picks save as you go, so you can come back any time.{g.allow_extra_selections && g.extra_price_note ? ` ${g.extra_price_note}` : ''}</p>}

        {photos.length ? (
          <RowsPhotoAlbum
            photos={photos}
            spacing={4}
            targetRowHeight={(w) => (w < 600 ? 150 : w < 1000 ? 220 : 300)}
            rowConstraints={{ singleRowMaxHeight: 420 }}
            render={{
              image: (props, { photo, width }) => (
                <button type="button" className="cg-open" aria-label={`Open ${photo.img.filename}`} onClick={() => setOpen(images.indexOf(photo.img))}>
                  <img
                    {...props}
                    src={photo.img.thumb ?? ''}
                    srcSet={photo.img.display ? `${photo.img.thumb} ${photo.tw}w, ${photo.img.display} ${photo.dw}w` : undefined}
                    sizes={`${Math.ceil(width)}px`}
                    loading="lazy" decoding="async" draggable={false}
                    className={(props.className ?? '') + ' cg-img'}
                    onLoad={(e) => e.currentTarget.classList.add('in')}
                    onContextMenu={proof ? (e) => e.preventDefault() : undefined}
                  />
                </button>
              ),
              extras: (_, { photo }) => (
                <>
                  {proof && (
                    <button
                      className={'cg-heart' + (picks.has(photo.img.id) ? ' on' : '')}
                      aria-pressed={picks.has(photo.img.id)}
                      aria-label={`${picks.has(photo.img.id) ? 'Remove' : 'Pick'} ${photo.img.filename}`}
                      disabled={locked && !picks.has(photo.img.id)}
                      onClick={(e) => { e.stopPropagation(); toggle(photo.img.id) }}
                    >
                      <Heart filled={picks.has(photo.img.id)} />
                    </button>
                  )}
                  {proof && picks.get(photo.img.id) && <span className="cg-has-note" title={picks.get(photo.img.id)!}>Note</span>}
                  {!proof && (
                    <button className="cg-dl" aria-label={`Download ${photo.img.filename}`} onClick={(e) => { e.stopPropagation(); downloadOne(g.id, photo.img.id).catch((err) => say(err.message)) }}>
                      <DownloadIcon />
                    </button>
                  )}
                </>
              ),
            }}
            componentsProps={{ container: { className: 'cg-album' + (proof ? ' proof' : '') } }}
          />
        ) : (
          <p className="cg-empty">{filter === 'picked' ? 'No picks yet. Tap the heart on a photo to pick it.' : 'No photos here yet.'}</p>
        )}
      </main>

      <footer className="cg-foot">
        <img src={galleryConfig.logoDark} alt={galleryConfig.brandName} />
        <p>Questions? <a href={`https://wa.me/${galleryConfig.ownerWhatsapp}`} target="_blank" rel="noreferrer">WhatsApp us</a> or email <a href={`mailto:${galleryConfig.ownerEmail}`}>{galleryConfig.ownerEmail}</a>.</p>
        <p><a href="/account/">Your account</a> — all your shoots in one place.</p>
      </footer>

      {open !== null && (
        <Lightbox
          images={images}
          index={open}
          onClose={() => setOpen(null)}
          proof={proof}
          picks={picks}
          locked={locked}
          onToggle={toggle}
          onNote={(id) => setNoteFor(id)}
          onDownload={proof ? undefined : (id) => downloadOne(g.id, id).catch((err) => say(err.message))}
        />
      )}
      {noteFor && (
        <NoteSheet
          filename={images.find((i) => i.id === noteFor)?.filename ?? ''}
          initial={picks.get(noteFor) ?? ''}
          readOnly={locked}
          inside={open !== null ? document.querySelector('.yarl__root') : null}
          onClose={() => setNoteFor(null)}
          onSave={async (t) => { if (await setNote(noteFor, t)) setNoteFor(null) }}
        />
      )}
      {review && (
        <SubmitSheet images={images.filter((i) => picks.has(i.id))} picks={picks} limit={limit} extrasNote={g.allow_extra_selections ? g.extra_price_note ?? null : null} onClose={() => setReview(false)} onSubmit={submit} onNote={setNoteFor} />
      )}
      {success && <SuccessScreen count={success.count} whatsappUrl={success.url} onClose={() => { setSuccess(null); reload() }} />}
      <div className={'cg-toast' + (notice ? ' show' : '')} role="status" aria-live="polite">{notice}</div>
    </div>
  )
}

/* -------------------------------------------------------------- download all */
function DownloadAll({ galleryId, title, images, onError }: { galleryId: string; title: string; images: ViewImage[]; onError: (m: string) => void }) {
  const parts = useMemo(() => planParts(images.filter((i) => i.has_original)), [images])
  const [state, setState] = useState<{ part: number; done: number; bytes: number } | null>(null)
  const [finished, setFinished] = useState<Set<number>>(new Set())
  const [panel, setPanel] = useState(false)
  const name = title.replace(/[\\/:*?"<>|]+/g, '').trim() || 'Photos'

  async function run(i: number) {
    setState({ part: i + 1, done: 0, bytes: 0 })
    try {
      await downloadZipPart({ galleryId, ids: parts[i], part: i + 1, parts: parts.length, total: images.length, name, onProgress: (p) => setState({ part: i + 1, ...p }) })
      setFinished((f) => new Set(f).add(i))
    } catch (e) {
      if ((e as Error).name !== 'AbortError') onError((e as Error).message || 'The download stopped. Try that part again.')
    }
    setState(null)
  }
  if (!parts.length) return null
  const label = state ? `Zipping ${state.done}/${parts[state.part - 1].length}` : 'Download all'
  return (
    <div className="cg-dlall">
      <button className="cg-btn solid" disabled={!!state} onClick={() => (parts.length === 1 ? run(0) : setPanel((p) => !p))} aria-expanded={parts.length > 1 ? panel : undefined}>
        <DownloadIcon />{label}
      </button>
      {state && <span className="cg-dlall-bar"><i style={{ width: `${(state.done / parts[state.part - 1].length) * 100}%` }} /></span>}
      {panel && parts.length > 1 && (
        <div className="cg-dlall-panel">
          <p>{images.length} photos, in {parts.length} zip files. Download each part:</p>
          {parts.map((p, i) => (
            <button key={i} className="cg-btn line" disabled={!!state} onClick={() => run(i)}>
              {finished.has(i) ? '✓ ' : ''}Part {i + 1} ({p.length} photos)
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
