/**
 * Dashboard → Bookings → Gallery (#/bookings/<id>/gallery). Proofs: upload watermarked previews, set the pick limit,
 * send, read the selection (copy filenames / Lightroom filter), unlock. Finals: upload edited originals, match them to
 * the picks, deliver. Timeline: everything that happened on this booking.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../admin/supabase'
import { useData, type R } from '../../../admin/data'
import { Badge, Empty, Field, PageHead, Tabs, ago, fmtDate } from '../../../admin/ui'
import { callFn } from '../api'
import { byFilename, filenameList, lightroomFilter, matchKey } from '../filenames'
import { galleryConfig } from '../gallery.config'
import { STATUS_TONE, describeActivity, fmtBytes, statusLabel } from '../status'
import type { ActivityRow, GalleryRow, ViewImage, ViewResponse } from '../types'
import { AdminGrid, type PickInfo } from './AdminGrid'
import { Uploader } from './Uploader'
import { defaultTitle, shootName, suggestLimit } from './bookingInfo'
import { refreshGalleries, useGalleryIndex } from './useGalleryIndex'
import { SetupNeeded } from './SetupNeeded'
import './gallery-admin.css'

const clientUrl = (id: string) => `${window.location.origin}/gallery/${id}/`

async function copy(text: string, toast: (m: string, k?: 'ok' | 'err') => void, what: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast(`✓ ${what} copied`)
  } catch {
    window.prompt(`Copy ${what.toLowerCase()}:`, text)
  }
}

function download(name: string, text: string, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** All images of one gallery with signed thumbnail URLs (admin: includes uploading/failed ones). */
function useGalleryImages(gid: string | null | undefined) {
  const [images, setImages] = useState<ViewImage[]>([])
  const [picks, setPicks] = useState<Map<string, PickInfo>>(new Map())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    if (!gid) { setImages([]); setPicks(new Map()); return }
    setLoading(true)
    const all: ViewImage[] = []
    let page = 0
    let pages = 1
    let sel: ViewResponse['selections']
    while (page < pages) {
      const r = await callFn<ViewResponse>('gallery-view-urls', { gallery_id: gid, page, include_unready: true })
      if (!r.ok) { setError(r.error); setLoading(false); return }
      all.push(...(r.images ?? []))
      if (page === 0) sel = r.selections
      pages = r.pages ?? 1
      page++
    }
    setImages(all)
    setPicks(new Map((sel ?? []).map((s) => [s.image_id, { note: s.note }])))
    setError('')
    setLoading(false)
  }, [gid])
  useEffect(() => { load() }, [load])
  return { images, picks, loading, error, reload: load }
}

export function GalleryManager({ bookingId }: { bookingId: string }) {
  const { d, toast } = useData()
  const booking = d.bookings.find((b) => b.id === bookingId)
  const idx = useGalleryIndex()
  const proof = idx.galleries.find((g) => g.booking_id === bookingId && g.kind === 'proof')
  const final = idx.galleries.find((g) => g.booking_id === bookingId && g.kind === 'final')
  const [tab, setTab] = useState<'proofs' | 'finals' | 'timeline'>(() => (proof && ['submitted', 'archived'].includes(proof.status) ? 'finals' : 'proofs'))

  if (!booking) return <Empty title="Booking not found" hint="It may have been deleted." action={<a className="ad-btn" href="#/bookings">← Back to bookings</a>} />
  if (idx.missing) return <SetupNeeded />
  const email = String(booking.email ?? '').trim().toLowerCase()

  async function ensureGallery(kind: 'proof' | 'final'): Promise<string | null> {
    const existing = kind === 'proof' ? proof : final
    if (existing) return existing.id
    if (!/^\S+@\S+\.\S+$/.test(email)) { toast('Add the client’s email to the booking first — it is the key to their gallery.', 'err'); return null }
    const { data, error } = await supabase!.from('galleries').insert({
      booking_id: booking!.id, client_email: email, client_name: booking!.name, kind, status: 'draft',
      title: defaultTitle(booking!, kind), selection_limit: kind === 'proof' ? suggestLimit(booking!) : null,
      parent_gallery_id: kind === 'final' ? proof?.id ?? null : null,
    }).select().single()
    if (error) { toast(error.message, 'err'); return null }
    await refreshGalleries()
    return (data as GalleryRow).id
  }

  const stats = (g?: GalleryRow) => (g ? idx.stats.get(g.id) : undefined)
  return (
    <>
      <PageHead
        title={`Gallery · ${booking.name}`}
        sub={`${shootName(booking)} · ${booking.event_date ? fmtDate(booking.event_date) : 'date TBC'} · #${booking.ref}`}
        actions={<a className="ad-btn" href="#/bookings">← Bookings</a>}
      />
      <div className="gm-head">
        <span><b>{email || 'No email on this booking'}</b></span>
        {booking.phone && <span>{booking.phone}</span>}
        <span className="gm-chip">Proofs {proof ? <Badge tone={STATUS_TONE[proof.status]}>{statusLabel('proof', proof.status, stats(proof)?.picks, proof.selection_limit)}</Badge> : <Badge tone="grey">not started</Badge>}</span>
        <span className="gm-chip">Finals {final ? <Badge tone={STATUS_TONE[final.status]}>{statusLabel('final', final.status)}</Badge> : <Badge tone="grey">not started</Badge>}</span>
      </div>
      {!email && <div className="ad-note" style={{ marginBottom: 16 }}>This booking has no email address. Open the booking, add the client’s email, then come back — the gallery is locked to that email.</div>}
      <Tabs
        tabs={[
          { id: 'proofs', label: 'Proofs', count: stats(proof)?.images_ready },
          { id: 'finals', label: 'Finals', count: stats(final)?.images_ready },
          { id: 'timeline', label: 'Timeline' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'proofs' && <ProofsTab booking={booking} gallery={proof} ensure={() => ensureGallery('proof')} />}
      {tab === 'finals' && <FinalsTab booking={booking} gallery={final} proof={proof} ensure={() => ensureGallery('final')} />}
      {tab === 'timeline' && <Timeline bookingId={booking.id} galleryIds={[proof?.id, final?.id].filter(Boolean) as string[]} />}
    </>
  )
}

/* ------------------------------------------------------------------ settings */
function Settings({ g, kind }: { g: GalleryRow; kind: 'proof' | 'final' }) {
  const { toast } = useData()
  const [f, setF] = useState({ title: g.title, message: g.message_to_client ?? '', limit: g.selection_limit ? String(g.selection_limit) : '', extras: g.allow_extra_selections, note: g.extra_price_note ?? '' })
  useEffect(() => setF({ title: g.title, message: g.message_to_client ?? '', limit: g.selection_limit ? String(g.selection_limit) : '', extras: g.allow_extra_selections, note: g.extra_price_note ?? '' }), [g.id, g.updated_at]) // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = f.title !== g.title || f.message !== (g.message_to_client ?? '') || f.limit !== (g.selection_limit ? String(g.selection_limit) : '') || f.extras !== g.allow_extra_selections || f.note !== (g.extra_price_note ?? '')
  async function save() {
    const limit = f.limit.trim() ? Math.max(1, Math.round(Number(f.limit))) : null
    if (f.limit.trim() && !Number.isFinite(limit)) return toast('The photo limit must be a number', 'err')
    const { error } = await supabase!.from('galleries').update({ title: f.title.trim() || g.title, message_to_client: f.message.trim() || null, selection_limit: kind === 'proof' ? limit : null, allow_extra_selections: f.extras, extra_price_note: f.note.trim() || null }).eq('id', g.id)
    if (error) return toast(error.message, 'err')
    toast('✓ Saved')
    refreshGalleries()
  }
  return (
    <div className="ad-form" style={{ gridTemplateColumns: '1fr 1fr' }}>
      <Field label="Gallery title" full><input type="text" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
      <Field label="Message to the client" full hint="Shown on the gallery and in the email."><textarea rows={3} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} placeholder={kind === 'proof' ? 'e.g. It was a joy photographing your day! Pick your favourites…' : 'e.g. Here they are — enjoy!'} /></Field>
      {kind === 'proof' && <>
        <Field label="Photos the client can pick" hint="Empty = no limit. Filled in from the package where possible."><input type="number" min={1} value={f.limit} onChange={(e) => setF({ ...f, limit: e.target.value })} placeholder="No limit" /></Field>
        <label className="ad-check" style={{ alignSelf: 'end', paddingBottom: 10 }}><input type="checkbox" checked={f.extras} onChange={(e) => setF({ ...f, extras: e.target.checked })} />Allow extra picks</label>
        {f.extras && <Field label="Note about extra photos" full><input type="text" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="e.g. Extra edited photos are £20 each — we’ll send an invoice." /></Field>}
      </>}
      <div className="ad-formfoot"><button className={'ad-btn' + (dirty ? ' primary' : '')} onClick={save} disabled={!dirty}>{dirty ? 'Save draft' : 'Saved'}</button></div>
    </div>
  )
}

/* ------------------------------------------------------------------ shared actions */
function useGalleryActions(g: GalleryRow | undefined, reload: () => void) {
  const { toast } = useData()
  const [busy, setBusy] = useState('')
  const run = async (key: string, fn: string, body: Record<string, unknown>, ok: (r: any) => string) => {
    setBusy(key)
    const r = await callFn<any>(fn, body)
    setBusy('')
    if (!r.ok) return toast(r.error, 'err')
    if (r.emailed === false && (r.email_error || fn === 'gallery-send')) toast(`Done, but the email was not sent${r.email_error ? `: ${r.email_error}` : ''}. Use “Copy client link” and send it on WhatsApp.`, 'err')
    else toast(ok(r))
    await refreshGalleries()
    reload()
  }
  return {
    busy,
    send: (resend = false) => g && window.confirm(`${resend ? 'Resend the email' : g.kind === 'proof' ? 'Send the previews' : 'Deliver the final photos'} to\n\n${g.client_email}\n\n${g.kind === 'proof' && !resend ? 'They will get an email with the link and can start picking.' : ''}`) &&
      run(resend ? 'resend' : 'send', 'gallery-send', { gallery_id: g.id }, () => (g.kind === 'proof' ? `✓ Sent to ${g.client_email}` : `✓ Delivered to ${g.client_email}`)),
    remind: () => g && window.confirm(`Send a reminder to ${g.client_email}?`) && run('remind', 'gallery-send', { gallery_id: g.id, reminder: true }, () => '✓ Reminder sent'),
    unlock: () => g && window.confirm('Reopen the selection? The client keeps their picks and gets an email saying they can change them.') && run('unlock', 'gallery-unlock-selection', { gallery_id: g.id }, () => '✓ Selection unlocked'),
    removeAll: () => g && window.confirm(`Delete this ${g.kind === 'proof' ? 'proof' : 'finals'} gallery and all its photos permanently?`) && run('delete', 'gallery-delete', { gallery_id: g.id }, () => '✓ Gallery deleted'),
  }
}

function useImageOps(g: GalleryRow | undefined, images: ViewImage[], reload: () => void) {
  const { toast } = useData()
  return {
    onCover: async (id: string) => {
      const { error } = await supabase!.from('galleries').update({ cover_image_id: id }).eq('id', g!.id)
      if (error) return toast(error.message, 'err')
      toast('✓ Cover set'); refreshGalleries()
    },
    onDelete: async (ids: string[]) => {
      const r = await callFn('gallery-delete', { gallery_id: g!.id, image_ids: ids })
      if (!r.ok) return toast(r.error, 'err')
      toast(`✓ ${ids.length} deleted`); refreshGalleries(); reload()
    },
    onReorder: async (ids: string[]) => {
      const { error } = await supabase!.rpc('gallery_reorder', { gid: g!.id, ids })
      if (error) return toast(error.message, 'err')
      reload()
    },
    onSortByName: async () => {
      const ids = [...images].sort((a, b) => byFilename(a.filename, b.filename)).map((i) => i.id)
      const { error } = await supabase!.rpc('gallery_reorder', { gid: g!.id, ids })
      if (error) return toast(error.message, 'err')
      toast('✓ Sorted in camera order'); reload()
    },
  }
}

/* ------------------------------------------------------------------ proofs */
function ProofsTab({ booking, gallery: g, ensure }: { booking: R; gallery?: GalleryRow; ensure: () => Promise<string | null> }) {
  const { toast } = useData()
  const { images, picks, loading, error, reload } = useGalleryImages(g?.id)
  const act = useGalleryActions(g, reload)
  const ops = useImageOps(g, images, reload)
  const ready = images.filter((i) => i.status === 'ready').length
  const bytes = images.reduce((s, i) => s + (i.bytes ?? 0), 0)

  return (
    <>
      <div className="gm-cols">
        <div className="ad-card">
          <div className="gm-card-h"><h3>Preview gallery</h3>{g && <Badge tone={STATUS_TONE[g.status]}>{statusLabel('proof', g.status, picks.size, g.selection_limit)}</Badge>}</div>
          {g ? <Settings g={g} kind="proof" /> : (
            <p className="ad-muted">Drop the preview photos on the right to start. The gallery is created as a <b>draft</b> — the client sees nothing until you press <b>Send to client</b>.
              {suggestLimit(booking) ? <> The package includes <b>{suggestLimit(booking)} photos</b>, so that will be the pick limit.</> : null}</p>
          )}
          {g && (
            <div className="gm-actions">
              {g.status === 'draft'
                ? <button className="ad-btn primary" disabled={!ready || !!act.busy} onClick={() => act.send()}>{act.busy === 'send' ? 'Sending…' : `Send to client (${ready})`}</button>
                : <button className="ad-btn" disabled={!!act.busy} onClick={() => act.send(true)}>{act.busy === 'resend' ? 'Sending…' : 'Resend email'}</button>}
              {['sent', 'viewed', 'selecting'].includes(g.status) && <button className="ad-btn" disabled={!!act.busy} onClick={act.remind}>Send reminder</button>}
              <button className="ad-btn" onClick={() => copy(clientUrl(g.id), toast, 'Client link')}>Copy client link</button>
              {g.status !== 'draft' && <a className="ad-btn" href={clientUrl(g.id)} target="_blank" rel="noreferrer">Open ↗</a>}
              <span style={{ flex: 1 }} />
              <button className="ad-btn danger sm" onClick={act.removeAll}>Delete gallery</button>
            </div>
          )}
          {g && <p className="ad-muted" style={{ marginTop: 12, fontSize: 12.5 }}>
            {g.sent_at ? `Sent ${ago(g.sent_at)}` : 'Not sent yet'}{g.first_viewed_at ? ` · first viewed ${ago(g.first_viewed_at)}` : g.sent_at ? ' · not opened yet' : ''}{g.submitted_at ? ` · submitted ${ago(g.submitted_at)}` : ''} · {ready} photos · {fmtBytes(bytes)}
            {g.previews_purge_at && !g.previews_purged_at ? ` · previews auto-delete ${fmtDate(g.previews_purge_at)}` : ''}{g.previews_purged_at ? ' · previews removed (picks kept)' : ''}
          </p>}
        </div>
        <div className="ad-card">
          <div className="gm-card-h"><h3>Upload previews</h3><small className="ad-muted">watermark: {Math.round(galleryConfig.watermark.size * 100)}% wide, {Math.round(galleryConfig.watermark.opacity * 100)}% opacity</small></div>
          {g?.previews_purged_at ? <p className="ad-muted">The previews of this gallery were removed after delivery.</p> : (
            <Uploader mode="proof" galleryId={g?.id ?? null} ensureGallery={ensure} onSettled={() => { reload(); refreshGalleries() }} onRejected={(n) => toast(`Skipped ${n.length} file${n.length === 1 ? '' : 's'} (only JPG, PNG, WebP): ${n.slice(0, 3).join(', ')}${n.length > 3 ? '…' : ''}`, 'err')} />
          )}
        </div>
      </div>

      {g && (picks.size > 0 || g.status === 'submitted') && <SelectionPanel g={g} images={images} picks={picks} busy={act.busy} onUnlock={act.unlock} />}

      {g && (
        <div className="ad-card">
          <div className="gm-card-h"><h3>Photos <small>{loading ? 'loading…' : `${images.length} · drag to reorder · click to select`}</small></h3></div>
          {error ? <p className="ad-err">{error}</p> : <AdminGrid images={images} picks={picks} coverId={g.cover_image_id} {...ops} />}
        </div>
      )}
    </>
  )
}

function SelectionPanel({ g, images, picks, busy, onUnlock }: { g: GalleryRow; images: ViewImage[]; picks: Map<string, PickInfo>; busy: string; onUnlock: () => void }) {
  const { toast } = useData()
  const picked = images.filter((i) => picks.has(i.id)).sort((a, b) => byFilename(a.filename, b.filename))
  const names = picked.map((i) => i.filename)
  const notes = picked.filter((i) => picks.get(i.id)?.note)
  const base = g.title.replace(/[^\w-]+/g, '-').replace(/-+/g, '-').toLowerCase()
  const submitted = g.status === 'submitted' || g.status === 'archived'
  return (
    <div className={'ad-card' + (submitted ? ' gm-sel' : '')} style={{ marginBottom: 16 }}>
      <div className="gm-card-h">
        <h3>{submitted ? `Selection submitted — ${picked.length} photos` : `Client is choosing — ${picked.length}${g.selection_limit ? ` of ${g.selection_limit}` : ''} picked so far`} {notes.length > 0 && <small>{notes.length} with notes</small>}</h3>
        {g.submitted_at && <small className="ad-muted">{fmtDate(g.submitted_at, true)}</small>}
      </div>
      <div className="ad-actions">
        <button className="ad-btn primary" onClick={() => copy(lightroomFilter(names), toast, 'Lightroom filter')}>Copy Lightroom filter</button>
        <button className="ad-btn" onClick={() => copy(filenameList(names), toast, 'Filenames')}>Copy filenames</button>
        <button className="ad-btn" onClick={() => download(`${base}-selection.txt`, filenameList(names) + '\n')}>Download .txt</button>
        <button className="ad-btn" onClick={() => download(`${base}-selection.csv`, ['filename,note', ...picked.map((i) => `"${i.filename.replace(/"/g, '""')}","${(picks.get(i.id)?.note ?? '').replace(/"/g, '""')}"`)].join('\n'), 'text/csv')}>Download .csv</button>
        {g.status === 'submitted' && <button className="ad-btn" disabled={!!busy} onClick={onUnlock}>{busy === 'unlock' ? 'Unlocking…' : 'Unlock selection'}</button>}
      </div>
      <p className="ad-muted" style={{ marginTop: 10, fontSize: 12.5 }}>Lightroom Classic: Library → filter bar → <b>Text</b> → <b>Filename</b> → <b>Contains</b>, then paste.</p>
      <div className="gm-sel-list">
        {picked.map((i) => <div key={i.id}><b>{i.filename}</b>{picks.get(i.id)?.note && <span>“{picks.get(i.id)!.note}”</span>}</div>)}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ finals */
function FinalsTab({ gallery: g, proof, ensure }: { booking: R; gallery?: GalleryRow; proof?: GalleryRow; ensure: () => Promise<string | null> }) {
  const { toast } = useData()
  const { images, loading, error, reload } = useGalleryImages(g?.id)
  const act = useGalleryActions(g, reload)
  const ops = useImageOps(g, images, reload)
  const [proofImgs, setProofImgs] = useState<ProofImg[]>([])
  const [proofPicks, setProofPicks] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!proof) return
    Promise.all([
      supabase!.from('gallery_images').select('id, original_filename').eq('gallery_id', proof.id).limit(5000),
      supabase!.from('gallery_selections').select('image_id').eq('gallery_id', proof.id).limit(5000),
    ]).then(([a, b]) => {
      setProofImgs((a.data ?? []) as ProofImg[])
      setProofPicks(new Set((b.data ?? []).map((x: { image_id: string }) => x.image_id)))
    })
  }, [proof?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // finals -> picked proofs, by filename stem ("DSC_0012-edit.jpg" ↔ "DSC_0012.jpg")
  const { matches, missing } = useMemo(() => {
    const byKey = new Map<string, ProofImg>()
    for (const p of proofImgs) {
      const k = matchKey(p.original_filename)
      if (!byKey.has(k) || proofPicks.has(p.id)) byKey.set(k, p)
    }
    const byId = new Map(proofImgs.map((p) => [p.id, p]))
    const m = new Map<string, string | null>()
    const covered = new Set<string>()
    for (const f of images) {
      const p = (f.source_proof_image_id && byId.get(f.source_proof_image_id)) || byKey.get(matchKey(f.filename))
      m.set(f.id, p ? p.original_filename : null)
      if (p) covered.add(p.id)
    }
    const miss = proofImgs.filter((p) => proofPicks.has(p.id) && !covered.has(p.id)).map((p) => p.original_filename).sort(byFilename)
    return { matches: m, missing: miss }
  }, [images, proofImgs, proofPicks])

  // remember the matches on the rows (the dashboard + finals view use them)
  useEffect(() => {
    if (!g || !proofImgs.length) return
    const byName = new Map(proofImgs.map((p) => [p.original_filename, p.id]))
    const todo = images.filter((f) => !f.source_proof_image_id && matches.get(f.id)).map((f) => ({ id: f.id, src: byName.get(matches.get(f.id)!) }))
    if (!todo.length) return
    Promise.all(todo.map((t) => supabase!.from('gallery_images').update({ source_proof_image_id: t.src }).eq('id', t.id)))
  }, [g, images, matches, proofImgs])

  const ready = images.filter((i) => i.status === 'ready').length
  const unmatched = [...matches.values()].filter((v) => v === null).length
  return (
    <>
      <div className="gm-cols">
        <div className="ad-card">
          <div className="gm-card-h"><h3>Final photos</h3>{g && <Badge tone={STATUS_TONE[g.status]}>{statusLabel('final', g.status)}</Badge>}</div>
          {!proof && <div className="ad-note" style={{ marginBottom: 12 }}>No preview gallery for this booking — that’s fine, you can deliver finals directly.</div>}
          {proof && proof.status !== 'submitted' && proof.status !== 'archived' && <div className="ad-note" style={{ marginBottom: 12 }}>The client hasn’t submitted their selection yet ({statusLabel('proof', proof.status)}).</div>}
          {g ? <Settings g={g} kind="final" /> : <p className="ad-muted">Drop the edited photos on the right. They are uploaded in full resolution without a watermark, and matched to the client’s picks by filename.</p>}
          {g && (
            <div className="gm-actions">
              {g.status !== 'delivered'
                ? <button className="ad-btn primary" disabled={!ready || !!act.busy} onClick={() => act.send()}>{act.busy === 'send' ? 'Delivering…' : `Deliver to client (${ready})`}</button>
                : <button className="ad-btn" disabled={!!act.busy} onClick={() => act.send(true)}>{act.busy === 'resend' ? 'Sending…' : 'Resend email'}</button>}
              <button className="ad-btn" onClick={() => copy(clientUrl(g.id), toast, 'Client link')}>Copy client link</button>
              {g.status === 'delivered' && <a className="ad-btn" href={clientUrl(g.id)} target="_blank" rel="noreferrer">Open ↗</a>}
              <span style={{ flex: 1 }} />
              <button className="ad-btn danger sm" onClick={act.removeAll}>Delete finals</button>
            </div>
          )}
          {g?.delivered_at && <p className="ad-muted" style={{ marginTop: 12, fontSize: 12.5 }}>Delivered {fmtDate(g.delivered_at, true)}{proof?.previews_purge_at ? ` · watermarked previews auto-delete on ${fmtDate(proof.previews_purge_at)}` : ''}</p>}
        </div>
        <div className="ad-card">
          <div className="gm-card-h"><h3>Upload finals</h3></div>
          <Uploader mode="final" galleryId={g?.id ?? null} ensureGallery={ensure} onSettled={() => { reload(); refreshGalleries() }} onRejected={(n) => toast(`Skipped ${n.length} file${n.length === 1 ? '' : 's'} (only JPG, PNG, WebP)`, 'err')} />
        </div>
      </div>

      {g && proof && proofPicks.size > 0 && (
        <div className="ad-card" style={{ marginBottom: 16 }}>
          <h3>Matching with the client’s picks</h3>
          <p style={{ marginTop: 8 }}><b>{ready - unmatched}</b> of {ready} finals matched to a pick · <b>{missing.length}</b> pick{missing.length === 1 ? '' : 's'} without a final yet{unmatched ? <> · <b>{unmatched}</b> final{unmatched === 1 ? '' : 's'} with no matching pick (extras or renamed)</> : null}</p>
          {missing.length > 0 && <p className="gm-missing">Still to deliver: {missing.slice(0, 60).join(', ')}{missing.length > 60 ? ` and ${missing.length - 60} more` : ''} <button className="ad-btn sm" style={{ marginLeft: 6 }} onClick={() => copy(lightroomFilter(missing), toast, 'Lightroom filter for the missing picks')}>Copy as Lightroom filter</button></p>}
        </div>
      )}

      {g && (
        <div className="ad-card">
          <div className="gm-card-h"><h3>Finals <small>{loading ? 'loading…' : `${images.length} photos`}</small></h3></div>
          {error ? <p className="ad-err">{error}</p> : <AdminGrid images={images} coverId={g.cover_image_id} matches={proof ? matches : undefined} {...ops} />}
        </div>
      )}
    </>
  )
}
type ProofImg = { id: string; original_filename: string }

/* ------------------------------------------------------------------ timeline */
function Timeline({ bookingId, galleryIds }: { bookingId: string; galleryIds: string[] }) {
  const [rows, setRows] = useState<ActivityRow[] | null>(null)
  useEffect(() => {
    const filter = [`booking_id.eq.${bookingId}`, ...(galleryIds.length ? [`gallery_id.in.(${galleryIds.join(',')})`] : [])].join(',')
    supabase!.from('activity_log').select('*').or(filter).order('created_at', { ascending: false }).limit(200).then(({ data }) => setRows((data ?? []) as ActivityRow[]))
  }, [bookingId, galleryIds.join()]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!rows) return <p className="ad-muted">Loading…</p>
  if (!rows.length) return <Empty title="Nothing yet" hint="Sending, viewing, picking, delivering and downloads show up here." />
  return (
    <div className="ad-card"><div className="ad-timeline">
      {rows.map((a) => { const t = describeActivity(a, false); return (
        <div key={a.id} className={'ad-tl' + (a.actor === 'system' ? ' auto' : '')}>
          <span className="ic" aria-hidden="true">{t.icon}</span>
          <div><b>{t.text}</b><br /><small>{fmtDate(a.created_at, true)} · {a.actor}</small></div>
        </div>
      ) })}
    </div></div>
  )
}
