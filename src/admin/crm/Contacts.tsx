import { useMemo, useRef, useState } from 'react'
import { useData, useDb, type R } from '../data'
import { matchesAudience, type AudienceFilter } from '../../server/audience'
import { Badge, Empty, Modal, PageHead, Pager, ago, downloadCsv, gbp, initials, parseCsv, useDebounced, Field } from '../ui'
import { ContactDrawer } from './ContactDrawer'
import { ContactForm, LIFECYCLES, SOURCES, contactStats, scoreColor } from './shared'

const PAGE = 25
const FLOW_NAMES: Record<string, string> = { portrait: 'Portrait', maternity: 'Maternity', baby: 'Baby shoot', prewedding: 'Pre-wedding', events: 'Events', family: 'Family', wedding: 'Wedding', academy: 'Academy', videography: 'Videography', booth: '360 booth', agency: 'Agency', store: 'Store' }

function ImportModal({ onClose }: { onClose: () => void }) {
  const { d, toast } = useData()
  const db = useDb()
  const [rows, setRows] = useState<R[]>([])
  const file = useRef<HTMLInputElement>(null)
  const existing = new Set(d.contacts.map((c) => (c.email ?? '').toLowerCase()).filter(Boolean))
  const clean = rows.filter((r) => (r.name || r['full name']) && !existing.has((r.email ?? '').toLowerCase()))
  async function run() {
    const payload = clean.map((r) => ({
      name: r.name || r['full name'], email: r.email?.toLowerCase() || null, phone: r.phone || r.whatsapp || '', city: r.city || '', source: SOURCES.includes(r.source) ? r.source : 'other',
      lifecycle: LIFECYCLES.includes(r.lifecycle) ? r.lifecycle : 'lead', tags: (r.tags ?? '').split(/[;,]/).map((t: string) => t.trim().toLowerCase()).filter(Boolean), birthday: /^\d{4}-\d{2}-\d{2}$/.test(r.birthday ?? '') ? r.birthday : null,
    }))
    const seen = new Set<string>()
    const unique = payload.filter((p) => !p.email || (!seen.has(p.email) && seen.add(p.email)))
    const r = await db.insert('contacts', unique, `${unique.length} contacts imported`)
    if (r.ok) onClose()
    else toast('Import failed', 'err')
  }
  return (
    <Modal title="Import contacts from CSV" onClose={onClose}>
      <p className="ad-muted" style={{ marginBottom: 12 }}>Columns recognised: <b>name</b>, email, phone, city, source, lifecycle, tags, birthday (YYYY-MM-DD). Contacts whose email already exists are skipped.</p>
      <input ref={file} type="file" accept=".csv,text/csv" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setRows(parseCsv(await f.text())) }} />
      {rows.length > 0 && <p style={{ margin: '14px 0' }}><b>{clean.length}</b> new contacts ready ({rows.length - clean.length} skipped).</p>}
      <div className="ad-formfoot" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}><button className="ad-btn" onClick={onClose}>Cancel</button><button className="ad-btn primary" disabled={!clean.length} onClick={run}>Import {clean.length || ''}</button></div>
    </Modal>
  )
}

export function Contacts({ openId }: { openId?: string }) {
  const { d } = useData()
  const db = useDb()
  const [q, setQ] = useState('')
  const dq = useDebounced(q)
  const [seg, setSeg] = useState('all')
  const [f, setF] = useState<AudienceFilter>({})
  const [sort, setSort] = useState('recent')
  const [page, setPage] = useState(1)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [modal, setModal] = useState<null | 'add' | 'import' | 'segment'>(null)
  const [open, setOpen] = useState<string | undefined>(openId)
  const [segName, setSegName] = useState('')

  const allTags = useMemo(() => [...new Set(d.contacts.flatMap((c) => c.tags ?? []))].sort(), [d.contacts])
  const stats = useMemo(() => new Map(d.contacts.map((c) => [c.id, contactStats(c, d.bookings)])), [d.contacts, d.bookings])
  const savedSeg = d.segments.find((s) => s.id === seg)
  const filter: AudienceFilter = useMemo(() => {
    const base: AudienceFilter = savedSeg ? savedSeg.filter : seg === 'all' ? {} : { lifecycle: [seg] }
    return { ...base, ...f, q: dq || undefined }
  }, [seg, savedSeg, f, dq])

  const list = useMemo(() => {
    const rows = d.contacts.filter((c) => matchesAudience(c as any, d.bookings as any, filter))
    const key: Record<string, (a: R, b: R) => number> = {
      recent: (a, b) => b.last_activity_at.localeCompare(a.last_activity_at),
      name: (a, b) => a.name.localeCompare(b.name),
      score: (a, b) => b.lead_score - a.lead_score,
      value: (a, b) => (stats.get(b.id)?.spent ?? 0) - (stats.get(a.id)?.spent ?? 0),
      newest: (a, b) => b.created_at.localeCompare(a.created_at),
    }
    return rows.sort(key[sort])
  }, [d.contacts, d.bookings, filter, sort, stats])

  const pages = Math.max(1, Math.ceil(list.length / PAGE))
  const view = list.slice((Math.min(page, pages) - 1) * PAGE, Math.min(page, pages) * PAGE)
  const counts = (l: string) => d.contacts.filter((c) => c.lifecycle === l).length
  const allSelected = view.length > 0 && view.every((c) => sel.has(c.id))
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  async function bulk(patch: R | ((c: R) => R), ok: string) {
    for (const id of sel) {
      const c = d.contacts.find((x) => x.id === id)!
      await db.update('contacts', { id }, typeof patch === 'function' ? patch(c) : patch)
    }
    setSel(new Set())
    db.update('contacts', { id: [...sel][0] }, {}, ok)
  }

  return (
    <>
      <PageHead title="Contacts" sub={`${d.contacts.length} people — leads, clients and partners in one place`} actions={<>
        <button className="ad-btn" onClick={() => downloadCsv('contacts', list.map((c) => ({ name: c.name, email: c.email, phone: c.phone, lifecycle: c.lifecycle, source: c.source, tags: c.tags, city: c.city, birthday: c.birthday, bookings: stats.get(c.id)?.count, lifetime_value: stats.get(c.id)?.spent, lead_score: c.lead_score, last_activity: c.last_activity_at })))}>Export CSV</button>
        <button className="ad-btn" onClick={() => setModal('import')}>Import</button>
        <button className="ad-btn primary" onClick={() => setModal('add')}>+ Add contact</button>
      </>} />

      <div className="ad-seg">
        <button className={seg === 'all' ? 'on' : ''} onClick={() => { setSeg('all'); setPage(1) }}>All<em>{d.contacts.length}</em></button>
        {['lead', 'opportunity', 'client', 'vip', 'inactive'].map((l) => <button key={l} className={seg === l ? 'on' : ''} onClick={() => { setSeg(l); setPage(1) }}>{l[0].toUpperCase() + l.slice(1)}{l === 'vip' ? '' : 's'}<em>{counts(l)}</em></button>)}
        {d.segments.map((s) => <button key={s.id} className={seg === s.id ? 'on' : ''} onClick={() => { setSeg(s.id); setPage(1) }}>★ {s.name}</button>)}
      </div>

      <div className="ad-toolbar">
        <input type="search" placeholder="Search name, email, phone, tag…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} />
        <select value={f.source?.[0] ?? ''} onChange={(e) => setF({ ...f, source: e.target.value ? [e.target.value] : undefined })}><option value="">Any source</option>{SOURCES.map((s) => <option key={s}>{s}</option>)}</select>
        <select value={f.tag ?? ''} onChange={(e) => setF({ ...f, tag: e.target.value || undefined })}><option value="">Any tag</option>{allTags.map((t) => <option key={t}>{t}</option>)}</select>
        <select value={f.service ?? ''} onChange={(e) => setF({ ...f, service: e.target.value || undefined })}><option value="">Any service booked</option>{Object.entries(FLOW_NAMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <select value={f.booked ?? ''} onChange={(e) => setF({ ...f, booked: (e.target.value || '') as any })}><option value="">Booked or not</option><option value="yes">Has booked</option><option value="no">Never booked</option></select>
        <select value={f.inactiveDays ?? ''} onChange={(e) => setF({ ...f, inactiveDays: Number(e.target.value) || undefined })}><option value="">Any activity</option><option value="30">Quiet 30+ days</option><option value="90">Quiet 90+ days</option><option value="180">Quiet 180+ days</option></select>
        <span className="sp" />
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort"><option value="recent">Recent activity</option><option value="newest">Newest</option><option value="name">Name A–Z</option><option value="score">Lead score</option><option value="value">Lifetime value</option></select>
        {(Object.keys(f).length > 0 || seg !== 'all') && <button className="ad-btn sm" onClick={() => { setF({}); setSeg('all') }}>Clear</button>}
        {Object.keys(f).length > 0 && <button className="ad-btn sm" onClick={() => setModal('segment')}>★ Save as segment</button>}
        {savedSeg && <button className="ad-btn sm danger" onClick={async () => { await db.remove('segments', { id: savedSeg.id }, 'Segment removed'); setSeg('all') }}>Delete segment</button>}
      </div>

      {sel.size > 0 && (
        <div className="ad-card" style={{ padding: '10px 14px', marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <b>{sel.size} selected</b>
          <select onChange={(e) => e.target.value && bulk({ lifecycle: e.target.value }, 'Lifecycle updated') } value=""><option value="">Set lifecycle…</option>{LIFECYCLES.map((l) => <option key={l}>{l}</option>)}</select>
          <button className="ad-btn sm" onClick={() => { const t = window.prompt('Tag to add to the selected contacts:'); if (t) bulk((c) => ({ tags: [...new Set([...(c.tags ?? []), t.trim().toLowerCase()])] }), 'Tag added') }}>+ Tag</button>
          <button className="ad-btn sm" onClick={() => bulk({ marketing_opt_in: false }, 'Opted out of marketing')}>Opt out of marketing</button>
          <button className="ad-btn sm" onClick={() => setSel(new Set())}>Clear</button>
        </div>
      )}

      <div className="ad-tablewrap">
        <table>
          <thead><tr>
            <th style={{ width: 36 }}><input type="checkbox" checked={allSelected} onChange={() => setSel(allSelected ? new Set() : new Set(view.map((c) => c.id)))} aria-label="Select all" /></th>
            <th>Contact</th><th>Stage</th><th>Source</th><th>Tags</th><th>Score</th><th className="num">Bookings</th><th className="num">Value</th><th>Last activity</th>
          </tr></thead>
          <tbody>
            {view.map((c) => {
              const s = stats.get(c.id)!
              return (
                <tr key={c.id} className="click" onClick={() => setOpen(c.id)}>
                  <td onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={sel.has(c.id)} onChange={() => toggle(c.id)} aria-label={`Select ${c.name}`} /></td>
                  <td><div className="ad-who"><span className="ad-avatar">{initials(c.name)}</span><div><strong>{c.name}</strong><span className="ad-muted" style={{ fontSize: 12 }}>{c.email ?? c.phone ?? ''}</span></div></div></td>
                  <td><Badge>{c.lifecycle}</Badge></td>
                  <td className="ad-muted">{c.source}</td>
                  <td><div className="ad-tags">{(c.tags ?? []).slice(0, 3).map((t: string) => <span className="ad-tag" key={t}>{t}</span>)}</div></td>
                  <td><span className="ad-score" style={{ ['--s' as any]: `${c.lead_score}%`, ['--c' as any]: scoreColor(c.lead_score) }}>{c.lead_score}<i /></span></td>
                  <td className="num">{s.count}</td>
                  <td className="num">{s.spent ? gbp(s.spent) : '—'}</td>
                  <td className="ad-muted">{ago(c.last_activity_at)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {!view.length && <Empty title="No contacts match" hint="Try clearing the filters, or add your first contact." />}
        <Pager page={Math.min(page, pages)} pages={pages} onChange={setPage} />
      </div>

      {modal === 'add' && <Modal title="Add contact" onClose={() => setModal(null)} wide><ContactForm onDone={(saved) => { setModal(null); if (saved) setOpen(saved.id) }} /></Modal>}
      {modal === 'import' && <ImportModal onClose={() => setModal(null)} />}
      {modal === 'segment' && (
        <Modal title="Save segment" onClose={() => setModal(null)}>
          <Field label="Segment name"><input type="text" value={segName} onChange={(e) => setSegName(e.target.value)} placeholder="e.g. Brides 2026" autoFocus /></Field>
          <p className="ad-muted" style={{ margin: '10px 0' }}>Saved segments appear as tabs here and can be used as the audience for an email campaign.</p>
          <div style={{ textAlign: 'right' }}><button className="ad-btn primary" disabled={!segName.trim()} onClick={async () => { await db.insert('segments', { name: segName.trim(), filter: { ...filter, q: undefined } }, 'Segment saved'); setModal(null); setSegName('') }}>Save</button></div>
        </Modal>
      )}
      {open && <ContactDrawer id={open} onClose={() => { setOpen(undefined); if (window.location.hash.includes('/crm/contacts/')) window.location.hash = '#/crm/contacts' }} />}
    </>
  )
}
