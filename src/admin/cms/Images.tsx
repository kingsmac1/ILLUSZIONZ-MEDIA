import { useRef, useState } from 'react'
import { useData, useDb, type R } from '../data'
import { Empty, PageHead, Tabs } from '../ui'
import { homeGallery, homeHero, weddingGallery } from '../../cms/builtin'
import { ManagePanel, uploadSiteImage } from './shared'

const SETS = {
  'home-hero': { label: 'Home — hero slideshow', note: 'The portrait picture beside the headline on the home page. Portrait photos (about 3:4, for example 1200×1600) look best. Each picture fills the frame in the order shown below.', seed: () => homeHero.map((u) => ({ url: u, thumb_url: u, alt: '', width: 1200, height: 1600 })) },
  'home-gallery': { label: 'Home — portfolio gallery', note: 'The masonry portfolio on the home page.', seed: () => homeGallery.map((g) => ({ url: g.href, thumb_url: g.thumb, alt: g.alt, width: g.w, height: g.h })) },
  'wedding-gallery': { label: 'Wedding — featured gallery', note: 'The masonry gallery on the wedding page.', seed: () => weddingGallery.map((g) => ({ url: g.href, thumb_url: g.thumb, alt: g.alt, width: g.w, height: g.h })) },
} as const
type SetKey = keyof typeof SETS

export function ImagesCms() {
  const { d, toast } = useData()
  const db = useDb()
  const [tab, setTab] = useState<SetKey>('home-hero')
  const [busy, setBusy] = useState(false)
  const file = useRef<HTMLInputElement>(null)
  const items = d.site_images.filter((i) => i.section === tab)
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
      <ManagePanel keyName={tab} label={SETS[tab].label} count={items.length} onImport={async () => { await db.insert('site_images', SETS[tab].seed().map((r, i) => ({ ...r, section: tab, sort_order: i + 1 }))) }}><p className="ad-muted" style={{ marginTop: 8 }}>{SETS[tab].note}</p></ManagePanel>
      <div className="ad-grid c4">
        {items.map((it, i) => (
          <div key={it.id} className="ad-card" style={{ padding: 10 }}>
            <img src={it.thumb_url || it.url} alt={it.alt} style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', borderRadius: 8, background: '#efeee9' }} loading="lazy" />
            <input type="text" defaultValue={it.alt} placeholder="Alt text (describe the picture)" style={{ marginTop: 8 }} onBlur={(e) => e.target.value !== it.alt && db.update('site_images', { id: it.id }, { alt: e.target.value }, 'Alt text saved')} />
            <div className="ad-actions" style={{ marginTop: 8 }}><button className="ad-btn sm" disabled={i === 0} onClick={() => move(it, -1)}>←</button><button className="ad-btn sm" disabled={i === items.length - 1} onClick={() => move(it, 1)}>→</button><button className="ad-btn sm danger" onClick={() => window.confirm('Remove this image from the set?') && db.remove('site_images', { id: it.id })}>Remove</button></div>
          </div>
        ))}
      </div>
      {!items.length && <Empty title="No images in this set yet" hint="Use “Start managing” to import the current images, or upload your own." />}
    </>
  )
}
