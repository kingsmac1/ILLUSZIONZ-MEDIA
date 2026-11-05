/**
 * Builds the invoice PDF in the browser (pdf-lib is loaded only when a PDF is asked for). The same bytes are downloaded
 * and emailed. Helvetica cannot draw every character, so anything it lacks is reduced to its nearest plain letter
 * (Ọ becomes O) rather than failing the whole invoice.
 */
import { DEFAULT_LOGO, STAGE_STAMP, bankLines, invoiceTotals, money, parseTerms, shortDate, type InvoiceDoc } from './model'

const W = 595.28
const H = 841.89
const M = 50
const CONTENT = W - M * 2
const INK = [0.13, 0.13, 0.13] as const
const SOFT = [0.42, 0.42, 0.42] as const

export async function buildInvoicePdf(doc: InvoiceDoc): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')
  const pdf = await PDFDocument.create()
  pdf.setTitle(`${doc.title} ${doc.number}`.trim())
  pdf.setAuthor(doc.fromName)
  pdf.setCreator('Illuszionz Media')
  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const known = new Set(regular.getCharacterSet())
  const clean = (s: string) =>
    Array.from((s ?? '').replace(/\t/g, ' ').replace(/−/g, '-').normalize('NFC'))
      .map((c) => {
        if (c === '\n' || c === '\r' || known.has(c.codePointAt(0)!)) return c // line breaks are handled by wrap()
        const base = c.normalize('NFD').replace(/\p{M}/gu, '')
        return Array.from(base).every((x) => known.has(x.codePointAt(0)!)) ? base : '?'
      })
      .join('')

  type Font = typeof regular
  type Color = readonly [number, number, number]
  let page = pdf.addPage([W, H])
  let y = H - 50
  const newPage = () => { page = pdf.addPage([W, H]); y = H - 50 }
  const widthOf = (s: string, f: Font, size: number) => f.widthOfTextAtSize(s, size)
  const text = (s: string, x: number, at: number, size: number, f: Font = regular, c: Color = INK) => page.drawText(clean(s), { x, y: at, size, font: f, color: rgb(c[0], c[1], c[2]) })
  const right = (s: string, xr: number, at: number, size: number, f: Font = regular, c: Color = INK) => text(s, xr - widthOf(clean(s), f, size), at, size, f, c)
  /** word wrap; a word wider than the column is cut so it can never run off the page */
  const wrap = (s: string, f: Font, size: number, width: number) => {
    const out: string[] = []
    for (const para of clean(s).split(/\r?\n/)) {
      let line = ''
      for (let word of para.split(/\s+/)) {
        while (widthOf(word, f, size) > width) {
          let n = word.length - 1
          while (n > 1 && widthOf(word.slice(0, n), f, size) > width) n--
          if (line) { out.push(line); line = '' }
          out.push(word.slice(0, n))
          word = word.slice(n)
        }
        const next = line ? `${line} ${word}` : word
        if (widthOf(next, f, size) > width && line) { out.push(line); line = word } else line = next
      }
      out.push(line)
    }
    return out
  }

  /* header */
  try {
    const bytes = doc.logo ? doc.logo : await (await fetch(DEFAULT_LOGO)).arrayBuffer()
    const img = typeof bytes === 'string' && bytes.startsWith('data:image/jp') ? await pdf.embedJpg(bytes) : await pdf.embedPng(bytes)
    const scale = Math.min(190 / img.width, 62 / img.height)
    page.drawImage(img, { x: M, y: H - 50 - img.height * scale, width: img.width * scale, height: img.height * scale })
  } catch { /* an unreadable logo must not stop the invoice */ }
  const t = invoiceTotals(doc)
  const xr = W - M
  right(doc.title, xr, H - 72, 28)
  right(`Invoice# ${doc.number}`, xr, H - 88, 9, bold)
  right('Balance Due', xr, H - 112, 8, bold)
  right(money(t.balance), xr, H - 128, 13, bold)
  const stamp = STAGE_STAMP[t.stage]
  if (stamp) {
    const c: Color = t.stage === 'paid' ? [0.09, 0.5, 0.24] : [0.11, 0.31, 0.85]
    const w = widthOf(stamp, bold, 10) + 16
    page.drawRectangle({ x: xr - w, y: H - 152, width: w, height: 18, borderColor: rgb(c[0], c[1], c[2]), borderWidth: 1.2 })
    right(stamp, xr - 8, H - 147, 10, bold, c)
  }

  /* from */
  y = H - 180
  for (const l of wrap(doc.fromName, bold, 9.5, 300)) { text(l, M, y, 9.5, bold); y -= 13 }
  for (const l of wrap(doc.fromAddress, regular, 9, 300)) { text(l, M, y, 9, regular, SOFT); y -= 12.5 }

  /* bill to + dates */
  y -= 24
  const top = y
  const metaLabelX = xr - 80
  ;[['Invoice Date :', shortDate(doc.invoiceDate)], ['Terms :', doc.terms], ['Due Date :', shortDate(doc.dueDate)]].forEach(([k, v], i) => {
    right(k, metaLabelX - 16, top - i * 21, 10, regular, SOFT)
    right(v, xr, top - i * 21, 9.5)
  })
  y = top - 21
  text('Bill To', M, y, 10, regular, SOFT)
  y -= 13
  for (const l of wrap(doc.billName, bold, 9.5, 260)) { text(l, M, y, 9.5, bold); y -= 13 }
  for (const v of [doc.billAddress, doc.billPhone, doc.billEmail]) if (v?.trim()) for (const l of wrap(v, regular, 9, 260)) { text(l, M, y, 9, regular, SOFT); y -= 12.5 }
  y = Math.min(y, top - 63) - 16

  /* items */
  const col = { n: M + 10, item: M + 46, qty: M + 340, rate: M + 410, amount: xr - 9 }
  const tableHead = () => {
    page.drawRectangle({ x: M, y: y - 8, width: CONTENT, height: 27, color: rgb(0.235, 0.235, 0.235) })
    const white: Color = [1, 1, 1]
    text('#', col.n, y, 9.5, regular, white)
    text('Item & Description', col.item, y, 9.5, regular, white)
    right('Qty', col.qty, y, 9.5, regular, white)
    right('Rate', col.rate, y, 9.5, regular, white)
    right('Amount', col.amount, y, 9.5, regular, white)
    y -= 29
  }
  tableHead()
  const num = (v: string) => (v.trim() ? money(Number(v) || 0).replace('£', '') : '')
  const items = doc.items.filter((i) => i.title.trim() || i.description.trim() || i.amount.trim())
  items.forEach((it, n) => {
    const width = col.qty - col.item - 40
    const title = wrap(it.title, regular, 9.5, width)
    const desc = it.description.trim() ? wrap(it.description, regular, 9, width) : []
    const height = title.length * 13 + desc.length * 12.5 + 14
    if (y - height < 60) { newPage(); tableHead() }
    text(String(n + 1), col.n, y, 9.5)
    right(it.qty, col.qty, y, 9.5)
    right(num(it.rate), col.rate, y, 9.5)
    right(num(it.amount), col.amount, y, 9.5)
    for (const l of title) { text(l, col.item, y, 9.5); y -= 13 }
    for (const l of desc) { text(l, col.item, y, 9, regular, SOFT); y -= 12.5 }
    y -= 4
    page.drawLine({ start: { x: M, y: y + 3 }, end: { x: xr, y: y + 3 }, thickness: 0.6, color: rgb(0.72, 0.72, 0.72) })
    y -= 11
  })

  /* totals */
  const payments = doc.payments.filter((p) => p.amount.trim())
  const rows: [string, string, 'plain' | 'strong' | 'balance'][] = [
    ['Sub Total', num(String(t.subtotal)), 'plain'],
    ...(t.discount !== 0 ? [[doc.discountLabel, `-${num(String(t.discount))}`, 'plain'] as [string, string, 'plain']] : []),
    ['Total', money(t.total), 'strong'],
    ...payments.map((p) => [`Payment made${p.date ? ` on ${shortDate(p.date)}` : ''}${p.method ? ` (${p.method})` : ''}`, `-${money(Number(p.amount) || 0)}`, 'plain'] as [string, string, 'plain']),
    ['Balance Due', money(t.balance), 'balance'],
  ]
  const labelR = xr - 95
  for (const [label, value, kind] of rows) {
    const lines = wrap(label, kind === 'plain' ? regular : bold, 9.5, 215)
    const height = lines.length * 12 + 13
    if (y - height < 60) newPage()
    if (kind === 'balance') page.drawRectangle({ x: xr - 240, y: y - 11, width: 240, height: 28, color: rgb(0.955, 0.95, 0.94) })
    const f = kind === 'plain' ? regular : bold
    lines.forEach((l, i) => right(l, labelR, y - i * 12, 9.5, f))
    right(value, col.amount, y, 9.5, f)
    y -= height + (kind === 'balance' ? 8 : 4)
  }

  /* notes + bank details */
  const bank = bankLines(doc)
  const noteLines = [...(doc.notes.trim() ? wrap(doc.notes, regular, 8.5, CONTENT) : []), ...bank.flatMap((b) => wrap(b, regular, 8.5, CONTENT))]
  if (noteLines.length) {
    y -= 14
    if (y - 18 - noteLines.length * 11.5 < 50) newPage()
    text('Notes', M, y, 10, regular, SOFT)
    y -= 14
    for (const l of noteLines) { text(l, M, y, 8.5); y -= 11.5 }
  }

  /* terms on their own page, like the studio's invoices */
  const terms = parseTerms(doc.termsText)
  if (terms.some((l) => l.text)) {
    newPage()
    text(doc.termsTitle, M, y, 12, bold)
    y -= 22
    for (const l of terms) {
      if (l.kind === 'gap') { y -= 8; continue }
      const f = l.kind === 'head' ? bold : regular
      const indent = l.kind === 'bullet' ? 24 : 0
      for (const [i, line] of wrap(l.text, f, 8.5, CONTENT - indent).entries()) {
        if (y < 56) newPage()
        if (l.kind === 'bullet' && i === 0) text('•', M + 12, y, 8.5)
        text(line, M + indent, y, 8.5, f)
        y -= 11.5
      }
    }
  }

  /* page numbers */
  const pages = pdf.getPages()
  pages.forEach((p, i) => {
    p.drawLine({ start: { x: M, y: 38 }, end: { x: xr, y: 38 }, thickness: 0.6, color: rgb(0.72, 0.72, 0.72) })
    const label = String(i + 1)
    p.drawText(label, { x: xr - regular.widthOfTextAtSize(label, 8), y: 24, size: 8, font: regular, color: rgb(SOFT[0], SOFT[1], SOFT[2]) })
  })
  return pdf.save()
}

export function downloadBytes(bytes: Uint8Array, filename: string) {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export function toBase64(bytes: Uint8Array) {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}
