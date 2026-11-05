// Dashboard → Invoices, against the fake Supabase and the Cloudflare runtime in email test mode (MAIL_DRY_RUN), in a fresh browser.
// Run:  node tests/fake-supabase.mjs &
//       VITE_SUPABASE_URL=http://127.0.0.1:54321 VITE_SUPABASE_ANON_KEY=anon npm run build
//       npx wrangler pages dev dist/client --port 4173 --binding SUPABASE_URL=http://127.0.0.1:54321 --binding SUPABASE_SERVICE_ROLE_KEY=service-role --binding CRON_SECRET=testsecret --binding MAIL_DRY_RUN=1 &
//       node tests/invoice-e2e.mjs
import { chromium } from 'playwright'
import { PDFDocument } from 'pdf-lib'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.BASE || 'http://localhost:4173'
const SB = process.env.SB || 'http://127.0.0.1:54321'
const SHOTS = process.env.SHOTS || '/tmp/invoice-shots'
fs.mkdirSync(SHOTS, { recursive: true })
let fails = 0
const ok = (name, pass, info = '') => { if (!pass) fails++; console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${info ? '  -> ' + info : ''}`) }
const dump = async () => (await fetch(SB + '/__dump')).json()
const insert = (table, row) => fetch(`${SB}/rest/v1/${table}`, { method: 'POST', headers: { 'content-type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify(row) }).then((r) => r.json()).then((r) => r[0])
await fetch(SB + '/__reset')

const contact = await insert('contacts', { name: 'Ada Obi', email: 'ada@example.com', phone: '+447700900123' })
const booking = await insert('bookings', {
  flow_id: 'portrait', kind: 'Portrait booking', contact_id: contact.id, name: 'Ada Obi', email: 'ada@example.com', phone: '+447700900123', packages: '2 Looks', total: 310, event_date: '2026-09-16', event_time: '1-3pm', status: 'confirmed',
  items: [{ label: '2 Looks Baby shoot', amount: '£250' }, { label: 'Studio booking', amount: '£60' }], details: [['Service', 'Portrait'], ['Location', 'Woolwich studio']],
})

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
const sends = []
page.on('response', async (r) => {
  if (!r.url().endsWith('/api/admin')) return
  const b = r.request().postDataJSON?.()
  if (b?.action === 'invoice_send') sends.push({ req: b, res: await r.json().catch(() => null) })
})
const go = async (hash) => { await page.evaluate((h) => { window.location.hash = h }, hash); await page.waitForTimeout(500) }
const paper = page.locator('[data-invoice-preview]')
const field = (label) => page.locator(`.iv-form label.ad-field:has(> span:text-is("${label}"))`).first().locator('input, textarea, select').first()
const pdfOf = async () => {
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download PDF' }).click()])
  const p = path.join(SHOTS, dl.suggestedFilename())
  await dl.saveAs(p)
  return { p, name: dl.suggestedFilename(), bytes: fs.readFileSync(p) }
}

await page.goto(`${BASE}/dashboard/`, { waitUntil: 'load' })
await page.fill('input[type=email]', 'info@illuszionzmedia.com')
await page.fill('input[type=password]', 'test1234')
await page.getByRole('button', { name: 'Sign in' }).click()
await page.waitForSelector('.ad-pagehead h1', { timeout: 20000 })

/* ── a general invoice for anyone ── */
await go('#/invoices')
await page.waitForSelector('.ad-pagehead h1:text-is("Invoices")')
ok('Invoices is in the sidebar', await page.locator('.ad-nav a[href="#/invoices"]').count() === 1)
await page.getByRole('link', { name: '+ New invoice' }).click()
await page.waitForSelector('.iv-form')
ok('new invoice gets the next number', (await field('Invoice number').inputValue()) === 'INV-002610')
await field('Client name').fill('Ada')
await field('Email').fill('ada@example.com')
await page.locator('[data-invoice-item]').first().locator('input[type=text]').fill('2looks Baby shoot')
await page.locator('[data-invoice-item]').first().locator('textarea').fill('Date : 16/09/2026\nTime : 1-3pm\nLocation : Woolwich studio\n8 edited images and all unedited for preview and selection purposes')
await page.locator('[data-invoice-item]').first().locator('input[type=number]').nth(1).fill('300')
ok('rate fills the amount', (await page.locator('[data-invoice-item]').first().locator('input[type=number]').nth(2).inputValue()) === '300')
await page.locator('[data-invoice-item]').first().locator('input[type=number]').nth(2).fill('250')
await page.getByRole('button', { name: '+ Add item' }).click()
await page.locator('[data-invoice-item]').nth(1).locator('input[type=text]').fill('2hours studio booking')
await page.locator('[data-invoice-item]').nth(1).locator('input[type=number]').nth(1).fill('60')
await page.waitForTimeout(200)
const box = await page.locator('.iv-form').boundingBox(), pv = await page.locator('.iv-preview').boundingBox()
ok('form on the left, preview on the right', pv.x >= box.x + box.width - 1)
let text = await paper.innerText()
ok('preview follows the form, including a typed amount (rate 300, amount 250)', /300\.00/.test(text) && /250\.00/.test(text) && /£310\.00/.test(text) && /Ada/.test(text))
for (const [label, value] of [['Title', 'TAX INVOICE'], ['Business name', 'Illuszionz Test Ltd'], ['Business address', 'Somewhere New'], ['Terms', 'Pay soon'], ['Sort code', '11-22-33'], ['Account number', '12345678'], ['Payment reference', 'REF-XYZ'], ['Notes', 'Merci beaucoup'], ['Heading', 'Our rules']]) await field(label).fill(value)
text = await paper.innerText()
ok('every text field shows on the paper', ['TAX INVOICE', 'Illuszionz Test Ltd', 'Somewhere New', 'Pay soon', '11-22-33', '12345678', 'REF-XYZ', 'Merci beaucoup', 'Our rules'].every((v) => text.includes(v)))
await page.screenshot({ path: path.join(SHOTS, 'editor-1440.png') })
await page.getByRole('button', { name: 'Save', exact: true }).click()
await page.waitForFunction(() => /#\/invoices\/[0-9a-f-]{36}/.test(location.hash))
let db = await dump()
ok('saved with its number', db.invoices.length === 1 && db.invoices[0].number === 'INV-002610' && db.invoices[0].doc.items.length === 2)

/* ── the three stages ── */
const stage = (n) => page.locator('.iv-stages button', { hasText: n })
const email = async () => {
  await page.getByRole('button', { name: 'Email to client' }).click()
  const subject = await page.locator('.ad-modal label:has-text("Subject") input').inputValue()
  const message = await page.locator('.ad-modal label:has-text("Message") textarea').inputValue()
  const n = sends.length
  await page.locator('.ad-modal').getByRole('button', { name: 'Send invoice' }).click()
  await page.waitForFunction(() => !document.querySelector('.ad-modal'), null, { timeout: 15000 })
  await page.waitForTimeout(200)
  return { subject, message, sent: sends[n] }
}
ok('nothing paid: Before payment is selected', (await stage('Before payment').getAttribute('aria-pressed')) === 'true' && !/PAID/.test(await page.locator('.iv-head-r').innerText()))
const s1 = await email()
ok('email before payment', /£310\.00 due/.test(s1.subject) && s1.sent?.res?.ok && s1.sent.res.stage === 'before' && /11-22-33/.test(s1.message), s1.subject)
ok('the PDF is attached', s1.sent?.res?.attachment?.filename === 'Invoice-INV-002610.pdf' && s1.sent.res.attachment.bytes > 1000, JSON.stringify(s1.sent?.res?.attachment))
fs.writeFileSync(path.join(SHOTS, 'stage-before.pdf'), Buffer.from(s1.sent.req.pdf, 'base64'))

await stage('Part paid').click()
ok('part paid starts at the deposit, balance follows', (await page.locator('[data-invoice-payment] input[type=number]').inputValue()) === '160' && /£150\.00/.test(await paper.innerText()) && /PART PAID/.test(await page.locator('.iv-head-r').innerText()))
await page.screenshot({ path: path.join(SHOTS, 'preview-part.png') })
const s2 = await email()
ok('email after part payment', /£150\.00 left/.test(s2.subject) && s2.sent?.res?.stage === 'part' && /£160\.00 of £310\.00/.test(s2.message), s2.subject)
fs.writeFileSync(path.join(SHOTS, 'stage-part.pdf'), Buffer.from(s2.sent.req.pdf, 'base64'))

await stage('Paid in full').click()
ok('paid in full: nothing due, marked PAID', /£0\.00/.test(await page.locator('.iv-due').innerText()) && /^PAID/.test((await page.locator('.iv-stamp').innerText()).trim()))
const s3 = await email()
ok('email after full payment', /^Paid in full/.test(s3.subject) && s3.sent?.res?.stage === 'paid' && !/11-22-33/.test(s3.message), s3.subject)
fs.writeFileSync(path.join(SHOTS, 'stage-paid.pdf'), Buffer.from(s3.sent.req.pdf, 'base64'))
await page.locator('[data-invoice-payment] input[type=number]').last().fill('50')
ok('typing a lower payment moves the status back to part paid', (await stage('Part paid').getAttribute('aria-pressed')) === 'true')
page.once('dialog', (d) => d.accept())
await stage('Before payment').click()
ok('before payment clears the payment lines', await page.locator('[data-invoice-payment]').count() === 0)

const dl = await pdfOf()
const loaded = await PDFDocument.load(dl.bytes)
ok('download is a real PDF with a terms page', dl.name === 'Invoice-INV-002610.pdf' && loaded.getPageCount() >= 2, `${loaded.getPageCount()} pages`)
await field('Client name').fill('Ọlá Ẹniọlá 你好 😀')
const odd = await pdfOf()
ok('names outside the PDF font still make a PDF', (await PDFDocument.load(odd.bytes)).getPageCount() >= 2)
await field('Client name').fill('Ada')
await page.locator('[data-invoice-item]').first().locator('textarea').fill(Array.from({ length: 120 }, (_, i) => `Line ${i + 1} of a very long description`).join('\n'))
const longPdf = await PDFDocument.load((await pdfOf()).bytes)
ok('a long invoice runs on to more pages', longPdf.getPageCount() >= 4, `${longPdf.getPageCount()} pages`)

/* ── logo + defaults ── */
await field('Sort code').fill('22-33-44')
await page.locator('.iv-form input[type=file]').setInputFiles('public/images/illuszionz-logo-white.png')
await page.waitForFunction(() => document.querySelector('.iv-logo')?.src.startsWith('data:image/png'))
ok('a new logo shows on the paper and goes in the PDF', (await PDFDocument.load((await pdfOf()).bytes)).getPageCount() >= 2)
await page.getByRole('button', { name: 'Save logo, business, bank and terms as default' }).click()
await page.waitForTimeout(400)
db = await dump()
ok('defaults are saved for the next invoice', db.settings.find((x) => x.key === 'invoice_defaults')?.value?.sortCode === '22-33-44')
await page.getByRole('button', { name: 'Use the standard logo' }).click()

/* ── duplicate number, and leaving with unsaved changes ── */
await page.getByRole('button', { name: 'Save', exact: true }).click()
await page.waitForTimeout(400)
await go('#/invoices/new')
await page.waitForSelector('.iv-form')
ok('the next invoice moves on a number', (await field('Invoice number').inputValue()) === 'INV-002611')
await field('Invoice number').fill('INV-002610')
await page.getByRole('button', { name: 'Save', exact: true }).click()
await page.waitForSelector('.ad-toast.err')
ok('a used number is refused in plain words', /already used/.test(await page.locator('.ad-toast.err').first().innerText()))
let asked = 0
page.once('dialog', (d) => { asked++; d.dismiss() })
await page.locator('.ad-nav a[href="#/finance"]').click()
await page.waitForTimeout(250)
ok('leaving with unsaved changes asks first, and No stays on the invoice', asked === 1 && await page.locator('.iv-form').count() === 1)
await field('Invoice number').fill('INV-002611')
await page.getByRole('button', { name: 'Save', exact: true }).click()
await page.waitForTimeout(400)

/* ── from a booking ── */
await go('#/bookings')
await page.waitForSelector('tbody tr')
const row = page.locator('tbody tr', { hasText: 'Ada Obi' })
ok('each booking row has an invoice button', await row.getByRole('link', { name: 'Invoice' }).count() === 1)
await row.locator('td').nth(2).click()
await page.waitForSelector('.ad-modal')
ok('the booking entry offers Generate invoice', await page.locator('.ad-modal').getByRole('link', { name: 'Generate invoice' }).count() === 1)
await page.locator('.ad-modal').getByRole('link', { name: 'Generate invoice' }).click()
await page.waitForSelector('.iv-form')
text = await paper.innerText()
ok('booking fills the client and the priced items', /Ada Obi/.test(text) && /2 Looks Baby shoot/.test(text) && /Studio booking/.test(text) && /Woolwich studio/.test(text) && /16\/09\/26/.test(text) && /£310\.00/.test(text))
await page.getByRole('button', { name: 'Save', exact: true }).click()
await page.waitForFunction(() => /#\/invoices\/[0-9a-f-]{36}/.test(location.hash))
await page.waitForTimeout(200)
db = await dump()
const inv = db.invoices.find((i) => i.booking_id === booking.id)
ok('invoice is linked to the booking and the contact', !!inv && inv.contact_id === contact.id)

/* ── after every payment: the prompt ── */
await go('#/bookings')
await page.waitForSelector('tbody tr')
await page.locator('tbody tr', { hasText: 'Ada Obi' }).locator('td').nth(2).click()
await page.getByRole('button', { name: '+ Record payment' }).click()
await page.locator('.ad-modal label:has-text("Amount") input').last().fill('160')
const receipt = page.locator('.ad-modal label.ad-check input')
if (await receipt.count()) await receipt.uncheck()
await page.getByRole('button', { name: 'Save payment' }).click()
await page.waitForSelector('text=Do you want to send them an updated invoice?')
ok('recording a payment asks about sending an invoice', /has now paid £160 of £310/.test(await page.locator('.ad-modal').last().innerText()))
await page.screenshot({ path: path.join(SHOTS, 'payment-prompt.png') })
await page.getByRole('button', { name: 'Not now' }).click()
await page.waitForTimeout(250)
ok('Not now just closes the question', await page.locator('text=Do you want to send them').count() === 0 && await page.locator('.ad-modal').count() === 1)
await page.getByRole('button', { name: '+ Record payment' }).click()
await page.locator('.ad-modal label:has-text("Amount") input').last().fill('50')
if (await receipt.count()) await receipt.uncheck()
await page.getByRole('button', { name: 'Save payment' }).click()
await page.waitForSelector('text=Do you want to send them an updated invoice?')
await page.locator('.ad-modal').last().getByRole('link', { name: 'Send invoice' }).click()
await page.waitForSelector('.iv-form')
await page.waitForFunction(() => document.querySelector('.ad-modal')?.textContent.includes('Part paid'), null, { timeout: 8000 })
ok('Send invoice reopens that booking’s invoice at the send step', (await field('Invoice number').inputValue()) === inv.number && /£210\.00/.test(await page.locator('.ad-modal').innerText()))
ok('both payments are on the invoice, balance updated', await page.locator('[data-invoice-payment]').count() === 2 && /£100\.00/.test(await page.locator('.iv-due').innerText()))
const s4 = await (async () => { const n = sends.length; await page.locator('.ad-modal').getByRole('button', { name: 'Send invoice' }).click(); await page.waitForFunction(() => !document.querySelector('.ad-modal'), null, { timeout: 15000 }); return sends[n] })()
db = await dump()
ok('send step saves the updated payments first', s4?.res?.stage === 'part' && db.invoices.find((i) => i.id === inv.id).doc.payments.length === 2)

// bulk: mark paid asks too
await go('#/bookings')
await page.waitForSelector('tbody tr')
await page.locator('tbody tr', { hasText: 'Ada Obi' }).locator('input[type=checkbox]').check()
page.once('dialog', (d) => d.accept())
await page.locator('.ad-bulk').getByRole('button', { name: 'Mark paid' }).click()
await page.waitForSelector('text=1 payments recorded').catch(() => {})
ok('bulk mark paid asks too', await page.locator('.ad-modal a:has-text("Send invoice")').count() === 1)
await page.getByRole('button', { name: 'Not now' }).click()

/* ── manual booking with money paid at the time ── */
await page.getByRole('button', { name: '+ Add booking' }).click()
await page.locator('.ad-modal label:has-text("Client name") input').fill('Walk In')
await page.locator('.ad-modal label:has-text("Total") input').fill('100')
await page.locator('.ad-modal label:has-text("Already paid") input').fill('40')
await page.locator('.ad-modal').getByRole('button', { name: 'Add booking' }).click()
await page.waitForSelector('text=Do you want to send them an updated invoice?')
ok('a booking added with a payment asks too', /Walk In has now paid £40/.test(await page.locator('.ad-modal').innerText()))
await page.getByRole('button', { name: 'Not now' }).click()

/* ── server checks ── */
const api = (body, auth = 'Bearer fake-token') => fetch(BASE + '/api/admin', { method: 'POST', headers: { 'content-type': 'application/json', Authorization: auth }, body: JSON.stringify(body) }).then(async (r) => ({ status: r.status, ...(await r.json()) }))
const good = { action: 'invoice_send', invoice_id: inv.id, to: 'a@example.com', subject: 'x', message: 'y', pdf: 'JVBERi0xLjc=' }
ok('sending needs an admin', (await api(good, 'Bearer nope')).status === 401)
ok('a non-PDF attachment is refused', (await api({ ...good, pdf: 'aGVsbG8=' })).status === 422)
ok('a bad address is refused', (await api({ ...good, to: 'a@b.c, d@e.f' })).status === 422)
ok('an unknown invoice is refused', (await api({ ...good, invoice_id: '00000000-0000-0000-0000-000000000000' })).status === 404)

/* ── list + phone ── */
await go('#/invoices')
await page.waitForSelector('tbody tr')
ok('the list shows every invoice with its status', await page.locator('tbody tr').count() === 3 && /Part paid/i.test(await page.locator('tbody').innerText()))
await page.screenshot({ path: path.join(SHOTS, 'list-1440.png') })
const phone = await browser.newContext({ storageState: await ctx.storageState(), viewport: { width: 375, height: 812 }, hasTouch: true })
const p2 = await phone.newPage()
p2.on('pageerror', (e) => errors.push(e.message))
await p2.goto(`${BASE}/dashboard/#/invoices/${inv.id}`, { waitUntil: 'load' })
await p2.waitForSelector('.iv-form', { timeout: 20000 })
const noScroll = () => p2.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)
ok('phone: the form fits with no sideways scroll', await noScroll())
await p2.waitForTimeout(1500)
await p2.screenshot({ path: path.join(SHOTS, 'editor-375.png') })
await p2.getByRole('tab', { name: 'Preview' }).click()
await p2.waitForTimeout(300)
const w = await p2.locator('.iv-paper').first().evaluate((e) => e.getBoundingClientRect().width)
ok('phone: the preview scales to fit', await noScroll() && w <= 375, `paper ${Math.round(w)}px`)
await p2.screenshot({ path: path.join(SHOTS, 'preview-375.png') })
await phone.close()

/* ── without the table (before go-live) the rest of the dashboard still works ── */
await page.route('**/rest/v1/invoices*', (r) => r.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: 'PGRST205', message: "Could not find the table 'public.invoices' in the schema cache" }) }))
await go('#/finance')
await page.waitForSelector('.ad-pagehead h1:text-is("Finance")')
await go('#/invoices')
await page.waitForSelector('text=gallery:go-live')
ok('before go-live: the page says what to run, and the other pages load', true)
await page.unroute('**/rest/v1/invoices*')

ok('no script errors', !errors.length, errors[0] ?? '')
await browser.close()
console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED')
process.exit(fails ? 1 : 0)
