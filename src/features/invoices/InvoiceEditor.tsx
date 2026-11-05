import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { adminApi, supabase } from '../../admin/supabase'
import { useData, useDb } from '../../admin/data'
import { Badge, Field, Modal, addDaysIso, fmtDate, gbp, todayIso } from '../../admin/ui'
import { BUSINESS_FIELDS, DEFAULT_LOGO, STAGE_LABEL, STAGE_TONE, USUAL_DEPOSIT, blankInvoice, defaultEmail, emptyItem, invoiceFromBooking, invoiceTotals, lineAmount, money, nextNumber, normalizeDoc, num, paymentsFromBooking, pdfFilename, plain, type BusinessDefaults, type InvoiceDoc, type InvoicePayment, type InvoiceStage } from './model'
import { InvoicePaper } from './InvoicePaper'
import { SETUP_NOTE, missingTable, type InvoiceRow } from './InvoicesSection'
import './invoices.css'

const METHODS = ['Bank transfer', 'Card', 'Cash', 'PayPal', 'Selar', 'Other']
const TERMS: Record<string, number> = { 'Due on Receipt': 0, 'Due in 7 days': 7, 'Due in 14 days': 14, 'Due in 30 days': 30 }
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const Section = ({ title, children, side }: { title: string; children: ReactNode; side?: ReactNode }) => (
  <section className="ad-card"><h3>{title}{side}</h3>{children}</section>
)

/** Shrinks an uploaded logo and re-encodes it, so only a small PNG is ever stored or put in the PDF. */
function logoToPng(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, 800 / img.naturalWidth, 300 / img.naturalHeight)
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That image could not be read. Choose a JPG or PNG.')) }
    img.src = url
  })
}

/**
 * The invoice form with the live preview beside it.
 *   `#/invoices/new`                        a blank invoice for anyone
 *   `#/invoices/new/<bookingId>`            a new invoice filled in from a booking
 *   `#/invoices/booking/<bookingId>[/send]` the booking's latest invoice with its payments brought up to date (or a new one)
 *   `#/invoices/<id>`                       a saved invoice
 */
export function InvoiceEditor({ path }: { path: string[] }) {
  const { d, toast, setting, refresh } = useData()
  const db = useDb()
  const [mode, target, after] = path
  const bookingId = mode === 'booking' || (mode === 'new' && target) ? target : null
  const booking = useMemo(() => (bookingId ? d.bookings.find((b) => b.id === bookingId) ?? null : null), [bookingId, d.bookings])

  const [id, setId] = useState<string | null>(mode !== 'new' && mode !== 'booking' ? mode : null)
  const [linkedBooking, setLinkedBooking] = useState<string | null>(bookingId)
  const [doc, setDoc] = useState<InvoiceDoc | null>(null)
  const [row, setRow] = useState<InvoiceRow | null>(null)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState('')
  const [reused, setReused] = useState<string | null>(null)
  const [view, setView] = useState<'edit' | 'preview'>('edit')
  const [busy, setBusy] = useState('')
  const [send, setSend] = useState<null | { to: string; subject: string; message: string }>(null)
  const invoiceDefaults = setting<BusinessDefaults>('invoice_defaults', {})

  /* ---------- open ---------- */
  const opened = useRef(false)
  useEffect(() => {
    if (opened.current) return
    opened.current = true
    ;(async () => {
      const today = todayIso()
      const bookingPayments = booking ? d.payments.filter((p) => p.booking_id === booking.id) : []
      const { data: all, error: err } = await supabase!.from('invoices').select('id,number,booking_id,created_at').order('created_at', { ascending: false }).limit(2000)
      if (err) { setError(missingTable(err.message) ? SETUP_NOTE : err.message); setDoc(blankInvoice(today, invoiceDefaults)); return }
      const used = (all ?? []) as { id: string; number: string; booking_id: string | null }[]
      let openId = mode !== 'new' && mode !== 'booking' ? mode : null
      if (mode === 'booking') openId = used.find((u) => u.booking_id === target)?.id ?? null

      if (openId) {
        const { data, error: e2 } = await supabase!.from('invoices').select('*').eq('id', openId).maybeSingle()
        if (e2 || !data) { setError(e2?.message ?? 'This invoice no longer exists.'); return }
        const r = data as InvoiceRow
        let opening = normalizeDoc(r.doc)
        setRow(r); setId(r.id); setLinkedBooking(r.booking_id)
        if (mode === 'booking' && booking) {
          // arriving from the booking: its recorded payments are the up-to-date ones
          const fresh = paymentsFromBooking(booking, bookingPayments)
          if (JSON.stringify(fresh) !== JSON.stringify(opening.payments)) { opening = { ...opening, payments: fresh }; setDirty(true) }
          setReused(r.number)
        }
        setDoc(opening)
        if (after === 'send') openSend(opening)
        return
      }
      const base = { ...blankInvoice(today, invoiceDefaults), number: nextNumber(used.map((u) => u.number)) }
      const start = booking ? invoiceFromBooking(base, booking, bookingPayments) : base
      setDoc(start)
      setDirty(!!booking)
      if (after === 'send') openSend(start)
    })().catch((e) => setError(e instanceof Error ? e.message : 'This invoice could not be opened.'))
    // opens once; the form owns the invoice from then on
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ---------- nothing typed is lost by accident ---------- */
  const dirtyRef = useRef(false)
  dirtyRef.current = dirty
  useEffect(() => {
    const leave = (e: BeforeUnloadEvent) => { if (dirtyRef.current) e.preventDefault() }
    const click = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.('a[href^="#/"]')
      if (a && dirtyRef.current && !a.getAttribute('target') && !window.confirm('Leave this invoice without saving your changes?')) { e.preventDefault(); e.stopPropagation() }
    }
    window.addEventListener('beforeunload', leave)
    document.addEventListener('click', click, true)
    return () => { window.removeEventListener('beforeunload', leave); document.removeEventListener('click', click, true) }
  }, [])

  const totals = useMemo(() => (doc ? invoiceTotals(doc) : null), [doc])
  if (error && !doc) return <div className="ad-note" role="alert">{error} <a href="#/invoices">Back to invoices</a></div>
  if (!doc || !totals) return <p className="ad-muted">Loading…</p>

  const patch = (p: Partial<InvoiceDoc>) => { setDoc((c) => (c ? { ...c, ...p } : c)); setDirty(true) }
  const text = (k: keyof InvoiceDoc) => ({ value: doc[k] as string, onChange: (e: { target: { value: string } }) => patch({ [k]: e.target.value } as Partial<InvoiceDoc>) })

  const setItem = (n: number, p: Partial<InvoiceDoc['items'][number]>) => patch({ items: doc.items.map((it, i) => {
    if (i !== n) return it
    const next = { ...it, ...p }
    // qty × rate fills the amount; typing in Amount itself overrides it (a discounted line, say)
    return 'qty' in p || 'rate' in p ? { ...next, amount: lineAmount(next.qty, next.rate) } : next
  }) })
  const setPayment = (n: number, p: Partial<InvoicePayment>) => patch({ payments: doc.payments.map((x, i) => (i === n ? { ...x, ...p } : x)) })

  /** The three buttons only change the payment lines: the status always follows from the money, so they cannot disagree. */
  function chooseStage(s: InvoiceStage) {
    const t = invoiceTotals(doc!)
    if (s === t.stage) return
    const today = todayIso()
    if (s === 'before') {
      if (!window.confirm('Remove the payment lines from this invoice?')) return
      return patch({ payments: [] })
    }
    if (t.total <= 0) return toast('Add an item with a price first', 'err')
    if (s === 'paid') return patch({ payments: [...doc!.payments, { date: today, method: 'Bank transfer', amount: plain(t.balance) }] })
    const part = plain(t.total > USUAL_DEPOSIT ? USUAL_DEPOSIT : Math.round((t.total / 2) * 100) / 100)
    patch({ payments: [{ date: doc!.payments[0]?.date || today, method: doc!.payments[0]?.method || 'Bank transfer', amount: part }] })
  }

  /* ---------- save ---------- */
  function problem(toSend = false) {
    if (!doc!.number.trim()) return 'Enter an invoice number'
    if (toSend && !doc!.billName.trim()) return 'Enter who the invoice is for'
    if (toSend && !doc!.items.some((i) => i.title.trim() && i.amount.trim())) return 'Add at least one item with an amount'
    return ''
  }
  async function save(quiet = false): Promise<string | null> {
    const bad = problem()
    if (bad) { toast(bad, 'err'); return null }
    const clean = { ...doc!, number: doc!.number.trim() }
    const values = { number: clean.number, doc: clean, booking_id: linkedBooking, contact_id: linkedBooking ? d.bookings.find((b) => b.id === linkedBooking)?.contact_id ?? null : null, updated_at: new Date().toISOString() }
    const res = id ? await supabase!.from('invoices').update(values).eq('id', id).select().single() : await supabase!.from('invoices').insert(values).select().single()
    if (res.error) {
      const msg = res.error.code === '23505' ? `Invoice number ${clean.number} is already used. Choose another one.` : missingTable(res.error.message) ? SETUP_NOTE : res.error.message
      toast(msg, 'err')
      return null
    }
    const saved = res.data as InvoiceRow
    setRow(saved); setId(saved.id); setDirty(false)
    if (!quiet) { toast('✓ Invoice saved'); showSaved(saved.id) }
    return saved.id
  }
  /** moves the address on to the saved invoice, so a reload or + New invoice behaves from here on */
  function showSaved(savedId: string) {
    const hash = `#/invoices/${savedId}`
    if (window.location.hash !== hash) window.location.hash = hash
  }
  async function saveDefaults() {
    const value = Object.fromEntries(BUSINESS_FIELDS.map((k) => [k, doc![k]]))
    await db.upsert('settings', { key: 'invoice_defaults', value, updated_at: new Date().toISOString() }, 'key', 'New invoices will start with these business details')
  }

  /* ---------- pdf + send ---------- */
  async function download() {
    setBusy('pdf')
    try {
      const { buildInvoicePdf, downloadBytes } = await import('./pdf')
      downloadBytes(await buildInvoicePdf(doc!), pdfFilename(doc!.number))
    } catch (e) { toast(e instanceof Error ? e.message : 'The PDF could not be made', 'err') }
    setBusy('')
  }
  function openSend(from: InvoiceDoc = doc!) { setSend({ to: from.billEmail, ...defaultEmail(from) }) }
  async function sendNow() {
    const bad = problem(true)
    if (bad) return toast(bad, 'err')
    if (!EMAIL_RE.test(send!.to.trim())) return toast('Enter a valid email address', 'err')
    if (!send!.subject.trim() || !send!.message.trim()) return toast('Enter a subject and a message', 'err')
    setBusy('send')
    try {
      const invoiceId = dirty || !id ? await save(true) : id
      if (!invoiceId) return
      const { buildInvoicePdf, toBase64 } = await import('./pdf')
      const pdf = toBase64(await buildInvoicePdf(doc!))
      const r = await adminApi<{ dryRun?: boolean; sent_at?: string }>({ action: 'invoice_send', invoice_id: invoiceId, to: send!.to.trim(), subject: send!.subject.trim(), message: send!.message, pdf })
      if (!r.ok) return toast(r.error ?? 'The invoice could not be sent', 'err')
      toast(r.dryRun ? 'Test mode: the email was not really sent' : `✓ Invoice sent to ${send!.to.trim()}`)
      const { data } = await supabase!.from('invoices').select('*').eq('id', invoiceId).maybeSingle()
      if (data) setRow(data as InvoiceRow)
      setSend(null)
      refresh('contacts')
      showSaved(invoiceId)
    } catch (e) { toast(e instanceof Error ? e.message : 'The invoice could not be sent', 'err') }
    finally { setBusy('') }
  }

  const linked = linkedBooking ? d.bookings.find((b) => b.id === linkedBooking) : null
  const bookingPaid = linked ? Number(linked.amount_paid) : 0
  const stageChanged = row?.sent_stage && row.sent_stage !== totals.stage

  return (
    <>
      <div className="iv-bar">
        <a className="ad-btn sm" href="#/invoices" aria-label="Back to all invoices">← Invoices</a>
        <h1>{doc.number || 'New invoice'}</h1>
        <Badge tone={STAGE_TONE[totals.stage]}>{STAGE_LABEL[totals.stage]}</Badge>
        <span className="sp" />
        {dirty ? <span className="iv-saved">Not saved yet</span> : row ? <span className="iv-saved">Saved</span> : null}
        <button className="ad-btn" disabled={!!busy} onClick={() => save()}>Save</button>
        <button className="ad-btn" disabled={!!busy} onClick={download}>{busy === 'pdf' ? 'Making PDF…' : 'Download PDF'}</button>
        <button className="ad-btn primary" disabled={!!busy} onClick={() => openSend()}>Email to client</button>
      </div>
      {error && <div className="ad-note" style={{ marginBottom: 14 }} role="alert">{error}</div>}
      {reused && (
        <div className="ad-note" style={{ marginBottom: 14 }}>
          This booking already has invoice {reused}, so it opened with its payments brought up to date. <a href={`#/invoices/new/${bookingId}`}>Start a new invoice instead</a>
        </div>
      )}
      {row?.sent_at && (
        <p className="iv-hint" style={{ margin: '0 0 14px' }}>
          Last sent {fmtDate(row.sent_at, true)} to {row.sent_to}{row.sent_stage ? ` as ${STAGE_LABEL[row.sent_stage].toLowerCase()}` : ''}.
          {stageChanged ? ' The payment has changed since, so the client has not seen this version.' : ''}
        </p>
      )}
      <div className="iv-tabs" role="tablist" aria-label="Edit or preview">
        <button role="tab" aria-selected={view === 'edit'} onClick={() => setView('edit')}>Edit</button>
        <button role="tab" aria-selected={view === 'preview'} onClick={() => setView('preview')}>Preview</button>
      </div>
      <div className="iv-layout" data-view={view}>
        <div className="iv-form">
          <Section title="Payment">
            <div className="iv-stages" role="group" aria-label="Payment status">
              {(Object.keys(STAGE_LABEL) as InvoiceStage[]).map((s) => <button key={s} type="button" aria-pressed={totals.stage === s} onClick={() => chooseStage(s)}>{STAGE_LABEL[s]}</button>)}
            </div>
            <p className="iv-hint">{totals.stage === 'before' ? 'Nothing paid yet: the client sees the full amount as due.' : totals.stage === 'part' ? `${money(totals.paid)} paid, ${money(totals.balance)} still due.` : 'Fully paid: the invoice is marked PAID and shows nothing due.'}</p>
            {linked && Math.round(bookingPaid * 100) !== Math.round(totals.paid * 100) && (
              <p className="ad-note" style={{ marginTop: 10 }}>
                The booking shows {gbp(bookingPaid)} paid but this invoice shows {gbp(totals.paid)}. Payments typed here are not added to Finance; use Record payment on the booking for that.{' '}
                <button type="button" className="ad-btn sm" onClick={() => patch({ payments: paymentsFromBooking(linked, d.payments.filter((p) => p.booking_id === linked.id)) })}>Use the booking’s payments</button>
              </p>
            )}
          </Section>

          <Section title="Invoice details">
            <div className="iv-grid">
              <Field label="Title"><input type="text" {...text('title')} /></Field>
              <Field label="Invoice number"><input type="text" {...text('number')} /></Field>
              <Field label="Invoice date"><input type="date" {...text('invoiceDate')} /></Field>
              <Field label="Terms">
                <input type="text" list="iv-terms" value={doc.terms} onChange={(e) => {
                  const days = TERMS[e.target.value]
                  patch(days != null && doc.invoiceDate ? { terms: e.target.value, dueDate: addDaysIso(doc.invoiceDate, days) } : { terms: e.target.value })
                }} />
                <datalist id="iv-terms">{Object.keys(TERMS).map((t) => <option key={t} value={t} />)}</datalist>
              </Field>
              <Field label="Due date"><input type="date" {...text('dueDate')} /></Field>
            </div>
          </Section>

          <Section title="Bill to">
            <div className="iv-grid">
              <Field label="Client name" full><input type="text" {...text('billName')} /></Field>
              <Field label="Email"><input type="email" {...text('billEmail')} /></Field>
              <Field label="Phone"><input type="tel" {...text('billPhone')} /></Field>
              <Field label="Address" full><textarea rows={2} style={{ minHeight: 60 }} {...text('billAddress')} /></Field>
            </div>
          </Section>

          <Section title="Items">
            {doc.items.map((it, n) => (
              <div className="iv-row" key={n} data-invoice-item>
                <div className="iv-row-top">
                  <span>Item {n + 1}</span>
                  {doc.items.length > 1 && <button type="button" className="ad-btn sm danger" onClick={() => patch({ items: doc.items.filter((_, i) => i !== n) })} aria-label={`Remove item ${n + 1}`}>Remove</button>}
                </div>
                <Field label="Item"><input type="text" value={it.title} onChange={(e) => setItem(n, { title: e.target.value })} placeholder="e.g. 2looks Baby shoot" /></Field>
                <Field label="Description"><textarea rows={3} style={{ minHeight: 74 }} value={it.description} onChange={(e) => setItem(n, { description: e.target.value })} placeholder={'Date, time, location, what’s included'} /></Field>
                <div className="iv-row-nums">
                  <Field label="Qty"><input type="number" min="0" step="any" value={it.qty} onChange={(e) => setItem(n, { qty: e.target.value })} /></Field>
                  <Field label="Rate (£)"><input type="number" step="0.01" value={it.rate} onChange={(e) => setItem(n, { rate: e.target.value })} /></Field>
                  <Field label="Amount (£)"><input type="number" step="0.01" value={it.amount} onChange={(e) => setItem(n, { amount: e.target.value })} /></Field>
                </div>
              </div>
            ))}
            <button type="button" className="ad-btn sm" onClick={() => patch({ items: [...doc.items, emptyItem()] })}>+ Add item</button>
          </Section>

          <Section title="Totals and payments received">
            <div className="iv-sum"><span>Sub total</span><b>{money(totals.subtotal)}</b></div>
            <div className="iv-grid" style={{ margin: '8px 0' }}>
              <Field label="Discount name"><input type="text" {...text('discountLabel')} /></Field>
              <Field label="Discount (£)"><input type="number" min="0" step="0.01" {...text('discount')} /></Field>
            </div>
            <div className="iv-sum big"><span>Total</span><span>{money(totals.total)}</span></div>
            <div style={{ marginTop: 12 }}>
              {doc.payments.map((p, n) => (
                <div className="iv-pay" key={n} data-invoice-payment>
                  <Field label="Date paid"><input type="date" value={p.date} onChange={(e) => setPayment(n, { date: e.target.value })} /></Field>
                  <Field label="Method"><input type="text" list="iv-methods" value={p.method} onChange={(e) => setPayment(n, { method: e.target.value })} /></Field>
                  <Field label="Amount (£)"><input type="number" min="0" step="0.01" value={p.amount} onChange={(e) => setPayment(n, { amount: e.target.value })} /></Field>
                  <button type="button" className="ad-btn sm danger" style={{ height: 38 }} onClick={() => patch({ payments: doc.payments.filter((_, i) => i !== n) })} aria-label={`Remove payment ${n + 1}`}>✕</button>
                </div>
              ))}
              <datalist id="iv-methods">{METHODS.map((m) => <option key={m} value={m} />)}</datalist>
              <button type="button" className="ad-btn sm" onClick={() => patch({ payments: [...doc.payments, { date: todayIso(), method: 'Bank transfer', amount: '' }] })}>+ Add payment</button>
            </div>
            <div className="iv-sum big"><span>Balance due</span><span>{money(totals.balance)}</span></div>
            {totals.overpaid > 0 && <p className="ad-err" role="alert">Payments are {money(totals.overpaid)} more than the total.</p>}
          </Section>

          <Section title="From">
            <div className="iv-grid">
              <div className="ad-field full">
                <span>Logo</span>
                <div className="iv-logo-row">
                  <img src={doc.logo || DEFAULT_LOGO} alt="Invoice logo" />
                  <label className="ad-btn sm" style={{ cursor: 'pointer' }}>Change logo
                    <input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={async (e) => {
                      const f = e.target.files?.[0]
                      e.target.value = ''
                      if (!f) return
                      try { patch({ logo: await logoToPng(f) }) } catch (x) { toast((x as Error).message, 'err') }
                    }} />
                  </label>
                  {doc.logo && <button type="button" className="ad-btn sm" onClick={() => patch({ logo: '' })}>Use the standard logo</button>}
                </div>
              </div>
              <Field label="Business name" full><input type="text" {...text('fromName')} /></Field>
              <Field label="Business address" full><textarea rows={4} {...text('fromAddress')} /></Field>
            </div>
          </Section>

          <Section title="Notes and bank details">
            {!doc.sortCode.trim() && !doc.accountNumber.trim() && <p className="ad-note" style={{ marginBottom: 12 }}>Add your sort code and account number, then press “Save logo, business, bank and terms as default” below so every new invoice starts with them.</p>}
            <div className="iv-grid">
              <Field label="Notes" full><textarea rows={2} style={{ minHeight: 60 }} {...text('notes')} /></Field>
              <Field label="Account name"><input type="text" {...text('bankName')} /></Field>
              <Field label="Sort code"><input type="text" inputMode="numeric" {...text('sortCode')} /></Field>
              <Field label="Account number"><input type="text" inputMode="numeric" {...text('accountNumber')} /></Field>
              <Field label="Payment reference"><input type="text" {...text('paymentReference')} /></Field>
            </div>
          </Section>

          <Section title="Terms and conditions">
            <div className="iv-grid">
              <Field label="Heading" full><input type="text" {...text('termsTitle')} /></Field>
              <Field label="Terms" full hint="Empty the box to leave the terms page out."><textarea rows={12} {...text('termsText')} /></Field>
            </div>
          </Section>

          <div><button type="button" className="ad-btn sm" onClick={saveDefaults}>Save logo, business, bank and terms as default</button></div>
        </div>
        <div className="iv-preview" aria-label="Invoice preview"><InvoicePaper doc={doc} /></div>
      </div>

      {send && (
        <Modal title={`Email ${doc.number || 'invoice'} to the client`} onClose={() => { if (busy !== 'send') setSend(null) }}>
          <div className="ad-form">
            <div className="ad-field full"><span>Sending as</span><div><Badge tone={STAGE_TONE[totals.stage]}>{STAGE_LABEL[totals.stage]}</Badge> <span className="ad-muted">Total {money(totals.total)}, paid {money(totals.paid)}, balance due {money(totals.balance)}. The invoice is attached as a PDF.</span></div></div>
            <Field label="To" full><input type="email" autoFocus value={send.to} onChange={(e) => setSend({ ...send, to: e.target.value })} /></Field>
            <Field label="Subject" full><input type="text" value={send.subject} onChange={(e) => setSend({ ...send, subject: e.target.value })} /></Field>
            <Field label="Message" full><textarea rows={9} value={send.message} onChange={(e) => setSend({ ...send, message: e.target.value })} /></Field>
            <div className="ad-formfoot">
              <button className="ad-btn" disabled={busy === 'send'} onClick={() => setSend(null)}>Cancel</button>
              <button className="ad-btn primary" disabled={busy === 'send'} onClick={sendNow}>{busy === 'send' ? 'Sending…' : 'Send invoice'}</button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
