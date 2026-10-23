import { useRef, useState } from 'react'
import { useData, useDb, type R } from '../data'
import { BulkBar, BulkBtn, BulkSelect, RowBox, confirmN, useSelection } from '../bulk'
import { Empty, PageHead, Tabs } from '../ui'
import { homeGallery, homeHero, weddingGallery } from '../../cms/builtin'
import { ManagePanel, uploadSiteImage } from './shared'
import { adminApi } from '../supabase'

type Ig = { enabled?: boolean; limit?: number; interval_hours?: number; last_sync?: string; last_error?: string; last_added?: number; pending?: boolean }

/** Pulls the latest Instagram posts into the home gallery. The access token lives in Cloudflare, never in the browser. */
function InstagramPanel({ managed }: { managed: boolean }) {
  const { setting, toast, refresh } = useData()
  const db = useDb()
  const cfg = setting<Ig>('instagram', {})
  const [busy, setBusy] = useState(false)
  const save = (patch: Ig) => db.upsert('settings', { key: 'instagram', value: { ...cfg, section: 'home-gallery', ...patch }, updated_at: new Date().toISOString() }, 'key', 'Instagram settings saved')
  async function syncNow() {
    setBusy(true)
    try {
      let added = 0
      for (let i = 0; i < 6; i++) {
        const r = await adminApi<{ added: number; removed: number; more: boolean }>({ action: 'instagram_sync' })
        if (!r.ok) { toast(r.error || 'Sync failed', 'err'); break }
        added += r.added
        if (!r.more) { toast(added ? `${added} new Instagram post${added === 1 ? '' : 's'} added to the gallery` : 'Gallery is up to date with Instagram'); break }
      }
    } finally { await refresh('settings', 'site_images'); setBusy(false) }
  }
  return (
    <div className="ad-card" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <b>Instagram sync</b>
          <p className="ad-muted" style={{ marginTop: 4 }}>Your latest Instagram pictures are copied into this gallery automatically. Pictures you upload yourself are never touched, and you can delete or reorder synced ones.</p>
          {!managed && <p className="ad-err" style={{ marginTop: 6 }}>Switch this gallery on with “Start managing” below first, otherwise the website keeps showing the built-in photos.</p>}
          <p className="ad-muted" style={{ marginTop: 6 }}>{cfg.last_error ? <span className="ad-err">{cfg.last_error}</span> : cfg.last_sync ? `Last synced ${new Date(cfg.last_sync).toLocaleString('en-GB')}${cfg.last_added ? ` · ${cfg.last_added} added` : ''}` : 'Not synced yet.'}{cfg.pending ? ' · more pictures are still being copied' : ''}</p>
        </div>
        <div className="ad-actions" style={{ alignItems: 'center' }}>
          <label className="ad-check"><input type="checkbox" checked={!!cfg.enabled} onChange={(e) => save({ enabled: e.target.checked })} />Sync automatically</label>
          <select aria-label="How many posts" value={cfg.limit ?? 12} onChange={(e) => save({ limit: Number(e.target.value) })} className="ad-btn">{[6, 9, 12, 18, 24, 30].map((n) => <option key={n} value={n}>Latest {n}</option>)}</select>
          <select aria-label="How often" value={cfg.interval_hours ?? 6} onChange={(e) => save({ interval_hours: Number(e.target.value) })} className="ad-btn">{[[1, 'every hour'], [6, 'every 6 hours'], [24, 'daily']].map(([n, l]) => <option key={n} value={n}>Check {l}</option>)}</select>
          <button className="ad-btn primary" disabled={busy} onClick={syncNow}>{busy ? 'Syncing…' : 'Sync now'}</button>
        </div>
      </div>
    </div>
  )
}

const SETS = {
  'home-hero': { label: 'Home — hero slideshow', note: 'The portrait picture beside the headline on the home page. Portrait photos (about 3:4, for example 1200×1600) look best. Each picture fills the frame in the order shown below.', seed: () => homeHero.map((u) => ({ url: u, thumb_url: u, alt: '', width: 1200, height: 1600 })) },
  'home-gallery': { label: 'Home — portfolio gallery', note: 'The masonry portfolio on the home page.', seed: () => homeGallery.map((g) => ({ url: g.href, thumb_url: g.thumb, alt: g.alt, width: g.w, height: g.h })) },
  'wedding-gallery': { label: 'Wedding — featured gallery', note: 'The masonry gallery on the wedding page.', seed: () => weddingGallery.map((g) => ({ url: g.href, thumb_url: g.thumb, alt: g.alt, width: g.w, height: g.h })) },
} as const
type SetKey = keyof typeof SETS

export function ImagesCms() {
  const { d, toast, setting } = useData()
  const db = useDb()
  const [tab, setTab] = useState<SetKey>('home-hero')
  const [busy, setBusy] = useState(false)
  const file = useRef<HTMLInputElement>(null)
  const items = d.site_images.filter((i) => i.section === tab)
  const sel = useSelection(items.map((i) => i.id))
  const nextOrder = () => Math.max(0, ...items.map((i) => i.sort_order)) + 1

  async function upload(files: FileList) {
    setBusy(true)
    let n = 0
    try {
      for (const f of Array.from(files)) {
        const r = await uploadSiteImage(f)
        await db.insert('site_images', { section: tab, url: r.url, thumb_url: r.url, alt: '', width: r.width, height: r.height, sort_order: nextOrder() + n++ })
      }
      toast(`${n} image${n === 1 ? '' : 's'} added`)
    } catch (e) { toast(`Upload failed: ${e instanceof Error ? e.message : ''}`, 'err') } finally { setBusy(false) }
  }
  async function addUrl() {
    const url = window.prompt('Image URL (e.g. /images/photo.webp or https://…):')?.trim()
    if (!url) return
    const dims = await new Promise<{ w: number; h: number }>((res) => { const im = new Image(); im.onload = () => res({ w: im.naturalWidth, h: im.naturalHeight }); im.onerror = () => res({ w: 0, h: 0 }); im.src = url })
    await db.insert('site_images', { section: tab, url, thumb_url: url, alt: '', width: dims.w, height: dims.h, sort_order: nextOrder() }, 'Image added')
  }
  const move = async (it: R, dir: -1 | 1) => {
    const i = items.findIndex((x) => x.id === it.id)
    const o = items[i + dir]
    if (!o) return
    const a = it.sort_order === o.sort_order ? it.sort_order + dir : it.sort_order
    await db.update('site_images', { id: it.id }, { sort_order: o.sort_order })
    await db.update('site_images', { id: o.id }, { sort_order: a }, 'New order saved')
  }
  return (
    <>
      <PageHead title="Website images" sub="Slideshows and galleries on the home and wedding pages" actions={<><button className="ad-btn" onClick={addUrl}>+ Add by link</button><button className="ad-btn primary" disabled={busy} onClick={() => file.current?.click()}>{busy ? 'Uploading…' : '⬆ Upload images'}</button><input ref={file} type="file" accept="image/*" multiple hidden onChange={(e) => { if (e.target.files?.length) upload(e.target.files); e.target.value = '' }} /></>} />
      <Tabs value={tab} onChange={setTab} tabs={(Object.keys(SETS) as SetKey[]).map((k) => ({ id: k, label: SETS[k].label, count: d.site_images.filter((i) => i.section === k).length }))} />
      {tab === 'home-gallery' && <InstagramPanel managed={!!setting<Record<string, boolean>>('cms_managed', {})['home-gallery']} />}
      <ManagePanel keyName={tab} label={SETS[tab].label} count={items.length} onImport={async () => { await db.insert('site_images', SETS[tab].seed().map((r, i) => ({ ...r, section: tab, sort_order: i + 1 }))) }}><p className="ad-muted" style={{ marginTop: 8 }}>{SETS[tab].note}</p></ManagePanel>
      <BulkBar s={sel} noun="image">
        <BulkSelect label="Move to" options={(Object.keys(SETS) as SetKey[]).filter((k) => k !== tab).map((k) => ({ value: k, label: SETS[k].label }))} onPick={async (v) => { const base = Math.max(0, ...d.site_images.filter((i) => i.section === v).map((i) => i.sort_order)); const picked = items.filter((i) => sel.has(i.id)); for (let n = 0; n < picked.length; n++) await db.update('site_images', { id: picked[n].id }, { section: v, sort_order: base + n + 1 }, n === picked.length - 1 ? `${picked.length} moved to ${SETS[v as SetKey].label}` : undefined); sel.clear() }} />
        <BulkBtn danger onClick={async () => { if (confirmN('Delete', sel.count, 'image')) { const r = await db.removeMany('site_images', sel.ids, `${sel.count} deleted`); if (r.ok) sel.clear() } }}>Delete</BulkBtn>
      </BulkBar>
      {items.length > 0 && !sel.count && <p style={{ margin: '0 0 10px' }}><button type="button" className="ad-link" onClick={sel.selectAll}>Select all</button></p>}
      <div className="ad-grid c4">
        {items.map((it, i) => (
          <div key={it.id} className={'ad-card' + (sel.has(it.id) ? ' picked' : '')} style={{ padding: 10, position: 'relative' }}>
            <span className="ad-pick" style={{ top: 18, left: 18 }}><RowBox s={sel} id={it.id} label="image" /></span>
            <img src={it.thumb_url || it.url} alt={it.alt} style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', borderRadius: 8, background: '#efeee9' }} loading="lazy" />
            {it.source === 'instagram' && <a className="ad-muted" style={{ display: 'block', marginTop: 6, fontSize: 12 }} href={it.link || 'https://www.instagram.com/'} target="_blank" rel="noreferrer">From Instagram ↗</a>}
            <input type="text" defaultValue={it.alt} placeholder="Alt text (describe the picture)" style={{ marginTop: 8 }} onBlur={(e) => e.target.value !== it.alt && db.update('site_images', { id: it.id }, { alt: e.target.value }, 'Alt text saved')} />
            <div className="ad-actions" style={{ marginTop: 8 }}><button className="ad-btn sm" disabled={i === 0} onClick={() => move(it, -1)}>←</button><button className="ad-btn sm" disabled={i === items.length - 1} onClick={() => move(it, 1)}>→</button><button className="ad-btn sm danger" onClick={() => window.confirm('Remove this image from the set?') && db.remove('site_images', { id: it.id })}>Remove</button></div>
          </div>
        ))}
      </div>
      {!items.length && <Empty title="No images in this set yet" hint="Use “Start managing” to import the current images, or upload your own." />}
    </>
  )
}
