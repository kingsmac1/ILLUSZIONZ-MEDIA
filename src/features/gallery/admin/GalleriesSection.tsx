/** Dashboard → Galleries (#/galleries): every client with their galleries, status at a glance, storage meter. */
import { useMemo, useState } from 'react'
import { useData } from '../../../admin/data'
import { Badge, Empty, PageHead, Stat, ago, initials, useDebounced } from '../../../admin/ui'
import { galleryConfig } from '../gallery.config'
import { STATUS_TONE, fmtBytes, fmtDay, statusLabel } from '../status'
import type { GalleryRow, GalleryStatus } from '../types'
import { useCover } from '../useCover'
import { SetupNeeded } from './SetupNeeded'
import { useGalleryIndex, type GalleryStats } from './useGalleryIndex'
import './gallery-admin.css'

const STATUSES: GalleryStatus[] = ['draft', 'sent', 'viewed', 'selecting', 'submitted', 'delivered', 'archived']

export function GalleriesSection() {
  const { d } = useData()
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

  if (idx.missing) return <><PageHead title="Galleries" /><SetupNeeded /></>
  const total = [...idx.stats.values()].reduce((s, x) => s + x.bytes, 0)
  const budget = galleryConfig.storageBudgetGb * 1024 ** 3
  const pct = Math.min(100, (total / budget) * 100)
  const waiting = idx.galleries.filter((g) => g.kind === 'proof' && g.status === 'submitted').length
  const shoots = [...new Set(idx.galleries.map(kindOf).filter(Boolean))].sort()

  return (
    <>
      <PageHead title="Galleries" sub={`${idx.galleries.length} galleries · ${new Set(idx.galleries.map((g) => g.client_email)).size} clients`} actions={<a className="ad-btn" href="#/bookings">Start one from a booking</a>} />
      <div className="ad-grid c3" style={{ marginBottom: 16 }}>
        <div className="ad-stat gx-meter">
          <span>Storage used</span><small>{pct.toFixed(0)}%</small>
          <strong>{fmtBytes(total)} <small style={{ fontSize: 13, fontWeight: 500 }}>of {galleryConfig.storageBudgetGb} GB</small></strong>
          <div className="gm-progress" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}><i className={pct > 95 ? 'full' : pct > 75 ? 'warn' : ''} style={{ width: `${pct}%` }} /></div>
          <small style={{ gridColumn: '1/-1' }}>{total > budget ? `About $${(((total - budget) / 1024 ** 3) * 0.015).toFixed(2)}/month over the free 10 GB` : 'R2: first 10 GB free, then ≈ $0.015 per GB per month'}</small>
        </div>
        <Stat label="Selections waiting for you" value={waiting} sub={waiting ? <a href="#" onClick={(e) => { e.preventDefault(); setStatus('waiting') }}>Show them</a> : 'All caught up'} tone={waiting ? 'warn' : ''} />
        <Stat label="Delivered" value={idx.galleries.filter((g) => g.kind === 'final' && g.status === 'delivered').length} sub="final galleries" tone="good" />
      </div>
      <div className="ad-toolbar">
        <input type="search" placeholder="Search client, email, title, booking ref…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status"><option value="">All statuses</option><option value="waiting">Selections waiting</option>{STATUSES.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}</select>
        <select value={shoot} onChange={(e) => setShoot(e.target.value)} aria-label="Shoot type"><option value="">All shoot types</option>{shoots.map((s) => <option key={s}>{s}</option>)}</select>
        <select value={range} onChange={(e) => setRange(e.target.value)} aria-label="Created"><option value="">Any date</option><option value="30">Last 30 days</option><option value="90">Last 3 months</option><option value="365">Last 12 months</option></select>
      </div>
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
            {c.galleries.map((g) => <Card key={g.id} g={g} s={idx.stats.get(g.id)} shoot={kindOf(g)} />)}
          </div>
        </details>
      ))}
    </>
  )
}

function Card({ g, s, shoot }: { g: GalleryRow; s?: GalleryStats; shoot: string }) {
  const cover = useCover(g.id, !!s?.images_ready && !g.previews_purged_at)
  const href = g.booking_id ? `#/bookings/${g.booking_id}/gallery` : `/gallery/${g.id}/`
  return (
    <a className="gx-card" href={href}>
      <span className="img" style={cover?.url ? { backgroundImage: `url("${cover.url}")` } : undefined}><span className="k">{g.kind === 'proof' ? 'Proofs' : 'Finals'}</span></span>
      <span className="body">
        <b title={g.title}>{g.title}</b>
        <span><Badge tone={STATUS_TONE[g.status]}>{statusLabel(g.kind, g.status, s?.picks, g.selection_limit)}</Badge></span>
        <small>{s?.images_ready ?? 0} photos{g.kind === 'proof' && s?.picks ? ` · ${s.picks} picked` : ''}{s?.notes ? ` · ${s.notes} notes` : ''}{s?.images_failed ? ` · ${s.images_failed} failed` : ''} · {fmtBytes(s?.bytes ?? 0)}</small>
        <small>{shoot ? `${shoot} · ` : ''}{g.first_viewed_at ? `viewed ${fmtDay(g.first_viewed_at)}` : g.sent_at ? 'not opened yet' : 'not sent'} · last activity {ago(s?.last_activity ?? g.updated_at)}</small>
      </span>
    </a>
  )
}
