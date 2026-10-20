/** POST /api/form — generic site forms (contact, service enquiry, review …): multipart with a JSON `payload` and optional files. */
import { deliver, type EmailSummary, type MailEnv } from '../../src/server/mail'
import type { DbEnv } from '../../src/server/db'
import { recordSubmission } from '../../src/server/crm'

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })

type Payload = { formName: string; fields: { label: string; value: string }[]; website?: string }

const copy: Record<string, { kind: string; headline: string; intro: string; next: string[] }> = {
  contact: {
    kind: 'Contact message',
    headline: 'Message received',
    intro: 'Thank you for reaching out. Your message is with us and we will reply personally, usually within one working day.',
    next: ['We read your message.', 'We reply by email or WhatsApp within one working day.'],
  },
  enquiry: {
    kind: 'Service enquiry',
    headline: 'Enquiry received',
    intro: 'Thank you for your enquiry — a member of our creative team will get back to you within one business day.',
    next: ['We review your enquiry.', 'A member of our team gets back to you within one business day.'],
  },
  review: {
    kind: 'Client review',
    headline: 'Thank you for your review',
    intro: 'Thank you for sharing your experience with us — it genuinely means a lot. Your story helps others understand the dedication we bring to every session.',
    next: ['We read every review personally.', 'Verified testimonials may be featured on the website — we will always ask first.'],
  },
}

function toBase64(buf: ArrayBuffer) {
  let s = ''
  const bytes = new Uint8Array(buf)
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

export const onRequestPost = async ({ request, env }: { request: Request; env: MailEnv & DbEnv }) => {
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return json({ ok: false, error: 'Invalid request.' }, 400)
  }
  let payload: Payload
  try {
    payload = JSON.parse(String(form.get('payload'))) as Payload
  } catch {
    return json({ ok: false, error: 'Invalid request.' }, 400)
  }
  if (payload.website) return json({ ok: true })
  const fields = (payload.fields ?? []).filter((f) => f && typeof f.label === 'string' && typeof f.value === 'string').slice(0, 60)
  const find = (re: RegExp) => fields.find((f) => re.test(f.label))?.value.trim()
  const email = fields.find((f) => /^\S+@\S+\.\S+$/.test(f.value.trim()) && /e-?mail/i.test(f.label))?.value.trim()
  const name = find(/^(full )?name$/i) || find(/name/i) || 'Website visitor'
  const phone = find(/phone|whatsapp/i)
  if (!fields.some((f) => f.value.trim())) return json({ ok: false, error: 'The form is empty.' }, 422)

  const c = copy[payload.formName] ?? copy.enquiry
  const files = [...form.entries()].filter(([k, v]) => k.startsWith('file') && typeof v !== 'string') as [string, File][]
  let size = 0
  const attachments: { filename: string; content: string }[] = []
  for (const [, file] of files.slice(0, 3)) {
    size += file.size
    if (size > 4_000_000) return json({ ok: false, error: 'Attachments must be under 4 MB in total.' }, 413)
    if (file.size) attachments.push({ filename: file.name.replace(/[^\w.\- ]/g, '_'), content: toBase64(await file.arrayBuffer()) })
  }

  const details: [string, string][] = []
  const notes: { label: string; value: string }[] = []
  for (const f of fields) {
    const v = f.value.trim()
    if (!v || /^(full )?name$/i.test(f.label) || (email && v === email) || (phone && v === phone && /phone|whatsapp/i.test(f.label))) continue
    if (v.length > 70 || v.includes('\n')) notes.push({ label: f.label, value: v })
    else details.push([f.label, v])
  }
  const summary: EmailSummary = {
    kind: c.kind,
    name,
    email,
    phone,
    headline: c.headline,
    intro: c.intro,
    details,
    items: [],
    notes,
    next: c.next,
    attachments: attachments.map((a) => a.filename),
  }
  await recordSubmission(env, { formName: payload.formName, name, email, phone, fields, attachments: attachments.map((a) => a.filename) })
  try {
    const result = await deliver(env, summary, attachments)
    return json({ ok: true, ...(result.dryRun ? { dryRun: true, emails: { customer: result.customer, owner: result.owner } } : {}) })
  } catch (err) {
    console.error('Form failed', err)
    return json({ ok: false, error: err instanceof Error ? err.message : 'Could not send.' }, 424)
  }
}
