/**
 * Photos on the service pages' price cards: every card that shows a photo can have it changed here (upload, choose a
 * photo already on the site, or paste a link), and put back to its original. Saved in settings.card_photos.
 */
import { useMemo, useRef, useState } from 'react'
import { PAGE_CARDS } from '../../booking/cards'
import { cardKey, safePhoto, type CardPhotos } from '../../booking/cardPhotos'
import type { BookingPackage } from '../../booking/overrides'
import { packageItemId } from '../../booking/overrides'
import { uploadSiteImage } from '../cms/shared'
import { useData, useDb } from '../data'
import { Modal } from '../ui'

export type PhotoCard = { key: string; title: string; original: string; added?: boolean }

/** Does this page show one card per package (so an added package gets its own card, and so a photo)? */
export const cardPerPackage = (flowId: string) => {
  const mine = PAGE_CARDS.flatMap((p) => p.cards).filter((c) => c.flowId === flowId && !c.href)
  return mine.length > 0 && !mine.some((c) => c.rows?.length)
}
export const firstPhoto = (flowId: string) => PAGE_CARDS.flatMap((p) => p.cards).find((c) => c.flowId === flowId && c.image)?.image ?? ''
/** the card whose rows list a page's packages, e.g. "Portrait Photography" */
export const rowCardTitle = (flowId: string) => PAGE_CARDS.flatMap((p) => p.cards).find((c) => c.flowId === flowId && c.rows?.length)?.title ?? 'page'

/** the cards with a photo for one page (booking form), built-in first, then added packages that get a card */
export function photoCardsFor(flowId: string, added: BookingPackage[], photos: CardPhotos = {}): PhotoCard[] {
  const builtIn = PAGE_CARDS.flatMap((p) => p.cards).filter((c) => c.flowId === flowId && c.image && !c.href).map((c) => ({ key: cardKey(c), title: c.title, original: c.image! }))
  const perPackage = cardPerPackage(flowId)
  // on row pages only the added packages that were given a photo have a card (and so a photo to change)
  const extra = added
    .filter((r) => r.flow_id === flowId && r.kind === 'option' && (perPackage || safePhoto(photos[`${flowId}:${packageItemId(r)}`])))
    .map((r) => ({ key: `${flowId}:${packageItemId(r)}`, title: r.label, original: perPackage ? firstPhoto(flowId) : '', added: true }))
  return [...builtIn, ...extra]
}

export function useCardPhotos() {
  const { setting } = useData()
  const db = useDb()
  const photos = setting<CardPhotos>('card_photos', {})
  const save = (next: CardPhotos, ok: string) => db.upsert('settings', { key: 'card_photos', value: next, updated_at: new Date().toISOString() }, 'key', ok)
  return {
    photos,
    current: (c: PhotoCard) => safePhoto(photos[c.key]) || c.original,
    changed: (c: PhotoCard) => !!safePhoto(photos[c.key]),
    set: (key: string, url: string) => save({ ...photos, [key]: url }, 'Photo changed, live on the page'),
    reset: (key: string) => { const next = { ...photos }; delete next[key]; return save(next, 'Original photo back on the page') },
    /** several keys at once: a url sets it, null removes it */
    apply: (changes: Record<string, string | null>) => {
      const next = { ...photos }
      for (const [k, v] of Object.entries(changes)) if (v) next[k] = v; else delete next[k]
      return save(next, 'Package photo saved')
    },
  }
}

/** Every photo the studio already uses: the cards' own photos, ones chosen before and the website image sets. */
function useLibrary(photos: CardPhotos) {
  const { d } = useData()
  return useMemo(() => {
    const urls = [
      ...Object.values(photos).map(safePhoto),
      ...PAGE_CARDS.flatMap((p) => p.cards.map((c) => c.image ?? '')),
      ...d.site_images.map((x) => String(x.url ?? '')),
    ].filter(Boolean)
    return [...new Set(urls)]
  }, [photos, d.site_images])
}

/** The picker: upload, choose from the photos already on the site, or paste a link. */
export function PhotoPicker({ card, current, photos, onPick, onReset, onClose }: {
  card: PhotoCard; current: string; photos: CardPhotos
  onPick: (url: string) => Promise<unknown>; onReset?: () => Promise<unknown>; onClose: () => void
}) {
  const { toast } = useData()
  const library = useLibrary(photos)
  const [chosen, setChosen] = useState(current)
  const [link, setLink] = useState('')
  const [busy, setBusy] = useState('')
  const file = useRef<HTMLInputElement>(null)
  async function upload(f: File) {
    if (!/^image\//.test(f.type)) return toast('Choose a photo (JPG, PNG or WebP).', 'err')
    if (f.size > 15 * 1024 * 1024) return toast('That photo is over 15 MB. Choose a smaller one.', 'err')
    setBusy('upload')
    try { const r = await uploadSiteImage(f); setChosen(r.url); toast('✓ Uploaded. Press Use this photo to put it on the card.') }
    catch (e) { toast(`Upload failed: ${e instanceof Error ? e.message : 'error'}. You can paste an image link instead.`, 'err') }
    finally { setBusy('') }
  }
  const pasted = safePhoto(link)
  return (
    <Modal title={`Photo for ${card.title}`} onClose={onClose} wide>
      <div className="cp-picker">
        <div className="cp-now">
          {chosen ? <img src={chosen} alt={`Chosen photo for ${card.title}`} /> : <div className="cp-empty cp-empty-lg">No photo yet</div>}
          <div>
            <p className="ad-muted" style={{ marginBottom: 10 }}>{!chosen ? 'Upload one, choose one below or paste a link.' : chosen === current ? 'On the card now.' : 'Not saved yet. Press Use this photo.'}</p>
            <button type="button" className="ad-btn" disabled={!!busy} onClick={() => file.current?.click()}>{busy === 'upload' ? 'Uploading…' : '⬆ Upload a photo'}</button>
            <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) upload(f) }} />
            <div className="cp-link">
              <input type="url" placeholder="or paste a link: https://…" aria-label="Photo link" value={link} onChange={(e) => setLink(e.target.value)} />
              <button type="button" className="ad-btn sm" disabled={!pasted} onClick={() => { setChosen(pasted); setLink('') }}>Preview</button>
            </div>
            {link && !pasted && <p className="ad-err">Paste a link that starts with https:// or /images/.</p>}
          </div>
        </div>
        <p className="cp-label">Or choose one already on the site</p>
        <div className="cp-grid" role="listbox" aria-label="Photos on the site">
          {library.map((u) => (
            <button key={u} type="button" role="option" aria-selected={u === chosen} className={u === chosen ? 'on' : ''} onClick={() => setChosen(u)}>
              <img src={u} alt="" loading="lazy" />
            </button>
          ))}
        </div>
        <div className="ad-formfoot" style={{ marginTop: 16 }}>
          {onReset && <button type="button" className="ad-btn" style={{ marginRight: 'auto' }} disabled={!!busy} onClick={async () => { setBusy('save'); await onReset(); setBusy(''); onClose() }}>Use the original photo</button>}
          <button type="button" className="ad-btn" onClick={onClose}>Cancel</button>
          <button type="button" className="ad-btn primary" disabled={!!busy || !chosen || chosen === current} onClick={async () => { setBusy('save'); await onPick(chosen); setBusy(''); onClose() }}>{busy === 'save' ? 'Saving…' : 'Use this photo'}</button>
        </div>
      </div>
    </Modal>
  )
}

/** One page's card photos, shown in its section of the Prices page. */
export function CardPhotoStrip({ flowId, added, cards: given }: { flowId: string; added: BookingPackage[]; cards?: PhotoCard[] }) {
  const cp = useCardPhotos()
  const cards = given ?? photoCardsFor(flowId, added, cp.photos)
  const [open, setOpen] = useState<PhotoCard | null>(null)
  if (!cards.length) return null
  return (
    <div className="cp-strip" data-card-photos={flowId}>
      <p className="cp-label">Card photos</p>
      <div className="cp-row">
        {cards.map((c) => (
          <button key={c.key} type="button" className="cp-thumb" onClick={() => setOpen(c)} aria-label={`Change the photo for ${c.title}`}>
            <img src={cp.current(c)} alt="" loading="lazy" />
            <span>{c.title}{cp.changed(c) && <em>changed</em>}</span>
            <b>Change photo</b>
          </button>
        ))}
      </div>
      {open && <PhotoPicker card={open} current={cp.current(open)} photos={cp.photos} onPick={(u) => cp.set(open.key, u)} onReset={cp.changed(open) ? () => cp.reset(open.key) : undefined} onClose={() => setOpen(null)} />}
    </div>
  )
}
