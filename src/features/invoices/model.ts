/**
 * The invoice as data, shared by the form, the preview, the PDF and the server. No React and no browser APIs in here.
 * Amounts are kept as the text the admin typed, so a half-typed "12." stays in the field; the sums work in pence.
 */
export type InvoiceItem = { title: string; description: string; qty: string; rate: string; amount: string }
export type InvoicePayment = { date: string; method: string; amount: string }
export type InvoiceStage = 'before' | 'part' | 'paid'

export type InvoiceDoc = {
  /** a data: URL when the studio uploaded its own logo; empty means the standard black logo */
  logo: string
  title: string
  number: string
  invoiceDate: string
  terms: string
  dueDate: string
  fromName: string
  fromAddress: string
  billName: string
  billEmail: string
  billPhone: string
  billAddress: string
  items: InvoiceItem[]
  discountLabel: string
  discount: string
  payments: InvoicePayment[]
  notes: string
  bankName: string
  sortCode: string
  accountNumber: string
  paymentReference: string
  termsTitle: string
  termsText: string
}

/** the fields that stay the same from invoice to invoice ("Save as default" in the form) */
export const BUSINESS_FIELDS = ['logo', 'fromName', 'fromAddress', 'notes', 'bankName', 'sortCode', 'accountNumber', 'paymentReference', 'termsTitle', 'termsText'] as const
export type BusinessDefaults = Partial<Pick<InvoiceDoc, (typeof BUSINESS_FIELDS)[number]>>

export const DEFAULT_LOGO = '/images/Illusionz-Media-Logo-Black.png'
/** the deposit in the studio's terms: only a starting value for the amount field when "Part paid" is chosen */
export const USUAL_DEPOSIT = 160

export const DEFAULT_TERMS = `This agreement outlines the terms and conditions under which ILLUSZIONZ PHOTOGRAPHY ("the Photographer") provides photographic services to the Client. By booking a session, the Client confirms they have read, understood, and agreed to the terms below.

1. Booking and Payment
• A non-refundable deposit of £160 is required to secure a booking.
• The remaining balance is due on or before the day of the shoot.
• Failure to make full payment on time may result in cancellation or additional charges.

2. Delivery and Turnaround Time
• Edited images will be delivered within 5–7 working days from the date the Client completes image selection.

3. Image Availability and Storage
• RAW files are not released to clients under any circumstance.
• Low-resolution unedited images may be provided for selection and preview purposes only.
• Unedited images are stored for 90 days post-shoot for the purpose of additional purchases or editing requests.
• Edited images remain available for 2 weeks in a private online gallery for download.

4. Image Access and Usage
• Clients will receive a private online gallery for viewing and downloading final images.
• The Photographer retains full copyright ownership and promotional usage rights to all images produced.
• The Photographer is not obligated to post client images on any social media platform.

5. Additional Edited Images
• Additional edits can be requested at a rate of £20 per image. (Applies to portrait sessions only)
• The Photographer will only edit images selected by the Client.

6. Image Review and Re-Edits
• Clients are entitled to one (1) round of image review or re-edit free of charge.
• Further reviews or edit requests may be subject to additional charges.

7. Cancellation and Rescheduling
• Cancellations or rescheduling may incur additional charges.
• All deposits are non-refundable regardless of the reason for cancellation.

8. Session Timing and Studio Conduct
• All sessions are strictly timed; any extension beyond the agreed time will incur a charge of £50 per hour. (Applies to portrait sessions only)
• Due to space limitations, clients are allowed to bring a maximum of one (1) additional person to the studio for their shoot.
• If the Client or their guest behaves in a rude, unfriendly, or violent manner that interferes with the Photographer's ability to work creatively and safely, the Photographer reserves the right to cancel the session immediately or ask the Client to leave the premises. No refunds will be issued.

9. On-Location Shoots
• If the shoot is to take place outside the Photographer's standard studio, the Client is responsible for booking the location and handling all related logistics.

10. Photographer Liability and Client Cooperation
• The Photographer will not be held liable for images that could not be taken due to the Client's lack of cooperation, unpreparedness, or unforeseen issues caused by the Client.
• The Photographer is not responsible for the Client's facial expressions, attitude, or mood during the session.
• The Photographer will provide posing guidance and make reasonable efforts to create a comfortable and enjoyable environment for the Client, within professional limits.

11. Amendments to Terms
• Any changes to this agreement must be made in writing and agreed upon by both the Client and the Photographer.

By proceeding with a booking, the Client acknowledges and agrees to abide by all terms outlined above.`

export const emptyItem = (): InvoiceItem => ({ title: '', description: '', qty: '1', rate: '', amount: '' })

export function blankInvoice(today: string, defaults: BusinessDefaults = {}): InvoiceDoc {
  return {
    logo: '',
    title: 'INVOICE',
    number: '',
    invoiceDate: today,
    terms: 'Due on Receipt',
    dueDate: today,
    fromName: 'ILLUSZIONZ MEDIA LTD',
    fromAddress: 'Unit F commonwealth complex\nOpp Coop funeral care woolwich\nLondon London SE18 5NS\nUnited Kingdom',
    billName: '',
    billEmail: '',
    billPhone: '',
    billAddress: '',
    items: [emptyItem()],
    discountLabel: 'Discount',
    discount: '',
    payments: [],
    notes: 'Thanks for your business.',
    bankName: 'ILLUSZIONZ MEDIA LTD',
    sortCode: '',
    accountNumber: '',
    paymentReference: 'Your name',
    termsTitle: 'Terms & Conditions',
    termsText: DEFAULT_TERMS,
    ...defaults,
  }
}

/** an old or partial row still opens: anything missing falls back to a blank field */
export const normalizeDoc = (raw: Partial<InvoiceDoc> | null | undefined): InvoiceDoc => ({ ...blankInvoice(''), termsText: '', ...(raw ?? {}) })

/* ---------------------------------- money ---------------------------------- */
export const num = (v: unknown) => {
  const n = Number(String(v ?? '').replace(/[£,\s]/g, ''))
  return Number.isFinite(n) ? n : 0
}
const pence = (v: unknown) => Math.round(num(v) * 100)
export const money = (n: number) => `${n < 0 ? '-' : ''}£${Math.abs(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
/** a number for an amount field: "160" or "12.50" */
export const plain = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2))

/** the amount for qty × rate, as the Amount field shows it */
export const lineAmount = (qty: string, rate: string) => (String(rate).trim() === '' ? '' : plain(Math.round(num(qty) * num(rate) * 100) / 100))

export type InvoiceTotals = { subtotal: number; discount: number; total: number; paid: number; balance: number; overpaid: number; stage: InvoiceStage }

export function invoiceTotals(doc: Pick<InvoiceDoc, 'items' | 'discount' | 'payments'>): InvoiceTotals {
  const subtotal = (doc.items ?? []).reduce((s, i) => s + pence(i.amount), 0)
  const discount = pence(doc.discount)
  const total = subtotal - discount
  const paid = (doc.payments ?? []).reduce((s, p) => s + pence(p.amount), 0)
  const stage: InvoiceStage = total > 0 && paid >= total ? 'paid' : paid > 0 ? 'part' : 'before'
  return { subtotal: subtotal / 100, discount: discount / 100, total: total / 100, paid: paid / 100, balance: Math.max(0, total - paid) / 100, overpaid: Math.max(0, paid - Math.max(0, total)) / 100, stage }
}

export const STAGE_LABEL: Record<InvoiceStage, string> = { before: 'Before payment', part: 'Part paid', paid: 'Paid in full' }
export const STAGE_TONE: Record<InvoiceStage, string> = { before: 'amber', part: 'blue', paid: 'green' }
/** the mark on the paper; an invoice nothing has been paid on has none, like the studio's usual invoice */
export const STAGE_STAMP: Record<InvoiceStage, string> = { before: '', part: 'PART PAID', paid: 'PAID' }

/* ---------------------------------- layout ---------------------------------- */
/** 08/09/26, as on the studio's invoices */
export function shortDate(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '')
  return m ? `${m[3]}/${m[2]}/${m[1].slice(2)}` : iso ?? ''
}

export type TermsLine = { kind: 'head' | 'bullet' | 'text' | 'gap'; text: string }
/** the terms text as the preview and the PDF both lay it out */
export function parseTerms(text: string): TermsLine[] {
  return (text ?? '').split(/\r?\n/).map((raw) => {
    const line = raw.trim()
    if (!line) return { kind: 'gap', text: '' }
    if (/^[•\-*]\s+/.test(line)) return { kind: 'bullet', text: line.replace(/^[•\-*]\s+/, '') }
    if (/^\d+\.\s/.test(line) && line.length < 80) return { kind: 'head', text: line }
    return { kind: 'text', text: line }
  })
}

/** the bank lines under the notes; a blank field leaves its line out */
export function bankLines(doc: Pick<InvoiceDoc, 'bankName' | 'sortCode' | 'accountNumber' | 'paymentReference'>) {
  return [
    doc.bankName?.trim(),
    doc.sortCode?.trim() && `Sort code- ${doc.sortCode.trim()}`,
    doc.accountNumber?.trim() && `Acct number- ${doc.accountNumber.trim()}`,
    doc.paymentReference?.trim() && `PAYMENT REFERENCE : ${doc.paymentReference.trim()}`,
  ].filter(Boolean) as string[]
}

/** Invoice-INV-002610.pdf: safe in a filename whatever was typed into the number field */
export const pdfFilename = (number: string) => `Invoice-${(number || 'draft').replace(/[^A-Za-z0-9._-]+/g, '-').slice(0, 60)}.pdf`

/** INV-002609 → INV-002610, from the highest number used so far */
export function nextNumber(used: string[], fallback = 'INV-002610') {
  let high = 0
  for (const u of used) {
    const m = /^INV-(\d+)$/i.exec(u.trim())
    if (m) high = Math.max(high, Number(m[1]))
  }
  return high ? `INV-${String(high + 1).padStart(6, '0')}` : fallback
}

/* ---------------------------------- email ---------------------------------- */
export const EMAIL_HEADING: Record<InvoiceStage, { eyebrow: string; title: string }> = {
  before: { eyebrow: 'Your invoice', title: 'Your invoice' },
  part: { eyebrow: 'Payment received', title: 'Thank you for your payment' },
  paid: { eyebrow: 'Paid in full', title: 'Your invoice is paid in full' },
}

export function defaultEmail(doc: InvoiceDoc) {
  const t = invoiceTotals(doc)
  const first = doc.billName.trim().split(/\s+/)[0] || 'there'
  const number = doc.number.trim()
  const bank = t.balance > 0 ? bankLines(doc) : []
  const payTo = bank.length ? `\n\nPlease pay by bank transfer:\n${bank.join('\n')}` : ''
  const due = doc.dueDate ? ` by ${shortDate(doc.dueDate)}` : ''
  if (t.stage === 'paid') {
    return {
      subject: `Paid in full: invoice ${number} from Illuszionz Media`,
      message: `Hi ${first},\n\nThank you. We have received your payment and invoice ${number} is now paid in full (${money(t.total)}).\n\nYour copy is attached as a PDF for your records.`,
    }
  }
  if (t.stage === 'part') {
    return {
      subject: `Payment received: ${money(t.balance)} left on invoice ${number}`,
      message: `Hi ${first},\n\nThank you for your payment. So far you have paid ${money(t.paid)} of ${money(t.total)}, which leaves a balance of ${money(t.balance)}${due}.\n\nYour updated invoice ${number} is attached as a PDF.${payTo}`,
    }
  }
  return {
    subject: `Invoice ${number} from Illuszionz Media: ${money(t.balance)} due`,
    message: `Hi ${first},\n\nYour invoice ${number} for ${money(t.total)} is attached as a PDF. The amount due is ${money(t.balance)}${due}.${payTo}`,
  }
}

/* ------------------------------ from a booking ------------------------------ */
type BookingLike = {
  kind?: string; name?: string; email?: string | null; phone?: string; packages?: string; items?: { label: string; amount: string }[]
  details?: [string, string][]; total?: number | string; discount?: number | string; promo_code?: string | null
  event_date?: string | null; event_time?: string | null; amount_paid?: number | string
}
type PaymentLike = { paid_at?: string; method?: string; amount?: number | string; created_at?: string }

/** the booking's recorded payments, oldest first; any paid amount not backed by a payment row becomes one more line */
export function paymentsFromBooking(b: BookingLike, payments: PaymentLike[]): InvoicePayment[] {
  const rows = [...payments].sort((x, y) => String(x.paid_at).localeCompare(String(y.paid_at))).map((p) => ({ date: String(p.paid_at ?? '').slice(0, 10), method: p.method ?? '', amount: plain(num(p.amount)) }))
  const recorded = rows.reduce((s, r) => s + pence(r.amount), 0)
  const extra = pence(b.amount_paid) - recorded
  if (extra > 0) rows.push({ date: '', method: 'Earlier payment', amount: plain(extra / 100) })
  return rows
}

/** Fills the client, the items and the payments from a booking. Keeps the business fields of `base`. */
export function invoiceFromBooking(base: InvoiceDoc, b: BookingLike, payments: PaymentLike[]): InvoiceDoc {
  const detail = (re: RegExp) => (b.details ?? []).find(([k]) => re.test(k))?.[1]
  const description = [
    b.event_date && `Date : ${shortDate(b.event_date)}`,
    b.event_time && `Time : ${b.event_time}`,
    detail(/location|venue/i) && `Location : ${detail(/location|venue/i)}`,
  ].filter(Boolean).join('\n')
  const total = num(b.total)
  const discount = num(b.discount)
  // priced lines from the booking form, unless the booking's total was changed since and they no longer add up to it
  const priced = (b.items ?? []).filter((i) => !/^promo\b/i.test(i.label) && num(i.amount) !== 0)
  const pricedSum = priced.reduce((s, i) => s + pence(i.amount), 0)
  const useLines = priced.length > 0 && pricedSum - pence(discount) === pence(total)
  const items: InvoiceItem[] = useLines
    ? priced.map((i, n) => ({ title: i.label, description: n === 0 ? description : '', qty: '1', rate: plain(num(i.amount)), amount: plain(num(i.amount)) }))
    : [{ title: [(b.kind ?? '').replace(/ booking$/i, ''), b.packages].filter(Boolean).join(': '), description, qty: '1', rate: total ? plain(total) : '', amount: total ? plain(total) : '' }]
  return {
    ...base,
    billName: b.name ?? '',
    billEmail: b.email ?? '',
    billPhone: b.phone ?? '',
    billAddress: detail(/^address$/i) ?? '',
    items,
    discountLabel: useLines && discount && b.promo_code ? `Promo ${b.promo_code}` : base.discountLabel,
    discount: useLines && discount ? plain(discount) : '',
    payments: paymentsFromBooking(b, payments),
  }
}
