import { useRef, useState, type ReactNode } from 'react'
import { supabase } from '../supabase'
import { useData, useDb } from '../data'
import { Field } from '../ui'

/** Upload an image to the public `site-media` bucket and measure it. */
export async function uploadSiteImage(file: File): Promise<{ url: string; width: number; height: number }> {
  const dims = await new Promise<{ width: number; height: number }>((resolve) => {
    const img = new Image()
    const u = URL.createObjectURL(file)
    img.onload = () => { resolve({ width: img.naturalWidth, height: img.naturalHeight }); URL.revokeObjectURL(u) }
    img.onerror = () => resolve({ width: 0, height: 0 })
    img.src = u
  })
  const path = `${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}-${file.name.replace(/[^\w.\-]/g, '_')}`
  const { error } = await supabase!.storage.from('site-media').upload(path, file, { contentType: file.type, cacheControl: '31536000' })
  if (error) throw error
  return { url: supabase!.storage.from('site-media').getPublicUrl(path).data.publicUrl, ...dims }
}

/** URL box + upload button + preview. */
export function ImageField({ label, value, onChange, hint }: { label: string; value: string; onChange: (url: string, dims?: { width: number; height: number }) => void; hint?: string }) {
  const { toast } = useData()
  const file = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  async function pick(f: File) {
    setBusy(true)
    try { const r = await uploadSiteImage(f); onChange(r.url, r) } catch (e) { toast(`Upload failed: ${e instanceof Error ? e.message : 'error'}. You can paste an image link instead.`, 'err') } finally { setBusy(false) }
  }
  return (
    <Field label={label} hint={hint} full>
      <div style={{ display: 'flex', gap: 8 }}>
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder="https://… or /images/…" />
        <button type="button" className="ad-btn" disabled={busy} onClick={() => file.current?.click()}>{busy ? 'Uploading…' : '⬆ Upload'}</button>
        <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) pick(f); e.target.value = '' }} />
      </div>
      {value && <img src={value} alt="" style={{ marginTop: 8, maxHeight: 120, maxWidth: '100%', borderRadius: 8, border: '1px solid #e6e5e0', objectFit: 'cover' }} />}
    </Field>
  )
}

/** "Start managing" panel: until a part is managed the website shows its built-in content. */
export function ManagePanel({ keyName, label, count, onImport, children }: { keyName: string; label: string; count: number; onImport: () => Promise<void>; children?: ReactNode }) {
  const { setting, toast } = useData()
  const db = useDb()
  const managed = setting<Record<string, boolean>>('cms_managed', {})
  const on = !!managed[keyName]
  const [busy, setBusy] = useState(false)
  const setFlag = (v: boolean) => db.upsert('settings', { key: 'cms_managed', value: { ...managed, [keyName]: v }, updated_at: new Date().toISOString() }, 'key', v ? `${label} is now controlled from the dashboard` : `${label} is back to the built-in content`)
  async function start() {
    setBusy(true)
    try { if (!count) await onImport(); await setFlag(true) } catch (e) { toast(e instanceof Error ? e.message : 'Failed', 'err') } finally { setBusy(false) }
  }
  return (
    <div className="ad-card" style={{ marginBottom: 16, background: on ? '#f0fdf4' : '#fffdf0', borderColor: on ? '#bbf7d0' : '#f3e7a1' }}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <b>{on ? `✓ The website is showing your dashboard ${label.toLowerCase()}` : `The website is showing the built-in ${label.toLowerCase()}`}</b>
          <p className="ad-muted" style={{ marginTop: 4 }}>{on ? 'Changes you make here go live within about a minute.' : count ? 'You have saved items below. Switch on to show them on the website.' : 'Start managing to copy the current content here so you can edit it.'}</p>
        </div>
        {!on && <button className="ad-btn primary" disabled={busy} onClick={start}>{busy ? 'Working…' : count ? 'Show on website' : 'Start managing — import current content'}</button>}
      </div>
      {children}
    </div>
  )
}

export const slugify = (t: string) => t.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)

export function Counter({ value, min, max }: { value: string; min: number; max: number }) {
  const n = value.length
  const ok = n >= min && n <= max
  return <small style={{ color: n === 0 ? '#7a7a82' : ok ? '#15803d' : '#b45309', fontWeight: 600 }}>{n} / {max} characters{n && !ok ? (n < min ? ' — a bit short' : ' — too long, may be cut off') : ''}</small>
}
