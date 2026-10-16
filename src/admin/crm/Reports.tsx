import { useMemo, useState } from 'react'
import { useData } from '../data'
import { Bars, Columns, PageHead, Stat, fmtDate, gbp } from '../ui'
import { ContactDrawer } from './ContactDrawer'
import { contactStats } from './shared'

const monthKey = (iso: string) => iso.slice(0, 7)
const lastMonths = (n: number) => Array.from({ length: n }, (_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - (n - 1 - i)); return { key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: d.toLocaleDateString('en-GB', { month: 'short' }) } })

export function CrmReports() {
  const { d } = useData()
  const [contact, setContact] = useState<string | null>(null)

  const r = useMemo(() => {
    const live = d.bookings.filter((b) => b.status !== 'cancelled')
    const sources = new Map<string, { n: number; clients: number; revenue: number }>()
    for (const c of d.contacts) {
      const s = sources.get(c.source) ?? { n: 0, clients: 0, revenue: 0 }
      s.n++
      const st = contactStats(c, d.bookings)
      if (st.count) s.clients++
      s.revenue += st.spent
      sources.set(c.source, s)
    }
    const byLife = new Map<string, number>()
    d.contacts.forEach((c) => byLife.set(c.lifecycle, (byLife.get(c.lifecycle) ?? 0) + 1))
    const byService = new Map<string, number>()
    live.forEach((b) => byService.set(b.kind.replace(/ booking$/i, ''), (byService.get(b.kind.replace(/ booking$/i, '')) ?? 0) + Number(b.total)))
    const lostReasons = new Map<string, number>()
    d.deals.filter((x) => x.stage === 'lost').forEach((x) => lostReasons.set((x.lost_reason || 'No reason given').toLowerCase(), (lostReasons.get((x.lost_reason || 'No reason given').toLowerCase()) ?? 0) + 1))
    const months = lastMonths(6).map((m) => ({ label: m.label, a: d.contacts.filter((c) => monthKey(c.created_at) === m.key).length, b: d.deals.filter((x) => monthKey(x.created_at) === m.key && ['booked', 'delivered'].includes(x.stage)).length }))
    const top = d.contacts.map((c) => ({ c, ...contactStats(c, d.bookings) })).filter((x) => x.spent > 0).sort((a, b) => b.spent - a.spent).slice(0, 8)
    const stale = d.contacts.filter((c) => ['lead', 'opportunity'].includes(c.lifecycle) && Date.now() - new Date(c.last_activity_at).getTime() > 7 * 86_400_000)
    const overdue = d.tasks.filter((t) => !t.done && t.due_at && new Date(t.due_at) < new Date())
    const unanswered = d.submissions.filter((s) => s.status === 'new' && Date.now() - new Date(s.created_at).getTime() > 86_400_000)
    const now = new Date()
    const upcomingBdays = d.contacts.filter((c) => c.birthday).map((c) => { const b = new Date(c.birthday + 'T12:00:00'); const next = new Date(now.getFullYear(), b.getMonth(), b.getDate()); if (next < new Date(now.toDateString())) next.setFullYear(now.getFullYear() + 1); return { c, next, days: Math.round((+next - +new Date(now.toDateString())) / 86_400_000) } }).filter((x) => x.days <= 30).sort((a, b) => a.days - b.days)
    const stageCount = (k: string[]) => d.deals.filter((x) => k.includes(x.stage)).length
    const total = d.deals.length
    const funnel = [
      { label: 'All deals', value: total },
      { label: 'Contacted+', value: total - stageCount(['new']) },
      { label: 'Quoted+', value: stageCount(['quoted', 'negotiation', 'booked', 'delivered']) },
      { label: 'Booked', value: stageCount(['booked', 'delivered']) },
      { label: 'Delivered', value: stageCount(['delivered']) },
    ]
    const repeat = d.contacts.filter((c) => contactStats(c, d.bookings).count >= 2).length
    const clients = d.contacts.filter((c) => contactStats(c, d.bookings).count >= 1).length
    return { sources, byLife, byService, lostReasons, months, top, stale, overdue, unanswered, upcomingBdays, funnel, repeat, clients, avg: clients ? live.reduce((s, b) => s + Number(b.total), 0) / clients : 0 }
  }, [d])

  const conv = d.contacts.length ? Math.round((r.clients / d.contacts.length) * 100) : 0
  return (
    <>
      <PageHead title="CRM reports" sub="Where clients come from, how they move through the funnel, and who needs attention" />
      <div className="ad-grid c4" style={{ marginBottom: 16 }}>
        <Stat label="Contacts" value={d.contacts.length} sub={`${r.clients} have booked`} />
        <Stat label="Lead → client" value={`${conv}%`} sub="of all contacts" />
        <Stat label="Repeat clients" value={r.repeat} sub={r.clients ? `${Math.round((r.repeat / r.clients) * 100)}% of clients` : ''} tone="good" />
        <Stat label="Avg. client value" value={gbp(Math.round(r.avg))} />
      </div>

      <div className="ad-grid c2" style={{ marginBottom: 16 }}>
        <div className="ad-card"><h3>Sales funnel <small>deals reaching each stage</small></h3><Bars rows={r.funnel} /></div>
        <div className="ad-card"><h3>New contacts vs. deals won <small>last 6 months</small></h3>
          <div className="ad-legend"><span><i style={{ background: '#0b0b0c' }} />New contacts</span><span><i style={{ background: '#c9c7bd' }} />Booked / delivered</span></div>
          <Columns rows={r.months} /></div>
      </div>

      <div className="ad-grid c2" style={{ marginBottom: 16 }}>
        <div className="ad-card"><h3>Lead sources <small>contacts → clients · revenue</small></h3>
          <div className="ad-tablewrap" style={{ border: 0 }}><table><thead><tr><th>Source</th><th className="num">Contacts</th><th className="num">Clients</th><th className="num">Conv.</th><th className="num">Revenue</th></tr></thead><tbody>
            {[...r.sources.entries()].sort((a, b) => b[1].revenue - a[1].revenue).map(([k, v]) => <tr key={k}><td>{k}</td><td className="num">{v.n}</td><td className="num">{v.clients}</td><td className="num">{v.n ? Math.round((v.clients / v.n) * 100) : 0}%</td><td className="num"><b>{gbp(v.revenue)}</b></td></tr>)}
          </tbody></table></div></div>
        <div className="ad-card"><h3>Revenue by service</h3><Bars money rows={[...r.byService.entries()].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }))} /></div>
      </div>

      <div className="ad-grid c3" style={{ marginBottom: 16 }}>
        <div className="ad-card"><h3>Lifecycle</h3><Bars rows={['lead', 'opportunity', 'client', 'vip', 'inactive', 'lost', 'subscriber'].map((l) => ({ label: l, value: r.byLife.get(l) ?? 0 }))} /></div>
        <div className="ad-card"><h3>Why deals are lost</h3><Bars rows={[...r.lostReasons.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([label, value]) => ({ label, value }))} /></div>
        <div className="ad-card"><h3>Follow-up health</h3>
          <div className="ad-list">
            <div><span>Overdue tasks</span><b className={r.overdue.length ? 'ad-err' : ''}>{r.overdue.length}</b></div>
            <div><span>Leads quiet for 7+ days</span><b className={r.stale.length ? 'ad-err' : ''}>{r.stale.length}</b></div>
            <div><span>Messages unanswered 24h+</span><b className={r.unanswered.length ? 'ad-err' : ''}>{r.unanswered.length}</b></div>
          </div></div>
      </div>

      <div className="ad-grid c2">
        <div className="ad-card"><h3>Top clients <small>lifetime value</small></h3>
          <div className="ad-list">{r.top.map((x) => <div key={x.c.id}><a href="#" onClick={(e) => { e.preventDefault(); setContact(x.c.id) }}><b>{x.c.name}</b> <span className="ad-muted">{x.count} booking{x.count === 1 ? '' : 's'}</span></a><b>{gbp(x.spent)}</b></div>)}{!r.top.length && <p className="ad-muted">Bookings will appear here.</p>}</div></div>
        <div className="ad-card"><h3>Birthdays · next 30 days</h3>
          <div className="ad-list">{r.upcomingBdays.map((x) => <div key={x.c.id}><a href="#" onClick={(e) => { e.preventDefault(); setContact(x.c.id) }}><b>{x.c.name}</b></a><span className="ad-muted">{x.days === 0 ? 'Today 🎂' : fmtDate(x.next.toISOString().slice(0, 10))}</span></div>)}{!r.upcomingBdays.length && <p className="ad-muted">Add birthdays to contacts to send automatic greetings.</p>}</div></div>
      </div>
      {contact && <ContactDrawer id={contact} onClose={() => setContact(null)} />}
    </>
  )
}
