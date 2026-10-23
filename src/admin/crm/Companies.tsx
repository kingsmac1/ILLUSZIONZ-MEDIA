import { useState } from 'react'
import { useData, useDb, type R } from '../data'
import { Empty, Field, Modal, PageHead, gbp } from '../ui'
import { ContactDrawer } from './ContactDrawer'
import { contactStats } from './shared'
import { BulkBar, BulkBtn, RowBox, confirmN, useSelection } from '../bulk'

export function Companies() {
  const { d } = useData()
  const db = useDb()
  const [edit, setEdit] = useState<R | 'new' | null>(null)
  const [f, setF] = useState<R>({})
  const sel = useSelection(d.companies.map((c) => c.id))
  const [contact, setContact] = useState<string | null>(null)
  const open = (c: R | 'new') => { setEdit(c); setF(c === 'new' ? { name: '', website: '', industry: '', phone: '', email: '', address: '', notes: '' } : c) }
  const set = (k: string, v: string) => setF((c) => ({ ...c, [k]: v }))
  async function save() {
    if (!f.name?.trim()) return
    const row = { name: f.name.trim(), website: f.website, industry: f.industry, phone: f.phone, email: f.email, address: f.address, notes: f.notes }
    const r = edit === 'new' ? await db.insert('companies', row, 'Company added') : await db.update('companies', { id: f.id }, row, 'Company saved')
    if (r.ok) setEdit(null)
  }
  return (
    <>
      <PageHead title="Companies" sub="Brands, venues, planners and agencies you work with" actions={<button className="ad-btn primary" onClick={() => open('new')}>+ Add company</button>} />
      <BulkBar s={sel} noun="company">
        <BulkBtn danger onClick={async () => { if (confirmN('Delete', sel.count, 'company', 'Their contacts are kept.')) { const r = await db.removeMany('companies', sel.ids, `${sel.count} compan${sel.count === 1 ? 'y' : 'ies'} deleted`, ['contacts']); if (r.ok) sel.clear() } }}>Delete</BulkBtn>
      </BulkBar>
      {d.companies.length > 0 && !sel.count && <p style={{ margin: '0 0 10px' }}><button type="button" className="ad-link" onClick={sel.selectAll}>Select all</button></p>}
      <div className="ad-grid c3">
        {d.companies.map((c) => {
          const people = d.contacts.filter((p) => p.company_id === c.id)
          const value = people.reduce((s, p) => s + contactStats(p, d.bookings).spent, 0)
          return (
            <div key={c.id} className={'ad-card' + (sel.has(c.id) ? ' picked' : '')} style={{ position: 'relative' }}>
              <span className="ad-pick"><RowBox s={sel} id={c.id} label={c.name} /></span>
              <h3 style={{ paddingLeft: 34 }}>{c.name}<button className="ad-btn sm" onClick={() => open(c)}>Edit</button></h3>
              <p className="ad-muted">{c.industry || 'No industry'}{c.website ? ` · ${c.website}` : ''}</p>
              <p style={{ margin: '10px 0' }}><b>{gbp(value)}</b> <span className="ad-muted">from {people.length} contact{people.length === 1 ? '' : 's'}</span></p>
              <div className="ad-tags">{people.map((p) => <a key={p.id} className="ad-tag" href="#" onClick={(e) => { e.preventDefault(); setContact(p.id) }}>{p.name}</a>)}</div>
            </div>
          )
        })}
      </div>
      {!d.companies.length && <Empty title="No companies yet" hint="Link a contact to a company from their Details tab." />}
      {edit && (
        <Modal title={edit === 'new' ? 'Add company' : 'Edit company'} onClose={() => setEdit(null)}>
          <div className="ad-form">
            <Field label="Name *" full><input type="text" value={f.name ?? ''} onChange={(e) => set('name', e.target.value)} autoFocus /></Field>
            <Field label="Industry"><input type="text" value={f.industry ?? ''} onChange={(e) => set('industry', e.target.value)} /></Field>
            <Field label="Website"><input type="text" value={f.website ?? ''} onChange={(e) => set('website', e.target.value)} /></Field>
            <Field label="Phone"><input type="tel" value={f.phone ?? ''} onChange={(e) => set('phone', e.target.value)} /></Field>
            <Field label="Email"><input type="email" value={f.email ?? ''} onChange={(e) => set('email', e.target.value)} /></Field>
            <Field label="Address" full><input type="text" value={f.address ?? ''} onChange={(e) => set('address', e.target.value)} /></Field>
            <Field label="Notes" full><textarea value={f.notes ?? ''} onChange={(e) => set('notes', e.target.value)} /></Field>
            <div className="ad-formfoot">
              {edit !== 'new' && <button className="ad-btn danger" onClick={async () => window.confirm('Delete this company? Its contacts are kept.') && (await db.remove('companies', { id: f.id }, 'Company deleted', ['contacts'])).ok && setEdit(null)}>Delete</button>}
              <button className="ad-btn" onClick={() => setEdit(null)}>Cancel</button><button className="ad-btn primary" onClick={save}>Save</button>
            </div>
          </div>
        </Modal>
      )}
      {contact && <ContactDrawer id={contact} onClose={() => setContact(null)} />}
    </>
  )
}
