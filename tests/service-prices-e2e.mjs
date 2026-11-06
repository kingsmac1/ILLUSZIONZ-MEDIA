// Prices: a package added to Photography services (e.g. Graduate Photography) gets its own price section like Portrait or
// Maternity — change a price, hide a line, change an add-on — and the website card, booking form and server follow.
// Run: same servers as tests/packages-e2e.mjs, then  node tests/service-prices-e2e.mjs
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.BASE || 'http://localhost:4173'
const SB = process.env.SB || 'http://127.0.0.1:54321'
const SHOTS = process.env.SHOTS || '/tmp/service-prices-shots'
fs.mkdirSync(SHOTS, { recursive: true })
let fails = 0
const ok = (name, pass, info = '') => { if (!pass) fails++; console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${info ? '  -> ' + info : ''}`) }
const dump = async () => (await fetch(SB + '/__dump')).json()
const svc = async () => (await dump()).booking_services[0]
const post = (body) => fetch(BASE + '/api/booking', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json())
const until = async (fn, ms = 8000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await fn()) return true; await new Promise((r) => setTimeout(r, 120)) } return false }
const fields = { name: 'Svc Test', phone: '+447700900123', email: 'svc@example.com', date: '2026-12-20', time: '14:00', setting: 'Studio' }
await fetch(SB + '/__reset')
const created = await (await fetch(`${SB}/rest/v1/booking_services`, { method: 'POST', headers: { 'content-type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify({ title: 'Graduate Photography', options: [{ label: '1 Look', note: '4 edited pictures', price: 200 }, { label: 'With family', note: '8 edited pictures', price: 260 }], extras: [{ label: 'Gown hire', note: '', price: 30 }], standard_extras: true, active: true, sort_order: 1 }) })).json()
const S = Array.isArray(created) ? created[0] : created
const FID = `svc-${S.id}`
// its cover photo, as every added package has one
await fetch(`${SB}/rest/v1/settings`, { method: 'POST', headers: { 'content-type': 'application/json', Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ key: 'card_photos', value: { [`service:${S.id}`]: '/images/imgi_18_591140939_18544250149022665_4243811256061463776_n.jpg' } }) })

const browser = await chromium.launch()
const errors = []
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
page.on('pageerror', (e) => errors.push(e.message))
page.on('dialog', (d) => d.accept())
await page.goto(`${BASE}/dashboard/`, { waitUntil: 'load' })
await page.fill('input[type=email]', 'info@illuszionzmedia.com')
await page.fill('input[type=password]', 'test1234')
await page.getByRole('button', { name: 'Sign in' }).click()
await page.waitForSelector('.ad-pagehead h1', { timeout: 20000 })
await page.evaluate(() => { window.location.hash = '#/prices' })
await page.waitForSelector('.ad-pagehead h1:text-is("Prices")')
const sec = page.locator(`[data-service-prices="${S.id}"]`)
await sec.waitFor({ timeout: 10000 })
const titles = await page.locator('.ad-card > h3').allInnerTexts()
const gi = titles.findIndex((t) => t.startsWith('Graduate Photography')), fi = titles.findIndex((t) => t.startsWith('Family')), wi = titles.findIndex((t) => t.startsWith('Wedding'))
ok('Graduate Photography has its own price section, after Family and before Wedding', gi > fi && gi < wi, titles.map((t) => t.split('\n')[0]).join(' | '))
const rows = await sec.locator('tbody tr').allInnerTexts()
ok('…listing its price lines, its own add-on and the usual photo add-ons', ['1 Look', 'With family', 'Gown hire', 'Extra edited pictures'].every((t) => rows.some((r) => r.includes(t))), String(rows.length))
ok('…with its card photo', (await sec.locator('[data-card-photos] .cp-thumb').count()) === 1)
await sec.screenshot({ path: path.join(SHOTS, 'graduate-section.png') })

const row = (t) => sec.locator('tr', { has: page.locator(`b:text-is("${t}")`) })
await row('1 Look').locator('input').fill('210')
await row('1 Look').getByRole('button', { name: 'Save' }).click()
ok('changing a price line saves it on the package', await until(async () => Number((await svc()).options[0].price) === 210))
await row('With family').getByRole('button', { name: 'Hide' }).click()
ok('hiding a line keeps it, marked hidden', await until(async () => (await svc()).options[1].hidden === true))
await row('Gown hire').locator('input').fill('35')
await row('Gown hire').getByRole('button', { name: 'Save' }).click()
ok('changing its own add-on price saves it', await until(async () => Number((await svc()).extras[0].price) === 35))
await row('24-hour express turnaround').locator('input').fill('60')
await row('24-hour express turnaround').getByRole('button', { name: 'Save' }).click()
ok('changing a usual add-on saves a price for this package only', await until(async () => (await dump()).price_overrides.some((o) => o.flow_id === FID && Number(o.price) === 60)))

// the server: 1 Look is £210, the hidden line can't be booked, the add-ons use the new prices
const r1 = await post({ flowId: FID, optionIds: [`${FID}-1`], extras: { [`${FID}-x1`]: 1 }, fields, agree: true })
ok('the server charges the new prices', r1.ok && r1.total === '£245', JSON.stringify(r1).slice(0, 200))
const r2 = await post({ flowId: FID, optionIds: [`${FID}-2`], fields, agree: true })
ok('the hidden line cannot be booked', !r2.ok, JSON.stringify(r2).slice(0, 160))

// the website card
const sp = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
await sp.goto(`${BASE}/photography-services`, { waitUntil: 'load' })
const card = sp.locator('.sc-card', { has: sp.locator('h3:text-is("Graduate Photography")') })
await card.waitFor({ timeout: 20000 })
const txt = await card.innerText()
ok('the website card shows £210 and not the hidden line', /£210/.test(txt) && !/With family/.test(txt), txt.replace(/\s+/g, ' ').slice(0, 200))

// editing the package in the form keeps the hidden line hidden
await sec.getByRole('button', { name: /Add a price option/ }).click()
const modal = page.locator('.ad-modal').first()
await modal.waitFor()
await modal.getByRole('button', { name: /Save/ }).last().click()
await page.locator('.ad-modal').waitFor({ state: 'detached', timeout: 8000 })
ok('saving the form keeps the hidden line hidden', await until(async () => { const v = await svc(); return v.updated_at !== S.updated_at && v.options[1]?.hidden === true && Number(v.options[0].price) === 210 }))

ok('no page errors', errors.length === 0, errors.join(' | '))
await browser.close()
console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED')
process.exit(fails ? 1 : 0)
