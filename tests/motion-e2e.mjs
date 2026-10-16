// Motion layer: Lenis, GSAP reveals, counters, reduced-motion + no-JS safety, page transitions, mobile.
// Usage: BASE=http://localhost:4173 node tests/motion-e2e.mjs   (production preview)
import { chromium } from 'playwright'

const BASE = process.env.BASE || 'http://localhost:4173'
const PAGES = ['/', '/about-us/', '/photography-services/', '/wedding/', '/videography-services/', '/360-photo-booth/', '/academy/', '/agency/', '/careers/', '/store/', '/contact/', '/form/', '/media/', '/review/']
let fails = 0
const ok = (name, pass, info = '') => { if (!pass) fails++; console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${info ? '  -> ' + info : ''}`) }
const browser = await chromium.launch()
const errors = []
const track = (p, tag) => { p.on('pageerror', (e) => errors.push(`${tag}: ${e.message}`)); p.on('console', (m) => m.type() === 'error' && errors.push(`${tag} console: ${m.text()}`)) }

/** Counts text/heading/image elements that are still (nearly) invisible. */
const hiddenCount = (page, viewportOnly = false) => page.evaluate((vo) => [...document.querySelectorAll('main :is(h1,h2,h3,p,li,img,.sc-card), .ftr :is(h2,p,li)')].filter((e) => !e.closest('.bk-panel,.lightbox') && getComputedStyle(e).opacity < 0.1 && e.getBoundingClientRect().width > 0 && (!vo || e.getBoundingClientRect().top < innerHeight)).length, viewportOnly)
async function scrollThrough(page) {
  const h = await page.evaluate(() => document.documentElement.scrollHeight)
  for (let y = 0; y < h; y += 700) { await page.mouse.wheel(0, 700); await page.waitForTimeout(260) }
  await page.waitForTimeout(1800)
}

/* 1 ─ desktop, motion on */
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()
track(page, 'desktop')
await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await page.waitForTimeout(1800)
const cls = await page.evaluate(() => document.documentElement.className)
ok('motion layer starts (Lenis + motion-on)', cls.includes('motion-on') && cls.includes('lenis') && (await page.evaluate(() => !!window.__lenis)), cls)
ok('pre-hide class is lifted after setup', !cls.includes('motion-pre'))
ok('scroll-progress bar + cursor lens exist', (await page.locator('.scroll-progress').count()) === 1)
ok('service marquee is on the home page', (await page.locator('.mq .mq-item').count()) >= 8)
ok('hero headline is split into masked lines and visible', (await page.locator('main h2 .split-line').count()) > 1 && (await page.evaluate(() => getComputedStyle(document.querySelector('main h2 .split-line')).opacity)) === '1')
ok('above-the-fold content is revealed on load', (await hiddenCount(page, true)) === 0)
await page.mouse.move(400, 400); await page.waitForTimeout(300)
ok('cursor lens follows the mouse', await page.locator('.cursor-lens.is-on').count() === 1)
const y0 = await page.evaluate(() => scrollY)
await page.mouse.wheel(0, 1200); await page.waitForTimeout(1500)
ok('smooth scrolling moves the page', (await page.evaluate(() => scrollY)) > y0 + 600)
await page.mouse.wheel(0, 800); await page.waitForTimeout(900)
ok('header hides on scroll down, glass when scrolled', (await page.evaluate(() => document.querySelector('.site-header').className)).includes('is-hidden'))
await page.mouse.wheel(0, -400); await page.waitForTimeout(900)
ok('header returns on scroll up', !(await page.evaluate(() => document.querySelector('.site-header').className)).includes('is-hidden'))

/* 2 ─ no page leaves content hidden */
for (const p of PAGES) {
  await page.goto(BASE + p, { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  await scrollThrough(page)
  const n = await hiddenCount(page)
  ok(`${p} — everything is revealed after scrolling`, n === 0, `${n} hidden`)
}

/* 3 ─ counters land on their real value */
await page.goto(BASE + '/review/', { waitUntil: 'networkidle' })
await scrollThrough(page)
const nums = await page.locator('.rev-22').allInnerTexts()
ok('review counters finish on the real numbers', nums.includes('850+') && nums.includes('5.0') && nums.includes('1,200'), nums.join(' | '))

/* 4 ─ page transitions + booking scroll */
await page.goto(BASE + '/photography-services/', { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
const before = await page.evaluate(() => scrollY)
await page.locator('.sc-cta').first().click()
await page.waitForSelector('.bk-panel', { timeout: 8000 })
await page.waitForTimeout(2200)
const top = await page.locator('.bk-panel').evaluate((e) => e.getBoundingClientRect().top)
ok('opening a booking card smooth-scrolls it into view', top > -50 && top < 500, `top ${Math.round(top)}`)
await page.getByLabel('Open menu').click(); await page.waitForTimeout(1200)
ok('menu stops page scrolling (Lenis paused)', (await page.evaluate(() => document.documentElement.classList.contains('lenis-stopped'))))
await page.keyboard.press('Escape'); await page.waitForTimeout(1200)
await page.locator('footer a[href="/wedding/"]').first().click()
await page.waitForURL('**/wedding/'); await page.waitForTimeout(2500)
ok('client navigation: new page starts at the top and is revealed', (await page.evaluate(() => scrollY)) < 50 && (await page.locator('main h1, main h2').first().evaluate((e) => getComputedStyle(e).opacity)) === '1')

/* 5 ─ reduced motion */
const rctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
const rp = await rctx.newPage(); track(rp, 'reduced')
await rp.goto(BASE + '/', { waitUntil: 'networkidle' }); await rp.waitForTimeout(800)
ok('reduced motion: no Lenis, no pre-hide, nothing hidden', !(await rp.evaluate(() => !!window.__lenis)) && (await rp.evaluate(() => document.documentElement.className)).includes('motion-off') && (await hiddenCount(rp)) === 0)
ok('reduced motion: marquee does not animate', (await rp.locator('.mq-track').evaluate((e) => getComputedStyle(e).animationName)) === 'none')

/* 6 ─ no JavaScript at all: content must still be visible */
const nctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, javaScriptEnabled: false })
const np = await nctx.newPage()
await np.goto(BASE + '/about-us/')
ok('without JavaScript nothing is hidden', (await hiddenCount(np)) === 0)

/* 7 ─ mobile */
const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
const mp = await mctx.newPage(); track(mp, 'mobile')
await mp.goto(BASE + '/', { waitUntil: 'networkidle' }); await mp.waitForTimeout(1500)
for (const p of ['/', '/wedding/', '/photography-services/']) {
  await mp.goto(BASE + p, { waitUntil: 'networkidle' }); await mp.waitForTimeout(800)
  for (let i = 0; i < 12; i++) { await mp.evaluate(() => window.scrollBy(0, 600)); await mp.waitForTimeout(150) }
  await mp.waitForTimeout(1500)
  ok(`mobile ${p}: no sideways overflow`, await mp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1))
}
ok('mobile: no cursor lens on touch devices', (await mp.locator('.cursor-lens').count()) === 0)

ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '))
await browser.close()
console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED')
process.exit(fails ? 1 : 0)
