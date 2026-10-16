import { useMemo, useState } from 'react'
import { useData, useDb, type R } from '../data'
import { Bars, Columns, Empty, Field, Modal, PageHead, Stat, Tabs, downloadCsv, fmtDate, gbp, todayIso } from '../ui'

type Kind = 'expense' | 'income'
function EntryModal({ kind, row, onClose }: { kind: Kind; row?: R; onClose: () => void }) {
  const { d } = useData()
  const db = useDb()
  const isExp = kind === 'expense'
  const [f, setF] = useState<R>(row ?? (isExp ? { spent_on: todayIso(), category: 'Other', vendor: '', amount: '', note: '' } : { received_on: todayIso(), source: '', amount: '', note: '' }))
  const set = (k: string, v: string) => setF((c) => ({ ...c, [k]: v }))
  async function save() {
    if (!Number(f.amount)) return
    const table = isExp ? 'expenses' : 'other_income'
    const data = isExp ? { spent_on: f.spent_on, category: f.category, vendor: f.vendor, amount: Number(f.amount), note: f.note } : { received_on: f.received_on, source: f.source, amount: Number(f.amount), note: f.note }
    const r = row ? await db.update(table, { id: row.id }, data, 'Saved') : await db.insert(table, data, 'Added')
    if (r.ok) onClose()
  }
  return (
    <Modal title={`${row ? 'Edit' : 'Add'} ${isExp ? 'expense' : 'other income'}`} onClose={onClose}>
      <div className="ad-form">
        <Field label="Date"><input type="date" value={isExp ? f.spent_on : f.received_on} onChange={(e) => set(isExp ? 'spent_on' : 'received_on', e.target.value)} /></Field>
        <Field label="Amount (£)"><input type="number" value={f.amount} onChange={(e) => set('amount', e.target.value)} autoFocus /></Field>
        {isExp ? (
          <>
            <Field label="Category"><select value={f.category} onChange={(e) => set('category', e.target.value)}>{d.expense_categories.map((c) => <option key={c.name}>{c.name}</option>)}</select></Field>
            <Field label="Vendor / paid to"><input type="text" value={f.vendor} onChange={(e) => set('vendor', e.target.value)} /></Field>
          </>
        ) : <Field label="Source" full><input type="text" value={f.source} onChange={(e) => set('source', e.target.value)} placeholder="e.g. Print sales, studio hire, brand collab" /></Field>}
        <Field label="Note" full><input type="text" value={f.note} onChange={(e) => set('note', e.target.value)} /></Field>
        <div className="ad-formfoot"><button className="ad-btn" onClick={onClose}>Cancel</button><button className="ad-btn primary" onClick={save}>Save</button></div>
      </div>
    </Modal>
  )
}

export function Finance() {
  const { d } = useData()
  const db = useDb()
  const [tab, setTab] = useState<'summary' | 'payments' | 'expenses' | 'income'>('summary')
  const [range, setRange] = useState('month')
  const [edit, setEdit] = useState<null | { kind: Kind; row?: R }>(null)

  const from = useMemo(() => {
    const n = new Date()
    if (range === 'month') return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-01`
    if (range === '90') return new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10)
    if (range === 'year') return `${n.getFullYear()}-01-01`
    return '0000-00-00'
  }, [range])
  const pay = d.payments.filter((p) => p.paid_at >= from)
  const inc = d.other_income.filter((i) => i.received_on >= from)
  const exp = d.expenses.filter((e) => e.spent_on >= from)
  const sum = (a: R[], k: string) => a.reduce((s, x) => s + Number(x[k]), 0)
  const bookingRev = sum(pay, 'amount')
  const revenue = bookingRev + sum(inc, 'amount')
  const spent = sum(exp, 'amount')
  const byCat = new Map<string, number>()
  exp.forEach((e) => byCat.set(e.category, (byCat.get(e.category) ?? 0) + Number(e.amount)))
  const bookingById = new Map(d.bookings.map((b) => [b.id, b]))
  const byService = new Map<string, number>()
  pay.forEach((p) => { const k = (bookingById.get(p.booking_id)?.kind ?? 'Other').replace(/ booking$/i, ''); byService.set(k, (byService.get(k) ?? 0) + Number(p.amount)) })
  const outstanding = d.bookings.filter((b) => b.status !== 'cancelled' && b.status !== 'new' && Number(b.total) > Number(b.amount_paid))
  const months = Array.from({ length: 6 }, (_, i) => { const dt = new Date(); dt.setDate(1); dt.setMonth(dt.getMonth() - (5 - i)); return { key: `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`, label: dt.toLocaleDateString('en-GB', { month: 'short' }) } })
  const chart = months.map((m) => ({ label: m.label, a: sum(d.payments.filter((p) => p.paid_at.startsWith(m.key)), 'amount') + sum(d.other_income.filter((i) => i.received_on.startsWith(m.key)), 'amount'), b: sum(d.expenses.filter((e) => e.spent_on.startsWith(m.key)), 'amount') }))

  return (
    <>
      <PageHead title="Finance" sub="Money in, money out and what clients still owe" actions={<>
        <select value={range} onChange={(e) => setRange(e.target.value)} className="ad-btn"><option value="month">This month</option><option value="90">Last 90 days</option><option value="year">This year</option><option value="all">All time</option></select>
        <button className="ad-btn" onClick={() => setEdit({ kind: 'income' })}>+ Other income</button>
        <button className="ad-btn primary" onClick={() => setEdit({ kind: 'expense' })}>+ Expense</button></>} />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'summary', label: 'Summary' }, { id: 'payments', label: 'Payments', count: pay.length }, { id: 'expenses', label: 'Expenses', count: exp.length }, { id: 'income', label: 'Other income', count: inc.length }]} />

      {tab === 'summary' && (
        <>
          <div className="ad-grid c4" style={{ marginBottom: 16 }}>
            <Stat label="Revenue" value={gbp(revenue)} sub={`Bookings ${gbp(bookingRev)} · other ${gbp(sum(inc, 'amount'))}`} />
            <Stat label="Expenses" value={gbp(spent)} sub={`${exp.length} entries`} />
            <Stat label="Net profit" value={gbp(revenue - spent)} tone={revenue - spent >= 0 ? 'good' : 'warn'} sub={revenue ? `${Math.round(((revenue - spent) / revenue) * 100)}% margin` : ''} />
            <Stat label="Still owed" value={gbp(outstanding.reduce((s, b) => s + Number(b.total) - Number(b.amount_paid), 0))} sub={`${outstanding.length} confirmed bookings`} tone={outstanding.length ? 'warn' : ''} />
          </div>
          <div className="ad-grid c2" style={{ marginBottom: 16 }}>
            <div className="ad-card"><h3>Last 6 months</h3><div className="ad-legend"><span><i style={{ background: '#0b0b0c' }} />Revenue</span><span><i style={{ background: '#c9c7bd' }} />Expenses</span></div><Columns money rows={chart} /></div>
            <div className="ad-card"><h3>Revenue by service</h3><Bars money rows={[...byService.entries()].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }))} /></div>
          </div>
          <div className="ad-grid c2">
            <div className="ad-card"><h3>Spending by category</h3><Bars money color="#b45309" rows={[...byCat.entries()].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }))} /></div>
            <div className="ad-card"><h3>Balances to chase</h3>
              <div className="ad-list">{outstanding.sort((a, b) => (a.event_date ?? '9').localeCompare(b.event_date ?? '9')).slice(0, 8).map((b) => <div key={b.id}><span><b>{b.name}</b> <span className="ad-muted">· {b.kind.replace(/ booking$/i, '')} {b.event_date ? fmtDate(b.event_date) : ''}</span></span><b className="ad-err">{gbp(Number(b.total) - Number(b.amount_paid))}</b></div>)}{!outstanding.length && <p className="ad-muted">Everyone is paid up 🎉</p>}</div></div>
          </div>
        </>
      )}

      {tab === 'payments' && (
        <div className="ad-tablewrap"><table><thead><tr><th>Date</th><th>Client</th><th>Service</th><th>Method</th><th>Note</th><th className="num">Amount</th></tr></thead><tbody>
          {pay.map((p) => { const b = bookingById.get(p.booking_id); return <tr key={p.id}><td>{fmtDate(p.paid_at)}</td><td>{b?.name ?? '—'}</td><td>{b?.kind.replace(/ booking$/i, '')}</td><td>{p.method}</td><td className="ad-muted">{p.note}</td><td className="num"><b>{gbp(p.amount)}</b></td></tr> })}
        </tbody></table>{!pay.length && <Empty title="No payments in this period" hint="Record payments from a booking's detail view." />}
        {pay.length > 0 && <div style={{ padding: 12, textAlign: 'right' }}><button className="ad-btn sm" onClick={() => downloadCsv('payments', pay.map((p) => ({ date: p.paid_at, client: bookingById.get(p.booking_id)?.name, method: p.method, amount: p.amount, note: p.note })))}>Export CSV</button></div>}</div>
      )}

      {tab === 'expenses' && (
        <div className="ad-tablewrap"><table><thead><tr><th>Date</th><th>Category</th><th>Vendor</th><th>Note</th><th className="num">Amount</th><th /></tr></thead><tbody>
          {exp.map((e) => <tr key={e.id}><td>{fmtDate(e.spent_on)}</td><td>{e.category}</td><td>{e.vendor}</td><td className="ad-muted">{e.note}</td><td className="num"><b>{gbp(e.amount)}</b></td><td className="num"><button className="ad-btn sm" onClick={() => setEdit({ kind: 'expense', row: e })}>Edit</button> <button className="ad-btn sm danger" onClick={() => window.confirm('Delete this expense?') && db.remove('expenses', { id: e.id })}>✕</button></td></tr>)}
        </tbody></table>{!exp.length && <Empty title="No expenses in this period" />}
        {exp.length > 0 && <div style={{ padding: 12, textAlign: 'right' }}><button className="ad-btn sm" onClick={() => downloadCsv('expenses', exp.map((e) => ({ date: e.spent_on, category: e.category, vendor: e.vendor, amount: e.amount, note: e.note })))}>Export CSV</button></div>}</div>
      )}

      {tab === 'income' && (
        <div className="ad-tablewrap"><table><thead><tr><th>Date</th><th>Source</th><th>Note</th><th className="num">Amount</th><th /></tr></thead><tbody>
          {inc.map((e) => <tr key={e.id}><td>{fmtDate(e.received_on)}</td><td>{e.source}</td><td className="ad-muted">{e.note}</td><td className="num"><b>{gbp(e.amount)}</b></td><td className="num"><button className="ad-btn sm" onClick={() => setEdit({ kind: 'income', row: e })}>Edit</button> <button className="ad-btn sm danger" onClick={() => window.confirm('Delete this entry?') && db.remove('other_income', { id: e.id })}>✕</button></td></tr>)}
        </tbody></table>{!inc.length && <Empty title="No other income in this period" hint="Track print sales, studio hire, brand collaborations and anything outside bookings." />}</div>
      )}
      {edit && <EntryModal kind={edit.kind} row={edit.row} onClose={() => setEdit(null)} />}
    </>
  )
}
