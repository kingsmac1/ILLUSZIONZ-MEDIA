/**
 * Writes website submissions into the database and keeps the CRM in step:
 * contact (found by email, then phone) → deal in the pipeline → timeline entry → follow-up task.
 * Every function is best-effort: a database hiccup must never stop the emails from going out.
 */
import { db, dbReady, q, type DbEnv } from './db'
import type { Flow, Selection } from '../booking/catalog'
import type { EmailSummary } from './mail'

const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString()
const digits = (v: string) => v.replace(/[^\d]/g, '')

export type PersonInput = { name: string; email?: string; phone?: string; source?: string; lifecycle?: string }

/** Finds the contact by email (then phone) or creates one. Existing clients keep their lifecycle. */
export async function upsertContact(env: DbEnv, p: PersonInput): Promise<{ id: string; isNew: boolean }> {
  const email = (p.email ?? '').trim().toLowerCase()
  const phone = (p.phone ?? '').trim()
  let found: Record<string, any> | undefined
  if (email) found = (await db.select(env, 'contacts', `email=ilike.${q(email)}&limit=1`))[0]
  if (!found && digits(phone).length >= 7) {
    const tail = digits(phone).slice(-9)
    found = (await db.select(env, 'contacts', `phone=ilike.*${q(tail)}*&limit=1`))[0]
  }
  if (found) {
    const patch: Record<string, any> = { last_activity_at: new Date().toISOString() }
    if (!found.email && email) patch.email = email
    if (!found.phone && phone) patch.phone = phone
    await db.update(env, 'contacts', `id=eq.${found.id}`, patch)
    return { id: found.id, isNew: false }
  }
  const [row] = await db.insert(env, 'contacts', {
    name: p.name,
    email: email || null,
    phone,
    source: p.source ?? 'website',
    lifecycle: p.lifecycle ?? 'lead',
  })
  return { id: row.id, isNew: true }
}

const eventDate = (sel: Selection) => {
  const raw = sel.fields.date || sel.fields.weddingDate || ''
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null
}

/** Booking form → bookings row + contact + deal + timeline + task. Returns the booking ref. */
export async function recordBooking(
  env: DbEnv,
  flow: Flow,
  sel: Selection,
  summary: EmailSummary,
  quote: { total: number; quoted: boolean; lines: { label: string; amount: string; value: number }[] },
  extra: { discount?: number; promo?: string; packages: string },
): Promise<string | null> {
  if (!dbReady(env)) return null
  try {
    const f = sel.fields
    const { id: contactId } = await upsertContact(env, { name: f.name, email: f.email, phone: f.phone, source: 'booking', lifecycle: 'opportunity' })
    const total = Math.max(0, quote.total - (extra.discount ?? 0))
    const [booking] = await db.insert(env, 'bookings', {
      flow_id: flow.id,
      kind: flow.kind,
      contact_id: contactId,
      name: f.name,
      email: (f.email ?? '').toLowerCase() || null,
      phone: f.phone ?? '',
      packages: extra.packages,
      selection: sel,
      details: summary.details,
      items: summary.items,
      total_text: summary.total ?? '',
      total,
      discount: extra.discount ?? 0,
      promo_code: extra.promo ?? null,
      quoted: quote.quoted,
      event_date: eventDate(sel),
      event_time: /^\d{2}:\d{2}/.test(f.time ?? '') ? f.time : null,
      notes: summary.notes?.map((n) => `${n.label}: ${n.value}`).join('\n') ?? '',
    })
    const [deal] = await db.insert(env, 'deals', {
      title: `${flow.title} — ${f.name}`,
      contact_id: contactId,
      booking_id: booking.id,
      service: flow.title,
      value: total,
      stage: 'new',
      source: 'booking',
      event_date: eventDate(sel),
    })
    await db.insert(env, 'activities', {
      contact_id: contactId,
      deal_id: deal.id,
      booking_id: booking.id,
      type: 'booking',
      subject: `${flow.kind} submitted${summary.total ? ` (${summary.total})` : ''}`,
      body: summary.details.map(([k, v]) => `${k}: ${v}`).join('\n'),
      auto: true,
      created_by: 'website',
    })
    await db.insert(env, 'tasks', {
      title: `Confirm ${flow.title.toLowerCase()} booking with ${f.name}`,
      type: 'whatsapp',
      priority: 'high',
      due_at: inDays(0.5),
      contact_id: contactId,
      deal_id: deal.id,
      booking_id: booking.id,
      auto: true,
    })
    await db.rpc(env, 'rescore_contact', { cid: contactId }).catch(() => undefined)
    return booking.ref as string
  } catch (err) {
    console.error('recordBooking failed', err)
    return null
  }
}

/** Contact message / enquiry / review / job application → inbox row + CRM contact (+ lead for enquiries). */
export async function recordSubmission(
  env: DbEnv,
  o: { formName: string; name: string; email?: string; phone?: string; fields: { label: string; value: string }[]; attachments: string[] },
): Promise<void> {
  if (!dbReady(env)) return
  try {
    const isCareer = /career|job|apply/i.test(o.formName)
    const isReview = o.formName === 'review'
    const { id: contactId } = await upsertContact(env, {
      name: o.name,
      email: o.email,
      phone: o.phone,
      source: 'website',
      lifecycle: isReview || isCareer ? 'client' : 'lead',
    })
    const rating = isReview ? Number(o.fields.find((f) => /rating|stars/i.test(f.label))?.value) || null : null
    await db.insert(env, 'submissions', {
      form_name: o.formName,
      contact_id: contactId,
      name: o.name,
      email: (o.email ?? '').toLowerCase() || null,
      phone: o.phone ?? '',
      fields: o.fields,
      attachments: o.attachments,
      rating,
    })
    await db.insert(env, 'activities', {
      contact_id: contactId,
      type: 'form',
      subject: `${isReview ? 'Review' : isCareer ? 'Job application' : o.formName === 'enquiry' ? 'Service enquiry' : 'Contact message'} received`,
      body: o.fields.map((f) => `${f.label}: ${f.value}`).join('\n').slice(0, 2000),
      auto: true,
      created_by: 'website',
    })
    if (o.formName === 'enquiry' || o.formName === 'contact') {
      const service = o.fields.find((f) => /service|interested|enquiry for/i.test(f.label))?.value ?? ''
      const [deal] = await db.insert(env, 'deals', {
        title: `${service || 'Enquiry'} — ${o.name}`,
        contact_id: contactId,
        service,
        stage: 'new',
        source: 'website',
      })
      await db.insert(env, 'tasks', {
        title: `Reply to ${o.name}'s ${o.formName === 'contact' ? 'message' : 'enquiry'}`,
        type: 'email',
        priority: 'high',
        due_at: inDays(1),
        contact_id: contactId,
        deal_id: deal.id,
        auto: true,
      })
    }
    await db.rpc(env, 'rescore_contact', { cid: contactId }).catch(() => undefined)
  } catch (err) {
    console.error('recordSubmission failed', err)
  }
}
