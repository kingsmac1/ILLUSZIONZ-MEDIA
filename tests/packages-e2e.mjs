// Dashboard → Prices → "+ Add package": choose the page, add the package, and see it on that page's cards, booking form
// and server-checked total. Against the fake Supabase and the Cloudflare runtime, in a fresh browser.
// Run:  node tests/fake-supabase.mjs &
//       VITE_SUPABASE_URL=http://127.0.0.1:54321 VITE_SUPABASE_ANON_KEY=anon npm run build
//       npx wrangler pages dev dist/client --port 4173 --binding SUPABASE_URL=http://127.0.0.1:54321 --binding SUPABASE_SERVICE_ROLE_KEY=service-role --binding CRON_SECRET=testsecret --binding MAIL_DRY_RUN=1 &
//       node tests/packages-e2e.mjs
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.BASE || 'http://localhost:4173'
const SB = process.env.SB || 'http://127.0.0.1:54321'
const SHOTS = process.env.SHOTS || '/tmp/package-shots'
fs.mkdirSync(SHOTS, { recursive: true })
let fails = 0
const ok = (name, pass, info = '') => { if (!pass) fails++; console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${info ? '  -> ' + info : ''}`) }
const dump = async () => (await fetch(SB + '/__dump')).json()
const post = (p, body) => fetch(BASE + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json())
const prices = () => fetch(`${BASE}/api/prices?t=${Date.now()}`).then((r) => r.json())
await fetch(SB + '/__reset')

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('dialog', (d) => d.accept())
const modal = () => page.locator('.ad-modal')
const mfield = (label) => modal().locator(`label.ad-field:has(> span:text-is("${label}"))`).locator('input, textarea, select').first()
const card = (title) => page.locator('.ad-card', { has: page.locator(`h3:has-text("${title}")`) })

await page.goto(`${BASE}/dashboard/`, { waitUntil: 'load' })
await page.fill('input[type=email]', 'info@illuszionzmedia.com')
await page.fill('input[type=password]', 'test1234')
await page.getByRole('button', { name: 'Sign in' }).click()
await page.waitForSelector('.ad-pagehead h1', { timeout: 20000 })
await page.evaluate(() => { window.location.hash = '#/prices' })
await page.waitForSelector('.ad-pagehead h1:text-is("Prices")')

/* ---- "+ Add option" on a booking form: a price line or add-on for that form ---- */
const optionButton = (title) => card(title).getByRole('button', { name: `Add a price option or add-on to ${title}` })
await optionButton('Portrait Photography').click()
await modal().waitFor()
ok('the option form starts on that booking form', (await mfield('Booking form').inputValue()) === 'portrait')
const pages = await mfield('Booking form').locator('option').allInnerTexts()
ok('every booking form is offered (not the shop)', ['Portrait Photography', 'Wedding Photography', 'Maternity Photography'].every((p) => pages.some((x) => x.includes(p.split(' ')[0]))) && !pages.some((x) => /^Store|Shop/.test(x)), pages.join(' | '))
ok('on Portrait it says it adds a price line and points to + Add package for a new card', /adds a price line to the Portrait Photography card/.test(await modal().innerText()) && /\+ Add package/.test(await modal().innerText()))
await mfield('Booking form').selectOption('')
await modal().getByRole('button', { name: 'Add package' }).click()
ok('it will not save without a booking form', /Choose the booking form/.test(await modal().innerText()))
await mfield('Booking form').selectOption('portrait')
await modal().getByRole('button', { name: 'Add package' }).click()
ok('…or without a name', /Enter a name/.test(await modal().innerText()))
await mfield('Name').fill('3 Looks')
await mfield('Short line under the name').fill('12 edited pictures')
await mfield('Price (£)').fill('420')
await mfield("What's included").fill('• Online gallery\nOne printed photo')
ok('the form says what clients will see', /Clients will see 3 Looks on Portrait Photography for £420/.test(await modal().innerText()))
await page.screenshot({ path: path.join(SHOTS, 'add-option-form.png') })
await modal().getByRole('button', { name: 'Add package' }).click()
await modal().waitFor({ state: 'detached' })
let db = await dump()
const looks = db.booking_packages.find((x) => x.label === '3 Looks')
ok('saved with the booking form, price and what is included', looks?.flow_id === 'portrait' && looks.kind === 'option' && Number(looks.price) === 420 && looks.includes.join('|') === 'Online gallery|One printed photo' && looks.active)
ok('it is listed under Portrait, marked added', /3 Looks/.test(await card('Portrait Photography').innerText()) && (await card('Portrait Photography').locator('[data-added-package]').count()) === 1)

/* ---- an add-on; a per-hour option; a wedding package card ---- */
await optionButton('Portrait Photography').click()
await modal().getByRole('button', { name: 'Add-on' }).click()
await mfield('Name').fill('Hair styling')
await mfield('Price (£)').fill('40')
await mfield('Most a client can choose').fill('3')
await modal().getByRole('button', { name: 'Add package' }).click()
await modal().waitFor({ state: 'detached' })

await optionButton('Events Photography').click()
await mfield('Name').fill('Second photographer')
await mfield('Price (£)').fill('60')
await mfield('Price is').selectOption('unit')
await mfield('Per').fill('hour')
await mfield('Fewest').fill('5')
await mfield('Most').fill('2')
await modal().getByRole('button', { name: 'Add package' }).click()
ok('a range with the most below the fewest is refused', /most at least the fewest/.test(await modal().innerText()))
await mfield('Fewest').fill('2')
await mfield('Most').fill('8')
await modal().getByRole('button', { name: 'Add package' }).click()
await modal().waitFor({ state: 'detached' })

await page.getByRole('button', { name: '+ Add package' }).click()
await mfield('Page').selectOption('wedding')
await mfield('Package name').fill('Platinum Package')
await mfield('Next to the price').fill('12 hours')
await mfield('Price (£)').fill('1800')
await mfield("What's included").fill('Two photographers\nA large photobook')
await modal().getByRole('button', { name: 'Add package' }).click()
await modal().waitFor({ state: 'detached' })
db = await dump()
ok('the add-on, the per-hour package and the wedding package are saved', db.booking_packages.length === 4 && db.booking_packages.find((x) => x.label === 'Hair styling')?.max_qty === 3 && db.booking_packages.find((x) => x.label === 'Second photographer')?.unit?.plural === 'hours')

/* ---- changing the price in its box ---- */
const row = card('Portrait Photography').locator('[data-added-package]', { hasText: '3 Looks' })
await row.locator('input[type=number]').fill('450')
await row.getByRole('button', { name: 'Save' }).click()
ok('the price box saves the new price', await (async () => { for (let i = 0; i < 40; i++) { db = await dump(); if (Number(db.booking_packages.find((x) => x.label === '3 Looks')?.price) === 450) return true; await page.waitForTimeout(100) } return false })())
await page.screenshot({ path: path.join(SHOTS, 'prices-with-added.png'), fullPage: false })

/* ---- the website ---- */
const live = await prices()
ok('/api/prices hands the shown packages to the website', live.packages?.length === 4 && Array.isArray(live.overrides))
const site = await ctx.newPage()
site.on('pageerror', (e) => errors.push(e.message))
await site.goto(`${BASE}/photography-services`, { waitUntil: 'load' })
const portraitCard = site.locator('.sc-card', { hasText: 'Portrait Photography' })
await portraitCard.locator('text=3 Looks').waitFor({ timeout: 15000 })
ok('the Portrait card gets a 3 Looks row with its price', /3 Looks[\s\S]*12 edited pictures[\s\S]*£450/.test(await portraitCard.innerText()))
ok('…and the other cards are unchanged', !/3 Looks/.test(await site.locator('.sc-card', { hasText: 'Maternity Photography' }).innerText()))
await portraitCard.screenshot({ path: path.join(SHOTS, 'portrait-card.png') })
await portraitCard.locator('button:has-text("3 Looks")').click()
const panel = site.locator('.bk-slot-inner')
await panel.waitFor()
const picked = panel.locator('.bk-option.is-on')
ok('choosing the row opens the form with 3 Looks chosen', /3 Looks/.test(await picked.innerText()) && /Online gallery/.test(await picked.innerText()))
await site.goto(`${BASE}/photography-services#book-events`, { waitUntil: 'load' })
await site.locator('.bk-slot-inner').waitFor({ timeout: 15000 })
const second = site.locator('.bk-option', { hasText: 'Second photographer' })
ok('the per-hour package is in the Events form, priced per hour', /£60\s*\/hour/.test(await second.innerText()))

await site.goto(`${BASE}/wedding`, { waitUntil: 'load' })
const platinum = site.locator('.sc-card', { hasText: 'Platinum Package' })
ok('the Wedding page gets a new Platinum card', await platinum.waitFor({ timeout: 15000 }).then(() => true, () => false))
const pt = await platinum.innerText()
ok('…with its price, hours, what is included and a photo', /£1,800/.test(pt) && /12 hours/.test(pt) && /A large photobook/.test(pt) && (await platinum.locator('img').count()) === 1)
ok('…placed after the standard packages', await site.evaluate(() => { const t = [...document.querySelectorAll('.sc-card h3')].map((h) => h.textContent); return t.indexOf('Platinum Package') > t.indexOf('Gold Package') }))
ok('…and a plain button, not “Book Silver”', /Book now/i.test(pt) && !/Book Silver/i.test(pt), pt.split('\n').slice(-1)[0])
await platinum.screenshot({ path: path.join(SHOTS, 'wedding-card.png') })

/* ---- the server prices them ---- */
const fields = { name: 'Test Client', phone: '+447700900123', email: 'test@example.com', date: '2026-12-20', time: '14:00', setting: 'Studio' }
const id = (label) => `added-${db.booking_packages.find((x) => x.label === label).id}`
const b1 = await post('/api/booking', { flowId: 'portrait', optionIds: [id('3 Looks')], units: {}, extras: { [id('Hair styling')]: 2 }, fields })
ok('a booking with the added package and add-on is priced by the server: £450 + 2 × £40', b1.ok && b1.total === '£530', JSON.stringify(b1).slice(0, 200))
db = await dump()
const saved = db.bookings.find((x) => x.email === 'test@example.com')
ok('the booking records the package and add-on by name', /3 Looks/.test(saved?.packages ?? '') && JSON.stringify(saved?.items ?? []).includes('Hair styling'))
const b2 = await post('/api/booking', { flowId: 'portrait', optionIds: [id('Platinum Package')], units: {}, extras: {}, fields })
ok('a package from another page is refused', !b2.ok && /Unknown option/.test(b2.error ?? ''))

/* ---- hide, show, delete ---- */
await row.getByRole('button', { name: 'Hide' }).click()
ok('Hide takes it off the website', await (async () => { for (let i = 0; i < 40; i++) { const p = await prices(); if (!p.packages.some((x) => x.label === '3 Looks')) return true; await page.waitForTimeout(150) } return false })())
const b3 = await post('/api/booking', { flowId: 'portrait', optionIds: [id('3 Looks')], units: {}, extras: {}, fields: { ...fields, date: '2026-12-21' } })
ok('…and a hidden package cannot be booked', !b3.ok && /Unknown option/.test(b3.error ?? ''))
await row.getByRole('button', { name: 'Show' }).click()
await card('Wedding').locator('[data-added-package]').getByRole('button', { name: 'Edit' }).click()
ok('Edit opens the saved package', (await mfield('Package name').inputValue()) === 'Platinum Package' && (await mfield("What's included").inputValue()) === 'Two photographers\nA large photobook')
await mfield('Price (£)').fill('1900')
await modal().getByRole('button', { name: 'Save package' }).click()
await modal().waitFor({ state: 'detached' })
db = await dump()
ok('Edit saves', Number(db.booking_packages.find((x) => x.label === 'Platinum Package')?.price) === 1900)
await card('Wedding').locator('[data-added-package]').getByRole('button', { name: 'Delete' }).click()
ok('Delete removes it', await (async () => { for (let i = 0; i < 40; i++) { db = await dump(); if (!db.booking_packages.some((x) => x.label === 'Platinum Package')) return true; await page.waitForTimeout(100) } return false })())

/* ---- phone ---- */
const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })
const pp = await phone.newPage()
pp.on('pageerror', (e) => errors.push(e.message))
await pp.goto(`${BASE}/dashboard/`, { waitUntil: 'load' })
await pp.fill('input[type=email]', 'info@illuszionzmedia.com')
await pp.fill('input[type=password]', 'test1234')
await pp.getByRole('button', { name: 'Sign in' }).click()
await pp.waitForSelector('.ad-pagehead h1', { timeout: 20000 })
await pp.evaluate(() => { window.location.hash = '#/prices' })
await pp.getByRole('button', { name: '+ Add package' }).click()
await pp.locator('.ad-modal').waitFor()
const over = await pp.evaluate(() => { const m = document.querySelector('.ad-modal').getBoundingClientRect(); return { right: m.right, w: window.innerWidth, scroll: document.documentElement.scrollWidth - window.innerWidth } })
ok('phone: the form fits the screen', over.right <= over.w + 1 && over.scroll <= 1, JSON.stringify(over))
await pp.screenshot({ path: path.join(SHOTS, 'add-package-phone.png') })
await phone.close()

ok('no page errors', errors.length === 0, errors.join(' | '))
await browser.close()
console.log(fails ? `\n${fails} check(s) failed` : '\nAll package checks passed')
process.exit(fails ? 1 : 0)
