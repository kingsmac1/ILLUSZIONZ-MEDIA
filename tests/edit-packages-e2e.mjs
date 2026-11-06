// Prices → Packages on the website: edit and delete the built-in package cards (Portrait Photography, Silver Package …)
// and the ones added in the dashboard, and see the website, the booking form and the server follow.
// Run: same servers as tests/packages-e2e.mjs, then  node tests/edit-packages-e2e.mjs
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.BASE || 'http://localhost:4173'
const SB = process.env.SB || 'http://127.0.0.1:54321'
const SHOTS = process.env.SHOTS || '/tmp/edit-pkg-shots'
fs.mkdirSync(SHOTS, { recursive: true })
let fails = 0
const ok = (name, pass, info = '') => { if (!pass) fails++; console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${info ? '  -> ' + info : ''}`) }
const dump = async () => (await fetch(SB + '/__dump')).json()
const setting = async (k) => (await dump()).settings.find((s) => s.key === k)?.value ?? {}
const post = (body) => fetch(BASE + '/api/booking', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json())
const until = async (fn, ms = 8000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await fn()) return true; await new Promise((r) => setTimeout(r, 120)) } return false }
const fields = { name: 'Edit Test', phone: '+447700900123', email: 'edit@example.com', date: '2026-12-20', time: '14:00', setting: 'Studio' }
await fetch(SB + '/__reset')
// an added Photography services package, to check added ones sit in the same list
await fetch(`${SB}/rest/v1/booking_services`, { method: 'POST', headers: { 'content-type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify({ title: 'Graduate Photography', options: [{ label: '1 Look', note: '', price: 150 }], active: true, sort_order: 1 }) })

const browser = await chromium.launch()
const errors = []
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()
page.on('pageerror', (e) => errors.push(e.message))
page.on('dialog', (d) => d.accept())
const site = async (p) => {
  const c = await browser.newContext({ viewport: { width: 1440, height: 900 } }) // a new visitor each time (prices are cached for a minute)
  const sp = await c.newPage()
  sp.on('pageerror', (e) => errors.push(e.message))
  await sp.goto(`${BASE}${p}`, { waitUntil: 'load' })
  await sp.locator('.sc-card').first().waitFor({ timeout: 20000 })
  await sp.waitForTimeout(800) // the live prices arrive just after the page
  return { c, sp }
}

await page.goto(`${BASE}/dashboard/`, { waitUntil: 'load' })
await page.fill('input[type=email]', 'info@illuszionzmedia.com')
await page.fill('input[type=password]', 'test1234')
await page.getByRole('button', { name: 'Sign in' }).click()
await page.waitForSelector('.ad-pagehead h1', { timeout: 20000 })
await page.evaluate(() => { window.location.hash = '#/prices' })
await page.waitForSelector('.ad-pagehead h1:text-is("Prices")')
const list = page.locator('[data-website-packages]')
const item = (key) => list.locator(`[data-pkg="${key}"]`)
const modal = page.locator('.ad-modal').first()
const mfield = (label) => modal.locator(`label.ad-field:has(> span:text-is("${label}"))`).locator('input, textarea, select').first()

/* ---- the list ---- */
const tabs = await list.locator('[role=tab]').allInnerTexts()
ok('Packages on the website lists every page', ['Photography services', 'Wedding', 'Videography services', 'Academy', 'Agency'].every((t) => tabs.some((x) => x.startsWith(t))), tabs.join(' | '))
const photo = await list.locator('.np-text b').allInnerTexts()
ok('Photography services shows the built-in packages and the added one', ['Portrait Photography', 'Maternity Photography', 'Baby Shoot', 'Prewedding / Engagement Pictures', 'Family Photo Sessions', 'Graduate Photography'].every((t) => photo.includes(t)), photo.join(' | '))
ok('…each with Edit and Delete', (await item('portrait:portrait-photography').getByRole('button', { name: 'Edit' }).count()) === 1 && (await item('portrait:portrait-photography').getByRole('button', { name: 'Delete' }).count()) === 1)
await list.screenshot({ path: path.join(SHOTS, 'packages-list.png') })

/* ---- edit a built-in package: Portrait Photography ---- */
await item('portrait:portrait-photography').getByRole('button', { name: 'Edit' }).click()
await modal.waitFor()
ok('the form opens with the current name, photo and price lines', (await mfield('Package name').inputValue()) === 'Portrait Photography' && (await modal.locator('[data-package-photo] img').count()) === 1 && (await modal.locator('[data-price-line] input').first().inputValue()) === '1 Look')
await mfield('Package name').fill('Portrait Sessions')
await mfield('Short description').fill('Relaxed portraits in our Woolwich studio.')
const line = modal.locator('[data-price-line]').first().locator('input')
await line.nth(0).fill('Single look')
await line.nth(1).fill('5 edited pictures')
await line.nth(2).fill('180')
await mfield('Button text').fill('Book your portrait')
await modal.screenshot({ path: path.join(SHOTS, 'edit-portrait.png') })
await modal.getByRole('button', { name: 'Save package' }).click()
await page.locator('.ad-modal').waitFor({ state: 'detached' })
ok('saved: the name, the price line wording and the price', await until(async () => {
  const ce = await setting('card_edits'); const oe = await setting('option_edits'); const db = await dump()
  return ce['portrait:portrait-photography']?.title === 'Portrait Sessions' && oe['portrait:portrait-1']?.label === 'Single look' && oe['portrait:portrait-1']?.note === '5 edited pictures' && db.price_overrides.some((o) => o.item_id === 'portrait-1' && Number(o.price) === 180)
}))
ok('the list shows the new name', await until(async () => /Portrait Sessions/.test(await item('portrait:portrait-photography').innerText())))
{
  const { c, sp } = await site('/photography-services')
  const card = sp.locator('.sc-card', { has: sp.locator('h3:text-is("Portrait Sessions")') })
  const t = await card.innerText().catch(() => '')
  ok('the website card has the new name, description, price line and button', /Relaxed portraits/.test(t) && /Single look[\s\S]*5 edited pictures[\s\S]*£180/.test(t) && /From\s*£180/i.test(t) && /Book your portrait/i.test(t), t.replace(/\s+/g, ' ').slice(0, 220))
  ok('…and keeps its photo', !!(await card.locator('img').getAttribute('src')))
  await card.locator('button:has-text("Single look")').click()
  const panel = sp.locator('.bk-slot-inner')
  await panel.waitFor()
  const pt = await panel.innerText()
  ok('its booking form uses the new name and wording', /Portrait Sessions/.test(pt) && /Single look/.test(pt) && /£180/.test(pt))
  await c.close()
}
const b1 = await post({ flowId: 'portrait', optionIds: ['portrait-1'], units: {}, extras: {}, fields })
ok('the server prices it at the new price and names it in the email', b1.ok && b1.total === '£180' && /Single look/.test(b1.emails?.customer?.html ?? '') && /Portrait Sessions/i.test(b1.emails?.owner?.subject ?? ''), `${b1.total} · ${b1.emails?.owner?.subject}`)

/* ---- stop offering one price line: Maternity's Couple line ---- */
await item('maternity:maternity-photography').getByRole('button', { name: 'Edit' }).click()
await modal.locator('[data-price-line]').nth(1).locator('input[type=checkbox]').uncheck()
await modal.getByRole('button', { name: 'Save package' }).click()
await page.locator('.ad-modal').waitFor({ state: 'detached' })
{
  const { c, sp } = await site('/photography-services')
  ok('the Maternity card no longer offers Couple · 1 Look', !/Couple/.test(await sp.locator('.sc-card', { hasText: 'Maternity Photography' }).innerText()))
  await c.close()
}
const b2 = await post({ flowId: 'maternity', optionIds: ['maternity-couple'], units: {}, extras: {}, fields: { ...fields, weeks: '30' } })
ok('…and it cannot be booked', !b2.ok && /Unknown option/.test(b2.error ?? ''))

/* ---- delete a built-in package: Baby Shoot ---- */
await item('baby:baby-shoot').getByRole('button', { name: 'Delete' }).click()
ok('Delete marks it deleted, with Restore', await until(async () => /deleted/i.test(await item('baby:baby-shoot').innerText()) && (await item('baby:baby-shoot').getByRole('button', { name: 'Restore' }).count()) === 1))
{
  const { c, sp } = await site('/photography-services')
  ok('Baby Shoot is gone from the website', (await sp.locator('.sc-card h3', { hasText: 'Baby Shoot' }).count()) === 0)
  await sp.locator('.sc-card', { has: sp.locator('h3:text-is("Portrait Sessions")') }).locator('button:has-text("Single look")').click()
  await sp.locator('.bk-slot-inner').waitFor()
  ok('…and from “Add another shoot”', (await sp.locator('.bk-also-chip', { hasText: 'Baby Shoot' }).count()) === 0 && (await sp.locator('.bk-also-chip').count()) > 0)
  await c.close()
}
const b3 = await post({ flowId: 'baby', optionIds: ['baby-1'], units: {}, extras: {}, fields: { ...fields, age: '6 months' } })
ok('…and the server refuses to book it', !b3.ok && /Unknown service/.test(b3.error ?? ''))
const b3b = await post({ flowId: 'portrait', also: ['baby'], optionIds: ['portrait-1', 'baby-1'], units: {}, extras: {}, fields: { ...fields, age: '6 months' } })
ok('…also as an extra shoot', !b3b.ok)
await item('baby:baby-shoot').getByRole('button', { name: 'Restore' }).click()
ok('Restore brings it back', await until(async () => !(await setting('card_edits'))['baby:baby-shoot']?.hidden))
const b4 = await post({ flowId: 'baby', optionIds: ['baby-1'], units: {}, extras: {}, fields: { ...fields, age: '6 months', email: 'baby@example.com' } })
ok('…and bookable again', b4.ok && b4.total === '£150', b4.error ?? b4.total)

/* ---- a Wedding package (one card per package) ---- */
await list.getByRole('tab', { name: /^Wedding/ }).click()
await item('wedding:silver-package').getByRole('button', { name: 'Edit' }).click()
ok('a Wedding package has its price, note and what’s included', (await mfield('Price (£)').inputValue()) === '1100' && (await mfield('Next to the price').inputValue()) === '8 hours' && /A photo frame/.test(await mfield("What's included").inputValue()))
await mfield('Package name').fill('Silver Plus')
await mfield('Price (£)').fill('1150')
await mfield("What's included").fill('All softcopies in Google Drive\nA photo frame\nA mini album')
await modal.getByRole('button', { name: 'Save package' }).click()
await page.locator('.ad-modal').waitFor({ state: 'detached' })
await item('wedding:gold-package').getByRole('button', { name: 'Delete' }).click()
await until(async () => (await setting('card_edits'))['wedding:gold-package']?.hidden === true)
{
  const { c, sp } = await site('/wedding')
  const silver = sp.locator('.sc-card', { has: sp.locator('h3:text-is("Silver Plus")') })
  const t = await silver.innerText().catch(() => '')
  ok('the Wedding page shows Silver Plus at £1,150 with the new list', /£1,150/.test(t) && /A mini album/.test(t), t.replace(/\s+/g, ' ').slice(0, 200))
  ok('…and Gold is gone', (await sp.locator('.sc-card h3', { hasText: 'Gold Package' }).count()) === 0)
  await c.close()
}
const wg = await post({ flowId: 'wedding', optionIds: ['wedding-gold'], units: {}, extras: {}, fields })
ok('a deleted Wedding package cannot be booked', !wg.ok && /Unknown option wedding-gold/.test(wg.error ?? ''), wg.error)

/* ---- reset a built-in package to the original ---- */
await list.getByRole('tab', { name: /^Photography services/ }).click()
await item('portrait:portrait-photography').getByRole('button', { name: 'Edit' }).click()
await modal.getByRole('button', { name: 'Reset to original' }).click()
await page.locator('.ad-modal').waitFor({ state: 'detached' })
ok('Reset to original puts Portrait Photography back (name, wording, price)', await until(async () => {
  const ce = await setting('card_edits'); const oe = await setting('option_edits'); const db = await dump()
  return !ce['portrait:portrait-photography'] && !oe['portrait:portrait-1'] && db.price_overrides.some((o) => o.item_id === 'portrait-1' && Number(o.price) === 170)
}))

/* ---- an added package in the same list ---- */
const grad = (await dump()).booking_services[0]
await list.locator(`[data-service="${grad.id}"]`).getByRole('button', { name: 'Delete' }).click()
ok('an added package can be deleted from the same list', await until(async () => !(await dump()).booking_services.length))

/* ---- phone ---- */
{
  const pc = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })
  const pp = await pc.newPage()
  pp.on('pageerror', (e) => errors.push(e.message))
  await pp.goto(`${BASE}/dashboard/`, { waitUntil: 'load' })
  await pp.fill('input[type=email]', 'info@illuszionzmedia.com')
  await pp.fill('input[type=password]', 'test1234')
  await pp.getByRole('button', { name: 'Sign in' }).click()
  await pp.waitForSelector('.ad-pagehead h1', { timeout: 20000 })
  await pp.evaluate(() => { window.location.hash = '#/prices' })
  await pp.locator('[data-pkg="portrait:portrait-photography"]').getByRole('button', { name: 'Edit' }).click()
  await pp.locator('.ad-modal').waitFor()
  const fit = await pp.evaluate(() => ({ scroll: document.documentElement.scrollWidth - window.innerWidth, modal: document.querySelector('.ad-modal').getBoundingClientRect().right, w: window.innerWidth }))
  ok('phone: the edit form fits the screen', fit.scroll <= 1 && fit.modal <= fit.w + 1, JSON.stringify(fit))
  await pp.screenshot({ path: path.join(SHOTS, 'edit-phone.png') })
  await pc.close()
}

ok('no page errors', errors.length === 0, errors.join(' | '))
await browser.close()
console.log(fails ? `\n${fails} check(s) failed` : '\nAll edit / delete checks passed')
process.exit(fails ? 1 : 0)
