// One look with a looks counter (price × looks, multi-look discount taken off on the invoice), several shoots in one booking, add-ons when adding a
// package, and the dashboard's forms on a phone. Against the fake Supabase + Cloudflare runtime, in a fresh browser.
// Run: same servers as tests/packages-e2e.mjs, then  node tests/looks-multi-e2e.mjs
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.BASE || 'http://localhost:4173'
const SB = process.env.SB || 'http://127.0.0.1:54321'
const SHOTS = process.env.SHOTS || '/tmp/looks-shots'
fs.mkdirSync(SHOTS, { recursive: true })
let fails = 0
const ok = (name, pass, info = '') => { if (!pass) fails++; console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${info ? '  -> ' + info : ''}`) }
const dump = async () => (await fetch(SB + '/__dump')).json()
const post = (body) => fetch(BASE + '/api/booking', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json())
const until = async (fn, ms = 8000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await fn()) return true; await new Promise((r) => setTimeout(r, 120)) } return false }
const fields = { name: 'Test Client', phone: '+447700900123', email: 'multi@example.com', date: '2026-12-20', time: '14:00', setting: 'Studio' }
await fetch(SB + '/__reset')

const browser = await chromium.launch()
const errors = []
const fresh = async (viewport = { width: 1440, height: 900 }) => {
  const ctx = await browser.newContext({ viewport, hasTouch: viewport.width < 500 })
  await ctx.addInitScript(() => { try { localStorage.setItem('ilz_cookie_consent', 'essential') } catch {} })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(e.message))
  return { ctx, page }
}

/* ============================== one look with a counter ============================== */
{
  const { ctx, page } = await fresh()
  await page.goto(`${BASE}/photography-services`, { waitUntil: 'load' })
  const portrait = page.locator('.sc-card', { has: page.locator('h3:text-is("Portrait Photography")') })
  await portrait.waitFor({ timeout: 20000 })
  const pt = await portrait.innerText()
  ok('the Portrait card offers 1 Look and no longer 2 Looks', /1 Look[\s\S]*£170/.test(pt) && !/2 Looks/.test(pt))
  ok('…and says more looks are chosen when booking, with a discount on the invoice', /More looks\?/.test(pt) && /Discount applies to multiple looks, taken off on your invoice/.test(pt))
  ok('Prewedding no longer lists 2 and 3 Looks', !/[23] Looks/.test(await page.locator('.sc-card', { hasText: 'Prewedding' }).innerText()))
  await portrait.locator('button:has-text("1 Look")').click()
  const panel = page.locator('.bk-slot-inner')
  await panel.waitFor()
  const look = panel.locator('.bk-option.is-on').first()
  ok('the form opens on 1 Look with a “How many looks?” counter', /How many looks\?/.test(await look.innerText()) && /Discount applies to multiple looks, taken off on your invoice/.test(await look.innerText()))
  ok('the price shows as £170, not per look', /£170/.test(await look.locator('.bk-price').innerText()) && !/\/look/.test(await look.locator('.bk-price').innerText()))
  await look.getByRole('button', { name: 'Increase looks' }).click()
  await look.getByRole('button', { name: 'Increase looks' }).click()
  ok('3 looks: the price becomes 3 × £170 = £510, with the discount note', /3 looks × £170 = £510/.test(await look.innerText()) && /£510/.test(await look.locator('.bk-price').innerText()) && /Discount applies to multiple looks/.test(await look.innerText()))
  ok('the total is £510', (await panel.locator('.bk-foot-total').innerText()).trim() === '£510')

  /* ---- several shoots in one booking ---- */
  const also = panel.locator('[data-also]')
  ok('“Add another shoot to this booking” is offered', await also.isVisible())
  const chips = await also.locator('.bk-also-chip').allInnerTexts()
  ok('…with the other photo shoots on the page (not Events)', ['Maternity Photography', 'Baby Shoot', 'Family Photo Sessions'].every((t) => chips.some((c) => c.includes(t))) && !chips.some((c) => /Events/.test(c)) && !chips.some((c) => /Portrait/.test(c)), chips.join(' | '))
  await also.getByRole('button', { name: '+ Maternity Photography' }).click()
  const mat = also.locator('[data-also-shoot="maternity"]')
  ok('adding Maternity shows its packages', /1 Look/.test(await mat.innerText()) && /Couple · 1 Look/.test(await mat.innerText()))
  await panel.getByRole('button', { name: 'Continue' }).click()
  ok('it asks for a Maternity package before going on', /Please choose a package for Maternity Photography/.test(await panel.innerText()))
  await mat.locator('button.bk-option-main:has-text("Couple · 1 Look")').click()
  ok('the total adds the two shoots: 3 × £170 + £200', (await panel.locator('.bk-foot-total').innerText()).trim() === '£710')
  await panel.screenshot({ path: path.join(SHOTS, 'two-shoots.png') })
  await panel.getByRole('button', { name: 'Continue' }).click()

  // About you, then Your session (with Maternity's own question), then add-ons, then review
  for (let n = 0; n < 6; n++) {
    if (await panel.locator('.bk-review').count()) break
    for (const el of await panel.locator('.bk-field input').all()) {
      const type = await el.getAttribute('type')
      if (type === 'file' || !(await el.isVisible())) continue
      if (await el.inputValue()) continue
      const id = (await el.getAttribute('id')) ?? ''
      await el.fill(type === 'email' ? fields.email : type === 'tel' ? fields.phone : type === 'date' ? fields.date : type === 'time' ? fields.time : /weeks/.test(id) ? '30' : 'Test Client')
    }
    for (const grp of await panel.locator('.bk-chips').all()) if (!(await grp.locator('button[aria-pressed="true"], button[aria-checked="true"]').count())) await grp.locator('button').first().click()
    for (const el of await panel.locator('.bk-field select').all()) { const v = await el.evaluate((s) => [...s.options].find((o) => o.value)?.value); if (v) await el.selectOption(v) }
    if (await panel.locator('#bk-weeks').count()) ok('the session step asks Maternity’s “Weeks pregnant” too', true)
    await panel.getByRole('button', { name: 'Continue' }).click()
    await page.waitForTimeout(400)
  }
  const review = await panel.innerText() // the review step and the price summary beside it
  ok('the review lists both shoots and the extra looks', /Portrait Photography: 1 Look/.test(review) && /Maternity Photography: Couple · 1 Look/.test(review) && /1 Look × 3 looks/.test(review) && /Multi-look discount/.test(review) && /On your invoice/.test(review), review.replace(/\s+/g, ' ').slice(0, 300))
  await panel.locator('input[type=checkbox]').last().check()
  const [req] = await Promise.all([
    page.waitForRequest((r) => r.url().endsWith('/api/booking') && r.method() === 'POST'),
    panel.locator('button[type=submit]').click(),
  ])
  const body = req.postDataJSON()
  ok('the booking sends both shoots', JSON.stringify(body.also) === '["maternity"]' && body.optionIds.join() === 'portrait-1,maternity-couple' && body.units['portrait-1'] === 3)
  await panel.locator('.bk-done').waitFor({ timeout: 15000 })
  ok('it is accepted, with the total for both shoots', /£710/.test(await panel.locator('.bk-done').innerText()))
  const wa = decodeURIComponent((await panel.getByRole('link', { name: /Continue on WhatsApp/ }).getAttribute('href')) ?? '')
  ok('the WhatsApp message lists both shoots, the looks and the discount note', /Packages: Portrait Photography: 1 Look, Maternity Photography: Couple · 1 Look/.test(wa) && /1 Look × 3 looks — £510/.test(wa) && /Multi-look discount — On your invoice/.test(wa) && /Weeks pregnant: 30/.test(wa), wa.slice(0, 400))
  const saved = (await dump()).bookings.find((b) => b.email === fields.email)
  ok('saved as one booking of both shoots, priced £710', !!saved && Number(saved.total) === 710 && /Portrait.*Maternity/i.test(saved.kind) && /Couple · 1 Look/.test(saved.packages), `${saved?.kind} · ${saved?.packages} · ${saved?.total}`)
  await ctx.close()
}

/* ============================== the server checks combined bookings ============================== */
{
  const one = await post({ flowId: 'baby', optionIds: ['baby-1'], units: { 'baby-1': 4 }, extras: {}, fields: { ...fields, email: 'baby@example.com' } })
  ok('a single shoot with 4 looks is priced 4 × £150 (£600)', one.ok && one.total === '£600', one.total)
  const r1 = await post({ flowId: 'portrait', also: ['events'], optionIds: ['portrait-1', 'events-hourly'], units: {}, extras: {}, fields })
  ok('Events cannot be added to a portrait booking', !r1.ok && /cannot be booked together/.test(r1.error ?? ''))
  const r2 = await post({ flowId: 'portrait', also: ['maternity'], optionIds: ['portrait-1'], units: {}, extras: {}, fields })
  ok('an added shoot without a package is refused', !r2.ok && /Choose a Maternity Photography package/.test(r2.error ?? ''))
  const r3 = await post({ flowId: 'portrait', also: [], optionIds: ['portrait-1', 'maternity-1'], units: {}, extras: {}, fields })
  ok('a package from a shoot that was not added is refused', !r3.ok)
  const r4 = await post({ flowId: 'portrait', also: ['maternity', 'baby'], optionIds: ['portrait-1', 'maternity-1', 'baby-1'], units: {}, extras: { 'express-24': 1 }, fields: { ...fields, email: 'three@example.com', weeks: '28', age: '6 months' } })
  ok('three shoots in one booking: £170 + £170 + £150 + express £50', r4.ok && r4.total === '£540', r4.total)
}

/* ============================== add-ons when adding a package ============================== */
{
  const { ctx, page } = await fresh()
  page.on('dialog', (d) => d.accept())
  await page.goto(`${BASE}/dashboard/`, { waitUntil: 'load' })
  await page.fill('input[type=email]', 'info@illuszionzmedia.com')
  await page.fill('input[type=password]', 'test1234')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForSelector('.ad-pagehead h1', { timeout: 20000 })
  await page.evaluate(() => { window.location.hash = '#/prices' })
  await page.waitForSelector('.ad-pagehead h1:text-is("Prices")')
  const modal = page.locator('.ad-modal').first()
  const mfield = (label) => modal.locator(`label.ad-field:has(> span:text-is("${label}"))`).locator('input, textarea, select').first()

  await page.getByRole('button', { name: '+ Add package' }).click()
  await mfield('Page').selectOption('photography')
  const addons = modal.locator('[data-package-addons]')
  ok('a new Photography services package has an Add-ons section', await addons.isVisible() && /Offer the usual photo add-ons too/.test(await addons.innerText()) && /Extra edited pictures/.test(await addons.innerText()))
  ok('…and a most-looks setting, explaining the multi-look discount', /discount on multiple looks is taken off on the invoice/.test(await modal.innerText()) && (await mfield('Most looks a client can choose').inputValue()) === '5')
  await mfield('Package name').fill('Graduate Photography')
  await modal.locator('[data-price-line] input').nth(0).fill('1 Look')
  await modal.locator('[data-price-line] input').nth(1).fill('4 edited pictures')
  await modal.locator('[data-price-line] input').nth(2).fill('150')
  await mfield('Most looks a client can choose').fill('4')
  await addons.getByRole('button', { name: '+ Add an add-on' }).click()
  const a1 = modal.locator('[data-addon-line]').nth(0).locator('input')
  await a1.nth(0).fill('Gown hire')
  await a1.nth(1).fill('per gown')
  await a1.nth(2).fill('30')
  await a1.nth(3).fill('1')
  // a cover photo is required on this page: paste one from the site
  await modal.locator('[data-package-photo] button').first().click()
  const picker = page.locator('.ad-modal.wide')
  await picker.locator('input[aria-label="Photo link"]').fill('/images/ILU6448.webp')
  await picker.getByRole('button', { name: 'Preview' }).click()
  await picker.getByRole('button', { name: 'Use this photo' }).click()
  await picker.waitFor({ state: 'detached' })
  await modal.getByRole('button', { name: 'Add package' }).click()
  ok('an add-on’s “most” of 1 is refused (2 or more, or empty for a tick box)', /Add-on 1: the most a client can choose/.test(await modal.innerText()))
  await a1.nth(3).fill('3')
  await modal.screenshot({ path: path.join(SHOTS, 'package-with-addons.png') })
  await modal.getByRole('button', { name: 'Add package' }).click()
  await page.locator('.ad-modal').waitFor({ state: 'detached' })
  const grad = (await dump()).booking_services.find((s) => s.title === 'Graduate Photography')
  ok('the package is saved with its add-on and looks setting', grad?.max_looks === 4 && grad.standard_extras === true && grad.extras?.[0]?.label === 'Gown hire' && grad.extras[0].max === 3 && grad.extras[0].price === 30)
  const g = await post({ flowId: `svc-${grad.id}`, optionIds: [`svc-${grad.id}-1`], units: { [`svc-${grad.id}-1`]: 2 }, extras: { [`svc-${grad.id}-x1`]: 2, 'express-24': 1 }, fields: { ...fields, email: 'grad@example.com' } })
  ok('its booking: 2 looks × £150 + 2 gowns £60 + express £50', g.ok && g.total === '£410', g.total)
  {
    const { ctx: c2, page: gp } = await fresh()
    await gp.goto(`${BASE}/photography-services`, { waitUntil: 'load' })
    const gcard = gp.locator('.sc-card', { has: gp.locator('h3:text-is("Graduate Photography")') })
    await gcard.waitFor({ timeout: 15000 })
    ok('its card says more looks can be chosen', /More looks\?/.test(await gcard.innerText()))
    await gcard.locator('button:has-text("1 Look")').click()
    const gpanel = gp.locator('.bk-slot-inner')
    await gpanel.waitFor()
    ok('its booking form has the looks counter (up to 4)', /How many looks\?/.test(await gpanel.innerText()))
    ok('Graduate Photography can be combined with the other shoots', (await gpanel.locator('.bk-also-chip', { hasText: 'Portrait Photography' }).count()) === 1)
    await c2.close()
  }

  await page.getByRole('button', { name: '+ Add package' }).click()
  await mfield('Page').selectOption('wedding')
  ok('on Wedding it lists the add-ons the Wedding form already has', /Already offered: Extra photographer, Extra hours/.test(await modal.locator('[data-package-addons]').innerText()))
  await mfield('Package name').fill('Platinum Package')
  await mfield('Price (£)').fill('1800')
  await modal.locator('[data-package-addons]').getByRole('button', { name: '+ Add an add-on' }).click()
  const w1 = modal.locator('[data-addon-line]').nth(0).locator('input')
  await w1.nth(0).fill('Drone footage')
  await w1.nth(2).fill('250')
  await modal.getByRole('button', { name: 'Add package' }).click()
  await page.locator('.ad-modal').waitFor({ state: 'detached' })
  const db = await dump()
  ok('the Wedding package and its add-on are saved (the add-on on the Wedding form)', db.booking_packages.some((p) => p.label === 'Platinum Package' && p.kind === 'option') && db.booking_packages.some((p) => p.label === 'Drone footage' && p.kind === 'extra' && p.flow_id === 'wedding' && Number(p.price) === 250))

  await page.locator('.ad-card', { has: page.locator('h3:has-text("Portrait Photography")') }).getByRole('button', { name: 'Add a price option or add-on to Portrait Photography' }).click()
  ok('a new Portrait price option starts as one look with a looks counter', (await mfield('Price is').inputValue()) === 'looks')
  await page.locator('.ad-modal').getByRole('button', { name: 'Cancel' }).click()
  await ctx.close()
}

/* ============================== dashboard forms on a phone ============================== */
{
  const { ctx, page } = await fresh({ width: 390, height: 844 })
  await page.goto(`${BASE}/dashboard/`, { waitUntil: 'load' })
  await page.fill('input[type=email]', 'info@illuszionzmedia.com')
  await page.fill('input[type=password]', 'test1234')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForSelector('.ad-pagehead h1', { timeout: 20000 })
  await page.evaluate(() => { window.location.hash = '#/prices' })
  await page.getByRole('button', { name: '+ Add package' }).click()
  await page.locator('.ad-modal select').first().selectOption('wedding')
  await page.locator('.ad-modal [data-package-addons]').getByRole('button', { name: '+ Add an add-on' }).click()
  await page.waitForTimeout(300)
  const check = async () => page.evaluate(() => {
    const m = document.querySelector('.ad-modal').getBoundingClientRect()
    const foot = document.querySelector('.ad-modal .ad-formfoot')
    const f = foot.getBoundingClientRect()
    const hit = document.elementFromPoint(f.left + f.width / 2, f.top + f.height / 2)
    return { modalBottom: Math.round(m.bottom), footBottom: Math.round(f.bottom), footTop: Math.round(f.top), vh: window.innerHeight, bg: getComputedStyle(foot).backgroundColor, inFoot: !!hit && foot.contains(hit), scroll: document.documentElement.scrollWidth - window.innerWidth }
  })
  let c = await check()
  ok('phone: the buttons sit in a solid bar at the bottom of the screen', c.footBottom <= c.vh + 1 && c.footBottom >= c.vh - 2 && c.bg !== 'rgba(0, 0, 0, 0)' && c.inFoot, JSON.stringify(c))
  await page.screenshot({ path: path.join(SHOTS, 'phone-form-top.png') })
  await page.locator('.ad-overlay').evaluate((o) => o.scrollTo(0, o.scrollHeight))
  await page.waitForTimeout(300)
  c = await check()
  ok('phone: scrolled to the end, the form ends inside the white sheet (nothing spills onto the page behind)', c.modalBottom >= c.footBottom && c.footBottom <= c.vh + 1 && c.inFoot && c.scroll <= 1, JSON.stringify(c))
  await page.screenshot({ path: path.join(SHOTS, 'phone-form-bottom.png') })
  ok('phone: the title bar stays at the top', await page.evaluate(() => Math.round(document.querySelector('.ad-modal header').getBoundingClientRect().top)) === 0)
  await ctx.close()
}

ok('no page errors', errors.length === 0, errors.join(' | '))
await browser.close()
console.log(fails ? `\n${fails} check(s) failed` : '\nAll looks / multi-shoot checks passed')
process.exit(fails ? 1 : 0)
