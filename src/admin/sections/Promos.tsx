import { useState } from 'react'
import { flows } from '../../booking/catalog'
import { useData, useDb, type R } from '../data'
import { BulkBar, BulkBtn, RowBox, SelectAllBox, confirmN, useSelection } from '../bulk'
import { Badge, Empty, Field, Modal, PageHead, fmtDate, gbp } from '../ui'

export function Promos() {
  const { d } = useData()
  const db = useDb()
  const [edit, setEdit] = useState<R | 'new' | null>(null)
  const [f, setF] = useState<R>({})
  const open = (p: R | 'new') => { setEdit(p); setF(p === 'new' ? { code: '', description: '', kind: 'percent', value: '', flows: [], starts_on: '', expires_on: '', max_uses: '', active: true } : { ...p, kind: p.percent_off != null ? 'percent' : 'amount', value: p.percent_off ?? p.amount_off, max_uses: p.max_uses ?? '', starts_on: p.starts_on ?? '', expires_on: p.expires_on ?? '' }) }
  const set = (k: string, v: unknown) => setF((c) => ({ ...c, [k]: v }))
  async function save() {
    const code = String(f.code).trim().toUpperCase().replace(/\s+/g, '')
    if (!code || !Number(f.value)) return
    const row = { code, description: f.description, percent_off: f.kind === 'percent' ? Number(f.value) : null, amount_off: f.kind === 'amount' ? Number(f.value) : null, flows: f.flows, active: !!f.active, starts_on: f.starts_on || null, expires_on: f.expires_on || null, max_uses: f.max_uses ? Number(f.max_uses) : null }
    const r = edit === 'new' ? await db.insert('promo_codes', row, 'Promo code created') : await db.update('promo_codes', { code: f.code }, row, 'Promo code saved')
    if (r.ok) setEdit(null)
  }
  const sel = useSelection(d.promo_codes.map((p) => p.code))
  const status = (p: R) => !p.active ? 'paused' : p.expires_on && p.expires_on < new Date().toISOString().slice(0, 10) ? 'expired' : p.max_uses != null && p.used >= p.max_uses ? 'used up' : 'live'
  return (
    <>
      <PageHead title="Promo codes" sub="Clients type these on the last step of any booking form" actions={<button className="ad-btn primary" onClick={() => open('new')}>+ New code</button>} />
      <div className="ad-tablewrap"><BulkBar s={sel} noun="code"><BulkBtn onClick={() => db.updateMany('promo_codes', sel.ids, { active: true }, `${sel.count} activated`, [], 'code')}>Activate</BulkBtn><BulkBtn onClick={() => db.updateMany('promo_codes', sel.ids, { active: false }, `${sel.count} paused`, [], 'code')}>Pause</BulkBtn><BulkBtn danger onClick={async () => { if (confirmN('Delete', sel.count, 'promo code')) { const r = await db.removeMany('promo_codes', sel.ids, `${sel.count} deleted`, [], 'code'); if (r.ok) sel.clear() } }}>Delete</BulkBtn></BulkBar><table><thead><tr><th className="sel"><SelectAllBox s={sel} view={d.promo_codes.map((p) => p.code)} /></th><th>Code</th><th>Discount</th><th>Applies to</th><th>Valid</th><th className="num">Used</th><th>Status</th><th /></tr></thead><tbody>
        {d.promo_codes.map((p) => (
          <tr key={p.code} className={sel.has(p.code) ? 'picked' : ''}><td className="sel"><RowBox s={sel} id={p.code} label={p.code} /></td><td><b>{p.code}</b><span className="sub">{p.description}</span></td><td><b>{p.percent_off != null ? `${p.percent_off}% off` : `${gbp(p.amount_off)} off`}</b></td>
            <td>{p.flows?.length ? p.flows.map((x: string) => flows[x]?.title ?? x).join(', ') : 'Every service'}</td><td className="ad-muted">{p.starts_on ? fmtDate(p.starts_on) : 'now'} → {p.expires_on ? fmtDate(p.expires_on) : 'no end'}</td>
            <td className="num">{p.used}{p.max_uses != null ? ` / ${p.max_uses}` : ''}</td><td><Badge tone={status(p) === 'live' ? 'green' : 'grey'}>{status(p)}</Badge></td>
            <td className="num"><button className="ad-btn sm" onClick={() => open(p)}>Edit</button> <button className="ad-btn sm danger" onClick={() => window.confirm(`Delete ${p.code}?`) && db.remove('promo_codes', { code: p.code }, 'Deleted')}>✕</button></td></tr>
        ))}
      </tbody></table>{!d.promo_codes.length && <Empty title="No promo codes yet" hint="Create a code like WELCOME10 for 10% off first sessions." />}</div>
      {edit && (
        <Modal title={edit === 'new' ? 'New promo code' : `Edit ${f.code}`} onClose={() => setEdit(null)}>
          <div className="ad-form">
            <Field label="Code *"><input type="text" value={f.code} onChange={(e) => set('code', e.target.value.toUpperCase())} disabled={edit !== 'new'} placeholder="WELCOME10" autoFocus /></Field>
            <Field label="Description"><input type="text" value={f.description} onChange={(e) => set('description', e.target.value)} placeholder="Internal note" /></Field>
            <Field label="Type"><select value={f.kind} onChange={(e) => set('kind', e.target.value)}><option value="percent">Percentage off</option><option value="amount">Fixed amount off (£)</option></select></Field>
            <Field label={f.kind === 'percent' ? 'Percent off *' : 'Amount off (£) *'}><input type="number" value={f.value} onChange={(e) => set('value', e.target.value)} /></Field>
            <Field label="Starts"><input type="date" value={f.starts_on} onChange={(e) => set('starts_on', e.target.value)} /></Field>
            <Field label="Expires"><input type="date" value={f.expires_on} onChange={(e) => set('expires_on', e.target.value)} /></Field>
            <Field label="Max uses" hint="Leave empty for unlimited"><input type="number" value={f.max_uses} onChange={(e) => set('max_uses', e.target.value)} /></Field>
            <Field label="Services" hint="None ticked = every service" full>
              <div className="ad-seg" style={{ marginBottom: 0 }}>{Object.values(flows).map((x) => <button type="button" key={x.id} className={f.flows.includes(x.id) ? 'on' : ''} onClick={() => set('flows', f.flows.includes(x.id) ? f.flows.filter((y: string) => y !== x.id) : [...f.flows, x.id])}>{x.title}</button>)}</div>
            </Field>
            <label className="ad-check"><input type="checkbox" checked={!!f.active} onChange={(e) => set('active', e.target.checked)} />Active</label>
            <div className="ad-formfoot"><button className="ad-btn" onClick={() => setEdit(null)}>Cancel</button><button className="ad-btn primary" onClick={save}>Save code</button></div>
          </div>
        </Modal>
      )}
    </>
  )
}
