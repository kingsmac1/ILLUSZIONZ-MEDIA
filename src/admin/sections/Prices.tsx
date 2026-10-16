import { useState } from 'react'
import { flows } from '../../booking/catalog'
import { useData, useDb } from '../data'
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

  return (
    <>
      <PageHead title="Prices" sub="Change a package or add-on price once and it updates on every booking form, email and total" />
      <div className="ad-note" style={{ marginBottom: 18 }}>Prices set here apply to the <b>booking forms</b> and are re-checked on the server, so totals always match. Headline “from £…” text printed on the pages themselves is page content and is edited in the code.</div>
      {Object.values(flows).map((flow) => (
        <div className="ad-card" key={flow.id} style={{ marginBottom: 16 }}>
          <h3>{flow.title}<small>{flow.kind}</small></h3>
          <div className="ad-tablewrap" style={{ border: 0 }}>
            <table><thead><tr><th>Item</th><th>Type</th><th className="num">Standard</th><th style={{ width: 150 }}>Current price (£)</th><th /></tr></thead><tbody>
              {[...flow.options.map((o) => ({ kind: 'option' as const, id: o.id, label: o.label, note: o.note, price: o.price })), ...flow.extras.map((e) => ({ kind: 'extra' as const, id: e.id, label: e.label, note: e.note, price: e.price }))].map((it) => {
                const cur = ov(flow.id, it.kind, it.id)
                const key = k(flow.id, it.kind, it.id)
                const shown = drafts[key] ?? String(cur ? cur.price : it.price)
                const dirty = drafts[key] !== undefined
                return (
                  <tr key={key} style={cur?.active === false ? { opacity: .5 } : undefined}>
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
