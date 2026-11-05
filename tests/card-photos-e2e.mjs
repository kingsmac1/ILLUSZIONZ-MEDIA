// Dashboard → Prices → Card photos: change the photo on any price card (upload, choose one on the site, paste a link),
// put the original back, and give an added package its own photo. Against the fake Supabase + Cloudflare runtime.
// Run: same servers as tests/packages-e2e.mjs, then  node tests/card-photos-e2e.mjs
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.BASE || 'http://localhost:4173'
const SB = process.env.SB || 'http://127.0.0.1:54321'
const SHOTS = process.env.SHOTS || '/tmp/card-photo-shots'
fs.mkdirSync(SHOTS, { recursive: true })
let fails = 0
const ok = (name, pass, info = '') => { if (!pass) fails++; console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${info ? '  -> ' + info : ''}`) }
const dump = async () => (await fetch(SB + '/__dump')).json()
const prices = () => fetch(`${BASE}/api/prices?t=${Date.now()}`).then((r) => r.json())
const photosNow = async () => (await dump()).settings.find((s) => s.key === 'card_photos')?.value ?? {}
const until = async (fn, ms = 6000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await fn()) return true; await new Promise((r) => setTimeout(r, 120)) } return false }
await fetch(SB + '/__reset')

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('dialog', (d) => d.accept())
const toasts = []
page.on('console', (m) => { if (m.type() === 'error') toasts.push(m.text().slice(0, 160)) })
const card = (title) => page.locator('.ad-card', { has: page.locator(`h3:has-text("${title}")`) })
const picker = () => page.locator('.ad-modal.wide')

await page.goto(`${BASE}/dashboard/`, { waitUntil: 'load' })
await page.fill('input[type=email]', 'info@illuszionzmedia.com')
await page.fill('input[type=password]', 'test1234')
await page.getByRole('button', { name: 'Sign in' }).click()
await page.waitForSelector('.ad-pagehead h1', { timeout: 20000 })
await page.evaluate(() => { window.location.hash = '#/prices' })
await page.waitForSelector('.ad-pagehead h1:text-is("Prices")')

/* ---- every card with a photo is listed under its page ---- */
const count = async (title) => card(title).locator('.cp-thumb').count()
ok('Portrait has its one card photo', (await count('Portrait Photography')) === 1)
ok('Wedding has its four package photos', (await count('Wedding Photography')) === 4)
ok('Videography has its photos', (await count('Videography')) >= 6)
ok('Academy has its course photos', (await count('Academy')) === 5)
ok('pages whose cards have no photo show no photo strip', (await card('Creative & Media Agency').locator('.cp-strip').count()) === 0)
const strip = card('Wedding Photography').locator('.cp-strip')
await strip.scrollIntoViewIfNeeded()
ok('the card photos show as thumbnails', await until(() => strip.locator('img').evaluateAll((imgs) => imgs.length === 4 && imgs.every((i) => i.complete && i.naturalWidth > 0))))
await strip.screenshot({ path: path.join(SHOTS, 'wedding-strip.png') })

/* ---- choose a photo already on the site ---- */
await card('Wedding Photography').getByRole('button', { name: 'Change the photo for Silver Package' }).click()
await picker().waitFor()
const options = picker().locator('.cp-grid button')
ok('the picker offers the photos already on the site', (await options.count()) >= 15, `${await options.count()} photos`)
ok('the current photo is marked', (await picker().locator('.cp-grid button.on').count()) === 1)
ok('nothing to save until a different photo is chosen', await picker().getByRole('button', { name: 'Use this photo' }).isDisabled())
const target = options.nth(5)
const targetUrl = await target.locator('img').getAttribute('src')
await target.click()
ok('choosing one previews it as not saved yet', /Not saved yet/.test(await picker().innerText()) && (await picker().locator('.cp-now img').getAttribute('src')) === targetUrl)
await picker().screenshot({ path: path.join(SHOTS, 'picker.png') })
await picker().getByRole('button', { name: 'Use this photo' }).click()
await picker().waitFor({ state: 'detached' })
ok('saved for that card only', await until(async () => (await photosNow())['wedding:silver-package'] === targetUrl))
ok('the card is marked changed and shows the new photo', /changed/.test(await card('Wedding Photography').locator('.cp-thumb', { hasText: 'Silver Package' }).innerText()) && (await card('Wedding Photography').locator('.cp-thumb', { hasText: 'Silver Package' }).locator('img').getAttribute('src')) === targetUrl)

/* ---- upload a new photo ---- */
await card('Portrait Photography').getByRole('button', { name: 'Change the photo for Portrait Photography' }).click()
await picker().waitFor()
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==', 'base64')
await picker().locator('input[type=file]').setInputFiles({ name: 'new portrait.png', mimeType: 'image/png', buffer: png })
ok('an uploaded photo goes to the site photo store and is previewed', await until(async () => /\/storage\/v1\/object\/public\/site-media\/.+new_portrait\.png$/.test((await picker().locator('.cp-now img').getAttribute('src')) ?? '')))
const uploaded = await picker().locator('.cp-now img').getAttribute('src')
await picker().getByRole('button', { name: 'Use this photo' }).click()
await picker().waitFor({ state: 'detached' })
ok('the upload is saved as the Portrait card photo', await until(async () => (await photosNow())['portrait:portrait-photography'] === uploaded), `${uploaded} vs ${(await photosNow())['portrait:portrait-photography']} · ${(await page.locator('.ad-toast').allInnerTexts()).join(' | ')} · ${toasts.join(' | ')}`)
const served = await fetch(uploaded)
ok('the uploaded photo is served as the image itself', served.ok && served.headers.get('content-type') === 'image/png' && Buffer.from(await served.arrayBuffer()).equals(png))

/* ---- a pasted link: only real links ---- */
await card('Academy').locator('.cp-thumb').first().click()
await picker().waitFor()
await picker().locator('input[aria-label="Photo link"]').fill('javascript:alert(1)')
ok('a link that is not a photo address is refused', /starts with https:\/\/ or \/images\//.test(await picker().innerText()) && await picker().getByRole('button', { name: 'Preview' }).isDisabled())
await picker().locator('input[aria-label="Photo link"]').fill('/images/drone-600700.jpg.webp')
await picker().getByRole('button', { name: 'Preview' }).click()
await picker().getByRole('button', { name: 'Use this photo' }).click()
await picker().waitFor({ state: 'detached' })
const academyKey = Object.keys(await photosNow()).find((k) => k.startsWith('academy:'))
ok('a pasted site link is saved', !!academyKey && (await photosNow())[academyKey] === '/images/drone-600700.jpg.webp', academyKey)

/* ---- the website ---- */
const live = await prices()
ok('/api/prices hands the photos to the website', live.cardPhotos?.['wedding:silver-package'] === targetUrl && live.cardPhotos['portrait:portrait-photography'] === uploaded)
const siteCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
let site = await siteCtx.newPage()
site.on('pageerror', (e) => errors.push(e.message))
await site.goto(`${BASE}/wedding`, { waitUntil: 'load' })
const silver = site.locator('.sc-card', { hasText: 'Silver Package' })
ok('the Wedding page shows the chosen Silver photo', await until(async () => (await silver.locator('img').getAttribute('src')) === targetUrl, 12000))
ok('…and leaves the other cards’ photos alone', (await site.locator('.sc-card', { hasText: 'Gold Package' }).locator('img').getAttribute('src')) === '/images/ILU6448.webp')
await site.goto(`${BASE}/photography-services`, { waitUntil: 'load' })
ok('the Portrait card shows the uploaded photo', await until(async () => (await site.locator('.sc-card', { hasText: 'Portrait Photography' }).locator('img').getAttribute('src')) === uploaded, 12000))

/* ---- put the original back ---- */
await card('Wedding Photography').getByRole('button', { name: 'Change the photo for Silver Package' }).click()
await picker().waitFor()
await picker().getByRole('button', { name: 'Use the original photo' }).click()
await picker().waitFor({ state: 'detached' })
ok('Use the original photo removes the change', await until(async () => !('wedding:silver-package' in (await photosNow()))))
ok('…and the card is no longer marked changed', !/changed/.test(await card('Wedding Photography').locator('.cp-thumb', { hasText: 'Silver Package' }).innerText()))

/* ---- an added package gets its own photo ---- */
const modal = page.locator('.ad-modal').first()
const mfield = (label) => modal.locator(`label.ad-field:has(> span:text-is("${label}"))`).locator('input, textarea, select').first()
await page.getByRole('button', { name: '+ Add package' }).click()
await mfield('Page').selectOption('portrait')
await mfield('Name').fill('3 Looks')
ok('on a page with package rows the form explains there is no separate photo', /no photo of its own/.test(await modal.innerText()) && (await modal.locator('.cp-field').count()) === 0)
await mfield('Page').selectOption('wedding')
await mfield('Name').fill('Platinum Package')
await mfield('Price (£)').fill('1800')
ok('on Wedding the form has a card photo, starting with the page’s first photo', (await modal.locator('.cp-field img').getAttribute('src')) === '/images/imgi_13_325350223_167249076020601_2069285591843222161_n.jpg')
await modal.getByRole('button', { name: 'Choose photo' }).click()
await picker().waitFor()
const pick2 = picker().locator('.cp-grid button').nth(3)
const pick2Url = await pick2.locator('img').getAttribute('src')
await pick2.click()
await picker().getByRole('button', { name: 'Use this photo' }).click()
await picker().waitFor({ state: 'detached' })
ok('the chosen photo shows in the form', (await modal.locator('.cp-field img').getAttribute('src')) === pick2Url)
await modal.getByRole('button', { name: 'Add package' }).click()
await page.locator('.ad-modal').waitFor({ state: 'detached' })
const db = await dump()
const plat = db.booking_packages.find((x) => x.label === 'Platinum Package')
ok('the package and its photo are saved together', !!plat && await until(async () => (await photosNow())[`wedding:added-${plat.id}`] === pick2Url))
ok('the added package is in the Wedding card photos too', (await count('Wedding Photography')) === 5)
await siteCtx.close()
const siteCtx2 = await browser.newContext({ viewport: { width: 1440, height: 900 } })
site = await siteCtx2.newPage()
await site.goto(`${BASE}/wedding`, { waitUntil: 'load' })
const platCard = site.locator('.sc-card', { hasText: 'Platinum Package' })
ok('the new Wedding card shows its own photo', await until(async () => (await platCard.locator('img').getAttribute('src').catch(() => '')) === pick2Url, 12000))
await card('Wedding Photography').locator('[data-added-package]').getByRole('button', { name: 'Edit' }).click()
ok('editing the package shows its saved photo', (await page.locator('.ad-modal .cp-field img').getAttribute('src')) === pick2Url)
await page.locator('.ad-modal').getByRole('button', { name: 'Cancel' }).click()

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
await pp.locator('.cp-thumb').first().click()
await pp.locator('.cp-picker').waitFor()
const fit = await pp.evaluate(() => ({ modal: document.querySelector('.ad-modal').getBoundingClientRect().right, w: window.innerWidth, scroll: document.documentElement.scrollWidth - window.innerWidth }))
ok('phone: the picker fits the screen', fit.modal <= fit.w + 1 && fit.scroll <= 1, JSON.stringify(fit))
await pp.screenshot({ path: path.join(SHOTS, 'picker-phone.png') })
await phone.close()

ok('no page errors', errors.length === 0, errors.join(' | '))
await browser.close()
console.log(fails ? `\n${fails} check(s) failed` : '\nAll card photo checks passed')
process.exit(fails ? 1 : 0)
