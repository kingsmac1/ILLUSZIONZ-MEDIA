import { Fragment, useMemo, useState } from 'react'
import { flows } from '../../booking/catalog'
import { adminApi } from '../supabase'
import { useData, useDb, type R } from '../data'
import { Badge, Confirm, Empty, Field, Modal, PageHead, Pager, addDaysIso, downloadCsv, fmtDate, gbp, todayIso, useDebounced, waLink } from '../ui'
import { ContactDrawer } from '../crm/ContactDrawer'
import { TaskModal } from '../crm/shared'

const PAGE = 20
const STATUSES = ['new', 'confirmed', 'completed', 'cancelled']
const PAY = ['Not Paid', 'Deposit Paid', 'Paid', 'Refunded']
const METHODS = ['Bank transfer', 'Card', 'Cash', 'PayPal', 'Selar', 'Other']

export function PaymentModal({ booking, onClose }: { booking: R; onClose: () => void }) {
  const { toast } = useData()
  const db = useDb()
  const balance = Math.max(0, Number(booking.total) - Number(booking.amount_paid))
  const [amount, setAmount] = useState(String(balance || ''))
  const [method, setMethod] = useState('Bank transfer')
  const [date, setDate] = useState(todayIso())
  const [note, setNote] = useState('')
  const [receipt, setReceipt] = useState(!!booking.email && booking.source === 'website')
  async function save() {
    const n = Number(amount)
    if (!n) return toast('Enter an amount', 'err')
    const r = await db.insert('payments', { booking_id: booking.id, contact_id: booking.contact_id, amount: n, method, paid_at: date, note }, undefined, ['bookings'])
    if (!r.ok) return
    const paid = Number(booking.amount_paid) + n
    const status = booking.total > 0 && paid >= Number(booking.total) ? 'Paid' : paid > 0 ? 'Deposit Paid' : 'Not Paid'
    await db.update('bookings', { id: booking.id }, { amount_paid: paid, payment_status: status }, 'Payment recorded')
    if (booking.contact_id) await db.log({ contact_id: booking.contact_id, booking_id: booking.id, type: 'payment', subject: `Payment received ${gbp(n)} (${method})`, body: note, auto: true })
    if (receipt) {
      const res = await adminApi({ action: 'send_template', key: 'payment_receipt', booking_id: booking.id, vars: { amount: gbp(n), balance: gbp(Math.max(0, Number(booking.total) - paid)) } })
      if (!res.ok) toast(res.error ?? 'Receipt email failed', 'err')
    }
    onClose()
  }
  return (
    <Modal title={`Record payment · ${booking.name}`} onClose={onClose}>
      <p className="ad-muted" style={{ marginBottom: 14 }}>Total {gbp(booking.total)} · paid {gbp(booking.amount_paid)} · balance <b>{gbp(balance)}</b></p>
      <div className="ad-form">
        <Field label="Amount (£)"><input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus /></Field>
        <Field label="Date"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Method"><select value={method} onChange={(e) => setMethod(e.target.value)}>{METHODS.map((m) => <option key={m}>{m}</option>)}</select></Field>
        <Field label="Note"><input type="text" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        {booking.email && <label className="ad-check" style={{ gridColumn: '1/-1' }}><input type="checkbox" checked={receipt} onChange={(e) => setReceipt(e.target.checked)} />Email the client a payment receipt</label>}
        <div className="ad-formfoot"><button className="ad-btn" onClick={onClose}>Cancel</button><button className="ad-btn primary" onClick={save}>Save payment</button></div>
      </div>
    </Modal>
  )
}

function ManualBooking({ onClose }: { onClose: () => void }) {
  const { d, toast } = useData()
  const db = useDb()
  const [f, setF] = useState<R>({ flow: 'portrait', name: '', email: '', phone: '', packages: '', total: '', date: '', time: '', notes: '', status: 'confirmed', paid: '' })
  const set = (k: string, v: string) => setF((c) => ({ ...c, [k]: v }))
  async function save() {
    if (!f.name.trim()) return toast('Name is required', 'err')
    const flow = flows[f.flow]
    const email = f.email.trim().toLowerCase()
    let contact = d.contacts.find((c) => (email && c.email === email) || (f.phone && c.phone === f.phone.trim()))
    if (!contact) {
      const r = await db.insert('contacts', { name: f.name.trim(), email: email || null, phone: f.phone.trim(), source: 'other', lifecycle: 'client' })
      if (!r.ok) return
      contact = r.data[0]
    }
    const total = Number(f.total) || 0
    const paid = Number(f.paid) || 0
    const r = await db.insert('bookings', {
      flow_id: flow.id, kind: flow.kind, contact_id: contact!.id, name: f.name.trim(), email: email || null, phone: f.phone.trim(), packages: f.packages, total, total_text: total ? gbp(total) : '', event_date: f.date || null, event_time: f.time || null,
      status: f.status, source: 'manual', notes: f.notes, amount_paid: paid, payment_status: total && paid >= total ? 'Paid' : paid > 0 ? 'Deposit Paid' : 'Not Paid', confirmed_at: f.status === 'confirmed' ? new Date().toISOString() : null,
      details: [['Service', flow.title], ...(f.packages ? [['Package', f.packages]] : [])],
    }, 'Booking added', ['contacts', 'deals'])
    if (!r.ok) return
    await db.insert('deals', { title: `${flow.title} — ${f.name.trim()}`, contact_id: contact!.id, booking_id: r.data[0].id, service: flow.title, value: total, stage: f.status === 'new' ? 'new' : 'booked', source: 'other', event_date: f.date || null })
    if (paid) await db.insert('payments', { booking_id: r.data[0].id, contact_id: contact!.id, amount: paid, method: 'Other', note: 'Recorded at booking' }, undefined, ['bookings'])
    onClose()
  }
  return (
    <Modal title="Add a booking manually" onClose={onClose} wide>
      <p className="ad-muted" style={{ marginBottom: 14 }}>For walk-ins, calls and WhatsApp bookings. Manual bookings are never announced by email automatically.</p>
      <div className="ad-form">
        <Field label="Service"><select value={f.flow} onChange={(e) => set('flow', e.target.value)}>{Object.values(flows).map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}</select></Field>
        <Field label="Package / details"><input type="text" value={f.packages} onChange={(e) => set('packages', e.target.value)} placeholder="e.g. 2 Looks + 24-hour express" /></Field>
        <Field label="Client name *"><input type="text" value={f.name} onChange={(e) => set('name', e.target.value)} /></Field>
        <Field label="Phone / WhatsApp"><input type="tel" value={f.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
        <Field label="Email"><input type="email" value={f.email} onChange={(e) => set('email', e.target.value)} /></Field>
        <Field label="Status"><select value={f.status} onChange={(e) => set('status', e.target.value)}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></Field>
        <Field label="Date"><input type="date" value={f.date} onChange={(e) => set('date', e.target.value)} /></Field>
        <Field label="Time"><input type="time" value={f.time} onChange={(e) => set('time', e.target.value)} /></Field>
        <Field label="Total (£)"><input type="number" value={f.total} onChange={(e) => set('total', e.target.value)} /></Field>
        <Field label="Already paid (£)"><input type="number" value={f.paid} onChange={(e) => set('paid', e.target.value)} /></Field>
        <Field label="Notes" full><textarea value={f.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
        <div className="ad-formfoot"><button className="ad-btn" onClick={onClose}>Cancel</button><button className="ad-btn primary" onClick={save}>Add booking</button></div>
      </div>
    </Modal>
  )
}

export function BookingDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const { d, toast } = useData()
  const db = useDb()
  const b = d.bookings.find((x) => x.id === id)
  const [pay, setPay] = useState(false)
  const [task, setTask] = useState(false)
  const [contact, setContact] = useState(false)
  const [busy, setBusy] = useState('')
  const [notes, setNotes] = useState(b?.notes ?? '')
  if (!b) return null
  const deal = d.deals.find((x) => x.booking_id === b.id)
  const payments = d.payments.filter((p) => p.booking_id === b.id)

  async function setStatus(status: string) {
    const patch: R = { status }
    if (status === 'confirmed' && !b!.confirmed_at) patch.confirmed_at = new Date().toISOString()
    if (status === 'completed') patch.completed_at = new Date().toISOString()
    await db.update('bookings', { id }, patch, `Marked ${status}`)
    if (deal) {
      const stage = { confirmed: 'booked', completed: 'delivered', cancelled: 'lost', new: 'new' }[status]!
      await db.update('deals', { id: deal.id }, { stage, updated_at: new Date().toISOString(), closed_at: ['delivered', 'lost'].includes(stage) ? new Date().toISOString() : null, lost_reason: status === 'cancelled' ? 'Cancelled booking' : '' })
    }
    if (b!.contact_id) await db.log({ contact_id: b!.contact_id, booking_id: id, deal_id: deal?.id, type: 'system', subject: `Booking ${b!.ref} marked ${status}`, auto: true })
    if (status === 'completed' && b!.contact_id) await db.update('contacts', { id: b!.contact_id }, { lifecycle: 'client' })
  }
  async function email(key: string) {
    setBusy(key)
    const r = await adminApi({ action: 'send_template', key, booking_id: id })
    setBusy('')
    toast(r.ok ? 'Email sent' : r.error ?? 'Failed', r.ok ? 'ok' : 'err')
  }
  const details = (b.details ?? []) as [string, string][]
  return (
    <Modal wide onClose={onClose} title={<span>{b.kind} <span className="ad-muted" style={{ fontWeight: 500 }}>#{b.ref}</span></span>}>
      <div className="ad-actions" style={{ marginBottom: 16 }}>
        <select className="ad-btn sm" style={{ width: 'auto' }} value={b.status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
        <button className="ad-btn sm" onClick={() => setPay(true)}>+ Record payment</button>
        {b.phone && <a className="ad-btn sm" target="_blank" rel="noreferrer" href={waLink(b.phone, `Hi ${b.name.split(' ')[0]}, this is Illuszionz Media about your ${b.kind.toLowerCase()} (${b.ref}).`)}>WhatsApp</a>}
        {b.contact_id && <button className="ad-btn sm" onClick={() => setContact(true)}>Open in CRM</button>}
        <button className="ad-btn sm" onClick={() => setTask(true)}>+ Task</button>
      </div>
      <div className="ad-grid c3" style={{ marginBottom: 18 }}>
        <div className="ad-stat"><span>Total</span><strong>{b.total ? gbp(b.total) : b.total_text || 'Quoted'}</strong>{b.discount > 0 && <small>incl. {gbp(b.discount)} off ({b.promo_code})</small>}</div>
        <div className="ad-stat"><span>Paid</span><strong>{gbp(b.amount_paid)}</strong><small><Badge>{b.payment_status}</Badge></small></div>
        <div className="ad-stat"><span>Session</span><strong style={{ fontSize: 18 }}>{b.event_date ? fmtDate(b.event_date) : 'TBC'}</strong><small>{b.event_time ?? ''}</small></div>
      </div>
      <div className="ad-grid c2">
        <div>
          <h4 style={{ marginBottom: 10 }}>Client</h4>
          <dl className="ad-kv" style={{ marginBottom: 18 }}><dt>Name</dt><dd>{b.name}</dd><dt>Phone</dt><dd>{b.phone || '—'}</dd><dt>Email</dt><dd>{b.email || '—'}</dd><dt>Source</dt><dd>{b.source}</dd><dt>Received</dt><dd>{fmtDate(b.created_at, true)}</dd></dl>
          <h4 style={{ marginBottom: 10 }}>Booking details</h4>
          <dl className="ad-kv">{details.map(([k, v]) => <Fragment key={k + v}><dt>{k}</dt><dd>{v}</dd></Fragment>)}</dl>
        </div>
        <div>
          <h4 style={{ marginBottom: 10 }}>Priced items</h4>
          <div className="ad-list" style={{ marginBottom: 18 }}>{((b.items ?? []) as { label: string; amount: string }[]).map((i) => <div key={i.label}><span>{i.label}</span><b>{i.amount}</b></div>)}{!(b.items ?? []).length && <p className="ad-muted">—</p>}</div>
          <h4 style={{ marginBottom: 10 }}>Payments</h4>
          <div className="ad-list" style={{ marginBottom: 18 }}>{payments.map((p) => <div key={p.id}><span>{fmtDate(p.paid_at)} · {p.method}{p.note ? ` · ${p.note}` : ''}</span><span><b>{gbp(p.amount)}</b> <button className="ad-btn sm danger" onClick={async () => { if (!window.confirm('Remove this payment?')) return; await db.remove('payments', { id: p.id }); const paid = Math.max(0, Number(b.amount_paid) - Number(p.amount)); await db.update('bookings', { id }, { amount_paid: paid, payment_status: paid <= 0 ? 'Not Paid' : paid >= b.total ? 'Paid' : 'Deposit Paid' }) }}>✕</button></span></div>)}{!payments.length && <p className="ad-muted">No payments yet.</p>}</div>
          <h4 style={{ marginBottom: 10 }}>Send an email</h4>
          <div className="ad-actions">{b.email ? <>
            {[['booking_confirmed', 'Confirmation'], ['reminder_24h', 'Reminder'], ['payment_reminder', 'Balance reminder'], ['thank_you', 'Thank-you'], ['review_request', 'Review request']].map(([k, l]) => <button key={k} className="ad-btn sm" disabled={!!busy} onClick={() => email(k)}>{busy === k ? 'Sending…' : l}</button>)}</> : <span className="ad-muted">No email address on this booking.</span>}</div>
        </div>
      </div>
      <h4 style={{ margin: '18px 0 8px' }}>Internal notes</h4>
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
        <Confirm text="Delete this booking permanently?" onYes={async () => { const r = await db.remove('bookings', { id }, 'Booking deleted', ['deals', 'payments']); if (r.ok) onClose() }}>Delete booking</Confirm>
        <button className="ad-btn primary sm" onClick={() => db.update('bookings', { id }, { payment_status: b.payment_status, notes }, 'Notes saved')}>Save notes</button>
      </div>
      {pay && <PaymentModal booking={b} onClose={() => setPay(false)} />}
      {task && <TaskModal defaults={{ contact_id: b.contact_id, booking_id: b.id, deal_id: deal?.id, title: `${b.kind} — ${b.name}: ` }} onClose={() => setTask(false)} />}
      {contact && b.contact_id && <ContactDrawer id={b.contact_id} onClose={() => setContact(false)} />}
    </Modal>
  )
}

export function Bookings() {
  const { d } = useData()
  const [q, setQ] = useState('')
  const dq = useDebounced(q)
  const [status, setStatus] = useState('')
  const [pay, setPay] = useState('')
  const [flow, setFlow] = useState('')
  const [range, setRange] = useState('')
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const list = useMemo(() => {
    const today = todayIso()
    return d.bookings.filter((b) => {
      if (status && b.status !== status) return false
      if (pay && b.payment_status !== pay) return false
      if (flow && b.flow_id !== flow) return false
      if (range === 'upcoming' && !(b.event_date && b.event_date >= today)) return false
      if (range === 'week' && !(b.event_date && b.event_date >= today && b.event_date <= addDaysIso(today, 7))) return false
      if (range === 'past' && !(b.event_date && b.event_date < today)) return false
      if (range === 'unpaid' && !(b.status !== 'cancelled' && Number(b.total) > Number(b.amount_paid))) return false
      if (dq && !`${b.name} ${b.email} ${b.phone} ${b.ref} ${b.kind} ${b.packages}`.toLowerCase().includes(dq.toLowerCase())) return false
      return true
    })
  }, [d.bookings, status, pay, flow, range, dq])
  const pages = Math.max(1, Math.ceil(list.length / PAGE))
  const view = list.slice((Math.min(page, pages) - 1) * PAGE, Math.min(page, pages) * PAGE)

  return (
    <>
      <PageHead title="Bookings" sub={`${d.bookings.length} total · ${d.bookings.filter((b) => b.status === 'new').length} waiting to be confirmed`} actions={<>
        <button className="ad-btn" onClick={() => downloadCsv('bookings', list.map((b) => ({ ref: b.ref, received: b.created_at, service: b.kind, packages: b.packages, name: b.name, email: b.email, phone: b.phone, date: b.event_date, time: b.event_time, status: b.status, total: b.total, paid: b.amount_paid, payment: b.payment_status, source: b.source })))}>Export CSV</button>
        <button className="ad-btn primary" onClick={() => setAdding(true)}>+ Add booking</button></>} />
      <div className="ad-toolbar">
        <input type="search" placeholder="Search name, ref, email, phone…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} />
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }}><option value="">All statuses</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
        <select value={pay} onChange={(e) => { setPay(e.target.value); setPage(1) }}><option value="">All payments</option>{PAY.map((s) => <option key={s}>{s}</option>)}</select>
        <select value={flow} onChange={(e) => { setFlow(e.target.value); setPage(1) }}><option value="">All services</option>{Object.values(flows).map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}</select>
        <select value={range} onChange={(e) => { setRange(e.target.value); setPage(1) }}><option value="">Any date</option><option value="week">Next 7 days</option><option value="upcoming">Upcoming</option><option value="past">Past sessions</option><option value="unpaid">Balance outstanding</option></select>
      </div>
      <div className="ad-tablewrap">
        <table>
          <thead><tr><th>Ref</th><th>Client</th><th>Service</th><th>Session</th><th>Status</th><th>Payment</th><th className="num">Total</th></tr></thead>
          <tbody>
            {view.map((b) => (
              <tr key={b.id} className="click" onClick={() => setOpen(b.id)}>
                <td><b>{b.ref}</b><span className="sub">{fmtDate(b.created_at)}</span></td>
                <td><b>{b.name}</b><span className="sub">{b.email || b.phone}</span></td>
                <td>{b.kind.replace(/ booking$/i, '')}<span className="sub">{b.packages}</span></td>
                <td>{b.event_date ? fmtDate(b.event_date) : <span className="ad-muted">TBC</span>}<span className="sub">{b.event_time}</span></td>
                <td><Badge>{b.status}</Badge></td>
                <td><Badge>{b.payment_status}</Badge></td>
                <td className="num"><b>{b.total ? gbp(b.total) : '—'}</b>{Number(b.total) > Number(b.amount_paid) && b.status !== 'cancelled' && Number(b.amount_paid) > 0 && <span className="sub">due {gbp(Number(b.total) - Number(b.amount_paid))}</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!view.length && <Empty title="No bookings found" hint="Bookings made on the website appear here instantly." />}
        <Pager page={Math.min(page, pages)} pages={pages} onChange={setPage} />
      </div>
      {open && <BookingDetail id={open} onClose={() => setOpen(null)} />}
      {adding && <ManualBooking onClose={() => setAdding(false)} />}
    </>
  )
}
