import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../admin/supabase'
import { useData } from '../../admin/data'
import { BulkBar, BulkBtn, RowBox, SelectAllBox, confirmN, useSelection } from '../../admin/bulk'
import { Badge, Empty, PageHead, Pager, downloadCsv, fmtDate, useDebounced } from '../../admin/ui'
import { STAGE_LABEL, STAGE_TONE, invoiceTotals, money, normalizeDoc, type InvoiceDoc, type InvoiceStage } from './model'
import './invoices.css'

export type InvoiceRow = {
  id: string; created_at: string; updated_at: string; number: string; booking_id: string | null; contact_id: string | null
  doc: Partial<InvoiceDoc>; sent_at: string | null; sent_to: string | null; sent_stage: InvoiceStage | null; sent_count: number
}
const PAGE = 20

/** Message for the dashboard when the invoices table is not in the database yet. */
export const missingTable = (message: string) => /invoices/.test(message) && /(does not exist|could not find|schema cache)/i.test(message)
export const SETUP_NOTE = 'The invoices table is not in the database yet. Run npm run gallery:go-live once, then reload this page.'

export function InvoicesSection() {
  const { toast, markSaved } = useData()
  const [rows, setRows] = useState<InvoiceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const dq = useDebounced(q)
  const [stage, setStage] = useState('')
  const [page, setPage] = useState(1)
  const load = useCallback(async () => {
    const { data, error: err } = await supabase!.from('invoices').select('*').order('created_at', { ascending: false }).limit(2000)
    if (err) setError(missingTable(err.message) ? SETUP_NOTE : err.message)
    else { setError(''); setRows((data ?? []) as InvoiceRow[]) }
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const list = useMemo(() => rows.map((r) => ({ r, doc: normalizeDoc(r.doc), t: invoiceTotals(normalizeDoc(r.doc)) })).filter(({ r, doc, t }) => {
    if (stage && t.stage !== stage) return false
    return !dq || `${r.number} ${doc.billName} ${doc.billEmail} ${doc.billPhone}`.toLowerCase().includes(dq.toLowerCase())
  }), [rows, stage, dq])
  const pages = Math.max(1, Math.ceil(list.length / PAGE))
  const view = list.slice((Math.min(page, pages) - 1) * PAGE, Math.min(page, pages) * PAGE)
  const sel = useSelection(list.map((x) => x.r.id))
  const csv = (items: typeof list) => downloadCsv('invoices', items.map(({ r, doc, t }) => ({ number: r.number, client: doc.billName, email: doc.billEmail, date: doc.invoiceDate, due: doc.dueDate, status: STAGE_LABEL[t.stage], total: t.total, paid: t.paid, balance: t.balance, last_sent: r.sent_at ?? '' })))

  async function bulkDelete() {
    const ids = sel.ids
    if (!confirmN('Permanently delete', ids.length, 'invoice', 'Their numbers can then be used again. Bookings and payments are not changed.')) return
    const { error: err } = await supabase!.from('invoices').delete().in('id', ids)
    if (err) return toast(err.message, 'err')
    toast(`✓ ${ids.length} invoice${ids.length === 1 ? '' : 's'} deleted`)
    markSaved()
    sel.clear()
    load()
  }

  return (
    <>
      <PageHead title="Invoices" sub="Create an invoice for anyone, and send it before payment, after a part payment or once it's paid" actions={<a className="ad-btn primary" href="#/invoices/new">+ New invoice</a>} />
      {error && <div className="ad-note" style={{ marginBottom: 14 }} role="alert">{error}</div>}
      <div className="ad-toolbar">
        <input type="search" placeholder="Search number, client, email…" aria-label="Search invoices" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} />
        <select aria-label="Filter by payment" value={stage} onChange={(e) => { setStage(e.target.value); setPage(1) }}>
          <option value="">All payments</option>
          {(Object.keys(STAGE_LABEL) as InvoiceStage[]).map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
        </select>
      </div>
      <BulkBar s={sel} noun="invoice">
        <BulkBtn onClick={() => csv(list.filter((x) => sel.has(x.r.id)))}>Export CSV</BulkBtn>
        <BulkBtn danger onClick={bulkDelete}>Delete</BulkBtn>
      </BulkBar>
      <div className="ad-tablewrap">
        <table>
          <thead><tr><th className="sel"><SelectAllBox s={sel} view={view.map((x) => x.r.id)} /></th><th>Invoice</th><th>Client</th><th>Payment</th><th className="num">Total</th><th className="num">Balance due</th><th>Last sent</th></tr></thead>
          <tbody>
            {view.map(({ r, doc, t }) => (
              <tr key={r.id} className={'click' + (sel.has(r.id) ? ' picked' : '')} onClick={() => { window.location.hash = `#/invoices/${r.id}` }}>
                <td className="sel"><RowBox s={sel} id={r.id} label={`invoice ${r.number}`} /></td>
                <td><a href={`#/invoices/${r.id}`} onClick={(e) => e.stopPropagation()}><b>{r.number}</b></a><span className="sub">{fmtDate(doc.invoiceDate)}</span></td>
                <td><b>{doc.billName || '—'}</b><span className="sub">{doc.billEmail || doc.billPhone}</span></td>
                <td><Badge tone={STAGE_TONE[t.stage]}>{STAGE_LABEL[t.stage]}</Badge></td>
                <td className="num"><b>{money(t.total)}</b></td>
                <td className="num">{money(t.balance)}</td>
                <td>{r.sent_at ? <>{fmtDate(r.sent_at)}<span className="sub">as {r.sent_stage ? STAGE_LABEL[r.sent_stage].toLowerCase() : ''}</span></> : <span className="ad-muted">Not sent</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!view.length && !loading && !error && <Empty title={rows.length ? 'No invoices match that search' : 'No invoices yet'} hint={rows.length ? undefined : 'Create one here, or choose Invoice on any booking to start with the client’s details filled in.'} />}
        <Pager page={Math.min(page, pages)} pages={pages} onChange={setPage} />
      </div>
      {list.length > 0 && <div style={{ padding: '12px 0', textAlign: 'right' }}><button className="ad-btn sm" onClick={() => csv(list)}>Export CSV</button></div>}
    </>
  )
}
