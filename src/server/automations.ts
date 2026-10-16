/**
 * Email automations — a port of the DMI `process-emails` rules, adapted to Illuszionz Media.
 * Called every ~10 minutes by pg_cron (via POST /api/cron). Each email is claimed in `email_log`
 * through a unique `dedupe_key` BEFORE it is sent, so the same email can never go out twice even if
 * two runs overlap. Manual (dashboard-created) bookings are never announced automatically.
 */
import { db, q, type DbEnv } from './db'
import { genericEmail, mailConfig, send, type MailEnv } from './mail'
import { site } from '../site'

type Row = Record<string, any>
export type AutoEnv = MailEnv & DbEnv
export type Template = { key: string; name: string; audience: 'customer' | 'owner'; enabled: boolean; subject: string; eyebrow: string; title: string; body: string; button_label: string; button_url: string }

/** Free Cloudflare plans allow ~50 subrequests per invocation; a send costs ~3, so cap each run. */
export const MAX_SENDS_PER_RUN = 14
const PACE_MS = 550 // Resend allows ~2 requests/second
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const MARKETING = new Set(['reengagement', 'birthday', 'lead_followup'])

/* ------------------------------ time helpers (UK) ------------------------------ */

/** "2026-05-30" + "14:30" in Europe/London -> UTC ms. */
export function londonToUtc(date: string, time = '12:00'): number {
  const asUtc = Date.parse(`${date}T${time.slice(0, 5)}:00Z`)
  if (Number.isNaN(asUtc)) return NaN
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
      .formatToParts(new Date(asUtc))
      .map((x) => [x.type, x.value]),
  ) as Record<string, string>
  const local = Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour === '24' ? '00' : p.hour}:${p.minute}:${p.second}Z`)
  return asUtc - (local - asUtc)
}
export const londonNow = (now = Date.now()) => {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit' }).formatToParts(new Date(now)).map((x) => [x.type, x.value]),
  ) as Record<string, string>
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) % 24, year: Number(p.year), month: Number(p.month), day: Number(p.day) }
}
const prettyDate = (v?: string | null) => {
  if (!v) return 'your date'
  const d = new Date(v + 'T12:00:00Z')
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
}
const gbp = (n: number) => `£${Number(n).toLocaleString('en-GB', { maximumFractionDigits: 2 })}`
const addDays = (date: string, n: number) => new Date(Date.parse(date + 'T12:00:00Z') + n * 86_400_000).toISOString().slice(0, 10)

/* ------------------------------- rendering ------------------------------- */

export function fill(text: string, vars: Record<string, string>) {
  return text.replace(/\{\{\s*([a-z_0-9]+)\s*\}\}/gi, (_, k: string) => vars[k] ?? '')
}

export function renderTemplate(env: AutoEnv, t: Template, vars: Record<string, string>) {
  const cfg = mailConfig(env)
  const all = { site: cfg.siteUrl, whatsapp: `https://wa.me/${site.whatsapp}`, review_link: `${cfg.siteUrl}/review/`, time_suffix: '', ...vars }
  return genericEmail({
    siteUrl: cfg.siteUrl,
    subject: fill(t.subject, all),
    eyebrow: fill(t.eyebrow, all),
    title: fill(t.title, all),
    body: fill(t.body, all),
    buttonLabel: fill(t.button_label, all),
    buttonUrl: fill(t.button_url, all),
    footerNote: MARKETING.has(t.key) ? 'Not interested in these emails? Just reply with “unsubscribe” and we will stop.' : undefined,
  })
}

export function bookingVars(b: Row): Record<string, string> {
  const total = Number(b.total ?? 0)
  const paid = Number(b.amount_paid ?? 0)
  return {
    name: b.name ?? '',
    first_name: String(b.name ?? '').trim().split(/\s+/)[0] || 'there',
    service: String(b.kind ?? 'session').replace(/ booking$/i, '').toLowerCase(),
    date: prettyDate(b.event_date),
    time: b.event_time ?? '',
    time_suffix: b.event_time ? ` at ${b.event_time}` : '',
    total: total ? gbp(total) : String(b.total_text ?? ''),
    balance: gbp(Math.max(0, total - paid)),
    ref: b.ref ?? '',
  }
}
export const contactVars = (c: Row): Record<string, string> => ({
  name: c.name ?? '',
  first_name: String(c.name ?? '').trim().split(/\s+/)[0] || 'there',
  service: 'session',
  date: '',
  time: '',
  ref: '',
})

/* ------------------------------- sending ------------------------------- */

export class Runner {
  sent = 0
  skipped = 0
  failed = 0
  report: string[] = []
  constructor(
    readonly env: AutoEnv,
    readonly templates: Record<string, Template>,
    readonly settings: { automations: Record<string, boolean>; email: Row },
    readonly dry = false,
  ) {}
  get budget() {
    return this.sent + this.failed < MAX_SENDS_PER_RUN
  }
  on(key: string) {
    return !!this.templates[key]?.enabled && this.settings.automations[key] !== false
  }
  get owners(): string[] {
    const list = (this.settings.email.owner_emails as string[] | undefined) ?? []
    return list.length ? list : [mailConfig(this.env).owner]
  }

  /** Claim the dedupe key, send, record the result. Returns true when an email actually went out. */
  async once(o: { key: string; dedupe: string; to: string; vars: Record<string, string>; bookingId?: string; contactId?: string }): Promise<boolean> {
    const t = this.templates[o.key]
    if (!t || !this.budget || !o.to) return false
    const message = renderTemplate(this.env, t, o.vars)
    if (this.dry) {
      this.report.push(`[dry] ${o.key} → ${o.to}`)
      this.sent++
      return true
    }
    const claim = await db.claim(
      this.env,
      'email_log',
      { dedupe_key: o.dedupe, template_key: o.key, to_email: o.to, subject: message.subject, booking_id: o.bookingId ?? null, contact_id: o.contactId ?? null, status: 'pending' },
      'dedupe_key',
    )
    if (!claim) {
      this.skipped++
      return false
    }
    if (/\.test$/i.test(o.to)) {
      // demo / placeholder address: claim + log but never send
      await db.update(this.env, 'email_log', `id=eq.${claim.id}`, { status: 'skipped', error: 'demo address — not sent' })
      this.skipped++
      return false
    }
    try {
      await send(this.env, { to: o.to, replyTo: t.audience === 'customer' ? mailConfig(this.env).owner : undefined, message })
      await db.update(this.env, 'email_log', `id=eq.${claim.id}`, { status: 'sent', sent_at: new Date().toISOString() })
      this.sent++
      this.report.push(`sent ${o.key} → ${o.to}`)
      await sleep(PACE_MS)
      return true
    } catch (err) {
      await db.update(this.env, 'email_log', `id=eq.${claim.id}`, { status: 'failed', error: String(err instanceof Error ? err.message : err).slice(0, 400) })
      this.failed++
      this.report.push(`FAILED ${o.key} → ${o.to}`)
      return false
    }
  }
  async owner(key: string, dedupe: string, vars: Record<string, string>) {
    for (const to of this.owners) await this.once({ key, dedupe: `${dedupe}:${to}`, to, vars })
  }
}

/* --------------------------------- rules --------------------------------- */

const websiteBookings = 'source=eq.website&email=not.is.null'

export async function runAutomations(env: AutoEnv, opts: { dry?: boolean; now?: number } = {}) {
  const now = opts.now ?? Date.now()
  const [tpls, settingsRows] = await Promise.all([db.select(env, 'email_templates', 'select=*'), db.select(env, 'settings', 'select=*')])
  const templates = Object.fromEntries((tpls as Template[]).map((t) => [t.key, t]))
  const s = Object.fromEntries(settingsRows.map((r) => [r.key, r.value]))
  const run = new Runner(env, templates, { automations: s.automations ?? {}, email: s.email ?? {} }, opts.dry)
  const cfg = (n: string, d: number) => Number(run.settings.email[n] ?? d)
  const today = londonNow(now)
  const iso = (ms: number) => new Date(ms).toISOString()

  /* 1. booking confirmed (status flipped to "confirmed" in the dashboard) */
  if (run.on('booking_confirmed')) {
    const rows = await db.select(env, 'bookings', `status=eq.confirmed&${websiteBookings}&confirmed_at=gte.${iso(now - 14 * 86_400_000)}&order=confirmed_at.asc&limit=20`)
    for (const b of rows) if (run.budget) await run.once({ key: 'booking_confirmed', dedupe: `confirmed:${b.id}`, to: b.email, vars: bookingVars(b), bookingId: b.id, contactId: b.contact_id })
  }

  /* 2. reminders: 24h (sent once the session is < 26h away) and 2h (< 2.5h away) */
  if (run.on('reminder_24h') || run.on('reminder_2h')) {
    const from = addDays(today.date, -1)
    const to = addDays(today.date, 2)
    const rows = await db.select(env, 'bookings', `status=eq.confirmed&${websiteBookings}&event_date=gte.${from}&event_date=lte.${to}&event_time=not.is.null&limit=60`)
    for (const b of rows) {
      const until = londonToUtc(b.event_date, b.event_time) - now
      if (Number.isNaN(until) || until <= 0) continue
      if (until <= 2.5 * 3_600_000) {
        if (run.on('reminder_2h')) await run.once({ key: 'reminder_2h', dedupe: `r2:${b.id}`, to: b.email, vars: bookingVars(b), bookingId: b.id, contactId: b.contact_id })
      } else if (until <= 26 * 3_600_000 && run.on('reminder_24h')) {
        await run.once({ key: 'reminder_24h', dedupe: `r24:${b.id}`, to: b.email, vars: bookingVars(b), bookingId: b.id, contactId: b.contact_id })
      }
    }
  }

  /* 3. balance reminder: confirmed, unpaid balance, session within 3 days */
  if (run.on('payment_reminder')) {
    const rows = await db.select(env, 'bookings', `status=eq.confirmed&${websiteBookings}&payment_status=in.(Not Paid,Deposit Paid)&total=gt.0&event_date=gte.${today.date}&event_date=lte.${addDays(today.date, 3)}&limit=30`)
    for (const b of rows) if (Number(b.total) > Number(b.amount_paid)) await run.once({ key: 'payment_reminder', dedupe: `pay:${b.id}`, to: b.email, vars: bookingVars(b), bookingId: b.id, contactId: b.contact_id })
  }

  /* 4/5. thank-you (24h after) and review request (14 days after) — sessions marked confirmed/completed */
  if (run.on('thank_you') || run.on('review_request')) {
    const rows = await db.select(env, 'bookings', `status=in.(confirmed,completed)&${websiteBookings}&event_date=gte.${addDays(today.date, -30)}&event_date=lte.${today.date}&limit=80`)
    for (const b of rows) {
      const ageH = (now - londonToUtc(b.event_date, b.event_time ?? '23:59')) / 3_600_000
      const reviewH = cfg('review_request_days', 14) * 24
      if (run.on('review_request') && ageH >= reviewH && ageH <= reviewH + 7 * 24) await run.once({ key: 'review_request', dedupe: `review:${b.id}`, to: b.email, vars: bookingVars(b), bookingId: b.id, contactId: b.contact_id })
      else if (run.on('thank_you') && ageH >= cfg('thank_you_hours', 24) && ageH <= 72) await run.once({ key: 'thank_you', dedupe: `thanks:${b.id}`, to: b.email, vars: bookingVars(b), bookingId: b.id, contactId: b.contact_id })
    }
  }

  /* 6. re-engagement: last session was N..N+7 days ago and nothing booked since */
  if (run.on('reengagement')) {
    const n = cfg('reengagement_days', 90)
    const rows = await db.select(env, 'bookings', `status=in.(confirmed,completed)&event_date=gte.${addDays(today.date, -(n + 7))}&event_date=lte.${addDays(today.date, -n)}&contact_id=not.is.null&limit=60`)
    for (const b of rows) {
      if (!run.budget) break
      const [c] = await db.select(env, 'contacts', `id=eq.${b.contact_id}&limit=1`)
      if (!c?.email || !c.marketing_opt_in || c.do_not_contact) continue
      const later = await db.select(env, 'bookings', `contact_id=eq.${c.id}&status=neq.cancelled&event_date=gt.${b.event_date}&limit=1`)
      if (later.length) continue
      await run.once({ key: 'reengagement', dedupe: `reeng:${b.id}`, to: c.email, vars: { ...contactVars(c), ...bookingVars(b) }, bookingId: b.id, contactId: c.id })
    }
  }

  /* 7. birthdays (from the digest hour; 29 Feb people are celebrated on 28 Feb in non-leap years) */
  if (today.hour >= cfg('digest_hour', 8) && (run.on('birthday') || run.on('owner_birthdays'))) {
    const leap = (today.year % 4 === 0 && today.year % 100 !== 0) || today.year % 400 === 0
    const mmdd = (m: number, d: number) => `-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const people = (await db.select(env, 'contacts', 'birthday=not.is.null&select=id,name,email,birthday,marketing_opt_in,do_not_contact&limit=2000')).filter((c) => {
      const b = String(c.birthday)
      return b.endsWith(mmdd(today.month, today.day)) || (!leap && today.month === 2 && today.day === 28 && b.endsWith('-02-29'))
    })
    if (people.length) {
      if (run.on('birthday')) for (const c of people) if (c.email && c.marketing_opt_in && !c.do_not_contact) await run.once({ key: 'birthday', dedupe: `bday:${c.id}:${today.year}`, to: c.email, vars: contactVars(c), contactId: c.id })
      if (run.on('owner_birthdays')) await run.owner('owner_birthdays', `obday:${today.date}`, { list: people.map((c) => `• ${c.name}`).join('\n') })
    }
  }

  /* 8. lead follow-up: enquiry still untouched N days later -> nudge email + an owner task */
  if (run.on('lead_followup')) {
    const n = cfg('lead_followup_days', 3)
    const deals = await db.select(env, 'deals', `stage=in.(new,contacted)&created_at=lte.${iso(now - n * 86_400_000)}&created_at=gte.${iso(now - (n + 10) * 86_400_000)}&limit=40`)
    for (const d of deals) {
      if (!run.budget) break
      const [c] = await db.select(env, 'contacts', `id=eq.${d.contact_id}&limit=1`)
      if (!c) continue
      if (c.email && c.marketing_opt_in && !c.do_not_contact && !d.booking_id) await run.once({ key: 'lead_followup', dedupe: `lead:${d.id}`, to: c.email, vars: { ...contactVars(c), service: (d.service || 'session').toLowerCase() }, contactId: c.id })
      if (!opts.dry) {
        const open = await db.select(env, 'tasks', `deal_id=eq.${d.id}&done=eq.false&limit=1`)
        const mark = await db.claim(env, 'email_log', { dedupe_key: `leadtask:${d.id}`, template_key: 'lead_task', to_email: 'system', status: 'skipped' }, 'dedupe_key')
        if (!open.length && mark) await db.insert(env, 'tasks', { title: `Follow up with ${c.name} — ${d.service || 'enquiry'} has gone quiet`, type: 'follow-up', priority: 'high', due_at: iso(now), contact_id: c.id, deal_id: d.id, auto: true })
      }
    }
  }

  /* 9. owner morning digest */
  if (run.on('owner_daily') && today.hour >= cfg('digest_hour', 8) && !opts.dry) {
    const tomorrow = addDays(today.date, 1)
    const endOfToday = iso(londonToUtc(tomorrow, '00:00'))
    const [tasks, todayB, tomB, unread, deals] = await Promise.all([
      db.select(env, 'tasks', `done=eq.false&due_at=lt.${endOfToday}&order=due_at.asc&limit=12&select=title,due_at`),
      db.select(env, 'bookings', `event_date=eq.${today.date}&status=in.(new,confirmed)&select=name,kind,event_time,status`),
      db.select(env, 'bookings', `event_date=eq.${tomorrow}&status=in.(new,confirmed)&select=name,kind,event_time,status`),
      db.select(env, 'submissions', `status=eq.new&select=id,name,form_name&limit=50`),
      db.select(env, 'bookings', `status=eq.new&select=id&limit=50`),
    ])
    const lines: string[] = []
    if (todayB.length) lines.push('TODAY', ...todayB.map((b) => `• ${b.event_time ?? ''} ${b.kind} — ${b.name}${b.status === 'new' ? ' (not yet confirmed!)' : ''}`.replace('•  ', '• ')), '')
    if (tomB.length) lines.push('TOMORROW', ...tomB.map((b) => `• ${b.event_time ?? ''} ${b.kind} — ${b.name}`.replace('•  ', '• ')), '')
    if (tasks.length) lines.push(`TASKS DUE OR OVERDUE (${tasks.length})`, ...tasks.map((t) => `• ${t.title}`), '')
    if (deals.length) lines.push(`${deals.length} booking request${deals.length === 1 ? '' : 's'} waiting to be confirmed`)
    if (unread.length) lines.push(`${unread.length} unread message${unread.length === 1 ? '' : 's'} / enquir${unread.length === 1 ? 'y' : 'ies'}`)
    if (lines.some((l) => l.trim())) await run.owner('owner_daily', `odaily:${today.date}`, { list: lines.join('\n').trim() })
  }

  /* 10. daily housekeeping: lifecycle stages + lead scores */
  if (!opts.dry && today.hour >= cfg('digest_hour', 8)) {
    const mark = await db.claim(env, 'email_log', { dedupe_key: `maint:${today.date}`, template_key: 'maintenance', to_email: 'system', status: 'skipped' }, 'dedupe_key')
    if (mark) await housekeeping(env, now)
  }

  return { sent: run.sent, skipped: run.skipped, failed: run.failed, report: run.report }
}

/** Promotes people who have booked to client / vip, parks the long-quiet ones, refreshes lead scores. */
export async function housekeeping(env: DbEnv, now = Date.now()) {
  const bookings = await db.select(env, 'bookings', 'status=in.(confirmed,completed)&contact_id=not.is.null&select=contact_id,total')
  const stats = new Map<string, { n: number; spent: number }>()
  for (const b of bookings) {
    const s = stats.get(b.contact_id) ?? { n: 0, spent: 0 }
    s.n++
    s.spent += Number(b.total)
    stats.set(b.contact_id, s)
  }
  for (const [id, s] of stats) {
    const lifecycle = s.n >= 3 || s.spent >= 1500 ? 'vip' : 'client'
    await db.update(env, 'contacts', `id=eq.${id}&lifecycle=in.(subscriber,lead,opportunity,client,inactive)&lifecycle=neq.${lifecycle}`, { lifecycle })
  }
  await db.update(env, 'contacts', `lifecycle=in.(client,vip)&last_activity_at=lt.${new Date(now - 365 * 86_400_000).toISOString()}`, { lifecycle: 'inactive' })
  const ids = await db.select(env, 'contacts', 'select=id&order=updated_at.desc&limit=40')
  for (const c of ids) await db.rpc(env, 'rescore_contact', { cid: c.id }).catch(() => undefined)
}
export { q }
