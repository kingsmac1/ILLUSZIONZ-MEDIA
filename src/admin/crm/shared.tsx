import { useState } from 'react'
import { useData, useDb, type R } from '../data'
import { Field, Modal, addDaysIso, todayIso } from '../ui'

export const LIFECYCLES = ['subscriber', 'lead', 'opportunity', 'client', 'vip', 'inactive', 'lost']
export const SOURCES = ['website', 'booking', 'instagram', 'facebook', 'whatsapp', 'referral', 'walk-in', 'event', 'other']
export const TASK_TYPES = ['call', 'whatsapp', 'email', 'follow-up', 'quote', 'meeting', 'deliver', 'other']
export const ACT_ICON: Record<string, string> = { note: '📝', call: '📞', email: '✉️', whatsapp: '💬', meeting: '🤝', booking: '📅', form: '📥', payment: '£', stage: '➜', task: '✓', system: '⚙' }

export const SERVICES = [
  'Portrait Photography', 'Maternity Photography', 'Baby Shoot', 'Pre-wedding', 'Event Photography', 'Family Photography', 'Wedding Photography',
  'Videography', '360 Photo Booth', 'Academy', 'Agency', 'Store',
]

export function contactStats(c: R, bookings: R[]) {
  const mine = bookings.filter((b) => b.contact_id === c.id && b.status !== 'cancelled')
  return { count: mine.length, spent: mine.reduce((s, b) => s + Number(b.total ?? 0), 0), paid: mine.reduce((s, b) => s + Number(b.amount_paid ?? 0), 0), last: mine.map((b) => b.event_date ?? b.created_at.slice(0, 10)).sort().pop() as string | undefined }
}

export function scoreColor(s: number) {
  return s >= 70 ? '#15803d' : s >= 40 ? '#d97706' : '#9ca3af'
}

/** Add / edit a contact. */
export function ContactForm({ contact, onDone }: { contact?: R; onDone: (saved?: R) => void }) {
  const { d, toast } = useData()
  const db = useDb()
  const [f, setF] = useState<R>({
    name: '', email: '', phone: '', company_id: '', job_title: '', lifecycle: 'lead', source: 'website', city: '', instagram: '', birthday: '', marketing_opt_in: true, do_not_contact: false, notes: '', tags: [], ...contact,
  })
  const [tagText, setTagText] = useState<string>((contact?.tags ?? []).join(', '))
  const set = (k: string, v: unknown) => setF((c) => ({ ...c, [k]: v }))

  async function save() {
    if (!f.name.trim()) return toast('Name is required', 'err')
    const row = {
      name: f.name.trim(), email: f.email?.trim().toLowerCase() || null, phone: f.phone?.trim() ?? '', company_id: f.company_id || null, job_title: f.job_title ?? '',
      lifecycle: f.lifecycle, source: f.source, city: f.city ?? '', instagram: f.instagram ?? '', birthday: f.birthday || null,
      marketing_opt_in: !!f.marketing_opt_in, do_not_contact: !!f.do_not_contact, notes: f.notes ?? '',
      tags: tagText.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean),
    }
    const r = contact ? await db.update('contacts', { id: contact.id }, row, 'Contact saved') : await db.insert('contacts', row, 'Contact added')
    if (r.ok) onDone(r.data?.[0])
  }
  return (
    <div className="ad-form">
      <Field label="Full name *"><input type="text" value={f.name} onChange={(e) => set('name', e.target.value)} autoFocus /></Field>
      <Field label="Email"><input type="email" value={f.email ?? ''} onChange={(e) => set('email', e.target.value)} /></Field>
      <Field label="Phone / WhatsApp"><input type="tel" value={f.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
      <Field label="Instagram"><input type="text" value={f.instagram} onChange={(e) => set('instagram', e.target.value)} placeholder="@handle" /></Field>
      <Field label="Lifecycle stage"><select value={f.lifecycle} onChange={(e) => set('lifecycle', e.target.value)}>{LIFECYCLES.map((l) => <option key={l}>{l}</option>)}</select></Field>
      <Field label="Source"><select value={f.source} onChange={(e) => set('source', e.target.value)}>{SOURCES.map((l) => <option key={l}>{l}</option>)}</select></Field>
      <Field label="Company"><select value={f.company_id ?? ''} onChange={(e) => set('company_id', e.target.value)}><option value="">— none —</option>{d.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
      <Field label="Job title"><input type="text" value={f.job_title} onChange={(e) => set('job_title', e.target.value)} /></Field>
      <Field label="City / area"><input type="text" value={f.city} onChange={(e) => set('city', e.target.value)} /></Field>
      <Field label="Birthday" hint="Used for the birthday email"><input type="date" value={f.birthday ?? ''} onChange={(e) => set('birthday', e.target.value)} /></Field>
      <Field label="Tags" hint="Comma separated, e.g. bride, repeat, corporate" full><input type="text" value={tagText} onChange={(e) => setTagText(e.target.value)} /></Field>
      <Field label="Notes" full><textarea value={f.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
      <label className="ad-check"><input type="checkbox" checked={!!f.marketing_opt_in} onChange={(e) => set('marketing_opt_in', e.target.checked)} />Happy to receive marketing emails</label>
      <label className="ad-check"><input type="checkbox" checked={!!f.do_not_contact} onChange={(e) => set('do_not_contact', e.target.checked)} />Do not contact</label>
      <div className="ad-formfoot">
        <button className="ad-btn" onClick={() => onDone()}>Cancel</button>
        <button className="ad-btn primary" onClick={save}>Save contact</button>
      </div>
    </div>
  )
}

/** Create a task (optionally linked to a contact / deal / booking). */
export function TaskModal({ defaults, onClose }: { defaults: R; onClose: () => void }) {
  const { d } = useData()
  const db = useDb()
  const [f, setF] = useState<R>({ title: '', type: 'follow-up', priority: 'normal', due: addDaysIso(todayIso(), 1), contact_id: '', ...defaults })
  const set = (k: string, v: unknown) => setF((c) => ({ ...c, [k]: v }))
  async function save() {
    if (!f.title.trim()) return
    const r = await db.insert('tasks', { title: f.title.trim(), type: f.type, priority: f.priority, due_at: f.due ? new Date(f.due + 'T09:00:00').toISOString() : null, contact_id: f.contact_id || null, deal_id: f.deal_id || null, booking_id: f.booking_id || null, notes: f.notes ?? '' }, 'Task added')
    if (r.ok) onClose()
  }
  return (
    <Modal title="New task" onClose={onClose}>
      <div className="ad-form">
        <Field label="What needs doing? *" full><input type="text" value={f.title} onChange={(e) => set('title', e.target.value)} autoFocus /></Field>
        <Field label="Type"><select value={f.type} onChange={(e) => set('type', e.target.value)}>{TASK_TYPES.map((t) => <option key={t}>{t}</option>)}</select></Field>
        <Field label="Priority"><select value={f.priority} onChange={(e) => set('priority', e.target.value)}><option>low</option><option>normal</option><option>high</option></select></Field>
        <Field label="Due"><input type="date" value={f.due} onChange={(e) => set('due', e.target.value)} /></Field>
        <Field label="Contact"><select value={f.contact_id ?? ''} onChange={(e) => set('contact_id', e.target.value)}><option value="">— none —</option>{d.contacts.slice(0, 600).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field label="Notes" full><textarea value={f.notes ?? ''} onChange={(e) => set('notes', e.target.value)} /></Field>
        <div className="ad-formfoot"><button className="ad-btn" onClick={onClose}>Cancel</button><button className="ad-btn primary" onClick={save}>Add task</button></div>
      </div>
    </Modal>
  )
}

/** Deal create / edit. */
export function DealModal({ deal, defaults, onClose }: { deal?: R; defaults?: R; onClose: () => void }) {
  const { d } = useData()
  const db = useDb()
  const [f, setF] = useState<R>({ title: '', contact_id: '', service: '', value: 0, stage: d.pipeline_stages[0]?.key ?? 'new', expected_close: '', event_date: '', source: 'website', notes: '', lost_reason: '', ...defaults, ...deal })
  const set = (k: string, v: unknown) => setF((c) => ({ ...c, [k]: v }))
  async function save() {
    if (!f.title.trim() || !f.contact_id) return
    const stage = d.pipeline_stages.find((s) => s.key === f.stage)
    const closed = stage && stage.kind !== 'open'
    const row = { title: f.title.trim(), contact_id: f.contact_id, service: f.service, value: Number(f.value) || 0, stage: f.stage, expected_close: f.expected_close || null, event_date: f.event_date || null, source: f.source, notes: f.notes, lost_reason: f.stage === 'lost' ? f.lost_reason : '', closed_at: closed ? deal?.closed_at ?? new Date().toISOString() : null }
    const r = deal ? await db.update('deals', { id: deal.id }, row, 'Deal saved') : await db.insert('deals', row, 'Deal created')
    if (r.ok) onClose()
  }
  return (
    <Modal title={deal ? 'Edit deal' : 'New deal'} onClose={onClose}>
      <div className="ad-form">
        <Field label="Title *" full><input type="text" value={f.title} onChange={(e) => set('title', e.target.value)} autoFocus placeholder="e.g. Wedding photography — Ada & Tobi" /></Field>
        <Field label="Contact *"><select value={f.contact_id} onChange={(e) => set('contact_id', e.target.value)}><option value="">Choose…</option>{d.contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field label="Service"><select value={f.service} onChange={(e) => set('service', e.target.value)}><option value="">—</option>{SERVICES.map((s) => <option key={s}>{s}</option>)}</select></Field>
        <Field label="Value (£)"><input type="number" value={f.value} onChange={(e) => set('value', e.target.value)} /></Field>
        <Field label="Stage"><select value={f.stage} onChange={(e) => set('stage', e.target.value)}>{d.pipeline_stages.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}</select></Field>
        <Field label="Event / session date"><input type="date" value={f.event_date ?? ''} onChange={(e) => set('event_date', e.target.value)} /></Field>
        <Field label="Decision expected by"><input type="date" value={f.expected_close ?? ''} onChange={(e) => set('expected_close', e.target.value)} /></Field>
        {f.stage === 'lost' && <Field label="Why was it lost?" full><input type="text" value={f.lost_reason} onChange={(e) => set('lost_reason', e.target.value)} placeholder="price, date unavailable, went elsewhere…" /></Field>}
        <Field label="Notes" full><textarea value={f.notes} onChange={(e) => set('notes', e.target.value)} /></Field>
        <div className="ad-formfoot">
          {deal && <button className="ad-btn danger" onClick={async () => window.confirm('Delete this deal?') && (await db.remove('deals', { id: deal.id }, 'Deal deleted')).ok && onClose()}>Delete</button>}
          <button className="ad-btn" onClick={onClose}>Cancel</button><button className="ad-btn primary" onClick={save}>Save deal</button>
        </div>
      </div>
    </Modal>
  )
}
