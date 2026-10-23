import { useState } from 'react'
import { useData, useDb, type R } from '../data'
import { BulkBar, BulkBtn, BulkSelect, RowBox, confirmN, useSelection } from '../bulk'
import { Badge, Empty, Field, Modal, PageHead } from '../ui'
import { builtinStore } from '../../cms/builtin'
import { ImageField, ManagePanel } from './shared'

function ProductModal({ product, onClose }: { product?: R; onClose: () => void }) {
  const { d } = useData()
  const db = useDb()
  const [f, setF] = useState<R>({ title: '', description: '', image_url: '', price: '', price_note: '', cta: 'Buy now', flow_id: '', option_id: '', buy_url: '', active: true, ...product })
  const [bullets, setBullets] = useState<string>((product?.bullets ?? []).join('\n'))
  const set = (k: string, v: unknown) => setF((c) => ({ ...c, [k]: v }))
  const kind = f.flow_id ? 'booking' : 'link'
  async function save() {
    if (!f.title.trim()) return
    const row = { title: f.title.trim(), description: f.description, bullets: bullets.split('\n').map((b) => b.trim()).filter(Boolean), image_url: f.image_url, price: f.price, price_note: f.price_note, cta: f.cta || 'Buy now', flow_id: f.flow_id, option_id: f.flow_id ? f.option_id : '', buy_url: f.flow_id ? '' : f.buy_url, active: !!f.active, sort_order: product?.sort_order ?? d.store_products.length + 1 }
    const r = product ? await db.update('store_products', { id: product.id }, row, 'Product saved') : await db.insert('store_products', row, 'Product added')
    if (r.ok) onClose()
  }
  return (
    <Modal wide title={product ? 'Edit product' : 'New product'} onClose={onClose}>
      <div className="ad-form">
        <Field label="Title *" full><input type="text" value={f.title} onChange={(e) => set('title', e.target.value)} autoFocus /></Field>
        <Field label="Description" full><textarea value={f.description} onChange={(e) => set('description', e.target.value)} /></Field>
        <Field label="Bullet points" hint="One per line" full><textarea style={{ minHeight: 120 }} value={bullets} onChange={(e) => setBullets(e.target.value)} /></Field>
        <ImageField label="Image" value={f.image_url} onChange={(u) => set('image_url', u)} />
        <Field label="Price (as shown)"><input type="text" value={f.price} onChange={(e) => set('price', e.target.value)} placeholder="£25" /></Field>
        <Field label="Price note"><input type="text" value={f.price_note} onChange={(e) => set('price_note', e.target.value)} placeholder="45 minute session" /></Field>
        <Field label="Button text"><input type="text" value={f.cta} onChange={(e) => set('cta', e.target.value)} /></Field>
        <Field label="Button does"><select value={kind} onChange={(e) => set('flow_id', e.target.value === 'booking' ? 'store' : '')}><option value="link">Opens a link (e.g. Selar checkout)</option><option value="booking">Opens the booking form</option></select></Field>
        {kind === 'link' ? <Field label="Link" full><input type="text" value={f.buy_url} onChange={(e) => set('buy_url', e.target.value)} placeholder="https://selar.com/…" /></Field> : <Field label="Booking option id" hint="store-session is the built-in 45-minute session" full><input type="text" value={f.option_id} onChange={(e) => set('option_id', e.target.value)} /></Field>}
        <label className="ad-check"><input type="checkbox" checked={!!f.active} onChange={(e) => set('active', e.target.checked)} />Show on the website</label>
        <div className="ad-formfoot">
          {product && <button className="ad-btn danger" onClick={async () => window.confirm('Delete this product?') && (await db.remove('store_products', { id: product.id }, 'Deleted')).ok && onClose()}>Delete</button>}
          <button className="ad-btn" onClick={onClose}>Cancel</button><button className="ad-btn primary" onClick={save}>Save product</button>
        </div>
      </div>
    </Modal>
  )
}

export function StoreCms() {
  const { d } = useData()
  const db = useDb()
  const [edit, setEdit] = useState<R | 'new' | null>(null)
  const sel = useSelection(d.store_products.map((p) => p.id))
  const move = async (p: R, dir: -1 | 1) => {
    const i = d.store_products.findIndex((x) => x.id === p.id)
    const o = d.store_products[i + dir]
    if (!o) return
    await db.update('store_products', { id: p.id }, { sort_order: o.sort_order })
    await db.update('store_products', { id: o.id }, { sort_order: p.sort_order })
  }
  return (
    <>
      <PageHead title="Store" sub="The products on /store/" actions={<><a className="ad-btn" href="/store/" target="_blank" rel="noreferrer">View page ↗</a><button className="ad-btn primary" onClick={() => setEdit('new')}>+ Add product</button></>} />
      <ManagePanel keyName="store" label="store" count={d.store_products.length} onImport={async () => { await db.insert('store_products', builtinStore.map((p, i) => ({ ...p, sort_order: i + 1 }))) }} />
      <BulkBar s={sel} noun="product">
        <BulkBtn onClick={() => db.updateMany('store_products', sel.ids, { active: true }, `${sel.count} shown on the website`)}>Show</BulkBtn>
        <BulkBtn onClick={() => db.updateMany('store_products', sel.ids, { active: false }, `${sel.count} hidden from the website`)}>Hide</BulkBtn>
        <BulkBtn danger onClick={async () => { if (confirmN('Delete', sel.count, 'product')) { const r = await db.removeMany('store_products', sel.ids, `${sel.count} deleted`); if (r.ok) sel.clear() } }}>Delete</BulkBtn>
      </BulkBar>
      {d.store_products.length > 0 && !sel.count && <p style={{ margin: '0 0 10px' }}><button type="button" className="ad-link" onClick={sel.selectAll}>Select all</button></p>}
      <div className="ad-grid c2">
        {d.store_products.map((p, i) => (
          <div key={p.id} className={'ad-card' + (sel.has(p.id) ? ' picked' : '')} style={{ opacity: p.active ? 1 : 0.55, position: 'relative' }}>
            <span className="ad-pick"><RowBox s={sel} id={p.id} label={p.title} /></span>
            <div style={{ display: 'flex', gap: 14 }}>
              {p.image_url && <img src={p.image_url} alt="" style={{ width: 96, height: 96, borderRadius: 10, objectFit: 'cover', flex: 'none' }} />}
              <div style={{ minWidth: 0, flex: 1 }}>
                <h3 style={{ marginBottom: 4 }}>{p.title}</h3>
                <p className="ad-muted" style={{ marginBottom: 8 }}>{p.price ? <b style={{ color: '#000' }}>{p.price}</b> : 'No price'} {p.price_note} · {p.flow_id ? 'booking form' : p.buy_url ? 'external link' : 'no link yet'} {!p.active && <Badge tone="grey">hidden</Badge>}</p>
                <div className="ad-actions"><button className="ad-btn sm" onClick={() => setEdit(p)}>Edit</button><button className="ad-btn sm" disabled={i === 0} onClick={() => move(p, -1)}>↑</button><button className="ad-btn sm" disabled={i === d.store_products.length - 1} onClick={() => move(p, 1)}>↓</button></div>
              </div>
            </div>
          </div>
        ))}
      </div>
      {!d.store_products.length && <Empty title="No products yet" hint="Use “Start managing” above to import the current store product, or add your own." />}
      {edit && <ProductModal product={edit === 'new' ? undefined : edit} onClose={() => setEdit(null)} />}
    </>
  )
}
