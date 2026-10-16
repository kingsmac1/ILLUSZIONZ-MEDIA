import { useState } from 'react'
import { useData, useDb, type R } from '../data'
import { Field, PageHead } from '../ui'

const TONES: Record<string, [string, string]> = { dark: ['#000', '#fff'], light: ['#f4f3ef', '#000'], gold: ['#b8941f', '#000'] }

export function BannerCms() {
  const { setting } = useData()
  const db = useDb()
  const cur = setting<R>('notice', { enabled: false, text: '', link: '', label: '', tone: 'dark' })
  const [f, setF] = useState<R>(cur)
  const set = (k: string, v: unknown) => setF((c) => ({ ...c, [k]: v }))
  const [bg, fg] = TONES[f.tone] ?? TONES.dark
  return (
    <>
      <PageHead title="Site banner" sub="An announcement strip shown at the very top of every page" />
      <div className="ad-grid c2" style={{ alignItems: 'start' }}>
        <div className="ad-card">
          <div className="ad-form" style={{ gridTemplateColumns: '1fr' }}>
            <label className="ad-check"><input type="checkbox" checked={!!f.enabled} onChange={(e) => set('enabled', e.target.checked)} />Show the banner</label>
            <Field label="Message"><input type="text" value={f.text} onChange={(e) => set('text', e.target.value)} placeholder="Autumn mini sessions are open — 15% off this week" /></Field>
            <Field label="Link (optional)"><input type="text" value={f.link} onChange={(e) => set('link', e.target.value)} placeholder="/photography-services/" /></Field>
            <Field label="Link text"><input type="text" value={f.label} onChange={(e) => set('label', e.target.value)} placeholder="Book now" /></Field>
            <Field label="Style"><select value={f.tone} onChange={(e) => set('tone', e.target.value)}><option value="dark">Black</option><option value="light">Light</option><option value="gold">Gold</option></select></Field>
            <button className="ad-btn primary" onClick={() => db.upsert('settings', { key: 'notice', value: f, updated_at: new Date().toISOString() }, 'key', 'Banner saved — live within a minute')}>Save banner</button>
          </div>
        </div>
        <div className="ad-card"><h3>Preview</h3>
          <div style={{ background: bg, color: fg, padding: '10px 16px', textAlign: 'center', borderRadius: 8, fontSize: 14, opacity: f.enabled ? 1 : 0.4 }}>{f.text || 'Your message appears here'}{f.link && <b style={{ marginLeft: 10, textDecoration: 'underline' }}>{f.label || 'Learn more'}</b>}</div>
          {!f.enabled && <p className="ad-muted" style={{ marginTop: 10 }}>The banner is switched off.</p>}
          <p className="ad-muted" style={{ marginTop: 10 }}>Visitors can dismiss it for their visit.</p></div>
      </div>
    </>
  )
}
