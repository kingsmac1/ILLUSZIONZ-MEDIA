/**
 * POST /api/admin — actions that need server secrets (sending email) for signed-in dashboard admins.
 * The browser sends its Supabase access token; we check it and the admin_users table before doing anything.
 */
import { db, dbReady, q, type DbEnv } from '../../src/server/db'
import { genericEmail, mailConfig, send, type MailEnv } from '../../src/server/mail'
import { bookingVars, contactVars, renderTemplate, type Template } from '../../src/server/automations'
import { matchesAudience, type AudienceFilter } from '../../src/server/audience'

type Env = MailEnv & DbEnv
const json = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const BATCH = 12

async function adminEmail(env: Env, request: Request): Promise<string | null> {
  const token = (request.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token || !dbReady(env)) return null
  const res = await fetch(`${env.SUPABASE_URL!.replace(/\/$/, '')}/auth/v1/user`, { headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY!, Authorization: `Bearer ${token}` } })
  if (!res.ok) return null
  const email = ((await res.json()) as { email?: string }).email?.toLowerCase()
  if (!email) return null
  const rows = await db.select(env, 'admin_users', `email=ilike.${q(email)}&limit=1`)
  return rows.length ? email : null
}

async function audience(env: Env, filter: AudienceFilter) {
  const [contacts, bookings] = await Promise.all([
    db.select(env, 'contacts', 'select=id,name,email,phone,lifecycle,source,tags,marketing_opt_in,do_not_contact,last_activity_at,city&limit=5000'),
    db.select(env, 'bookings', 'select=contact_id,flow_id,status&limit=5000'),
  ])
  return contacts.filter((c) => c.email && matchesAudience(c as any, bookings as any, { ...filter, marketingOnly: true }))
}

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }) => {
  const who = await adminEmail(env, request).catch(() => null)
  if (!who) return json({ ok: false, error: 'Not authorised.' }, 401)
  const body = (await request.json().catch(() => ({}))) as Record<string, any>
  const cfg = mailConfig(env)
  const dry = cfg.dryRun
  const deliver = async (to: string, message: { subject: string; html: string; text: string }) => {
    if (dry) return
    await send(env, { to, replyTo: cfg.owner, message })
  }

  try {
    switch (body.action) {
      case 'whoami':
        return json({ ok: true, email: who, mail: !!(cfg.apiKey && cfg.from), dryRun: dry })

      /* send an editable template to any address with sample data */
      case 'test_template': {
        const [t] = (await db.select(env, 'email_templates', `key=eq.${q(body.key)}&limit=1`)) as Template[]
        if (!t) return json({ ok: false, error: 'Unknown template.' }, 404)
        const sample = { ...bookingVars({ name: 'Ada Lovelace', kind: 'Portrait booking', event_date: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10), event_time: '14:00', total: 300, amount_paid: 150, ref: 'A1B2C3' }), list: '• Sample line one\n• Sample line two' }
        const m = renderTemplate(env, t, sample)
        m.subject = `[TEST] ${m.subject}`
        await deliver(String(body.to || who), m)
        return json({ ok: true, ...(dry ? { dryRun: true, email: m } : {}) })
      }

      /* send a template now to one booking / contact (manual, logged) */
      case 'send_template': {
        const [t] = (await db.select(env, 'email_templates', `key=eq.${q(body.key)}&limit=1`)) as Template[]
        if (!t) return json({ ok: false, error: 'Unknown template.' }, 404)
        let vars: Record<string, string> = {}
        let to = ''
        let contactId: string | undefined
        let bookingId: string | undefined
        if (body.booking_id) {
          const [b] = await db.select(env, 'bookings', `id=eq.${q(body.booking_id)}&limit=1`)
          if (!b?.email) return json({ ok: false, error: 'That booking has no email address.' }, 422)
          vars = bookingVars(b)
          to = b.email
          contactId = b.contact_id
          bookingId = b.id
        } else if (body.contact_id) {
          const [c] = await db.select(env, 'contacts', `id=eq.${q(body.contact_id)}&limit=1`)
          if (!c?.email) return json({ ok: false, error: 'That contact has no email address.' }, 422)
          vars = contactVars(c)
          to = c.email
          contactId = c.id
        } else return json({ ok: false, error: 'Choose a booking or contact.' }, 422)
        const m = renderTemplate(env, t, { ...vars, ...(body.vars ?? {}) })
        await deliver(to, m)
        if (!dry) {
          await db.insert(env, 'email_log', { template_key: t.key, to_email: to, subject: m.subject, status: 'sent', sent_at: new Date().toISOString(), booking_id: bookingId ?? null, contact_id: contactId ?? null })
          if (contactId) await db.insert(env, 'activities', { contact_id: contactId, booking_id: bookingId ?? null, type: 'email', subject: `Sent “${t.name}”`, body: m.subject, created_by: who })
        }
        return json({ ok: true, ...(dry ? { dryRun: true, email: m } : {}) })
      }

      /* one-off personal email from the CRM */
      case 'quick_email': {
        const { to, subject, message, contact_id } = body
        if (!to || !subject || !message) return json({ ok: false, error: 'Recipient, subject and message are required.' }, 422)
        const m = genericEmail({ siteUrl: cfg.siteUrl, subject, eyebrow: 'A note from us', title: subject, body: message })
        await deliver(to, m)
        if (!dry) {
          await db.insert(env, 'email_log', { template_key: 'quick_email', to_email: to, subject, status: 'sent', sent_at: new Date().toISOString(), contact_id: contact_id ?? null })
          if (contact_id) await db.insert(env, 'activities', { contact_id, type: 'email', subject: `Emailed: ${subject}`, body: message, created_by: who })
          if (contact_id) await db.update(env, 'contacts', `id=eq.${contact_id}`, { last_contacted_at: new Date().toISOString(), last_activity_at: new Date().toISOString() })
        }
        return json({ ok: true, ...(dry ? { dryRun: true, email: m } : {}) })
      }

      case 'audience_count':
        return json({ ok: true, count: (await audience(env, body.filter ?? {})).length })

      /* campaigns: test send, then send in small batches (the dashboard keeps calling until remaining = 0) */
      case 'campaign_test':
      case 'campaign_batch': {
        const [c] = await db.select(env, 'email_campaigns', `id=eq.${q(body.id)}&limit=1`)
        if (!c) return json({ ok: false, error: 'Campaign not found.' }, 404)
        const build = (name: string) => {
          const vars = contactVars({ name })
          return genericEmail({
            siteUrl: cfg.siteUrl,
            subject: c.subject.replace(/\{\{\s*first_name\s*\}\}/g, vars.first_name),
            eyebrow: c.eyebrow,
            title: c.title.replace(/\{\{\s*first_name\s*\}\}/g, vars.first_name),
            body: c.body.replace(/\{\{\s*first_name\s*\}\}/g, vars.first_name),
            buttonLabel: c.button_label,
            buttonUrl: c.button_url,
            imageUrl: c.image_url,
            footerNote: 'Not interested in these emails? Just reply with “unsubscribe” and we will stop.',
          })
        }
        if (body.action === 'campaign_test') {
          const m = build('Ada Lovelace')
          m.subject = `[TEST] ${m.subject}`
          await deliver(String(body.to || who), m)
          return json({ ok: true, ...(dry ? { dryRun: true, email: m } : {}) })
        }
        const people = await audience(env, c.audience)
        const done = new Set((await db.select(env, 'email_log', `campaign_id=eq.${c.id}&select=contact_id`)).map((r) => r.contact_id))
        const todo = people.filter((p) => !done.has(p.id))
        await db.update(env, 'email_campaigns', `id=eq.${c.id}`, { status: todo.length ? 'sending' : 'sent', recipients: people.length })
        let sent = 0
        let failed = 0
        for (const p of todo.slice(0, BATCH)) {
          const m = build(p.name)
          const claim = await db.claim(env, 'email_log', { dedupe_key: `camp:${c.id}:${p.id}`, template_key: 'campaign', campaign_id: c.id, contact_id: p.id, to_email: p.email, subject: m.subject, status: 'pending' }, 'dedupe_key')
          if (!claim) continue
          try {
            await deliver(p.email, m)
            await db.update(env, 'email_log', `id=eq.${claim.id}`, { status: 'sent', sent_at: new Date().toISOString() })
            sent++
            await sleep(550)
          } catch (err) {
            await db.update(env, 'email_log', `id=eq.${claim.id}`, { status: 'failed', error: String(err).slice(0, 300) })
            failed++
          }
        }
        const remaining = Math.max(0, todo.length - sent - failed)
        await db.update(env, 'email_campaigns', `id=eq.${c.id}`, {
          sent_count: Number(c.sent_count) + sent,
          failed_count: Number(c.failed_count) + failed,
          status: remaining ? 'sending' : 'sent',
          sent_at: remaining ? null : new Date().toISOString(),
        })
        return json({ ok: true, sent, failed, remaining, total: people.length })
      }

      default:
        return json({ ok: false, error: 'Unknown action.' }, 400)
    }
  } catch (err) {
    console.error('admin action failed', err)
    return json({ ok: false, error: err instanceof Error ? err.message : 'Failed.' }, 500)
  }
}
