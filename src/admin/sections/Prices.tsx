import { useState } from 'react'
import { flows } from '../../booking/catalog'
import { useData, useDb } from '../data'
import { BulkBar, BulkBtn, BulkSelect, RowBox, SelectAllBox, confirmN, useSelection } from '../bulk'
import { Badge, PageHead, gbp } from '../ui'

export function Prices() {
  const { d } = useData()
  const db = useDb()
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const ov = (flow: string, kind: string, id: string) => d.price_overrides.find((o) => o.flow_id === flow && o.kind === kind && o.item_id === id)
  const k = (a: string, b: string, c: string) => `${a}|${b}|${c}`

  async function save(flow: string, kind: 'option' | 'extra', id: string, base: number) {
    const key = k(flow, kind, id)
    const cur = ov(flow, kind, id)
    const price = drafts[key] !== undefined ? Number(drafts[key]) : cur ? Number(cur.price) : base
    await db.upsert('price_overrides', { flow_id: flow, kind, item_id: id, price, active: cur ? cur.active : true, updated_at: new Date().toISOString() }, 'flow_id,kind,item_id', 'Price saved — live on the booking forms')
    setDrafts((x) => { const n = { ...x }; delete n[key]; return n })
  }
  async function toggle(flow: string, kind: 'option' | 'extra', id: string, base: number) {
    const cur = ov(flow, kind, id)
    await db.upsert('price_overrides', { flow_id: flow, kind, item_id: id, price: cur ? cur.price : base, active: cur ? !cur.active : false, updated_at: new Date().toISOString() }, 'flow_id,kind,item_id', cur?.active === false ? 'Shown again' : 'Hidden from the booking form')
  }
  const reset = (flow: string, kind: string, id: string) => db.remove('price_overrides', { flow_id: flow, kind, item_id: id }, 'Reset to the standard price')

  type Item = { flow: string; kind: 'option' | 'extra'; id: string; price: number; key: string }
  const items: Item[] = Object.values(flows).flatMap((fl) => [...fl.options.map((o) => ({ flow: fl.id, kind: 'option' as const, id: o.id, price: o.price })), ...fl.extras.map((e) => ({ flow: fl.id, kind: 'extra' as const, id: e.id, price: e.price }))].map((x) => ({ ...x, key: k(fl.id, x.kind, x.id) })))
  const sel = useSelection(items.map((x) => x.key))
  const picked = () => items.filter((x) => sel.has(x.key))
  const now = () => new Date().toISOString()
  const current = (x: Item) => ov(x.flow, x.kind, x.id)
  const rowFor = (x: Item, patch: { price?: number; active?: boolean }) => { const cur = current(x); return { flow_id: x.flow, kind: x.kind, item_id: x.id, price: patch.price ?? (cur ? Number(cur.price) : x.price), active: patch.active ?? (cur ? cur.active : true), updated_at: now() } }
  const bulkActive = (active: boolean) => db.upsert('price_overrides', picked().map((x) => rowFor(x, { active })), 'flow_id,kind,item_id', active ? `${sel.count} shown on the booking forms` : `${sel.count} hidden from the booking forms`)
  const bulkPct = (v: string) => {
    const pct = Number(v)
    if (!confirmN(pct > 0 ? `Raise the price of` : `Lower the price of`, sel.count, 'item', `By ${Math.abs(pct)}% (quoted items with no price are skipped).`)) return
    const rows = picked().map((x) => ({ x, base: current(x) ? Number(current(x)!.price) : x.price })).filter((r) => r.base > 0).map((r) => rowFor(r.x, { price: Math.max(0, Math.round(r.base * (1 + pct / 100))) }))
    return db.upsert('price_overrides', rows, 'flow_id,kind,item_id', `${rows.length} prices updated`)
  }
  async function bulkReset() {
    const withOv = picked().filter(current)
    if (!withOv.length) return
    if (!confirmN('Reset', withOv.length, 'price', 'Back to the standard price and visible.')) return
    // composite primary key, so rows are removed one by one; only the last one announces itself
    for (let i = 0; i < withOv.length; i++) {
      const x = withOv[i]
      const r = await db.remove('price_overrides', { flow_id: x.flow, kind: x.kind, item_id: x.id }, i === withOv.length - 1 ? 'Reset to the standard prices' : undefined)
      if (!r.ok) return
    }
    sel.clear()
  }

  return (
    <>
      <PageHead title="Prices" sub="Change a package or add-on price once and it updates on every booking form, email and total" />
      <div className="ad-note" style={{ marginBottom: 18 }}>Prices set here apply to the <b>booking forms</b> and are re-checked on the server, so totals always match. Headline “from £…” text printed on the pages themselves is page content and is edited in the code.</div>
      <BulkBar s={sel} noun="item">
        <BulkBtn onClick={() => bulkActive(false)}>Hide</BulkBtn>
        <BulkBtn onClick={() => bulkActive(true)}>Show</BulkBtn>
        <BulkSelect label="Adjust price" options={[{ value: '10', label: '+10%' }, { value: '5', label: '+5%' }, { value: '-5', label: '−5%' }, { value: '-10', label: '−10%' }, { value: '-20', label: '−20%' }]} onPick={bulkPct} />
        <BulkBtn danger onClick={bulkReset}>Reset to standard</BulkBtn>
      </BulkBar>
      {Object.values(flows).map((flow) => (
        <div className="ad-card" key={flow.id} style={{ marginBottom: 16 }}>
          <h3>{flow.title}<small>{flow.kind}</small></h3>
          <div className="ad-tablewrap" style={{ border: 0 }}>
            <table><thead><tr><th className="sel"><SelectAllBox s={sel} view={items.filter((x) => x.flow === flow.id).map((x) => x.key)} /></th><th>Item</th><th>Type</th><th className="num">Standard</th><th style={{ width: 150 }}>Current price (£)</th><th /></tr></thead><tbody>
              {[...flow.options.map((o) => ({ kind: 'option' as const, id: o.id, label: o.label, note: o.note, price: o.price })), ...flow.extras.map((e) => ({ kind: 'extra' as const, id: e.id, label: e.label, note: e.note, price: e.price }))].map((it) => {
                const cur = ov(flow.id, it.kind, it.id)
                const key = k(flow.id, it.kind, it.id)
                const shown = drafts[key] ?? String(cur ? cur.price : it.price)
                const dirty = drafts[key] !== undefined
                return (
                  <tr key={key} className={sel.has(key) ? 'picked' : ''} style={cur?.active === false ? { opacity: .5 } : undefined}>
                    <td className="sel"><RowBox s={sel} id={key} label={it.label} /></td>
                    <td><b>{it.label}</b><span className="sub">{it.note}</span></td>
                    <td><Badge tone="grey">{it.kind === 'option' ? 'package' : 'add-on'}</Badge></td>
                    <td className="num">{it.price ? gbp(it.price) : 'Quoted'}</td>
                    <td><input type="number" value={shown} onChange={(e) => setDrafts({ ...drafts, [key]: e.target.value })} /></td>
                    <td className="num" style={{ whiteSpace: 'nowrap' }}>
                      {dirty && <button className="ad-btn primary sm" onClick={() => save(flow.id, it.kind, it.id, it.price)}>Save</button>}{' '}
                      <button className="ad-btn sm" onClick={() => toggle(flow.id, it.kind, it.id, it.price)}>{cur?.active === false ? 'Show' : 'Hide'}</button>{' '}
                      {cur && <button className="ad-btn sm" onClick={() => reset(flow.id, it.kind, it.id)}>Reset</button>}
                    </td>
                  </tr>
                )
              })}
            </tbody></table>
          </div>
        </div>
      ))}
    </>
  )
}
