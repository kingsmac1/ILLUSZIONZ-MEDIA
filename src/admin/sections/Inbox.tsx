import { Fragment, useMemo, useState } from 'react'
import { useData, useDb, type R } from '../data'
import { BulkBar, BulkBtn, BulkSelect, RowBox, SelectAllBox, confirmN, useSelection } from '../bulk'
import { Badge, Confirm, Empty, Modal, PageHead, Tabs, ago, downloadCsv, fmtDate, waLink } from '../ui'
import { ContactDrawer } from '../crm/ContactDrawer'

const KIND: Record<string, string> = { contact: 'Contact message', enquiry: 'Service enquiry', review: 'Review', careers: 'Job application' }
const label = (f: string) => KIND[f] ?? f

export function Inbox() {
  const { d } = useData()
  const db = useDb()
  const [tab, setTab] = useState<'all' | 'contact' | 'enquiry' | 'review' | 'careers'>('all')
  const [status, setStatus] = useState('')
  const [open, setOpen] = useState<R | null>(null)
  const [contact, setContact] = useState<string | null>(null)
  const list = useMemo(() => d.submissions.filter((s) => (tab === 'all' || s.form_name === tab) && (!status || s.status === status)), [d.submissions, tab, status])
  const sel = useSelection(list.map((x) => x.id))
  const picked = () => d.submissions.filter((x) => sel.has(x.id))
  const n = (k: string) => d.submissions.filter((s) => k === 'all' || s.form_name === k).length

  const current = open ? d.submissions.find((s) => s.id === open.id) ?? open : null
  async function openIt(s: R) {
    setOpen(s)
    if (s.status === 'new') db.update('submissions', { id: s.id }, { status: 'read' })
  }
  async function bulkDelete() {
    if (!confirmN('Permanently delete', sel.count, 'message')) return
    const r = await db.removeMany('submissions', sel.ids, `${sel.count} message${sel.count === 1 ? '' : 's'} deleted`)
    if (r.ok) sel.clear()
  }
  return (
    <>
      <PageHead title="Inbox" sub="Contact messages, enquiries, reviews and job applications from the website" />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'all', label: 'All', count: n('all') }, { id: 'contact', label: 'Messages', count: n('contact') }, { id: 'enquiry', label: 'Enquiries', count: n('enquiry') }, { id: 'review', label: 'Reviews', count: n('review') }, { id: 'careers', label: 'Careers', count: n('careers') }]} />
      <div className="ad-toolbar"><select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Any status</option>{['new', 'read', 'replied', 'archived'].map((s) => <option key={s}>{s}</option>)}</select></div>
      <BulkBar s={sel} noun="message">
        <BulkSelect label="Mark as" options={[{ value: 'new', label: 'Unread' }, { value: 'read', label: 'Read' }, { value: 'replied', label: 'Replied' }, { value: 'archived', label: 'Archived' }]} onPick={(v) => db.updateMany('submissions', sel.ids, { status: v }, `${sel.count} marked ${v === 'new' ? 'unread' : v}`)} />
        {picked().some((x) => x.form_name === 'review') && <>
          <BulkBtn onClick={() => db.updateMany('submissions', picked().filter((x) => x.form_name === 'review').map((x) => x.id), { featured: true }, 'Reviews featured')}>★ Feature reviews</BulkBtn>
          <BulkBtn onClick={() => db.updateMany('submissions', picked().filter((x) => x.form_name === 'review').map((x) => x.id), { featured: false }, 'Reviews unfeatured')}>Unfeature</BulkBtn></>}
        <BulkBtn onClick={() => downloadCsv('inbox-selected', picked().map((x) => ({ received: x.created_at, type: x.form_name, name: x.name, email: x.email, phone: x.phone, status: x.status, rating: x.rating, message: ((x.fields ?? []) as { label: string; value: string }[]).map((f) => `${f.label}: ${f.value}`).join(' | ') })))}>Export CSV</BulkBtn>
        <BulkBtn danger onClick={bulkDelete}>Delete</BulkBtn>
      </BulkBar>
      <div className="ad-tablewrap">
        <table>
          <thead><tr><th className="sel"><SelectAllBox s={sel} view={list.map((x) => x.id)} /></th><th>From</th><th>Type</th><th>Preview</th><th>Status</th><th>Received</th></tr></thead>
          <tbody>
            {list.map((s) => {
              const fields = (s.fields ?? []) as { label: string; value: string }[]
              const preview = fields.find((f) => f.value.length > 25)?.value ?? fields[1]?.value ?? ''
              return (
                <tr key={s.id} className={'click' + (sel.has(s.id) ? ' picked' : '')} onClick={() => openIt(s)} style={s.status === 'new' ? { fontWeight: 600 } : undefined}>
                  <td className="sel"><RowBox s={sel} id={s.id} label={`message from ${s.name}`} /></td>
                  <td><b>{s.name}</b><span className="sub">{s.email || s.phone}</span></td>
                  <td>{label(s.form_name)}{s.rating ? ` · ${'★'.repeat(s.rating)}` : ''}</td>
                  <td className="ad-muted" style={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{preview}</td>
                  <td><Badge>{s.status}</Badge>{s.featured && <> <Badge tone="gold">featured</Badge></>}</td>
                  <td className="ad-muted">{ago(s.created_at)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {!list.length && <Empty title="Nothing here" hint="New messages and enquiries land here the moment they are submitted." />}
      </div>
      {current && (
        <Modal title={`${label(current.form_name)} · ${current.name}`} onClose={() => setOpen(null)}>
          <div className="ad-actions" style={{ marginBottom: 16 }}>
            {current.phone && <a className="ad-btn sm" target="_blank" rel="noreferrer" href={waLink(current.phone)}>WhatsApp</a>}
            {current.email && <a className="ad-btn sm" href={`mailto:${current.email}`} onClick={() => db.update('submissions', { id: current.id }, { status: 'replied' })}>Reply by email</a>}
            {current.contact_id && <button className="ad-btn sm" onClick={() => setContact(current.contact_id)}>Open in CRM</button>}
            <select className="ad-btn sm" style={{ width: 'auto' }} value={current.status} onChange={(e) => db.update('submissions', { id: current.id }, { status: e.target.value })}>{['new', 'read', 'replied', 'archived'].map((s) => <option key={s}>{s}</option>)}</select>
            {current.form_name === 'review' && <button className="ad-btn sm" onClick={() => db.update('submissions', { id: current.id }, { featured: !current.featured }, current.featured ? 'Unfeatured' : 'Marked as featured')}>{current.featured ? '★ Featured' : '☆ Feature'}</button>}
          </div>
          <dl className="ad-kv">
            <dt>Received</dt><dd>{fmtDate(current.created_at, true)}</dd>
            <dt>Email</dt><dd>{current.email || '—'}</dd><dt>Phone</dt><dd>{current.phone || '—'}</dd>
            {((current.fields ?? []) as { label: string; value: string }[]).map((f) => <Fragment key={f.label + f.value}><dt>{f.label}</dt><dd>{f.value}</dd></Fragment>)}
            {current.attachments?.length > 0 && <><dt>Attachments</dt><dd>{current.attachments.join(', ')} <span className="ad-muted">(sent to the owner email)</span></dd></>}
          </dl>
          <div style={{ marginTop: 20 }}><Confirm text="Delete this message?" onYes={async () => { const r = await db.remove('submissions', { id: current.id }, 'Deleted'); if (r.ok) setOpen(null) }}>Delete</Confirm></div>
        </Modal>
      )}
      {contact && <ContactDrawer id={contact} onClose={() => setContact(null)} />}
    </>
  )
}
