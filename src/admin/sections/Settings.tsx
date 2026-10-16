import { useState } from 'react'
import { useData, useDb } from '../data'
import { Field, PageHead } from '../ui'
import { supabase } from '../supabase'

export function Settings({ email }: { email: string }) {
  const { d, toast } = useData()
  const db = useDb()
  const [admins, setAdmins] = useState<{ email: string; name: string }[] | null>(null)
  const [ne, setNe] = useState('')
  const [nn, setNn] = useState('')
  const [stages, setStages] = useState(d.pipeline_stages)
  const [cat, setCat] = useState('')
  const load = async () => setAdmins((await supabase!.from('admin_users').select('*').order('created_at')).data ?? [])
  if (admins === null) load()

  async function addAdmin() {
    if (!/^\S+@\S+\.\S+$/.test(ne)) return toast('Enter a valid email', 'err')
    const { error } = await supabase!.from('admin_users').insert({ email: ne.trim().toLowerCase(), name: nn })
    if (error) return toast(error.message, 'err')
    toast('Admin added — they must also be created in Supabase → Authentication → Users')
    setNe(''); setNn(''); load()
  }
  return (
    <>
      <PageHead title="Settings" sub="Admins, pipeline stages and expense categories" />
      <div className="ad-grid c2" style={{ marginBottom: 16 }}>
        <div className="ad-card"><h3>Dashboard admins</h3>
          <div className="ad-list">{(admins ?? []).map((a) => <div key={a.email}><span><b>{a.name || a.email}</b><span className="sub ad-muted" style={{ display: 'block' }}>{a.email}</span></span>{a.email.toLowerCase() === email.toLowerCase() ? <span className="ad-muted">you</span> : <button className="ad-btn sm danger" onClick={async () => { if (window.confirm(`Remove ${a.email}?`)) { await supabase!.from('admin_users').delete().eq('email', a.email); load() } }}>Remove</button>}</div>)}</div>
          <div className="ad-form" style={{ marginTop: 14 }}><Field label="Email"><input type="email" value={ne} onChange={(e) => setNe(e.target.value)} /></Field><Field label="Name"><input type="text" value={nn} onChange={(e) => setNn(e.target.value)} /></Field><div className="ad-formfoot"><button className="ad-btn primary" onClick={addAdmin}>Add admin</button></div></div>
          <p className="ad-muted" style={{ marginTop: 10 }}>Create their login under Supabase → Authentication → Users, then add the same email here.</p>
        </div>
        <div className="ad-card"><h3>Expense categories</h3>
          <div className="ad-tags" style={{ marginBottom: 12 }}>{d.expense_categories.map((c) => <span className="ad-tag" key={c.name}>{c.name} <a href="#" onClick={(e) => { e.preventDefault(); window.confirm(`Remove “${c.name}”? Existing expenses keep the name.`) && db.remove('expense_categories', { name: c.name }) }}>×</a></span>)}</div>
          <div className="ad-actions"><input type="text" value={cat} onChange={(e) => setCat(e.target.value)} placeholder="New category" style={{ maxWidth: 240 }} /><button className="ad-btn" onClick={async () => { if (cat.trim()) { await db.insert('expense_categories', { name: cat.trim(), sort_order: d.expense_categories.length + 1 }); setCat('') } }}>Add</button></div>
        </div>
      </div>
      <div className="ad-card"><h3>Pipeline stages <small>the “probability” weights the forecast</small></h3>
        <div className="ad-tablewrap" style={{ border: 0 }}><table><thead><tr><th>Name</th><th>Type</th><th style={{ width: 110 }}>Probability %</th><th style={{ width: 90 }}>Colour</th></tr></thead><tbody>
          {stages.map((s, i) => <tr key={s.key}>
            <td><input type="text" value={s.name} onChange={(e) => setStages(stages.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} /></td>
            <td className="ad-muted">{s.kind === 'open' ? 'In progress' : s.kind === 'won' ? 'Won' : 'Lost'}</td>
            <td><input type="number" min={0} max={100} value={s.probability} disabled={s.kind !== 'open'} onChange={(e) => setStages(stages.map((x, j) => (j === i ? { ...x, probability: Number(e.target.value) } : x)))} /></td>
            <td><input type="color" value={s.color} onChange={(e) => setStages(stages.map((x, j) => (j === i ? { ...x, color: e.target.value } : x)))} style={{ width: 48, height: 34, padding: 0, border: 0, background: 'none' }} /></td>
          </tr>)}
        </tbody></table></div>
        <div style={{ textAlign: 'right', marginTop: 10 }}><button className="ad-btn primary" onClick={() => db.upsert('pipeline_stages', stages.map((s) => ({ key: s.key, name: s.name, sort_order: s.sort_order, probability: s.probability, kind: s.kind, color: s.color })), 'key', 'Stages saved')}>Save stages</button></div>
        <p className="ad-muted" style={{ marginTop: 6 }}>To add a custom stage, insert a row into pipeline_stages in the Supabase SQL editor.</p>
      </div>
    </>
  )
}
