import { useMemo, useState } from 'react'
import { useData } from '../data'
import { Badge, Bars, Columns, PageHead, Stat, addDaysIso, fmtDate, gbp, todayIso } from '../ui'
import { BookingDetail } from './Bookings'
import { SelectionsWaiting } from '../../features/gallery/admin/SelectionsWaiting'

export function Overview() {
  const { d } = useData()
  const [open, setOpen] = useState<string | null>(null)
  const today = todayIso()
  const m = useMemo(() => {
    const live = d.bookings.filter((b) => b.status !== 'cancelled')
    const monthPrefix = today.slice(0, 7)
    const thisMonth = live.filter((b) => b.created_at.slice(0, 7) === monthPrefix)
    const received = d.payments.filter((p) => p.paid_at.slice(0, 7) === monthPrefix).reduce((s, p) => s + Number(p.amount), 0) + d.other_income.filter((i) => i.received_on.slice(0, 7) === monthPrefix).reduce((s, i) => s + Number(i.amount), 0)
    const spent = d.expenses.filter((e) => e.spent_on.slice(0, 7) === monthPrefix).reduce((s, e) => s + Number(e.amount), 0)
    const outstanding = live.filter((b) => b.status !== 'new' || Number(b.amount_paid) > 0).reduce((s, b) => s + Math.max(0, Number(b.total) - Number(b.amount_paid)), 0)
    const months = Array.from({ length: 6 }, (_, i) => { const dt = new Date(); dt.setDate(1); dt.setMonth(dt.getMonth() - (5 - i)); const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`; return { key, label: dt.toLocaleDateString('en-GB', { month: 'short' }) } })
    const chart = months.map((mm) => ({ label: mm.label, a: d.payments.filter((p) => p.paid_at.startsWith(mm.key)).reduce((s, p) => s + Number(p.amount), 0) + d.other_income.filter((i) => i.received_on.startsWith(mm.key)).reduce((s, i) => s + Number(i.amount), 0), b: d.expenses.filter((e) => e.spent_on.startsWith(mm.key)).reduce((s, e) => s + Number(e.amount), 0) }))
    const byService = new Map<string, number>()
    live.forEach((b) => byService.set(b.kind.replace(/ booking$/i, ''), (byService.get(b.kind.replace(/ booking$/i, '')) ?? 0) + 1))
    const upcoming = live.filter((b) => b.event_date && b.event_date >= today && b.event_date <= addDaysIso(today, 14)).sort((a, b) => `${a.event_date}${a.event_time ?? ''}`.localeCompare(`${b.event_date}${b.event_time ?? ''}`))
    const unconfirmed = d.bookings.filter((b) => b.status === 'new')
    const dueTasks = d.tasks.filter((t) => !t.done && t.due_at && new Date(t.due_at).getTime() < Date.now() + 86_400_000)
    const unread = d.submissions.filter((s) => s.status === 'new')
    const openDeals = d.deals.filter((x) => d.pipeline_stages.find((s) => s.key === x.stage)?.kind === 'open')
    return { thisMonth, received, spent, outstanding, chart, byService, upcoming, unconfirmed, dueTasks, unread, openDeals }
  }, [d, today])

  const needs = [
    m.unconfirmed.length && { t: `${m.unconfirmed.length} booking${m.unconfirmed.length === 1 ? '' : 's'} to confirm`, href: '#/bookings' },
    m.unread.length && { t: `${m.unread.length} unread message${m.unread.length === 1 ? '' : 's'}`, href: '#/inbox' },
    m.dueTasks.length && { t: `${m.dueTasks.length} follow-up task${m.dueTasks.length === 1 ? '' : 's'} due`, href: '#/crm/tasks' },
  ].filter(Boolean) as { t: string; href: string }[]

  return (
    <>
      <PageHead title="Overview" sub={new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} />
      {needs.length > 0 && <div className="ad-card" style={{ marginBottom: 16, background: '#fffdf0', borderColor: '#f3e7a1' }}><h3>Needs your attention</h3><div className="ad-actions">{needs.map((n) => <a key={n.t} className="ad-btn" href={n.href}>{n.t} →</a>)}</div></div>}
      <SelectionsWaiting />
      <div className="ad-grid c4" style={{ marginBottom: 16 }}>
        <Stat label="Bookings this month" value={m.thisMonth.length} sub={`${d.bookings.length} all time`} />
        <Stat label="Received this month" value={gbp(m.received)} sub={`Spent ${gbp(m.spent)} · net ${gbp(m.received - m.spent)}`} tone="good" />
        <Stat label="Outstanding balances" value={gbp(m.outstanding)} sub="on confirmed bookings" tone={m.outstanding ? 'warn' : ''} />
        <Stat label="Open pipeline" value={gbp(m.openDeals.reduce((s, x) => s + Number(x.value), 0))} sub={`${m.openDeals.length} open deals`} />
      </div>
      <div className="ad-grid c21" style={{ marginBottom: 16 }}>
        <div className="ad-card"><h3>Money in vs. out <small>last 6 months</small></h3>
          <div className="ad-legend"><span><i style={{ background: '#0b0b0c' }} />Received</span><span><i style={{ background: '#c9c7bd' }} />Expenses</span></div>
          <Columns money rows={m.chart} /></div>
        <div className="ad-card"><h3>Bookings by service</h3><Bars rows={[...m.byService.entries()].sort((a, b) => b[1] - a[1]).slice(0, 7).map(([label, value]) => ({ label, value }))} /></div>
      </div>
      <div className="ad-grid c2">
        <div className="ad-card"><h3>Coming up <small>next 14 days</small></h3>
          <div className="ad-list">{m.upcoming.map((b) => <div key={b.id} style={{ cursor: 'pointer' }} onClick={() => setOpen(b.id)}><span><b>{b.name}</b> <span className="ad-muted">· {b.kind.replace(/ booking$/i, '')}</span></span><span>{fmtDate(b.event_date)} {b.event_time} <Badge>{b.status}</Badge></span></div>)}{!m.upcoming.length && <p className="ad-muted">No sessions in the next two weeks.</p>}</div></div>
        <div className="ad-card"><h3>Latest activity</h3>
          <div className="ad-list">{[...d.bookings.slice(0, 4).map((b) => ({ at: b.created_at, t: `New ${b.kind.toLowerCase()} — ${b.name}`, href: '#/bookings' })), ...d.submissions.slice(0, 4).map((s) => ({ at: s.created_at, t: `${s.form_name === 'review' ? 'Review' : s.form_name === 'careers' ? 'Application' : 'Message'} from ${s.name}`, href: '#/inbox' }))].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 7).map((x, i) => <div key={i}><a href={x.href}>{x.t}</a><span className="ad-muted">{fmtDate(x.at)}</span></div>)}</div></div>
      </div>
      {open && <BookingDetail id={open} onClose={() => setOpen(null)} />}
    </>
  )
}
