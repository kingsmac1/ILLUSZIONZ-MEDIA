import { useMemo, useState } from 'react'
import { useData } from '../data'
import { PageHead, fmtDate, todayIso } from '../ui'
import { BookingDetail } from './Bookings'

export function Schedule() {
  const { d } = useData()
  const [cursor, setCursor] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1) })
  const [open, setOpen] = useState<string | null>(null)
  const today = todayIso()
  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const lead = (new Date(year, month, 1).getDay() + 6) % 7 // Monday first
  const days = new Date(year, month + 1, 0).getDate()
  const cells = Array.from({ length: Math.ceil((lead + days) / 7) * 7 }, (_, i) => i - lead + 1)
  const iso = (n: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(n).padStart(2, '0')}`

  const byDay = useMemo(() => {
    const m = new Map<string, any[]>()
    for (const b of d.bookings) if (b.event_date && b.status !== 'cancelled') m.set(b.event_date, [...(m.get(b.event_date) ?? []), b])
    for (const x of m.values()) x.sort((a, b) => (a.event_time ?? '').localeCompare(b.event_time ?? ''))
    return m
  }, [d.bookings])
  const upcoming = d.bookings.filter((b) => b.event_date && b.event_date >= today && b.status !== 'cancelled').sort((a, b) => `${a.event_date}${a.event_time ?? ''}`.localeCompare(`${b.event_date}${b.event_time ?? ''}`)).slice(0, 8)

  return (
    <>
      <PageHead title="Schedule" sub="Every booked session at a glance" actions={<>
        <button className="ad-btn" onClick={() => setCursor(new Date(year, month - 1, 1))}>←</button>
        <b style={{ minWidth: 150, textAlign: 'center' }}>{cursor.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</b>
        <button className="ad-btn" onClick={() => setCursor(new Date(year, month + 1, 1))}>→</button>
        <button className="ad-btn" onClick={() => { const n = new Date(); setCursor(new Date(n.getFullYear(), n.getMonth(), 1)) }}>Today</button></>} />
      <div className="ad-legend"><span><i style={{ background: '#2563eb' }} />Awaiting confirmation</span><span><i style={{ background: '#0b0b0c' }} />Confirmed</span><span><i style={{ background: '#8a887e' }} />Completed</span></div>
      <div className="ad-cal" style={{ marginBottom: 20 }}>
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((x) => <div key={x} className="h">{x}</div>)}
        {cells.map((n, i) => {
          const inMonth = n >= 1 && n <= days
          const list = inMonth ? byDay.get(iso(n)) ?? [] : []
          return (
            <div key={i} className={'d' + (inMonth ? '' : ' dim') + (inMonth && iso(n) === today ? ' today' : '')}>
              {inMonth && <span>{n}</span>}
              {list.slice(0, 4).map((b) => <button key={b.id} className={'ev ' + b.status} onClick={() => setOpen(b.id)}>{b.event_time ? b.event_time + ' ' : ''}{b.name.split(' ')[0]} · {b.kind.replace(/ booking$| photography/gi, '')}</button>)}
              {list.length > 4 && <small className="ad-muted">+{list.length - 4} more</small>}
            </div>
          )
        })}
      </div>
      <div className="ad-card"><h3>Next up</h3>
        <div className="ad-list">{upcoming.map((b) => <div key={b.id} style={{ cursor: 'pointer' }} onClick={() => setOpen(b.id)}><span><b>{b.name}</b> · {b.kind.replace(/ booking$/i, '')}<span className="sub ad-muted" style={{ display: 'block' }}>{b.packages}</span></span><span style={{ textAlign: 'right' }}>{fmtDate(b.event_date)}<span className="ad-muted" style={{ display: 'block' }}>{b.event_time}</span></span></div>)}{!upcoming.length && <p className="ad-muted">No upcoming sessions.</p>}</div></div>
      {open && <BookingDetail id={open} onClose={() => setOpen(null)} />}
    </>
  )
}
