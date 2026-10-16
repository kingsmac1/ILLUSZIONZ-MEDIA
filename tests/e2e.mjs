// Interaction, link, booking-flow and form checks.
// Usage: BASE=http://localhost:3000 node tests/e2e.mjs   (server must run with MAIL_DRY_RUN=1, see .dev.vars)
import { chromium } from 'playwright'

const BASE = process.env.BASE || 'http://localhost:3000'
const PAGES = ['/', '/about-us/', '/photography-services/', '/wedding/', '/videography-services/', '/360-photo-booth/', '/academy/', '/agency/', '/careers/', '/store/', '/contact/', '/form/', '/media/', '/review/']
const results = []
const ok = (name, pass, info = '') => { results.push({ name, pass }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${info ? '  -> ' + info : ''}`) }

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))

/* 1 ─ every page loads with title, description, OG tags; internal links resolve */
const internal = new Set()
for (const p of PAGES) {
  const res = await page.goto(BASE + p, { waitUntil: 'networkidle' })
  const meta = await page.evaluate(() => ({
    title: document.title,
    desc: document.querySelector('meta[name="description"]')?.getAttribute('content') ?? '',
    ogTitle: document.querySelector('meta[property="og:title"]')?.getAttribute('content') ?? '',
    ogImage: document.querySelector('meta[property="og:image"]')?.getAttribute('content') ?? '',
    canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? '',
  }))
  ok(`page ${p} loads + SEO tags`, !!res?.ok() && /Illuszionz Media/.test(meta.title) && meta.desc.length > 70 && meta.desc.length <= 160 && !!meta.ogTitle && /^https:\/\/illuszionzmedia\.com\/og-image\.jpg$/.test(meta.ogImage) && meta.canonical.endsWith(p), `${meta.title} | ${meta.desc.length} chars`)
  for (const h of await page.$$eval('a[href]', (as) => as.map((a) => a.getAttribute('href')))) {
    if (h && h.startsWith('/') && !h.startsWith('/images/')) internal.add(h.split('#')[0].split('?')[0])
  }
}
for (const h of internal) ok(`internal link ${h || '/'} resolves`, h === '' || PAGES.includes(h.endsWith('/') ? h : h + '/'))

/* 2 ─ full-screen menu */
await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await page.getByLabel('Open menu').click(); await page.waitForTimeout(1200)
const box = await page.locator('.fm').boundingBox()
ok('menu opens full screen', !!box && box.width >= 1439 && box.height >= 899)
ok('menu is black', (await page.locator('.fm').evaluate((e) => getComputedStyle(e).backgroundColor)) === 'rgb(0, 0, 0)')
await page.getByRole('button', { name: /Media Services/ }).click(); await page.waitForTimeout(600)
ok('Media Services submenu expands', await page.locator('.fm').getByRole('link', { name: /Wedding Photography/ }).isVisible())
await page.locator('.fm').getByRole('link', { name: /Wedding Photography/ }).click()
await page.waitForURL('**/wedding/', { waitUntil: 'commit' }); await page.waitForTimeout(1500)
ok('menu link navigates + menu closes', page.url().endsWith('/wedding/') && (await page.locator('.fm').count()) === 0, page.url())
await page.getByLabel('Open menu').click(); await page.waitForTimeout(1000)
await page.keyboard.press('Escape'); await page.waitForTimeout(1200)
ok('Escape closes menu', (await page.locator('.fm').count()) === 0)

/* 3 ─ home: service icons link to their pages */
await page.goto(BASE + '/', { waitUntil: 'networkidle' })
const hrefs = await page.$$eval('.svc-link', (a) => a.map((x) => x.getAttribute('href')))
ok('home service icons link to their pages', JSON.stringify(hrefs) === JSON.stringify(['/photography-services/', '/videography-services/', '/agency/', '/academy/', '/store/']), hrefs.join(' '))
const icon = page.locator('.svc-link').first()
await icon.scrollIntoViewIfNeeded(); await icon.hover(); await page.waitForTimeout(500)
ok('home service icon turns black on hover', (await icon.locator('div').first().evaluate((e) => getComputedStyle(e).backgroundColor)) === 'rgb(0, 0, 0)')

/* 4 ─ testimonial slider, hero slideshow, gallery lightbox */
const author = page.locator('section h4').first()
const before = await author.textContent()
await page.getByLabel('Next testimonial').click(); await page.waitForTimeout(900)
ok('testimonial next works', before !== (await author.textContent()))
const slide = () => page.locator('.bg-slideshow__slide.is-active').evaluate((e) => e.style.backgroundImage)
const s1 = await slide(); await page.waitForTimeout(5600)
ok('hero slideshow advances', s1 !== (await slide()))
const first = page.locator('.gallery__cols--d .gallery__item').first()
await first.scrollIntoViewIfNeeded(); await first.click()
ok('lightbox opens', await page.locator('.lightbox').isVisible())
await page.getByRole('button', { name: 'Next', exact: true }).click()
ok('lightbox next', /^2 \//.test((await page.locator('.lightbox__count').textContent()) ?? ''))
await page.keyboard.press('Escape')

/* 5 ─ careers accordion */
await page.goto(BASE + '/careers/', { waitUntil: 'networkidle' })
const active = () => page.locator('.career-item.active').count()
const a0 = await active()
await page.getByRole('button', { name: /Videographers/ }).click(); await page.waitForTimeout(300)
ok('careers accordion toggles', (await active()) === a0 + 1)

/* 6 ─ booking flows: slide-down panel, multi-step form, submit (API in dry-run) */
async function fillStep(fp) {
  for (const el of await fp.$$('.bk-fields input')) {
    const type = await el.getAttribute('type')
    const req = await el.getAttribute('required')
    if (req === null) continue
    await el.fill(type === 'email' ? 'test@example.com' : type === 'tel' ? '+447000000000' : type === 'date' ? '2027-03-20' : type === 'time' ? '14:00' : (await el.getAttribute('id')) === 'bk-age' || (await el.getAttribute('id')) === 'bk-guests' ? '25' : 'Test')
  }
  for (const el of await fp.$$('.bk-fields textarea[required]')) await el.fill('Test message')
  for (const el of await fp.$$('.bk-fields select[required]')) await el.selectOption({ index: 1 })
  for (const grp of await fp.$$('.bk-fields .bk-field')) {
    const req = await grp.$('label i')
    const chips = await grp.$$('.bk-chips button')
    if (req && chips.length && !(await grp.$('.bk-chips button.is-on'))) await chips[0].click()
  }
}
const FLOWS = [
  ['/photography-services/', /Book this shoot/, 'portrait'],
  ['/photography-services/', /Book this event/, 'events'],
  ['/wedding/', /Book Silver/, 'wedding'],
  ['/academy/', /Enrol now/, 'academy'],
  ['/videography-services/', /Get a quote/, 'videography'],
  ['/agency/', /Enquire/, 'agency'],
  ['/store/', /Book this session/, 'store'],
]
for (const [path, cta, id] of FLOWS) {
  const fp = await ctx.newPage()
  await fp.goto(BASE + path, { waitUntil: 'networkidle' })
  await fp.getByRole('button', { name: cta }).first().click()
  await fp.locator('.bk-panel').waitFor({ timeout: 4000 })
  let guard = 0
  while (!(await fp.locator('.bk-done').count()) && guard++ < 8) {
    if (await fp.locator('.bk-agree').count()) {
      await fp.locator('.bk-agree input').check()
      await fp.getByRole('button', { name: /Submit|Request|Continue to payment|Submit & continue/ }).last().click()
      await fp.locator('.bk-done').waitFor({ timeout: 6000 }).catch(() => {})
      break
    }
    // step 1 options: pick the first if none chosen
    if (await fp.locator('.bk-options').count()) {
      if (!(await fp.locator('.bk-option.is-on').count())) await fp.locator('.bk-option-main').first().click()
    }
    await fillStep(fp)
    await fp.getByRole('button', { name: 'Continue' }).click()
    await fp.waitForTimeout(450)
  }
  ok(`booking flow "${id}" on ${path} completes`, (await fp.locator('.bk-done').count()) === 1, id)
  await fp.close()
}
// 360 booth
{
  const fp = await ctx.newPage()
  await fp.goto(BASE + '/360-photo-booth/', { waitUntil: 'networkidle' })
  await fp.getByRole('button', { name: 'Book the 360 Booth' }).click()
  await fp.locator('.bk-panel').waitFor({ timeout: 4000 })
  await fp.locator('.bk-option-main').first().click()
  let guard = 0
  while (!(await fp.locator('.bk-done').count()) && guard++ < 8) {
    if (await fp.locator('.bk-agree').count()) { await fp.locator('.bk-agree input').check(); await fp.getByRole('button', { name: /Request availability/ }).click(); await fp.locator('.bk-done').waitFor({ timeout: 6000 }).catch(() => {}); break }
    await fillStep(fp); await fp.getByRole('button', { name: 'Continue' }).click(); await fp.waitForTimeout(450)
  }
  ok('booking flow "booth" on /360-photo-booth/ completes', (await fp.locator('.bk-done').count()) === 1)
  await fp.close()
}

/* 7 ─ booking API: pricing is recomputed on the server, bad input rejected */
const post = (body) => ctx.request.post(BASE + '/api/booking', { data: body })
let r = await post({ flowId: 'portrait', optionIds: ['portrait-2'], units: {}, extras: { 'extra-images': 3, 'express-24': 1 }, fields: { name: 'A B', phone: '+447000000000', email: 'a@b.co', date: '2027-01-01', time: '10:00', setting: 'Studio' } })
let j = await r.json()
ok('API prices portrait 2 looks + extras at £410', j.ok && j.total === '£410', j.total)
ok('owner email goes to info@illuszionzmedia.com copy + customer email rendered', j.emails?.owner?.subject.includes('A B') && /Booking request received/.test(j.emails?.customer?.subject ?? ''))
r = await post({ flowId: 'portrait', optionIds: ['portrait-2'], fields: { name: 'A' } })
ok('API rejects an incomplete booking', r.status() === 422)
r = await post({ flowId: 'nope', optionIds: [], fields: {} })
ok('API rejects an unknown service', r.status() === 400)

/* 8 ─ generic forms (contact, service enquiry with conditional field, review) */
for (const path of ['/contact/', '/form/', '/review/']) {
  const fp = await ctx.newPage()
  await fp.goto(BASE + path, { waitUntil: 'networkidle' })
  for (let pass = 0; pass < 2; pass++) {
    for (const el of await fp.$$('form input[required]')) {
      const type = await el.getAttribute('type')
      if (type === 'checkbox' || type === 'radio') { await el.check({ force: true }); continue }
      if (type === 'file') continue
      await el.fill(type === 'email' ? 'test@example.com' : type === 'tel' ? '+447000000000' : 'Test')
    }
    for (const el of await fp.$$('form select[required]')) {
      const v = await el.evaluate((s) => [...s.options].find((o) => o.value)?.value)
      if (v) await el.selectOption({ value: v })
    }
    for (const el of await fp.$$('form textarea[required]')) await el.fill('Test message')
    await fp.waitForTimeout(250)
  }
  await fp.locator('form button[type="submit"]').first().click()
  ok(`form ${path} submits and shows confirmation`, await fp.locator('.form-confirmation').waitFor({ timeout: 6000 }).then(() => true, () => false))
  await fp.close()
}
await page.goto(BASE + '/form/', { waitUntil: 'networkidle' })
ok('conditional field hidden initially', (await page.locator('[data-field="wpforms-751-field_13-container"]').count()) === 0)
await page.locator('.choices-root').first().click()
await page.locator('.choices-dropdown').getByText('Videography', { exact: true }).click()
ok('conditional field shown after choosing Videography', (await page.locator('[data-field="wpforms-751-field_13-container"]').count()) === 1)

ok('no uncaught page errors', errors.length === 0, errors.join(' | ').slice(0, 200))
await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length ? 1 : 0)
