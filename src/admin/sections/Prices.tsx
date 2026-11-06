import { Fragment, useState } from 'react'
import { flows } from '../../booking/catalog'
import { useData, useDb } from '../data'
import { BulkBar, BulkBtn, BulkSelect, RowBox, SelectAllBox, confirmN, useSelection } from '../bulk'
import { Badge, PageHead, gbp } from '../ui'
import { PackageForm, useAddedPackages } from './AddedPackages'
import { CardPhotoStrip, cardPerPackage } from './CardPhotos'
import { NewPackageForm, useAddedServices } from './NewPackage'
import { WebsitePackages } from './WebsitePackages'
import { serviceFlowId, servicePhotoKey, type BookingService } from '../../booking/services'
import type { BookingPackage } from '../../booking/overrides'

export function Prices() {
  const { d } = useData()
  const db = useDb()
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const added = useAddedPackages()
  const [form, setForm] = useState<null | { flowId?: string; row?: BookingPackage }>(null)
  const services = useAddedServices()
  // "+ Add package": a new package card on a website page (Photography services, Wedding …) with its cover photo
  const [newPkg, setNewPkg] = useState<null | { service?: BookingService; pkg?: BookingPackage }>(null)
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

  // packages added to Photography services (e.g. Graduate Photography): their own price section, after Family
  const serviceSections = services.rows.filter((s) => s.page === 'photography').map((s) => {
        const fid = serviceFlowId(s)
        const opts = (s.options ?? []).map((o, n) => ({ o, n })).filter(({ o }) => o?.label?.trim())
        const own = (s.extras ?? []).map((e, n) => ({ e, n })).filter(({ e }) => e?.label?.trim())
        const std = s.standard_extras === false ? [] : flows.portrait.extras
        // a price line or add-on of the package itself: its price and "hidden" live on the package row
        const patch = (field: 'options' | 'extras', n: number, p: { price?: number; hidden?: boolean }) => {
          const list = ((s[field] ?? []) as Array<Record<string, unknown>>).map((x, i) => {
            if (i !== n) return x
            const next: Record<string, unknown> = { ...x, ...p }
            if (!next.hidden) delete next.hidden
            return next
          })
          return services.save({ [field]: list } as Partial<BookingService>, s.id)
        }
        const ownRow = (field: 'options' | 'extras', n: number, label: string, note: string | undefined, price: number, hidden: boolean) => {
          const key = `svc|${s.id}|${field}|${n}`
          const shown = drafts[key] ?? String(Number(price) || 0)
          const dirty = drafts[key] !== undefined
          return (
            <tr key={key} data-service-line style={hidden ? { opacity: .5 } : undefined}>
              <td className="sel" />
              <td><b>{label}</b><span className="sub">{note}</span></td>
              <td><Badge tone="grey">{field === 'options' ? 'package' : 'add-on'}</Badge></td>
              <td className="num"><span className="ad-muted">—</span></td>
              <td><input type="number" min="0" step="0.01" aria-label={`Price of ${label}`} value={shown} onChange={(e) => setDrafts({ ...drafts, [key]: e.target.value })} /></td>
              <td className="num" style={{ whiteSpace: 'nowrap' }}>
                {dirty && <button className="ad-btn primary sm" onClick={async () => {
                  const v = Number(drafts[key])
                  if (!Number.isFinite(v) || v < 0) return
                  if (await patch(field, n, { price: Math.round(v * 100) / 100 })) setDrafts((x) => { const c = { ...x }; delete c[key]; return c })
                }}>Save</button>}{' '}
                <button className="ad-btn sm" onClick={() => {
                  if (!hidden && field === 'options' && opts.filter(({ o }) => !o.hidden).length <= 1) { window.alert(`${s.title} needs at least one price line on show. Hide the whole package from “Packages on the website” instead.`); return }
                  patch(field, n, { hidden: !hidden })
                }}>{hidden ? 'Show' : 'Hide'}</button>
              </td>
            </tr>
          )
        }
        return (
          <div className="ad-card" key={s.id} data-service-prices={s.id} style={{ marginBottom: 16, ...(s.active ? {} : { opacity: .7 }) }}>
            <h3><span>{s.title} <Badge tone="blue">added</Badge>{!s.active && <> <Badge tone="grey">hidden</Badge></>}</span><span style={{ display: 'flex', alignItems: 'center', gap: 10 }}><small>{s.title} booking</small><button className="ad-btn sm" onClick={() => setNewPkg({ service: s })} aria-label={`Add a price option or add-on to ${s.title}`}>+ Add option</button></span></h3>
            <div className="ad-tablewrap" style={{ border: 0 }}>
              <table><thead><tr><th className="sel" /><th>Item</th><th>Type</th><th className="num">Standard</th><th style={{ width: 150 }}>Current price (£)</th><th /></tr></thead><tbody>
                {opts.map(({ o, n }) => ownRow('options', n, o.label, o.note, Number(o.price), o.hidden === true))}
                {own.map(({ e, n }) => ownRow('extras', n, e.label, [e.note, Number(e.max) > 1 ? `up to ${e.max}` : ''].filter(Boolean).join(' · '), Number(e.price), e.hidden === true))}
                {std.map((e) => {
                  const cur = ov(fid, 'extra', e.id)
                  const key = k(fid, 'extra', e.id)
                  const shown = drafts[key] ?? String(cur ? cur.price : e.price)
                  const dirty = drafts[key] !== undefined
                  return (
                    <tr key={key} style={cur?.active === false ? { opacity: .5 } : undefined}>
                      <td className="sel" />
                      <td><b>{e.label}</b><span className="sub">{e.note}</span></td>
                      <td><Badge tone="grey">add-on</Badge></td>
                      <td className="num">{e.price ? gbp(e.price) : 'Quoted'}</td>
                      <td><input type="number" value={shown} onChange={(ev) => setDrafts({ ...drafts, [key]: ev.target.value })} /></td>
                      <td className="num" style={{ whiteSpace: 'nowrap' }}>
                        {dirty && <button className="ad-btn primary sm" onClick={() => save(fid, 'extra', e.id, e.price)}>Save</button>}{' '}
                        <button className="ad-btn sm" onClick={() => toggle(fid, 'extra', e.id, e.price)}>{cur?.active === false ? 'Show' : 'Hide'}</button>{' '}
                        {cur && <button className="ad-btn sm" onClick={() => reset(fid, 'extra', e.id)}>Reset</button>}
                      </td>
                    </tr>
                  )
                })}
              </tbody></table>
            </div>
            <CardPhotoStrip flowId={fid} added={[]} cards={[{ key: servicePhotoKey(s), title: s.title, original: '', added: true }]} />
          </div>
        )
      })

  return (
    <>
      <PageHead title="Prices" sub="Change a package or add-on price once and it updates on every booking form, email and total" actions={<button className="ad-btn primary" onClick={() => setNewPkg({})}>+ Add package</button>} />
      {(added.error || services.error) && <div className="ad-note" style={{ marginBottom: 14 }} role="alert">{services.error || added.error}</div>}
      <WebsitePackages
        services={services.rows} added={added.rows}
        onEditService={(s) => setNewPkg({ service: s })}
        onToggleService={(s) => services.setActive(s.id, !s.active)}
        onDeleteService={(s) => { if (window.confirm(`Delete ${s.title} from the Photography services page? Bookings already made keep it.`)) services.remove(s.id) }}
        onEditAdded={(r) => setNewPkg({ pkg: r })}
        onToggleAdded={(r) => added.setActive(r.id, !r.active)}
        onDeleteAdded={(r) => { if (window.confirm(`Delete ${r.label}? Bookings already made keep it.`)) added.remove(r.id) }}
      />
      <div className="ad-note" style={{ marginBottom: 18 }}>Prices set here apply to the <b>booking forms</b> and are re-checked on the server, so totals always match. Headline “from £…” text printed on the pages themselves is page content and is edited in the code. Packages you add with <b>+ Add package</b> appear on the page’s price cards and its booking form.</div>
      <BulkBar s={sel} noun="item">
        <BulkBtn onClick={() => bulkActive(false)}>Hide</BulkBtn>
        <BulkBtn onClick={() => bulkActive(true)}>Show</BulkBtn>
        <BulkSelect label="Adjust price" options={[{ value: '10', label: '+10%' }, { value: '5', label: '+5%' }, { value: '-5', label: '−5%' }, { value: '-10', label: '−10%' }, { value: '-20', label: '−20%' }]} onPick={bulkPct} />
        <BulkBtn danger onClick={bulkReset}>Reset to standard</BulkBtn>
      </BulkBar>
      {Object.values(flows).map((flow) => (
        <Fragment key={flow.id}>
        <div className="ad-card" style={{ marginBottom: 16 }}>
          <h3>{flow.title}<span style={{ display: 'flex', alignItems: 'center', gap: 10 }}><small>{flow.kind}</small>{flow.id !== 'store' && <button className="ad-btn sm" onClick={() => setForm({ flowId: flow.id })} aria-label={`Add a price option or add-on to ${flow.title}`}>+ Add option</button>}</span></h3>
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
              {added.rows.filter((r) => r.flow_id === flow.id).sort((x, y) => (x.kind === y.kind ? (Number(x.sort_order) || 0) - (Number(y.sort_order) || 0) : x.kind === 'option' ? -1 : 1)).map((r) => {
                const key = `added|${r.id}`
                const shown = drafts[key] ?? String(Number(r.price) || 0)
                const dirty = drafts[key] !== undefined
                return (
                  <tr key={key} data-added-package style={!r.active ? { opacity: .5 } : undefined}>
                    <td className="sel" />
                    <td><b>{r.label}</b><span className="sub">{[r.note, r.unit?.label ? `per ${r.unit.label}` : '', r.max_qty ? `up to ${r.max_qty}` : ''].filter(Boolean).join(' · ')}</span></td>
                    <td><Badge tone="grey">{r.kind === 'option' ? 'package' : 'add-on'}</Badge> <Badge tone="blue">added</Badge></td>
                    <td className="num"><span className="ad-muted">—</span></td>
                    <td><input type="number" min="0" step="0.01" aria-label={`Price of ${r.label}`} value={shown} onChange={(e) => setDrafts({ ...drafts, [key]: e.target.value })} /></td>
                    <td className="num" style={{ whiteSpace: 'nowrap' }}>
                      {dirty && <button className="ad-btn primary sm" onClick={async () => {
                        const v = Number(drafts[key])
                        if (!Number.isFinite(v) || v < 0) return
                        if (await added.setPrice(r.id, Math.round(v * 100) / 100)) setDrafts((x) => { const n = { ...x }; delete n[key]; return n })
                      }}>Save</button>}{' '}
                      <button className="ad-btn sm" onClick={() => (r.kind === 'option' && cardPerPackage(r.flow_id) ? setNewPkg({ pkg: r }) : setForm({ row: r }))}>Edit</button>{' '}
                      <button className="ad-btn sm" onClick={() => added.setActive(r.id, !r.active)}>{r.active ? 'Hide' : 'Show'}</button>{' '}
                      <button className="ad-btn sm danger" onClick={() => { if (window.confirm(`Delete ${r.label} from ${flow.title}? Bookings already made keep it.`)) added.remove(r.id) }}>Delete</button>
                    </td>
                  </tr>
                )
              })}
            </tbody></table>
          </div>
          <CardPhotoStrip flowId={flow.id} added={added.rows} />
        </div>
        {flow.id === 'family' && serviceSections}
        </Fragment>
      ))}
      {form && <PackageForm initial={form.row} flowId={form.flowId} rows={added.rows} onSave={added.save} onClose={() => setForm(null)} />}
      {newPkg && <NewPackageForm service={newPkg.service} pkg={newPkg.pkg} services={services.rows} packages={added.rows} onSaveService={services.save} onSavePackage={added.save} onClose={() => setNewPkg(null)} />}
    </>
  )
}
