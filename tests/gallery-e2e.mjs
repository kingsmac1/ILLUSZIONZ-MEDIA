// Client gallery + client area + Gallery Manager, in a real browser with Supabase and R2 mocked (no live project needed).
// Checks the in-browser watermark/upload pipeline (the uploaded JPEGs are saved for inspection), the client proofing flow
// (hearts, notes, limit, submit, WhatsApp hand-off), opening a gallery from the emailed private link with no sign-in and
// the save-to-account prompt, finals downloads, password sign in / sign up / reset, the account area and the dashboard
// screens, at 375 px and at desktop width.
//   npm run dev &          (any VITE_SUPABASE_URL works — every request to it is intercepted)
//   BASE=http://localhost:3000 SHOTS=/tmp/gallery-shots node tests/gallery-e2e.mjs
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const BASE = process.env.BASE || 'http://localhost:3000'
const SHOTS = process.env.SHOTS || '/tmp/gallery-shots'
fs.mkdirSync(SHOTS, { recursive: true })
let fails = 0
const ok = (name, pass, info = '') => { if (!pass) fails++; console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${info ? '  -> ' + info : ''}`) }

const SAMPLES = ['ILZ_8904.jpg', 'ILZ_8923.jpg', 'ILU0061.webp', 'ILU3655.webp', 'ILU6304-copy.webp', 'ILZ_8962.jpg', 'ILU4972.webp', 'ILU6433.webp', 'ILZ_8966.jpg', 'ILU6217.webp', 'ILZ_8996.jpg', 'ILU7003-copy.webp']
const dims = Object.fromEntries(await Promise.all(SAMPLES.map(async (f) => { const m = await sharp(`public/images/${f}`).metadata(); return [f, [m.width, m.height]] })))
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const PROOF = uuid(1), FINAL = uuid(2), LOCKED = uuid(3), BOOKING = uuid(9)
const img = (f, i, kind) => ({ id: uuid(100 + i), filename: f.replace(/\.\w+$/, '.jpg').replace('ILU', 'DSC_').replace('-copy', ''), width: dims[f][0], height: dims[f][1], sort_order: i, taken_at: null, source_proof_image_id: null, status: 'ready', bytes: 9_000_000, has_original: kind === 'final', thumb: `${BASE}/images/${f}`, display: `${BASE}/images/${f}` })
const images = (kind) => SAMPLES.map((f, i) => img(f, i, kind))
const gallery = (id, kind, extra = {}) => ({ id, title: kind === 'proof' ? 'Maternity — 20 Nov 2026' : 'Maternity — Final photos', kind, client_first_name: 'Elena', client_name: 'Elena Test', event_date: '2026-11-20', shoot: 'Maternity', status: kind === 'proof' ? 'selecting' : 'delivered', selection_limit: kind === 'proof' ? 4 : null, allow_extra_selections: false, extra_price_note: null, message_to_client: kind === 'proof' ? 'It was a joy photographing you both. Pick your four favourites and we will edit them with care.' : null, cover_image_id: uuid(102), previews_purge_at: null, ...extra })
const KEY = 'a'.repeat(64)
const picksSent = []
const view = (body, signedIn) => {
  if (body.gallery_id === LOCKED || (!signedIn && body.key !== KEY)) return { ok: true, access: 'signin', gallery: gallery(LOCKED, 'proof'), cover: { url: `${BASE}/images/ILU0061.webp`, width: 1600, height: 2000 }, email_hint: 'e•••••@example.com' }
  const kind = body.gallery_id === FINAL ? 'final' : 'proof'
  if (body.cover_only) return { ok: true, access: 'full', gallery: gallery(body.gallery_id, kind), cover: { url: `${BASE}/images/${kind === 'proof' ? 'ILU0061.webp' : 'ILU6433.webp'}` }, total: 12 }
  return { ok: true, access: 'full', client_email: 'elena@example.com', signed_in_as: signedIn ? 'elena@example.com' : null, is_owner: signedIn, gallery: gallery(body.gallery_id, kind), cover: null, images: images(kind), total: 12, page: 0, pages: 1, selections: kind === 'proof' ? [{ image_id: uuid(101), note: null, created_at: '' }] : undefined, related: kind === 'proof' ? [] : [{ id: PROOF, kind: 'proof', status: 'submitted', key: KEY }] }
}

const uploads = []
async function mockSupabase(page, { admin = false } = {}) {
  await page.route(/supabase\.co\//, async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const body = req.postDataJSON?.() ?? {}
    const json = (d, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(d), headers: { 'access-control-allow-origin': '*' } })
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } })
    const p = url.pathname
    const signedIn = /^Bearer test\./.test(req.headers()['authorization'] ?? '')
    if (p.endsWith('/functions/v1/gallery-view-urls')) return json(view(body, signedIn))
    if (p.endsWith('/functions/v1/gallery-pick')) { picksSent.push(body); return json({ ok: true, count: 1 }) }
    // password accounts
    if (p.endsWith('/auth/v1/signup')) return json({ id: uuid(78), email: body.email, aud: 'authenticated', role: '', identities: [{ id: uuid(78) }], user_metadata: body.data ?? {}, app_metadata: {}, created_at: '2026-01-01T00:00:00Z', confirmation_sent_at: new Date().toISOString() })
    if (p.endsWith('/auth/v1/recover')) return json({})
    if (p.endsWith('/auth/v1/verify')) return json(JSON.parse(fakeSession('elena@example.com')))
    if (p.endsWith('/auth/v1/user')) return json(JSON.parse(fakeSession('elena@example.com')).user)
    if (p.endsWith('/auth/v1/token')) return json({ error: 'invalid_grant', error_description: 'Invalid login credentials' }, 400)
    if (p.endsWith('/functions/v1/gallery-submit-selection')) return json({ ok: true, count: 3, submitted_at: new Date().toISOString(), whatsapp_text: 'Hi Illuszionz Media 👋 test' })
    if (p.endsWith('/functions/v1/gallery-download-url')) return json({ ok: true, files: (body.image_ids ?? [body.image_id]).map((id) => ({ id, filename: 'DSC_0001.jpg', bytes: 1000, url: `${BASE}/images/ILZ_8904.jpg` })) })
    if (p.endsWith('/functions/v1/gallery-upload-urls')) return json({ ok: true, items: body.files.map((f, i) => ({ client_ref: f.client_ref, image_id: uuid(500 + uploads.length + i), urls: Object.fromEntries(f.variants.map((v) => [v, `${BASE}/__r2/${encodeURIComponent(f.original_filename)}/${v}.jpg`])) })) })
    if (p.endsWith('/functions/v1/gallery-confirm-uploads')) return json({ ok: true, ready: body.done ?? [], failed: [] })
    if (p.endsWith('/functions/v1/gallery-send')) return json({ ok: true, status: 'sent', emailed: true })
    if (p.includes('/rest/v1/rpc/is_admin')) return json(admin)
    if (p.includes('/rest/v1/rpc/my_bookings')) return json([{ id: BOOKING, ref: '1F649C', name: 'Elena Test', kind: 'Maternity booking', flow_id: 'maternity', packages: 'Couple · 1 Look', event_date: '2026-12-20', event_time: '14:00', status: 'confirmed', total: 200, total_text: '£200', amount_paid: 100, payment_status: 'Deposit Paid', created_at: '2026-10-01T10:00:00Z' }])
    if (p.includes('/rest/v1/rpc/gallery_stats')) return json([{ gallery_id: PROOF, images_ready: 12, images_failed: 0, bytes: 41_000_000, picks: 3, notes: 1, last_activity: new Date().toISOString() }, { gallery_id: FINAL, images_ready: 3, images_failed: 0, bytes: 61_000_000, picks: 0, notes: 0, last_activity: new Date().toISOString() }])
    if (p.includes('/rest/v1/rpc/')) return json(null)
    const table = p.split('/rest/v1/')[1]
    const galleriesRows = [
      { id: PROOF, created_at: '2026-10-20T10:00:00Z', updated_at: new Date().toISOString(), booking_id: BOOKING, client_email: 'elena@example.com', client_name: 'Elena Test', title: 'Maternity — 20 Nov 2026', kind: 'proof', status: 'selecting', share_token: KEY, selection_limit: 4, allow_extra_selections: false, cover_image_id: null, sent_at: '2026-10-21T10:00:00Z', first_viewed_at: '2026-10-21T12:00:00Z' },
      { id: FINAL, created_at: '2026-10-25T10:00:00Z', updated_at: new Date().toISOString(), booking_id: BOOKING, client_email: 'elena@example.com', client_name: 'Elena Test', title: 'Maternity — Final photos', kind: 'final', status: 'delivered', share_token: KEY, delivered_at: '2026-10-28T10:00:00Z' },
    ]
    if (req.method() !== 'GET') return json(table === 'galleries' ? [galleriesRows[0]] : [], req.method() === 'POST' ? 201 : 200)
    if (table === 'profiles') return json({ id: uuid(77), email: 'elena@example.com', full_name: 'Elena Test', phone: '', role: 'client' })
    if (table === 'galleries') return json(galleriesRows)
    if (table === 'activity_log') return json([
      { id: uuid(901), client_email: 'elena@example.com', actor: 'admin', event: 'finals_delivered', meta: { count: 3, title: 'Maternity — Final photos' }, created_at: '2026-10-28T10:00:00Z' },
      { id: uuid(902), client_email: 'elena@example.com', actor: 'client', event: 'selection_submitted', meta: { count: 3, notes: 1, title: 'Maternity — 20 Nov 2026' }, created_at: '2026-10-22T10:00:00Z' },
      { id: uuid(903), client_email: 'elena@example.com', actor: 'client', event: 'booking_created', meta: { ref: '1F649C', kind: 'Maternity booking' }, created_at: '2026-10-01T10:00:00Z' },
    ])
    if (table === 'bookings') return json([{ id: BOOKING, ref: '1F649C', created_at: '2026-10-01T10:00:00Z', flow_id: 'maternity', kind: 'Maternity booking', name: 'Elena Test', email: 'elena@example.com', phone: '07700900000', packages: 'Couple · 1 Look', selection: { optionIds: ['maternity-couple'], units: {}, extras: {} }, details: [], items: [], total: 200, amount_paid: 100, payment_status: 'Deposit Paid', status: 'confirmed', event_date: '2026-12-20', event_time: '14:00', source: 'website', notes: '' }])
    if (table === 'gallery_images') return json(images('proof').map((i) => ({ id: i.id, original_filename: i.filename })))
    if (table === 'gallery_selections') return json([{ image_id: uuid(101) }, { image_id: uuid(103) }])
    return json([])
  })
  // presigned PUTs to "R2": keep the bytes so the watermark can be checked
  await page.route(`${BASE}/__r2/**`, async (route) => {
    const r = route.request()
    if (r.method() === 'PUT') uploads.push({ url: r.url(), type: r.headers()['content-type'], body: r.postDataBuffer() })
    return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*' } })
  })
  await page.route(/wa\.me|whatsapp/, (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<h1>WhatsApp (test stub)</h1>' }))
}

const ref = new URL(fs.readFileSync('.dev.vars', 'utf8').match(/VITE_SUPABASE_URL=(.+)/)?.[1]?.trim() || 'https://x.supabase.co').hostname.split('.')[0]
const fakeSession = (email) => JSON.stringify({ access_token: 'test.' + Buffer.from(JSON.stringify({ sub: uuid(77), email, exp: 4102444800 })).toString('base64url') + '.sig', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, refresh_token: 'x', user: { id: uuid(77), email, aud: 'authenticated', role: 'authenticated', email_confirmed_at: '2026-01-01T00:00:00Z', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' } })

const browser = await chromium.launch() // fresh, throwaway browser
const errors = []
async function newPage(viewport, { session, admin } = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: viewport.width < 500 ? 2 : 1, hasTouch: viewport.width < 500 })
  if (session) await ctx.addInitScript(([k, v]) => localStorage.setItem(k, v), [`sb-${ref}-auth-token`, fakeSession(session)])
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(`${page.url()}: ${e.message}`))
  await mockSupabase(page, { admin })
  return page
}
const shot = (page, name, full = false) => page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: full })
const noHScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)

/* ── 1. signed out: cover gate with inline sign-in ── */
for (const vp of [{ width: 375, height: 812 }, { width: 1440, height: 900 }]) {
  const page = await newPage(vp)
  await page.goto(`${BASE}/gallery/${LOCKED}/`)
  await page.waitForSelector('.cg-gate input[type=email]')
  ok(`gate explains the private link (${vp.width})`, await page.isVisible('text=This gallery is private'))
  ok(`gate offers password sign-in, no codes (${vp.width})`, (await page.locator('.cg-gate input[type=password]').count()) === 1 && !(await page.isVisible('text=code')))
  ok(`gate shows the email hint (${vp.width})`, await page.isVisible('text=e•••••@example.com'))
  ok(`gate has no horizontal scroll (${vp.width})`, await noHScroll(page))
  await shot(page, `1-gate-${vp.width}`)
  await page.context().close()
}

/* ── 2. proof gallery: grid, hearts, limit, notes, lightbox, submit ── */
for (const vp of [{ width: 375, height: 812 }, { width: 1440, height: 900 }]) {
  const page = await newPage(vp, { session: 'elena@example.com' })
  await page.goto(`${BASE}/gallery/${PROOF}/`)
  await page.waitForSelector('.cg-album img')
  await shot(page, `2-hero-${vp.width}`)
  ok(`hero shows title (${vp.width})`, await page.isVisible('h1:has-text("Maternity")'))
  await page.click('text=View gallery')
  await page.waitForTimeout(700)
  ok(`counter starts at 1 / 4 (${vp.width})`, (await page.textContent('.cg-count'))?.replace(/\s/g, '').startsWith('1/4'))
  const hearts = page.locator('.cg-heart')
  ok(`every photo has a heart (${vp.width})`, (await hearts.count()) === 12)
  await hearts.nth(2).click({ force: true }); await hearts.nth(3).click({ force: true }); await hearts.nth(4).click({ force: true })
  await page.waitForTimeout(200)
  ok(`picking updates the counter (${vp.width})`, (await page.textContent('.cg-count'))?.replace(/\s/g, '').startsWith('4/4'))
  await hearts.nth(5).click({ force: true })
  await page.waitForTimeout(150)
  ok(`limit is enforced with a gentle notice (${vp.width})`, (await page.textContent('.cg-toast'))?.includes('picked all 4'))
  ok(`grid has no horizontal scroll (${vp.width})`, await noHScroll(page))
  await shot(page, `3-grid-${vp.width}`)
  // lightbox + note
  await page.locator('.cg-open').nth(0).click()
  await page.waitForSelector('.yarl__slide_image')
  ok(`lightbox opens with filename (${vp.width})`, await page.isVisible('.cg-lb-foot'))
  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(400)
  ok(`arrow key moves to the next photo (${vp.width})`, (await page.textContent('.cg-lb-foot'))?.includes('2 / 12'))
  await shot(page, `4-lightbox-${vp.width}`)
  await page.click('.cg-lb-note')
  await page.fill('.cg-sheet textarea', 'Please remove the person in the back')
  await shot(page, `5-note-${vp.width}`)
  await page.click('.cg-sheet .cg-btn.solid')
  await page.waitForTimeout(200)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  // filter
  await page.click('.cg-filter button:has-text("Picked")')
  await page.waitForTimeout(300)
  ok(`"Picked" filter shows only picks (${vp.width})`, (await page.locator('.cg-heart').count()) === 4)
  await page.click('.cg-filter button:has-text("All")')
  // submit
  await page.click('.cg-bar .cg-btn.red')
  await page.waitForSelector('.cg-review')
  ok(`review sheet lists the picks (${vp.width})`, (await page.locator('.cg-review figure').count()) === 4)
  await shot(page, `6-review-${vp.width}`)
  await page.click('.cg-sheet .cg-btn.red')
  await page.waitForSelector('.cg-success')
  await shot(page, `7-success-${vp.width}`)
  ok(`success screen shows (${vp.width})`, await page.isVisible('text=Selection sent!'))
  await page.waitForURL(/wa\.me/, { timeout: 4000 }).then(() => ok(`WhatsApp opens after submit (${vp.width})`, true), () => ok(`WhatsApp opens after submit (${vp.width})`, false))
  await page.context().close()
}

/* ── 2b. from the emailed link: no sign-in, picks save with the key, then the save-to-account prompt ── */
for (const vp of [{ width: 375, height: 812 }, { width: 1440, height: 900 }]) {
  const page = await newPage(vp)
  picksSent.length = 0
  await page.goto(`${BASE}/gallery/${PROOF}/?k=${KEY}`)
  await page.waitForSelector('.cg-album img')
  ok(`link opens the gallery without signing in (${vp.width})`, !(await page.isVisible('.cg-gate')))
  await page.locator('.cg-heart').nth(2).click({ force: true })
  await page.waitForTimeout(300)
  ok(`a heart saves through gallery-pick with the link key (${vp.width})`, picksSent.length === 1 && picksSent[0].key === KEY && picksSent[0].action === 'add')
  ok(`no save prompt straight away (${vp.width})`, !(await page.isVisible('text=Keep your photos in one place')))
  await page.waitForSelector('text=Keep your photos in one place', { timeout: 9000 }).then(() => ok(`save prompt appears after a few seconds (${vp.width})`, true), () => ok(`save prompt appears after a few seconds (${vp.width})`, false))
  await shot(page, `2b-save-prompt-${vp.width}`)
  await page.click('.cg-sheet .cg-btn:has-text("Create account")')
  ok(`create account is prefilled with the gallery email (${vp.width})`, (await page.inputValue('.cg-sheet #cg-email')) === 'elena@example.com')
  ok(`sign-up asks for a password (${vp.width})`, (await page.locator('.cg-sheet input[type=password]').count()) === 1)
  await shot(page, `2b-save-signup-${vp.width}`)
  await page.fill('.cg-sheet #cg-pw', 'a-good-password')
  await page.click('.cg-sheet .cg-auth-go')
  await page.waitForSelector('.cg-sheet >> text=Check your email', { timeout: 5000 }).then(() => ok(`sign-up says to check email (${vp.width})`, true), () => ok(`sign-up says to check email (${vp.width})`, false))
  await shot(page, `2b-save-check-${vp.width}`)
  await page.click('.cg-sheet .cg-x')
  ok(`"later" is remembered on this device (${vp.width})`, !!(await page.evaluate(() => localStorage.getItem('cg-save-later'))))
  ok(`the key is remembered on this device (${vp.width})`, (await page.evaluate((id) => localStorage.getItem(`cg-key:${id}`), PROOF)) === KEY)
  ok(`link view has no horizontal scroll (${vp.width})`, await noHScroll(page))
  await page.context().close()
}

/* ── 3. finals ── */
for (const vp of [{ width: 375, height: 812 }, { width: 1440, height: 900 }]) {
  const page = await newPage(vp, { session: 'elena@example.com' })
  await page.goto(`${BASE}/gallery/${FINAL}/`)
  await page.waitForSelector('.cg-album img')
  await page.click('text=View gallery')
  await page.waitForTimeout(600)
  ok(`finals: no hearts, download buttons (${vp.width})`, (await page.locator('.cg-heart').count()) === 0 && (await page.locator('.cg-dl').count()) === 12)
  ok(`finals: "Download all" (${vp.width})`, await page.isVisible('text=Download all'))
  await shot(page, `8-finals-${vp.width}`)
  await page.context().close()
}

/* ── 4. client area ── */
for (const vp of [{ width: 375, height: 812 }, { width: 1440, height: 900 }]) {
  const page = await newPage(vp, { session: 'elena@example.com' })
  await page.goto(`${BASE}/account/`)
  await page.waitForSelector('.ca-nav')
  await page.waitForTimeout(800)
  ok(`account greets by name (${vp.width})`, await page.isVisible('text=Hello, Elena'))
  ok(`account shows the action card (${vp.width})`, await page.isVisible('text=Finish picking your photos'))
  ok(`account has no horizontal scroll (${vp.width})`, await noHScroll(page))
  await shot(page, `9-account-${vp.width}`, true)
  for (const s of ['Bookings', 'Galleries', 'Activity', 'Profile']) {
    await page.click(`.ca-nav button:has-text("${s}")`)
    await page.waitForTimeout(500)
    await shot(page, `9-account-${s.toLowerCase()}-${vp.width}`, true)
  }
  await page.context().close()
  const out = await newPage(vp)
  await out.goto(`${BASE}/account/`)
  await out.waitForSelector('.cg-auth input')
  await shot(out, `10-account-signin-${vp.width}`)
  ok(`header shows the sign-in link (${vp.width})`, (await out.locator('.hd-account').count()) === 1)
  ok(`signed-out account page has no horizontal scroll (${vp.width})`, await noHScroll(out))
  await out.fill('#cg-email', 'elena@example.com'); await out.fill('#cg-pw', 'wrong')
  await out.click('.cg-auth-go')
  await out.waitForSelector('.cg-auth-err', { timeout: 5000 })
  ok(`wrong password gives a clear message (${vp.width})`, (await out.textContent('.cg-auth-err'))?.includes('reset your password'))
  await out.click('text=Forgot password?')
  ok(`forgot password keeps the email (${vp.width})`, (await out.inputValue('#cg-email')) === 'elena@example.com')
  await out.click('.cg-auth-go')
  await out.waitForSelector('text=Check your email', { timeout: 5000 }).then(() => ok(`reset link "sent" screen (${vp.width})`, true), () => ok(`reset link "sent" screen (${vp.width})`, false))
  await shot(out, `10-account-reset-sent-${vp.width}`)
  await out.click('text=Back to sign in')
  await out.click('.cg-auth-tabs button:has-text("Create account")')
  ok(`create account tab has name + password (${vp.width})`, (await out.locator('#cg-name').count()) === 1 && (await out.locator('#cg-pw[autocomplete=new-password]').count()) === 1)
  await shot(out, `10-account-signup-${vp.width}`)
  await out.context().close()
  // the link in the reset email: verify → choose a new password → into the account
  const rec = await newPage(vp)
  await rec.goto(`${BASE}/account/?token_hash=test&type=recovery`)
  await rec.waitForSelector('text=Choose a new password', { timeout: 8000 }).then(() => ok(`reset link opens "Choose a new password" (${vp.width})`, true), () => ok(`reset link opens "Choose a new password" (${vp.width})`, false))
  ok(`reset token is removed from the address bar (${vp.width})`, !rec.url().includes('token_hash'))
  await shot(rec, `10-account-newpw-${vp.width}`)
  await rec.fill('#cg-newpw', 'a-new-password')
  await rec.click('.cg-auth-go')
  await rec.waitForSelector('text=Your new password is saved', { timeout: 8000 }).then(() => ok(`new password saved, signed in (${vp.width})`, true), () => ok(`new password saved, signed in (${vp.width})`, false))
  await rec.context().close()
  const conf = await newPage(vp)
  await conf.goto(`${BASE}/account/?token_hash=test&type=email`)
  await conf.waitForSelector('text=Your email is confirmed', { timeout: 8000 }).then(() => ok(`confirm link welcomes them in (${vp.width})`, true), () => ok(`confirm link welcomes them in (${vp.width})`, false))
  await conf.context().close()
}

/* ── 5. dashboard: manager upload pipeline (watermark) + galleries section ── */
{
  const page = await newPage({ width: 1440, height: 1000 }, { session: 'admin@example.com', admin: true })
  await page.goto(`${BASE}/dashboard/#/bookings/${BOOKING}/gallery`)
  await page.waitForSelector('.gm-drop', { timeout: 15000 })
  await shot(page, '11-manager-proofs', true)
  await page.setInputFiles('.gm-drop input', ['ILZ_8904.jpg', 'ILU0061.webp', 'ILU6433.webp'].map((f) => `public/images/${f}`))
  await page.waitForSelector('.gm-wmprev img', { timeout: 15000 })
  await shot(page, '12-manager-staged', true)
  await page.click('text=Watermark & upload 3')
  await page.waitForFunction(() => document.querySelector('.gm-queue-sum')?.textContent?.startsWith('3 of 3 uploaded'), null, { timeout: 30000 })
  ok('upload queue finishes 3 of 3', true)
  const proofs = uploads.filter((u) => u.url.includes('/__r2/'))
  ok('proofs upload exactly thumb + preview per file (no original)', proofs.length === 6 && proofs.every((u) => /\/(thumb|preview)\.jpg$/.test(u.url)), proofs.map((u) => u.url.split('/').pop()).join(','))
  for (const u of proofs) {
    const m = await sharp(u.body).metadata()
    const long = Math.max(m.width, m.height)
    const want = u.url.endsWith('/thumb.jpg') ? 600 : 2048
    ok(`${decodeURIComponent(u.url.split('/__r2/')[1])}: JPEG, long edge ≤ ${want}`, m.format === 'jpeg' && long <= want && u.type === 'image/jpeg', `${m.width}x${m.height}`)
    fs.writeFileSync(path.join(SHOTS, `upload-${decodeURIComponent(u.url.split('/__r2/')[1]).replace(/\//g, '-')}`), u.body)
  }
  // the watermarked preview differs from a clean resize of the same file
  const prev = proofs.find((u) => u.url.includes('ILU0061') && u.url.endsWith('/preview.jpg'))
  if (prev) {
    const m = await sharp(prev.body).metadata()
    // compare the centre band, where the big logo sits
    const band = { left: Math.round(m.width * 0.2), top: Math.round(m.height * 0.42), width: Math.round(m.width * 0.6), height: Math.round(m.height * 0.16) }
    const clean = await sharp('public/images/ILU0061.webp').resize(m.width, m.height).extract(band).removeAlpha().raw().toBuffer()
    const marked = await sharp(prev.body).extract(band).removeAlpha().raw().toBuffer()
    let diff = 0
    for (let i = 0; i < clean.length; i += 3) if (Math.abs(clean[i] - marked[i]) > 18) diff++
    ok('preview carries a visible watermark (centre band)', diff / (clean.length / 3) > 0.08, `${((diff / (clean.length / 3)) * 100).toFixed(1)}% of centre pixels changed`)
  }
  ok('manager offers Reset link once sent', await page.isVisible('button:has-text("Reset link")'))
  await page.click('.ad-tabs button:has-text("Finals")')
  await page.waitForTimeout(800)
  await shot(page, '13-manager-finals', true)
  await page.goto(`${BASE}/dashboard/#/galleries`)
  await page.waitForSelector('.gx-client', { timeout: 15000 })
  await page.waitForTimeout(800)
  await shot(page, '14-galleries', true)
  ok('galleries section groups by client', await page.isVisible('.gx-client summary:has-text("Elena Test")'))
  await page.goto(`${BASE}/dashboard/#/bookings`)
  await page.waitForTimeout(1200)
  ok('bookings rows have a Gallery action', (await page.locator('a.ad-btn:has-text("Gallery")').count()) >= 1)
  await shot(page, '15-bookings')
  await page.goto(`${BASE}/dashboard/#/overview`)
  await page.waitForTimeout(1200)
  await shot(page, '16-overview')
  await page.context().close()
}
{
  const page = await newPage({ width: 375, height: 812 }, { session: 'admin@example.com', admin: true })
  await page.goto(`${BASE}/dashboard/#/bookings/${BOOKING}/gallery`)
  await page.waitForSelector('.gm-drop', { timeout: 15000 })
  await page.waitForTimeout(800)
  await shot(page, '17-manager-375', true)
  ok('manager has no horizontal scroll at 375', await noHScroll(page))
  await page.context().close()
}
{
  const page = await newPage({ width: 1280, height: 800 }, { session: 'client@example.com', admin: false })
  await page.goto(`${BASE}/dashboard/`)
  await page.waitForURL(/\/account\//, { timeout: 8000 }).then(() => ok('a client opening /dashboard is sent to /account', true), () => ok('a client opening /dashboard is sent to /account', false))
  await page.context().close()
}

ok('no JavaScript errors on any page', !errors.length, errors.slice(0, 5).join(' | '))
await browser.close()
console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED')
process.exit(fails ? 1 : 0)
