import { useState } from 'react'
import { pages } from '../../seo'
import { useData, useDb, type R } from '../data'
import { BulkBar, BulkBtn, RowBox, SelectAllBox, confirmN, useSelection } from '../bulk'
import { Badge, Field, Modal, PageHead } from '../ui'
import { Counter, ImageField } from './shared'

export function SeoCms() {
  const { d } = useData()
  const db = useDb()
  const [edit, setEdit] = useState<string | null>(null)
  const [f, setF] = useState<R>({})
  const list = Object.values(pages)
  const sel = useSelection(list.map((p) => p.path))
  const setNoindex = (on: boolean) => db.upsert('page_seo', sel.ids.map((path) => { const o = d.page_seo.find((x) => x.path === path); return { path, title: o?.title ?? '', description: o?.description ?? '', og_image: o?.og_image ?? '', noindex: on, updated_at: new Date().toISOString() } }), 'path', on ? `${sel.count} hidden from search engines` : `${sel.count} visible to search engines`)
  async function resetSel() {
    const have = sel.ids.filter((path) => d.page_seo.some((x) => x.path === path))
    if (!have.length) return
    if (!confirmN('Reset', have.length, 'page', 'Back to the built-in title, description and image.')) return
    const r = await db.removeMany('page_seo', have, `${have.length} reset to built-in`, [], 'path')
    if (r.ok) sel.clear()
  }
  const open = (path: string) => { const row = d.page_seo.find((p) => p.path === path); setEdit(path); setF({ title: '', description: '', og_image: '', noindex: false, ...row }) }
  const set = (k: string, v: unknown) => setF((c) => ({ ...c, [k]: v }))
  const base = edit ? list.find((p) => p.path === edit) : null
  async function save() {
    const row = { path: edit, title: f.title, description: f.description, og_image: f.og_image, noindex: !!f.noindex, updated_at: new Date().toISOString() }
    const r = await db.upsert('page_seo', row, 'path', 'SEO saved — live within a minute')
    if (r.ok) setEdit(null)
  }
  return (
    <>
      <PageHead title="Page SEO" sub="Override the Google title, description and share image of any page — applied instantly, no rebuild" />
      <BulkBar s={sel} noun="page">
        <BulkBtn onClick={() => setNoindex(true)}>Noindex</BulkBtn>
        <BulkBtn onClick={() => setNoindex(false)}>Allow indexing</BulkBtn>
        <BulkBtn danger onClick={resetSel}>Reset to built-in</BulkBtn>
      </BulkBar>
      <div className="ad-tablewrap"><table><thead><tr><th className="sel"><SelectAllBox s={sel} view={list.map((p) => p.path)} /></th><th>Page</th><th>Title in Google</th><th>Status</th><th /></tr></thead><tbody>
        {list.map((p) => {
          const o = d.page_seo.find((x) => x.path === p.path)
          const changed = o && (o.title || o.description || o.og_image || o.noindex)
          return (
            <tr key={p.path} className={sel.has(p.path) ? 'picked' : ''}>
              <td className="sel"><RowBox s={sel} id={p.path} label={p.path} /></td>
              <td><b>{p.path}</b></td>
              <td style={{ maxWidth: 420 }}>{o?.title || p.title}<span className="sub">{(o?.description || p.description).slice(0, 110)}…</span></td>
              <td>{changed ? <Badge tone="blue">customised</Badge> : <Badge tone="grey">built-in</Badge>} {o?.noindex && <Badge tone="red">noindex</Badge>}</td>
              <td className="num"><button className="ad-btn sm" onClick={() => open(p.path)}>Edit</button></td>
            </tr>
          )
        })}
      </tbody></table></div>
      <p className="ad-muted" style={{ marginTop: 12 }}>Blog posts have their own SEO settings inside each post. The sitemap at /sitemap.xml updates automatically.</p>
      {edit && base && (
        <Modal wide title={`SEO — ${edit}`} onClose={() => setEdit(null)}>
          <div className="ad-form" style={{ gridTemplateColumns: '1fr' }}>
            <Field label="Title" hint={`Built-in: ${base.title}`}><input type="text" value={f.title} onChange={(e) => set('title', e.target.value)} placeholder={base.title} /><Counter value={f.title || base.title} min={30} max={60} /></Field>
            <Field label="Description" hint={`Built-in: ${base.description}`}><textarea value={f.description} onChange={(e) => set('description', e.target.value)} placeholder={base.description} /><Counter value={f.description || base.description} min={120} max={160} /></Field>
            <ImageField label="Share image" hint="Leave empty to keep the default (1200×630)." value={f.og_image} onChange={(u) => set('og_image', u)} />
            <label className="ad-check"><input type="checkbox" checked={!!f.noindex} onChange={(e) => set('noindex', e.target.checked)} />Hide this page from search engines (noindex)</label>
            <div className="ad-card"><h3>Google preview</h3><div style={{ fontFamily: 'Arial, sans-serif' }}><div style={{ color: '#202124', fontSize: 13 }}>illuszionzmedia.com{edit}</div><div style={{ color: '#1a0dab', fontSize: 20 }}>{(f.title || base.title).slice(0, 62)}</div><div style={{ color: '#4d5156', fontSize: 14 }}>{(f.description || base.description).slice(0, 165)}</div></div></div>
            <div className="ad-formfoot"><button className="ad-btn" onClick={() => db.remove('page_seo', { path: edit }, 'Reset to built-in').then(() => setEdit(null))}>Reset to built-in</button><button className="ad-btn primary" onClick={save}>Save</button></div>
          </div>
        </Modal>
      )}
    </>
  )
}
