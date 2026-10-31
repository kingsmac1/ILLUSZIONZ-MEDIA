/**
 * Drag-and-drop uploader. Files are staged first (proofs show a live watermark preview of the first image), then
 * processed + uploaded by an UploadQueue that keeps running if you switch tabs or dashboard sections.
 */
import { useEffect, useRef, useState, useSyncExternalStore, type DragEvent } from 'react'
import { galleryConfig } from '../gallery.config'
import { watermarkPreview } from '../imaging'
import { byFilename } from '../filenames'
import { fmtBytes } from '../status'
import { UploadQueue } from './uploadQueue'

/** queues outlive the component: switching tabs or sections never stops an upload */
const queues = new Map<string, UploadQueue>()
const EMPTY = { items: [], active: false }
const noop = () => () => {}

export function Uploader({ mode, set = 'edited', galleryId, ensureGallery, onSettled, onRejected }: {
  mode: 'proof' | 'final'
  /** finals only: the edited photos, or the client's full set of unedited ones */
  set?: 'edited' | 'unedited'
  galleryId: string | null
  ensureGallery: () => Promise<string | null>
  onSettled: () => void
  onRejected: (names: string[]) => void
}) {
  const key = galleryId ? `${galleryId}:${mode}:${set}` : ''
  const [queue, setQueue] = useState<UploadQueue | null>(() => (key ? queues.get(key) ?? null : null))
  useEffect(() => setQueue(key ? queues.get(key) ?? null : null), [key])
  const snap = useSyncExternalStore(queue?.subscribe ?? noop, queue?.getSnapshot ?? (() => EMPTY), () => EMPTY)
  const settled = useRef(onSettled)
  settled.current = onSettled

  const [staged, setStaged] = useState<File[]>([])
  const [preview, setPreview] = useState('')
  const [over, setOver] = useState(false)
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  function stage(list: FileList | File[]) {
    const files = [...list]
    const ok = files.filter((f) => galleryConfig.images.accept.includes(f.type))
    const bad = files.filter((f) => !galleryConfig.images.accept.includes(f.type)).map((f) => f.name)
    if (bad.length) onRejected(bad)
    if (!ok.length) return
    const next = [...staged, ...ok].sort((a, b) => byFilename(a.name, b.name))
    setStaged(next)
    if (mode === 'proof') {
      setPreview('')
      watermarkPreview(next[0]).then(setPreview, () => setPreview('error'))
    }
  }
  useEffect(() => () => { if (preview.startsWith('blob:')) URL.revokeObjectURL(preview) }, [preview])

  async function start() {
    setBusy(true)
    const gid = galleryId ?? (await ensureGallery())
    setBusy(false)
    if (!gid) return
    const k = `${gid}:${mode}:${set}`
    let q = queues.get(k)
    if (!q) {
      q = new UploadQueue(gid, mode, () => settled.current(), set)
      queues.set(k, q)
    }
    setQueue(q)
    q.add(staged)
    setStaged([])
    setPreview('')
  }

  const items = snap.items
  const done = items.filter((i) => i.status === 'done').length
  const failed = items.filter((i) => i.status === 'failed')
  const cancelled = items.filter((i) => i.status === 'cancelled').length
  const pending = items.filter((i) => i.status === 'queued' || i.status === 'processing' || i.status === 'uploading').length
  const live = items.filter((i) => i.status !== 'cancelled')
  const progress = live.length ? live.reduce((s, i) => s + (i.status === 'failed' ? 1 : i.progress), 0) / live.length : 0
  const stagedBytes = staged.reduce((s, f) => s + f.size, 0)
  const onDrop = (e: DragEvent) => { e.preventDefault(); setOver(false); if (e.dataTransfer.files.length) stage(e.dataTransfer.files) }

  return (
    <div>
      <div
        className={'gm-drop' + (over ? ' over' : '')} role="button" tabIndex={0}
        onClick={() => input.current?.click()} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)} onDrop={onDrop}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3" /></svg>
        <strong>Drop {mode === 'proof' ? 'preview' : set === 'unedited' ? 'all the unedited' : 'edited'} photos here</strong>
        <small>or click to choose · JPG, PNG or WebP · {mode === 'proof' ? 'watermarked in your browser before upload' : 'uploaded in full resolution, no watermark'}</small>
        <input ref={input} type="file" multiple accept={galleryConfig.images.accept.join(',')} onChange={(e) => { if (e.target.files) stage(e.target.files); e.target.value = '' }} tabIndex={-1} />
      </div>

      {staged.length > 0 && (
        <div className="gm-stage">
          {mode === 'proof' ? (
            <div className="gm-wmprev">{preview && preview !== 'error' ? <img src={preview} alt="Watermark preview" /> : preview === 'error' ? 'Preview failed' : 'Preparing preview…'}<span>Client sees this</span></div>
          ) : <div />}
          <div>
            <p><b>{staged.length} photo{staged.length === 1 ? '' : 's'}</b> ready · {fmtBytes(stagedBytes)}</p>
            <p className="ad-muted" style={{ margin: '4px 0 12px' }}>
              {mode === 'proof'
                ? 'Only watermarked versions (≈600 px thumbnail + ≈2048 px preview) are uploaded. Your full-size files never leave this computer.'
                : 'The untouched originals are uploaded, plus a web-size copy and a thumbnail for fast viewing.'}
            </p>
            <div className="ad-actions">
              <button className="ad-btn primary" onClick={start} disabled={busy}>{busy ? 'Preparing…' : mode === 'proof' ? `Watermark & upload ${staged.length}` : set === 'unedited' ? `Upload ${staged.length} unedited` : `Upload ${staged.length} finals`}</button>
              <button className="ad-btn" onClick={() => { setStaged([]); setPreview('') }}>Clear</button>
            </div>
          </div>
        </div>
      )}

      {items.length > 0 && (
        <div className="gm-queue" aria-live="polite">
          <div className="gm-queue-sum">
            <span>{done} of {live.length} uploaded{failed.length ? ` · ${failed.length} failed` : ''}{cancelled ? ` · ${cancelled} cancelled` : ''}{snap.active ? ' — keep this tab open' : ''}</span>
            <span className="ad-actions">
              {pending > 0 && <button className="ad-btn sm danger" onClick={() => window.confirm(`Cancel the ${pending} photo${pending === 1 ? '' : 's'} still uploading? Photos already uploaded stay.`) && queue?.cancel()}>Cancel upload</button>}
              {failed.length > 0 && !snap.active && <button className="ad-btn sm" onClick={() => queue?.retryFailed()}>Retry failed</button>}
              {!snap.active && (done > 0 || cancelled > 0) && <button className="ad-btn sm" onClick={() => queue?.clearFinished()}>Clear finished</button>}
            </span>
          </div>
          <div className="gm-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}><i style={{ width: `${progress * 100}%` }} /></div>
          <div className="gm-qlist" style={{ marginTop: 10 }}>
            {[...failed, ...items.filter((i) => i.status !== 'failed' && i.status !== 'done' && i.status !== 'cancelled'), ...items.filter((i) => i.status === 'done').slice(-20), ...items.filter((i) => i.status === 'cancelled').slice(-20)].slice(0, 150).map((i) => (
              <div key={i.ref} className={'gm-q ' + i.status}>
                <span className="n" title={i.name}>{i.name}</span>
                <span className="gm-progress"><i style={{ width: `${(i.status === 'done' ? 1 : i.progress) * 100}%` }} /></span>
                <span className="s">{i.status === 'processing' ? (mode === 'proof' ? 'watermarking' : 'preparing') : i.status}</span>
                {['queued', 'processing', 'uploading'].includes(i.status) && <button className="gm-q-x" onClick={() => queue?.cancel(i.ref)} aria-label={`Cancel ${i.name}`} title="Cancel this photo">×</button>}
                {i.error && <span className="err">{i.error}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
