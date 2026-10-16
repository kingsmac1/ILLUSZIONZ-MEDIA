import { useState } from 'react'
import { useData, useDb, type R } from '../data'
import { Badge, Empty, Field, Modal, PageHead } from '../ui'
import { homeTestimonials } from '../../cms/builtin'
import { ManagePanel } from './shared'

export function TestimonialsCms() {
  const { d } = useData()
  const db = useDb()
  const [edit, setEdit] = useState<R | 'new' | null>(null)
  const [f, setF] = useState<R>({})
  const open = (t: R | 'new') => { setEdit(t); setF(t === 'new' ? { quote: '', author: '', role: '', active: true } : { ...t }) }
  const set = (k: string, v: unknown) => setF((c) => ({ ...c, [k]: v }))
  async function save() {
    if (!f.quote?.trim() || !f.author?.trim()) return
    const row = { quote: f.quote.trim(), author: f.author.trim(), role: f.role ?? '', active: !!f.active, sort_order: f.sort_order ?? d.testimonials.length + 1 }
    const r = edit === 'new' ? await db.insert('testimonials', row, 'Testimonial added') : await db.update('testimonials', { id: f.id }, row, 'Saved')
    if (r.ok) setEdit(null)
  }
  const move = async (t: R, dir: -1 | 1) => {
    const i = d.testimonials.findIndex((x) => x.id === t.id)
    const o = d.testimonials[i + dir]
    if (!o) return
    await db.update('testimonials', { id: t.id }, { sort_order: o.sort_order })
    await db.update('testimonials', { id: o.id }, { sort_order: t.sort_order })
  }
  const featured = d.submissions.filter((s) => s.form_name === 'review' && s.featured && !d.testimonials.some((t) => t.quote === ((s.fields ?? []).find((x: R) => /review/i.test(x.label))?.value ?? '')))
  async function importFeatured() {
    const rows = featured.map((s, i) => ({ quote: (s.fields ?? []).find((x: R) => /review/i.test(x.label))?.value ?? '', author: s.name, role: 'Client', sort_order: d.testimonials.length + i + 1 })).filter((r) => r.quote)
    if (rows.length) await db.insert('testimonials', rows, `${rows.length} featured reviews added`)
  }
  return (
    <>
      <PageHead title="Testimonials" sub="The quotes in the home page slider" actions={<button className="ad-btn primary" onClick={() => open('new')}>+ Add testimonial</button>} />
      <ManagePanel keyName="testimonials" label="testimonials" count={d.testimonials.length} onImport={async () => { await db.insert('testimonials', homeTestimonials.map((t, i) => ({ ...t, sort_order: i + 1 }))) }} />
      {featured.length > 0 && <div className="ad-note" style={{ marginBottom: 14 }}>{featured.length} review{featured.length === 1 ? '' : 's'} you marked as “featured” in the Inbox {featured.length === 1 ? 'is' : 'are'} not in the slider yet. <button className="ad-btn sm" onClick={importFeatured}>Add them</button></div>}
      <div className="ad-grid c2">
        {d.testimonials.map((t, i) => (
          <div key={t.id} className="ad-card" style={{ opacity: t.active ? 1 : 0.55 }}>
            <p style={{ fontFamily: 'Playfair Display, serif', fontSize: 17, lineHeight: 1.6, marginBottom: 12 }}>“{t.quote}”</p>
            <p><b>{t.author}</b> <span className="ad-muted">{t.role}</span> {!t.active && <Badge tone="grey">hidden</Badge>}</p>
            <div className="ad-actions" style={{ marginTop: 12 }}><button className="ad-btn sm" onClick={() => open(t)}>Edit</button><button className="ad-btn sm" disabled={i === 0} onClick={() => move(t, -1)}>↑</button><button className="ad-btn sm" disabled={i === d.testimonials.length - 1} onClick={() => move(t, 1)}>↓</button><button className="ad-btn sm danger" onClick={() => window.confirm('Delete this testimonial?') && db.remove('testimonials', { id: t.id })}>✕</button></div>
          </div>
        ))}
      </div>
      {!d.testimonials.length && <Empty title="No testimonials yet" />}
      {edit && (
        <Modal title={edit === 'new' ? 'Add testimonial' : 'Edit testimonial'} onClose={() => setEdit(null)}>
          <div className="ad-form">
            <Field label="Quote *" full><textarea value={f.quote} onChange={(e) => set('quote', e.target.value)} autoFocus /></Field>
            <Field label="Name *"><input type="text" value={f.author} onChange={(e) => set('author', e.target.value)} /></Field>
            <Field label="Role / company"><input type="text" value={f.role} onChange={(e) => set('role', e.target.value)} /></Field>
            <label className="ad-check"><input type="checkbox" checked={!!f.active} onChange={(e) => set('active', e.target.checked)} />Show on the website</label>
            <div className="ad-formfoot"><button className="ad-btn" onClick={() => setEdit(null)}>Cancel</button><button className="ad-btn primary" onClick={save}>Save</button></div>
          </div>
        </Modal>
      )}
    </>
  )
}
