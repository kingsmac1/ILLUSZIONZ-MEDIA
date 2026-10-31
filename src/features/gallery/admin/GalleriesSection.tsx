/**
 * Dashboard → Galleries (#/galleries): every client with their galleries, status at a glance, storage used.
 * Each card has a checkbox (bulk: delete, remind, keep previews longer) and a ⋯ menu (manage, open, copy link, rename, delete).
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../../admin/supabase'
import { useData } from '../../../admin/data'
import { BulkBar, BulkBtn, SelectAllBox, useSelection, type Selection } from '../../../admin/bulk'
import { Badge, Empty, PageHead, Stat, ago, initials, useDebounced } from '../../../admin/ui'
import { STATUS_TONE, fmtBytes, fmtDay, statusLabel } from '../status'
import type { GalleryRow, GalleryStatus } from '../types'
import { useCover } from '../useCover'
import { SetupNeeded } from './SetupNeeded'
import { refreshGalleries, useGalleryIndex, type GalleryStats } from './useGalleryIndex'
import { deleteGalleries, extendPreviewsMany, remindGalleries } from './galleryActions'
import './gallery-admin.css'

const STATUSES: GalleryStatus[] = ['draft', 'sent', 'viewed', 'selecting', 'submitted', 'delivered', 'archived']
const OPEN = ['sent', 'viewed', 'selecting']
const clientUrl = (g: GalleryRow) => `${window.location.origin}/gallery/${g.id}/${g.share_token ? `?k=${g.share_token}` : ''}`

export function GalleriesSection() {
  const { d, toast } = useData()
  const idx = useGalleryIndex()
  const [q, setQ] = useState('')
  const dq = useDebounced(q)
  const [status, setStatus] = useState('')
  const [shoot, setShoot] = useState('')
  const [range, setRange] = useState('')
  const bookings = useMemo(() => new Map(d.bookings.map((b) => [b.id, b])), [d.bookings])
  const kindOf = (g: GalleryRow) => String(bookings.get(g.booking_id ?? '')?.kind ?? '').replace(/ booking$/i, '')

  const groups = useMemo(() => {
    const since = range ? Date.now() - Number(range) * 86_400_000 : 0
    const list = idx.galleries.filter((g) => {
      if (status === 'waiting' ? !(g.kind === 'proof' && g.status === 'submitted') : status && g.status !== status) return false
      if (shoot && kindOf(g) !== shoot) return false
      if (since && new Date(g.created_at).getTime() < since) return false
      if (dq && !`${g.client_name} ${g.client_email} ${g.title} ${bookings.get(g.booking_id ?? '')?.ref ?? ''}`.toLowerCase().includes(dq.toLowerCase())) return false
      return true
    })
    const by = new Map<string, GalleryRow[]>()
    for (const g of list) by.set(g.client_email, [...(by.get(g.client_email) ?? []), g])
    return [...by.entries()].map(([email, gs]) => {
      const stats = gs.map((g) => idx.stats.get(g.id))
      const last = stats.map((s) => s?.last_activity ?? '').concat(gs.map((g) => g.updated_at)).sort().pop() ?? ''
      return { email, name: gs.find((g) => g.client_name)?.client_name || email, galleries: gs, shoots: new Set(gs.map((g) => g.booking_id ?? g.id)).size, bytes: stats.reduce((s, x) => s + (x?.bytes ?? 0), 0), last }
    }).sort((a, b) => b.last.localeCompare(a.last))
  }, [idx.galleries, idx.stats, status, shoot, range, dq, bookings]) // eslint-disable-line react-hooks/exhaustive-deps

  const visible = useMemo(() => groups.flatMap((c) => c.galleries), [groups])
  const sel = useSelection(visible.map((g) => g.id))
  const picked = () => idx.galleries.filter((g) => sel.has(g.id))
  const report = (ok: string, errors: string[]) => toast(errors.length ? `${ok}. ${errors.length} failed: ${errors[0]}` : ok, errors.length ? 'err' : 'ok')

  async function removeMany(rows: GalleryRow[]) {
    if (!rows.length || !window.confirm(`Permanently delete ${rows.length === 1 ? 'this gallery' : `${rows.length} galleries`}?\n\n` + 'All their photos are deleted from storage, with the client’s picks, notes and feedback. The private links stop working. This cannot be undone.')) return
    const r = await deleteGalleries(rows.map((g) => g.id))
    report(`✓ ${r.deleted} galler${r.deleted === 1 ? 'y' : 'ies'} deleted`, r.errors)
    sel.clear()
  }
  async function remindMany() {
    const rows = picked().filter((g) => g.kind === 'proof' && OPEN.includes(g.status))
    if (!rows.length) return toast('None of the selected galleries are still waiting for picks.', 'err')
    if (!window.confirm(`Send a reminder to ${rows.length === 1 ? '1 client' : `${rows.length} clients`} still choosing their photos?\n\nEach gets the “your previews are waiting” email.`)) return
    const r = await remindGalleries(rows.map((g) => g.id))
    report(`✓ ${r.sent} reminder${r.sent === 1 ? '' : 's'} sent`, r.errors)
  }
  async function extendMany() {
    const rows = picked().filter((g) => g.kind === 'proof' && g.previews_purge_at && !g.previews_purged_at)
    if (!rows.length) return toast('None of the selected galleries have previews waiting to be deleted.', 'err')
    const r = await extendPreviewsMany(rows)
    report(`✓ Previews kept 30 more days on ${r.done} galler${r.done === 1 ? 'y' : 'ies'}`, r.errors)
  }

  if (idx.missing) return <><PageHead title="Galleries" /><SetupNeeded /></>
  const total = [...idx.stats.values()].reduce((s, x) => s + x.bytes, 0)
  const waiting = idx.galleries.filter((g) => g.kind === 'proof' && g.status === 'submitted').length
  const shoots = [...new Set(idx.galleries.map(kindOf).filter(Boolean))].sort()

  return (
    <>
      <PageHead title="Galleries" sub={(() => { const n = new Set(idx.galleries.map((g) => g.client_email)).size; return `${idx.galleries.length} galler${idx.galleries.length === 1 ? 'y' : 'ies'} · ${n} client${n === 1 ? '' : 's'}` })()} actions={<a className="ad-btn" href="#/bookings">Start one from a booking</a>} />
      <div className="ad-grid c3" style={{ marginBottom: 16 }}>
        <Stat label="Storage used" value={fmtBytes(total)} />
        <Stat label="Selections waiting for you" value={waiting} sub={waiting ? <a href="#" onClick={(e) => { e.preventDefault(); setStatus('waiting') }}>Show them</a> : 'All caught up'} tone={waiting ? 'warn' : ''} />
        <Stat label="Delivered" value={idx.galleries.filter((g) => g.kind === 'final' && g.status === 'delivered').length} sub="final galleries" tone="good" />
      </div>
      <div className="ad-toolbar">
        {visible.length > 0 && <label className="gx-selall" title="Select every gallery shown"><SelectAllBox s={sel} view={visible.map((g) => g.id)} /><span>Select all</span></label>}
        <input type="search" placeholder="Search client, email, title, booking ref…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status"><option value="">All statuses</option><option value="waiting">Selections waiting</option>{STATUSES.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}</select>
        <select value={shoot} onChange={(e) => setShoot(e.target.value)} aria-label="Shoot type"><option value="">All shoot types</option>{shoots.map((s) => <option key={s}>{s}</option>)}</select>
        <select value={range} onChange={(e) => setRange(e.target.value)} aria-label="Created"><option value="">Any date</option><option value="30">Last 30 days</option><option value="90">Last 3 months</option><option value="365">Last 12 months</option></select>
      </div>
      <BulkBar s={sel} noun="gallery" plural="galleries">
        <BulkBtn onClick={remindMany} title="Email the clients still choosing">Send reminder</BulkBtn>
        <BulkBtn onClick={extendMany} title="Keep the previews 30 more days">Keep previews +30 days</BulkBtn>
        <BulkBtn danger onClick={() => removeMany(picked())}>Delete</BulkBtn>
      </BulkBar>
      {idx.error && <p className="ad-err" style={{ marginBottom: 12 }}>{idx.error}</p>}
      {!groups.length ? (
        <div className="ad-card"><Empty title={idx.galleries.length ? 'No galleries match' : 'No galleries yet'} hint={idx.galleries.length ? 'Try clearing the filters.' : 'Open a booking and press “Gallery” to upload the first previews.'} /></div>
      ) : groups.map((c, i) => (
        <details key={c.email} className="gx-client" open={i < 8 || !!dq || !!status}>
          <summary>
            <span className="gx-avatar" aria-hidden="true">{initials(c.name)}</span>
            <span className="who"><b>{c.name}</b><span>{c.email}</span></span>
            <span className="meta"><span>{c.shoots} shoot{c.shoots === 1 ? '' : 's'}</span><span>{fmtBytes(c.bytes)}</span><span>active {ago(c.last)}</span></span>
          </summary>
          <div className="gx-cards">
            {c.galleries.map((g) => <Card key={g.id} g={g} s={idx.stats.get(g.id)} shoot={kindOf(g)} sel={sel} orphan={!g.booking_id || !bookings.has(g.booking_id)} onDelete={() => removeMany([g])} />)}
          </div>
        </details>
      ))}
    </>
  )
}

function Card({ g, s, shoot, sel, orphan, onDelete }: { g: GalleryRow; s?: GalleryStats; shoot: string; sel: Selection; orphan: boolean; onDelete: () => void }) {
  const { toast } = useData()
  const cover = useCover(g.id, !!s?.images_ready && !g.previews_purged_at)
  // a gallery whose booking was deleted has no Gallery Manager page: it opens as the client sees it
  const href = !orphan ? `#/bookings/${g.booking_id}/gallery` : `/gallery/${g.id}/`
  const [menu, setMenu] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!menu) return
    const out = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setMenu(false) }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setMenu(false)
    document.addEventListener('pointerdown', out)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('pointerdown', out); document.removeEventListener('keydown', esc) }
  }, [menu])
  async function rename() {
    setMenu(false)
    const title = window.prompt('Gallery title', g.title)?.trim()
    if (!title || title === g.title) return
    const { error } = await supabase!.from('galleries').update({ title }).eq('id', g.id)
    if (error) return toast(error.message, 'err')
    toast('✓ Renamed')
    refreshGalleries()
  }
  async function copyLink() {
    setMenu(false)
    try { await navigator.clipboard.writeText(clientUrl(g)); toast('✓ Client link copied') } catch { window.prompt('Copy the client link:', clientUrl(g)) }
  }
  return (
    <div className={'gx-card' + (sel.has(g.id) ? ' on' : '')} ref={box}>
      <label className="gx-pick" title="Select"><input type="checkbox" className="ad-cb" aria-label={`Select ${g.title}`} checked={sel.has(g.id)} onChange={() => sel.toggle(g.id)} /></label>
      <button type="button" className="gx-more" aria-label={`Actions for ${g.title}`} aria-expanded={menu} onClick={() => setMenu((m) => !m)}>⋯</button>
      {menu && (
        <div className="gx-menu" role="menu">
          {!orphan && <a role="menuitem" href={href}>Manage gallery</a>}
          <a role="menuitem" href={`/gallery/${g.id}/`} target="_blank" rel="noreferrer">Open as the client sees it ↗</a>
          {g.status !== 'draft' && <button role="menuitem" type="button" onClick={copyLink}>Copy client link</button>}
          <button role="menuitem" type="button" onClick={rename}>Rename</button>
          <button role="menuitem" type="button" className="danger" onClick={() => { setMenu(false); onDelete() }}>Delete gallery</button>
        </div>
      )}
      <a className="gx-card-link" href={href} target={orphan ? '_blank' : undefined} rel={orphan ? 'noreferrer' : undefined}>
        <span className="img" style={cover?.url ? { backgroundImage: `url("${cover.url}")` } : undefined}><span className="k">{g.kind === 'proof' ? 'Proofs' : 'Finals'}</span></span>
        <span className="body">
          <b title={g.title}>{g.title}</b>
          <span><Badge tone={STATUS_TONE[g.status]}>{statusLabel(g.kind, g.status, s?.picks, g.selection_limit)}</Badge>{orphan && <> <Badge tone="grey">Booking deleted</Badge></>}</span>
          <small>{s?.images_ready ?? 0} photos{g.kind === 'proof' && s?.picks ? ` · ${s.picks} picked` : ''}{s?.notes ? ` · ${s.notes} note${s.notes === 1 ? '' : 's'}` : ''}{s?.images_failed ? ` · ${s.images_failed} failed` : ''} · {fmtBytes(s?.bytes ?? 0)}</small>
          <small>{shoot ? `${shoot} · ` : ''}{g.kind === 'final' ? (g.delivered_at ? `delivered ${fmtDay(g.delivered_at)}` : 'not delivered') : g.first_viewed_at ? `viewed ${fmtDay(g.first_viewed_at)}` : g.sent_at ? 'not opened yet' : 'not sent'} · last activity {ago(s?.last_activity ?? g.updated_at)}</small>
        </span>
      </a>
    </div>
  )
}
