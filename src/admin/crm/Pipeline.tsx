import { useMemo, useState } from 'react'
import { useData, useDb, type R } from '../data'
import { Empty, PageHead, Stat, ago, fmtDate, gbp } from '../ui'
import { ContactDrawer } from './ContactDrawer'
import { DealModal, SERVICES } from './shared'

export function Pipeline() {
  const { d } = useData()
  const db = useDb()
  const [q, setQ] = useState('')
  const [service, setService] = useState('')
  const [showLost, setShowLost] = useState(false)
  const [drag, setDrag] = useState<string | null>(null)
  const [over, setOver] = useState<string | null>(null)
  const [edit, setEdit] = useState<R | 'new' | null>(null)
  const [contact, setContact] = useState<string | null>(null)

  const stages = d.pipeline_stages.filter((s) => showLost || s.kind !== 'lost')
  const cname = (id: string) => d.contacts.find((c) => c.id === id)?.name ?? '—'
  const deals = useMemo(() => d.deals.filter((x) => (!service || x.service === service) && (!q || `${x.title} ${cname(x.contact_id)}`.toLowerCase().includes(q.toLowerCase()))), [d.deals, d.contacts, q, service])

  const open = deals.filter((x) => d.pipeline_stages.find((s) => s.key === x.stage)?.kind === 'open')
  const won = d.deals.filter((x) => d.pipeline_stages.find((s) => s.key === x.stage)?.kind === 'won')
  const lost = d.deals.filter((x) => x.stage === 'lost')
  const openValue = open.reduce((s, x) => s + Number(x.value), 0)
  const weighted = open.reduce((s, x) => s + Number(x.value) * ((d.pipeline_stages.find((st) => st.key === x.stage)?.probability ?? 0) / 100), 0)
  const winRate = won.length + lost.length ? Math.round((won.length / (won.length + lost.length)) * 100) : 0

  async function move(id: string, stageKey: string) {
    const deal = d.deals.find((x) => x.id === id)
    if (!deal || deal.stage === stageKey) return
    const stage = d.pipeline_stages.find((s) => s.key === stageKey)!
    const from = d.pipeline_stages.find((s) => s.key === deal.stage)
    let lostReason = ''
    if (stage.kind === 'lost') {
      const r = window.prompt('Why was this deal lost? (price, date unavailable, went elsewhere…)', '')
      if (r === null) return
      lostReason = r
    }
    await db.update('deals', { id }, { stage: stageKey, updated_at: new Date().toISOString(), closed_at: stage.kind === 'open' ? null : new Date().toISOString(), lost_reason: lostReason }, undefined, ['contacts'])
    await db.log({ contact_id: deal.contact_id, deal_id: id, type: 'stage', subject: `Deal moved: ${from?.name ?? deal.stage} → ${stage.name}`, body: lostReason, auto: true })
    // moving to "Booked" can confirm the booking (and the confirmation email goes out via the automations)
    const booking = deal.booking_id ? d.bookings.find((b) => b.id === deal.booking_id) : null
    if (stageKey === 'booked' && booking?.status === 'new' && window.confirm(`Mark ${booking.kind} #${booking.ref} as confirmed? ${booking.email && booking.source === 'website' ? 'The client will receive a booking-confirmed email shortly.' : ''}`))
      await db.update('bookings', { id: booking.id }, { status: 'confirmed', confirmed_at: new Date().toISOString() }, 'Booking confirmed')
    if (stage.kind === 'won') await db.update('contacts', { id: deal.contact_id }, { lifecycle: 'client' })
    if (stage.kind === 'lost') await db.update('contacts', { id: deal.contact_id, lifecycle: 'opportunity' }, { lifecycle: 'lead' })
    if (stage.kind === 'open' && ['quoted', 'negotiation', 'booked'].includes(stageKey)) await db.update('contacts', { id: deal.contact_id, lifecycle: 'lead' }, { lifecycle: 'opportunity' })
  }

  return (
    <>
      <PageHead title="Pipeline" sub="Drag deals across the stages as the conversation moves forward" actions={<button className="ad-btn primary" onClick={() => setEdit('new')}>+ New deal</button>} />
      <div className="ad-grid c4" style={{ marginBottom: 18 }}>
        <Stat label="Open deals" value={open.length} sub={gbp(openValue)} />
        <Stat label="Weighted forecast" value={gbp(Math.round(weighted))} sub="value × stage probability" />
        <Stat label="Won" value={won.length} sub={gbp(won.reduce((s, x) => s + Number(x.value), 0))} tone="good" />
        <Stat label="Win rate" value={`${winRate}%`} sub={`${lost.length} lost`} />
      </div>
      <div className="ad-toolbar">
        <input type="search" placeholder="Search deals…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={service} onChange={(e) => setService(e.target.value)}><option value="">All services</option>{SERVICES.map((s) => <option key={s}>{s}</option>)}</select>
        <label className="ad-check"><input type="checkbox" checked={showLost} onChange={(e) => setShowLost(e.target.checked)} />Show lost</label>
      </div>
      <div className="ad-kanban">
        {stages.map((s) => {
          const col = deals.filter((x) => x.stage === s.key)
          return (
            <section key={s.key} className={'ad-lane' + (over === s.key ? ' over' : '')}
              onDragOver={(e) => { e.preventDefault(); setOver(s.key) }} onDragLeave={() => setOver((o) => (o === s.key ? null : o))}
              onDrop={(e) => { e.preventDefault(); setOver(null); const id = e.dataTransfer.getData('text/plain') || drag; if (id) move(id, s.key); setDrag(null) }}>
              <header><h4><i style={{ background: s.color }} />{s.name}</h4><small>{col.length} · {gbp(col.reduce((t, x) => t + Number(x.value), 0))}</small></header>
              {col.map((x) => {
                const stale = s.kind === 'open' && Date.now() - new Date(x.updated_at).getTime() > 7 * 86_400_000
                return (
                  <article key={x.id} className={'ad-deal' + (drag === x.id ? ' drag' : '')} draggable
                    onDragStart={(e) => { e.dataTransfer.setData('text/plain', x.id); setDrag(x.id) }} onDragEnd={() => { setDrag(null); setOver(null) }}
                    onClick={() => setEdit(x)}>
                    <strong>{x.title}</strong>
                    <div className="row"><a href={`#/crm/contacts/${x.contact_id}`} onClick={(e) => { e.stopPropagation(); e.preventDefault(); setContact(x.contact_id) }}>{cname(x.contact_id)}</a><span className="val">{x.value ? gbp(x.value) : 'TBC'}</span></div>
                    <div className="row"><span>{x.event_date ? `📅 ${fmtDate(x.event_date)}` : x.service || ' '}</span><span className={stale ? 'stale' : ''}>{stale ? '⏱ ' : ''}{ago(x.updated_at)}</span></div>
                    {x.stage === 'lost' && x.lost_reason && <div className="row"><span>Lost: {x.lost_reason}</span></div>}
                  </article>
                )
              })}
              {!col.length && <p className="ad-muted" style={{ padding: '8px 6px', fontSize: 13 }}>Drop deals here</p>}
            </section>
          )
        })}
      </div>
      {!d.deals.length && <Empty title="No deals yet" hint="Every booking and enquiry from the website creates a deal automatically. You can also add one by hand." />}
      {edit && <DealModal deal={edit === 'new' ? undefined : edit} onClose={() => setEdit(null)} />}
      {contact && <ContactDrawer id={contact} onClose={() => setContact(null)} />}
    </>
  )
}
