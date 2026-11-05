import { Fragment, useEffect, useRef, useState } from 'react'
import { DEFAULT_LOGO, STAGE_STAMP, bankLines, invoiceTotals, money, parseTerms, shortDate, type InvoiceDoc } from './model'

const PAPER_WIDTH = 794 // A4 at 96 dpi; the sheet is scaled to fit the column

/** The live preview: the same layout as the PDF (pdf.ts), one sheet for the invoice and one for the terms. */
export function InvoicePaper({ doc }: { doc: InvoiceDoc }) {
  const box = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  useEffect(() => {
    const el = box.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([e]) => setScale(Math.min(1, e.contentRect.width / PAPER_WIDTH)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const t = invoiceTotals(doc)
  const stamp = STAGE_STAMP[t.stage]
  const bank = bankLines(doc)
  const items = doc.items.filter((i) => i.title.trim() || i.description.trim() || i.amount.trim())
  const payments = doc.payments.filter((p) => p.amount.trim())
  const terms = parseTerms(doc.termsText)
  return (
    <div className="iv-sheets" ref={box} data-invoice-preview>
      <div className="iv-paper" style={{ zoom: scale }}>
        <div className="iv-head">
          <img className="iv-logo" src={doc.logo || DEFAULT_LOGO} alt="" />
          <div className="iv-head-r">
            <div className="iv-title">{doc.title}</div>
            <div className="iv-number">Invoice# {doc.number}</div>
            <div className="iv-due-l">Balance Due</div>
            <div className="iv-due">{money(t.balance)}</div>
            {stamp && <div className={'iv-stamp ' + t.stage}>{stamp}</div>}
          </div>
        </div>
        <div className="iv-from"><b>{doc.fromName}</b><br /><span className="iv-pre">{doc.fromAddress}</span></div>
        <div className="iv-parties">
          <div className="iv-bill">
            <span>Bill To</span><br /><b>{doc.billName}</b>
            {doc.billAddress && <><br /><span className="iv-pre">{doc.billAddress}</span></>}
            {doc.billPhone && <><br />{doc.billPhone}</>}
            {doc.billEmail && <><br />{doc.billEmail}</>}
          </div>
          <dl className="iv-meta">
            <dt>Invoice Date :</dt><dd>{shortDate(doc.invoiceDate)}</dd>
            <dt>Terms :</dt><dd>{doc.terms}</dd>
            <dt>Due Date :</dt><dd>{shortDate(doc.dueDate)}</dd>
          </dl>
        </div>
        <table className="iv-items">
          <thead><tr><th className="n">#</th><th>Item &amp; Description</th><th className="r">Qty</th><th className="r">Rate</th><th className="r">Amount</th></tr></thead>
          <tbody>
            {items.map((i, n) => (
              <tr key={n}>
                <td className="n">{n + 1}</td>
                <td>{i.title}{i.description && <div className="iv-pre">{i.description}</div>}</td>
                <td className="r">{i.qty}</td>
                <td className="r">{i.rate ? money(Number(i.rate) || 0).replace('£', '') : ''}</td>
                <td className="r">{i.amount ? money(Number(i.amount) || 0).replace('£', '') : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="iv-totals">
          <div><span>Sub Total</span><span>{money(t.subtotal).replace('£', '')}</span></div>
          {t.discount !== 0 && <div><span>{doc.discountLabel}</span><span>-{money(t.discount).replace('£', '')}</span></div>}
          <div className="strong"><span>Total</span><span>{money(t.total)}</span></div>
          {payments.map((p, n) => (
            <div key={n} className="paid"><span>Payment made{p.date ? ` on ${shortDate(p.date)}` : ''}{p.method ? ` (${p.method})` : ''}</span><span>-{money(Number(p.amount) || 0)}</span></div>
          ))}
          <div className="balance"><span>Balance Due</span><span>{money(t.balance)}</span></div>
        </div>
        {(doc.notes || bank.length > 0) && (
          <div className="iv-notes">
            <h5>Notes</h5>
            {doc.notes && <div className="iv-pre">{doc.notes}</div>}
            {bank.map((l) => <div key={l}>{l}</div>)}
          </div>
        )}
      </div>
      {terms.some((l) => l.text) && (
        <div className="iv-paper iv-paper-terms" style={{ zoom: scale }}>
          <h5>{doc.termsTitle}</h5>
          {terms.map((l, n) => (
            <Fragment key={n}>
              {l.kind === 'gap' ? <div className="iv-gap" /> : <div className={'iv-term ' + l.kind}>{l.text}</div>}
            </Fragment>
          ))}
        </div>
      )}
    </div>
  )
}
