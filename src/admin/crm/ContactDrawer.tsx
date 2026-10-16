import { useCallback, useEffect, useState } from 'react'
import { supabase, adminApi } from '../supabase'
import { useData, useDb, type R } from '../data'
import { Badge, Confirm, Empty, Field, Modal, Tabs, ago, fmtDate, gbp, initials, waLink } from '../ui'
import { ACT_ICON, ContactForm, DealModal, TaskModal, contactStats, scoreColor } from './shared'

function EmailModal({ contact, onClose }: { contact: R; onClose: () => void }) {
  const { toast } = useData()
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState(`Hi ${contact.name.split(' ')[0]},\n\n`)
  const [busy, setBusy] = useState(false)
  async function send() {
    setBusy(true)
    const r = await adminApi({ action: 'quick_email', to: contact.email, subject, message, contact_id: contact.id })
    setBusy(false)
    if (r.ok) { toast('Email sent'); onClose() } else toast(r.error ?? 'Could not send', 'err')
  }
  return (
    <Modal title={`Email ${contact.name}`} onClose={onClose}>
      <div className="ad-form">
        <Field label="To" full><input type="text" value={contact.email} readOnly /></Field>
        <Field label="Subject" full><input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} autoFocus /></Field>
        <Field label="Message" full hint="Sent in the branded Illuszionz email layout and logged on the timeline."><textarea style={{ minHeight: 180 }} value={message} onChange={(e) => setMessage(e.target.value)} /></Field>
        <div className="ad-formfoot"><button className="ad-btn" onClick={onClose}>Cancel</button><button className="ad-btn primary" disabled={busy || !subject.trim()} onClick={send}>{busy ? 'Sending…' : 'Send email'}</button></div>
      </div>
    </Modal>
  )
}

export function ContactDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const { d, refresh } = useData()
  const db = useDb()
  const c = d.contacts.find((x) => x.id === id)
  const [tab, setTab] = useState<'timeline' | 'deals' | 'bookings' | 'tasks' | 'details'>('timeline')
  const [acts, setActs] = useState<R[]>([])
  const [note, setNote] = useState('')
  const [kind, setKind] = useState('note')
  const [modal, setModal] = useState<null | 'email' | 'task' | 'deal' | { deal: R }>(null)

  const loadActs = useCallback(async () => {
    const { data } = await supabase!.from('activities').select('*').eq('contact_id', id).order('created_at', { ascending: false }).limit(200)
    setActs(data ?? [])
  }, [id])
  useEffect(() => { loadActs() }, [loadActs])

  if (!c) return null
  const bookings = d.bookings.filter((b) => b.contact_id === id)
  const deals = d.deals.filter((x) => x.contact_id === id)
  const tasks = d.tasks.filter((t) => t.contact_id === id)
  const company = d.companies.find((x) => x.id === c.company_id)
  const st = contactStats(c, d.bookings)

  async function addNote() {
    if (!note.trim()) return
    await db.log({ contact_id: id, type: kind, subject: kind === 'note' ? 'Note' : { call: 'Call logged', email: 'Email logged', whatsapp: 'WhatsApp logged', meeting: 'Meeting logged' }[kind] ?? kind, body: note.trim() })
    if (kind !== 'note') await db.update('contacts', { id }, { last_contacted_at: new Date().toISOString(), last_activity_at: new Date().toISOString() })
    else await db.update('contacts', { id }, { last_activity_at: new Date().toISOString() })
    setNote('')
    loadActs()
  }
  async function setLifecycle(v: string) {
    await db.update('contacts', { id }, { lifecycle: v }, 'Lifecycle updated')
    await db.log({ contact_id: id, type: 'system', subject: `Lifecycle set to ${v}`, auto: true })
    loadActs()
  }

  return (
    <Modal drawer onClose={onClose} title={
      <span className="ad-who"><span className="ad-avatar">{initials(c.name)}</span><span><strong style={{ display: 'block' }}>{c.name}</strong><span className="ad-muted" style={{ fontSize: 12, fontWeight: 500 }}>{company?.name ?? c.job_title ?? ''}</span></span></span>
    }>
      <div className="ad-actions" style={{ marginBottom: 16 }}>
        {c.phone && <a className="ad-btn sm" href={waLink(c.phone)} target="_blank" rel="noreferrer" onClick={() => db.log({ contact_id: id, type: 'whatsapp', subject: 'WhatsApp opened', auto: true })}>WhatsApp</a>}
        {c.phone && <a className="ad-btn sm" href={`tel:${c.phone}`}>Call</a>}
        {c.email && !c.do_not_contact && <button className="ad-btn sm" onClick={() => setModal('email')}>Email</button>}
        <button className="ad-btn sm" onClick={() => setModal('task')}>+ Task</button>
        <button className="ad-btn sm" onClick={() => setModal('deal')}>+ Deal</button>
        <select className="ad-btn sm" style={{ width: 'auto' }} value={c.lifecycle} onChange={(e) => setLifecycle(e.target.value)} aria-label="Lifecycle stage">
          {['subscriber', 'lead', 'opportunity', 'client', 'vip', 'inactive', 'lost'].map((l) => <option key={l}>{l}</option>)}
        </select>
      </div>
      <div className="ad-grid c4" style={{ marginBottom: 18 }}>
        <div className="ad-stat"><span>Lead score</span><strong className="ad-score" style={{ ['--s' as any]: `${c.lead_score}%`, ['--c' as any]: scoreColor(c.lead_score) }}>{c.lead_score}<i /></strong></div>
        <div className="ad-stat"><span>Bookings</span><strong>{st.count}</strong></div>
        <div className="ad-stat"><span>Lifetime value</span><strong>{gbp(st.spent)}</strong></div>
        <div className="ad-stat"><span>Last contact</span><strong style={{ fontSize: 17 }}>{ago(c.last_contacted_at)}</strong></div>
      </div>
      <div className="ad-tags" style={{ marginBottom: 14 }}><Badge>{c.lifecycle}</Badge><Badge tone="grey">{c.source}</Badge>{(c.tags ?? []).map((t: string) => <span className="ad-tag" key={t}>#{t}</span>)}{c.do_not_contact && <Badge tone="red">do not contact</Badge>}{!c.marketing_opt_in && <Badge tone="amber">no marketing</Badge>}</div>

      <Tabs value={tab} onChange={setTab} tabs={[
        { id: 'timeline', label: 'Timeline', count: acts.length },
        { id: 'deals', label: 'Deals', count: deals.length },
        { id: 'bookings', label: 'Bookings', count: bookings.length },
        { id: 'tasks', label: 'Tasks', count: tasks.filter((t) => !t.done).length },
        { id: 'details', label: 'Details' },
      ]} />

      {tab === 'timeline' && (
        <>
          <div className="ad-card" style={{ marginBottom: 18, padding: 14 }}>
            <div className="ad-seg" style={{ marginBottom: 10 }}>{['note', 'call', 'whatsapp', 'email', 'meeting'].map((k) => <button key={k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>{ACT_ICON[k]} {k}</button>)}</div>
            <textarea placeholder={kind === 'note' ? 'Write a note…' : `What was discussed on the ${kind}?`} value={note} onChange={(e) => setNote(e.target.value)} />
            <div style={{ textAlign: 'right', marginTop: 8 }}><button className="ad-btn primary sm" onClick={addNote} disabled={!note.trim()}>Add to timeline</button></div>
          </div>
          <div className="ad-timeline">
            {acts.map((a) => (
              <div key={a.id} className={'ad-tl' + (a.auto ? ' auto' : '')}>
                <span className="ic">{ACT_ICON[a.type] ?? '•'}</span>
                <div><b>{a.subject}</b> <small>· {ago(a.created_at)}{a.created_by && !a.auto ? ` · ${a.created_by.split('@')[0]}` : ''}</small>{a.body && <p>{a.body}</p>}</div>
              </div>
            ))}
            {!acts.length && <Empty title="No activity yet" hint="Notes, calls, emails and form submissions will appear here." />}
          </div>
        </>
      )}

      {tab === 'deals' && (
        <div className="ad-list">
          {deals.map((x) => {
            const stage = d.pipeline_stages.find((s) => s.key === x.stage)
            return <div key={x.id}><div><b>{x.title}</b><div className="ad-muted">{x.service || '—'} · {fmtDate(x.created_at)}</div></div><div style={{ textAlign: 'right' }}><b>{gbp(x.value)}</b><div><span className="ad-badge" style={{ background: stage?.color, color: '#fff' }}>{stage?.name ?? x.stage}</span> <button className="ad-btn sm" onClick={() => setModal({ deal: x })}>Edit</button></div></div></div>
          })}
          {!deals.length && <Empty title="No deals" action={<button className="ad-btn primary sm" onClick={() => setModal('deal')}>+ New deal</button>} />}
        </div>
      )}

      {tab === 'bookings' && (
        <div className="ad-list">
          {bookings.map((b) => <div key={b.id}><div><b>{b.kind}</b> <span className="ad-muted">#{b.ref}</span><div className="ad-muted">{b.packages || '—'} · {b.event_date ? fmtDate(b.event_date) : 'date TBC'}</div></div><div style={{ textAlign: 'right' }}><b>{b.total ? gbp(b.total) : b.total_text}</b><div><Badge>{b.status}</Badge> <Badge>{b.payment_status}</Badge></div></div></div>)}
          {!bookings.length && <Empty title="No bookings yet" />}
        </div>
      )}

      {tab === 'tasks' && (
        <div className="ad-list">
          {tasks.map((t) => (
            <div key={t.id}>
              <label className="ad-check"><input type="checkbox" checked={t.done} onChange={() => db.update('tasks', { id: t.id }, { done: !t.done, done_at: t.done ? null : new Date().toISOString() })} /><span style={{ textDecoration: t.done ? 'line-through' : 'none' }}>{t.title}</span></label>
              <span className="ad-muted">{t.due_at ? fmtDate(t.due_at) : ''} <Badge>{t.priority}</Badge></span>
            </div>
          ))}
          {!tasks.length && <Empty title="No tasks" action={<button className="ad-btn primary sm" onClick={() => setModal('task')}>+ New task</button>} />}
        </div>
      )}

      {tab === 'details' && (
        <>
          <dl className="ad-kv" style={{ marginBottom: 22 }}>
            <dt>Email</dt><dd>{c.email ?? '—'}</dd><dt>Phone</dt><dd>{c.phone || '—'}</dd><dt>Instagram</dt><dd>{c.instagram || '—'}</dd>
            <dt>City</dt><dd>{c.city || '—'}</dd><dt>Birthday</dt><dd>{c.birthday ? fmtDate(c.birthday) : '—'}</dd><dt>Added</dt><dd>{fmtDate(c.created_at)}</dd>
            <dt>Notes</dt><dd>{c.notes || '—'}</dd>
          </dl>
          <h4 style={{ margin: '0 0 12px' }}>Edit contact</h4>
          <ContactForm contact={c} onDone={() => { refresh('contacts'); loadActs() }} />
          <div style={{ marginTop: 22 }}>
            <Confirm text={`Delete ${c.name} and all their timeline, deals and tasks? Bookings are kept.`} onYes={async () => { const r = await db.remove('contacts', { id }, 'Contact deleted', ['deals', 'tasks']); if (r.ok) onClose() }}>Delete contact</Confirm>
          </div>
        </>
      )}

      {modal === 'email' && <EmailModal contact={c} onClose={() => { setModal(null); loadActs() }} />}
      {modal === 'task' && <TaskModal defaults={{ contact_id: id }} onClose={() => setModal(null)} />}
      {modal === 'deal' && <DealModal defaults={{ contact_id: id, title: `${c.name} — `, source: c.source }} onClose={() => setModal(null)} />}
      {modal && typeof modal === 'object' && <DealModal deal={modal.deal} onClose={() => setModal(null)} />}
    </Modal>
  )
}
