/**
 * "+ Add package" on the Prices page: a new package card on a website page, with its cover photo.
 *  - Photography services (Portrait, Maternity, Baby Shoot …): a new card with its own price lines and booking form
 *    (table booking_services), e.g. Graduate Photography
 *  - Wedding (Silver, Gold …), Videography services (Wedding Videography, Drone Coverage …), Academy (courses):
 *    a new card in that page's booking form (table booking_packages)
 * The cover photo is kept with the other card photos (settings.card_photos).
 */
import { useCallback, useEffect, useState } from 'react'
import { PAGE_CARDS } from '../../booking/cards'
import { formatGBP } from '../../booking/catalog'
import { packageItemId, type BookingPackage } from '../../booking/overrides'
import { safePhoto } from '../../booking/cardPhotos'
import { serviceFlowId, servicePhotoKey, type BookingService } from '../../booking/services'
import { supabase } from '../supabase'
import { useData } from '../data'
import { Badge, Field, Modal } from '../ui'
import { PhotoPicker, firstPhoto, useCardPhotos } from './CardPhotos'

type PageId = 'photography' | 'wedding' | 'videography' | 'academy'
/** the website pages a package card can be added to, and what their cards show */
export const WEBSITE_PAGES: { id: PageId; label: string; flow?: string; priceNote?: string; includes?: boolean }[] = [
  { id: 'photography', label: 'Photography services' },
  { id: 'wedding', label: 'Wedding', flow: 'wedding', priceNote: 'e.g. 8 hours', includes: true },
  { id: 'videography', label: 'Videography services', flow: 'videography' },
  { id: 'academy', label: 'Academy', flow: 'academy', priceNote: 'e.g. 9 months', includes: true },
]
const PAGE_PATH: Record<PageId, string> = { photography: '/photography-services', wedding: '/wedding', videography: '/videography-services', academy: '/academy' }
/** the packages already on a page, e.g. "Portrait Photography, Maternity Photography, Baby Shoot …" */
const onPage = (id: PageId) => (PAGE_CARDS.find((p) => p.path === PAGE_PATH[id])?.cards ?? []).filter((c) => !c.href && (id !== 'videography' || c.flowId === 'videography')).map((c) => c.title)
export const pageOfFlow = (flowId: string) => WEBSITE_PAGES.find((p) => p.flow === flowId)

export const SERVICES_SETUP = 'Adding packages needs one database update. Run npm run gallery:go-live once, then reload this page.'
const missing = (m: string) => /booking_(services|packages)|description/.test(m) && /(does not exist|could not find|schema cache)/i.test(m)

export function useAddedServices() {
  const { toast, markSaved } = useData()
  const [rows, setRows] = useState<BookingService[]>([])
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    const { data, error: err } = await supabase!.from('booking_services').select('*').order('sort_order', { ascending: true }).limit(500)
    if (err) setError(missing(err.message) ? SERVICES_SETUP : err.message)
    else { setError(''); setRows((data ?? []) as BookingService[]) }
  }, [])
  useEffect(() => { load() }, [load])
  const run = async (p: PromiseLike<{ error: { message: string } | null; data?: unknown }>, ok: string) => {
    const r = await p
    if (r.error) { toast(missing(r.error.message) ? SERVICES_SETUP : r.error.message, 'err'); return null }
    await load()
    markSaved()
    toast(`✓ ${ok}`)
    return r
  }
  const now = () => new Date().toISOString()
  return {
    rows, error, reload: load,
    save: async (row: Partial<BookingService>, id?: string): Promise<string | null> => {
      const q = id ? supabase!.from('booking_services').update({ ...row, updated_at: now() }).eq('id', id).select('id').single() : supabase!.from('booking_services').insert(row).select('id').single()
      const r = await run(q, id ? 'Package saved, live on the page' : 'Package added, live on the page')
      return r ? ((r.data as { id?: string } | null)?.id ?? id ?? null) : null
    },
    setActive: (id: string, active: boolean) => run(supabase!.from('booking_services').update({ active, updated_at: now() }).eq('id', id), active ? 'Shown again' : 'Hidden from the page'),
    remove: (id: string) => run(supabase!.from('booking_services').delete().eq('id', id), 'Package deleted'),
  }
}

type Line = { label: string; note: string; price: string }
type Form = { page: PageId | ''; title: string; description: string; lines: Line[]; price: string; priceNote: string; includes: string; cta: string; active: boolean }
const emptyLine = (): Line => ({ label: '', note: '', price: '' })

/** The form. `service` edits a Photography services package, `pkg` a card added to another page. */
export function NewPackageForm({ service, pkg, presetPage, services, packages, onSaveService, onSavePackage, onClose }: {
  service?: BookingService; pkg?: BookingPackage; presetPage?: PageId
  services: BookingService[]; packages: BookingPackage[]
  onSaveService: (row: Partial<BookingService>, id?: string) => Promise<string | null>
  onSavePackage: (row: Partial<BookingPackage>, id?: string) => Promise<string | null>
  onClose: () => void
}) {
  const cp = useCardPhotos()
  const [f, setF] = useState<Form>(() => {
    if (service) return {
      page: 'photography', title: service.title, description: service.description ?? '', price: '', priceNote: '', includes: '', cta: service.cta ?? 'Book this shoot', active: service.active,
      lines: (service.options ?? []).map((o) => ({ label: o.label, note: o.note ?? '', price: String(Number(o.price) || 0) })),
    }
    if (pkg) return {
      page: pageOfFlow(pkg.flow_id)?.id ?? '', title: pkg.label, description: pkg.description ?? '', price: String(Number(pkg.price) || 0), priceNote: pkg.note ?? '',
      includes: (pkg.includes ?? []).join('\n'), cta: '', lines: [emptyLine()], active: pkg.active,
    }
    return { page: presetPage ?? '', title: '', description: '', lines: [emptyLine()], price: '', priceNote: '', includes: '', cta: 'Book this shoot', active: true }
  })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [picking, setPicking] = useState(false)
  const set = <K extends keyof Form>(k: K, v: Form[K]) => { setF((c) => ({ ...c, [k]: v })); setErr('') }
  const setLine = (n: number, p: Partial<Line>) => { setF((c) => ({ ...c, lines: c.lines.map((l, i) => (i === n ? { ...l, ...p } : l)) })); setErr('') }
  const page = WEBSITE_PAGES.find((p) => p.id === f.page)
  const isService = f.page === 'photography'
  const editing = !!(service || pkg)

  const keyOf = (id: string): string => (isService ? servicePhotoKey({ id }) : `${page?.flow}:${packageItemId({ id })}`)
  const savedPhoto = service ? safePhoto(cp.photos[servicePhotoKey(service)]) : pkg ? safePhoto(cp.photos[`${pkg.flow_id}:${packageItemId(pkg)}`]) : ''
  const [photo, setPhoto] = useState<string | null>(null)
  const ownPhoto = photo ?? savedPhoto
  const shownPhoto = ownPhoto || (page?.flow ? firstPhoto(page.flow) : '')

  async function submit() {
    if (!page) return setErr('Choose the page this package goes on.')
    if (!f.title.trim()) return setErr('Enter the package name, e.g. Graduate Photography.')
    if (isService && !ownPhoto) return setErr('Add a cover photo, as the other packages on this page have.')
    let saved: string | null
    if (isService) {
      const lines = f.lines.filter((l) => l.label.trim() || l.price.trim() || l.note.trim())
      if (!lines.length) return setErr('Add at least one price line, e.g. 1 Look · 4 edited pictures · £150.')
      for (const [n, l] of lines.entries()) {
        if (!l.label.trim()) return setErr(`Price line ${n + 1} needs a name, e.g. 1 Look.`)
        const p = l.price.trim() === '' ? 0 : Number(l.price)
        if (!Number.isFinite(p) || p < 0) return setErr(`Price line ${n + 1}: enter a price of 0 or more (0 means you quote it).`)
      }
      const row: Partial<BookingService> = {
        page: 'photography', title: f.title.trim(), description: f.description.trim(), cta: f.cta.trim() || 'Book this shoot', active: f.active,
        options: lines.map((l) => ({ label: l.label.trim(), note: l.note.trim(), price: Math.round((Number(l.price) || 0) * 100) / 100 })),
      }
      if (!service) row.sort_order = Math.max(0, ...services.map((s) => Number(s.sort_order) || 0)) + 1
      setBusy(true)
      saved = await onSaveService(row, service?.id)
    } else {
      const price = f.price.trim() === '' ? 0 : Number(f.price)
      if (!Number.isFinite(price) || price < 0) return setErr('Enter a price of 0 or more (0 means you quote it).')
      const row: Partial<BookingPackage> = {
        flow_id: page.flow!, kind: 'option', label: f.title.trim(), note: page.priceNote ? f.priceNote.trim() : '', description: f.description.trim(),
        includes: page.includes ? f.includes.split('\n').map((x) => x.replace(/^[•\-*]\s*/, '').trim()).filter(Boolean) : [],
        price: Math.round(price * 100) / 100, unit: null, max_qty: null, active: f.active,
      }
      if (!pkg) row.sort_order = Math.max(0, ...packages.filter((r) => r.flow_id === page.flow && r.kind === 'option').map((r) => Number(r.sort_order) || 0)) + 1
      setBusy(true)
      saved = await onSavePackage(row, pkg?.id)
    }
    if (saved && ownPhoto !== savedPhoto) await cp.apply({ [keyOf(saved)]: ownPhoto || null })
    setBusy(false)
    if (saved) onClose()
  }

  const preview = (() => {
    if (!page || !f.title.trim()) return null
    if (isService) {
      const prices = f.lines.map((l) => Number(l.price) || 0).filter((p) => p > 0)
      return <>Clients will see a <b>{f.title.trim()}</b> card on {page.label}{prices.length ? <> {prices.length > 1 ? 'from' : 'for'} <b>{formatGBP(Math.min(...prices))}</b></> : ', priced on request'}, with its own booking form.</>
    }
    return <>Clients will see a <b>{f.title.trim()}</b> card on {page.label}{Number(f.price) > 0 ? <> for <b>{formatGBP(Number(f.price))}</b></> : ', priced on request'}.</>
  })()

  return (
    <Modal title={editing ? `Edit ${service?.title ?? pkg?.label}` : 'Add a package'} onClose={onClose}>
      <div className="ad-form" data-new-package>
        <Field label="Page" full hint={page ? `Already on this page: ${onPage(page.id).join(', ')}.` : 'The website page the new package card goes on.'}>
          <select value={f.page} autoFocus={!editing} disabled={editing} onChange={(e) => set('page', e.target.value as PageId)}>
            <option value="">Choose a page…</option>
            {WEBSITE_PAGES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </Field>
        {page && (
          <>
            <Field label="Package name" full><input type="text" maxLength={120} value={f.title} onChange={(e) => set('title', e.target.value)} placeholder={isService ? 'e.g. Graduate Photography' : f.page === 'wedding' ? 'e.g. Platinum Package' : f.page === 'academy' ? 'e.g. Lighting Masterclass' : 'e.g. Music Video'} /></Field>
            <div className="ad-field full" data-package-photo>
              <span>Cover photo</span>
              <div className="cp-field">
                {shownPhoto ? <img src={shownPhoto} alt={`Cover photo for ${f.title.trim() || 'this package'}`} /> : <div className="cp-empty" aria-hidden="true">No photo</div>}
                <div>
                  <button type="button" className="ad-btn sm" onClick={() => setPicking(true)}>{ownPhoto ? 'Change photo' : '⬆ Upload or choose a photo'}</button>
                  <small style={{ display: 'block', marginTop: 6 }}>{ownPhoto ? 'Shown at the top of the package card.' : isService ? 'Upload the photo for the top of the card.' : 'Uses the page’s first photo until you choose one.'}</small>
                </div>
              </div>
            </div>
            <Field label="Short description" full hint="Optional. Shown on the card.">
              <textarea rows={2} maxLength={600} value={f.description} onChange={(e) => set('description', e.target.value)} />
            </Field>
            {isService ? (
              <div className="ad-field full">
                <span>Prices</span>
                <small style={{ marginBottom: 8 }}>Each line is a choice on the card and in the booking form, like 1 Look and 2 Looks on Portrait.</small>
                {f.lines.map((l, n) => (
                  <div className="np-line" key={n} data-price-line>
                    <input type="text" aria-label={`Price line ${n + 1} name`} placeholder="e.g. 1 Look" value={l.label} onChange={(e) => setLine(n, { label: e.target.value })} />
                    <input type="text" aria-label={`Price line ${n + 1} detail`} placeholder="e.g. 4 edited pictures" value={l.note} onChange={(e) => setLine(n, { note: e.target.value })} />
                    <input type="number" min="0" step="0.01" aria-label={`Price line ${n + 1} price (£)`} placeholder="£" value={l.price} onChange={(e) => setLine(n, { price: e.target.value })} />
                    {f.lines.length > 1 && <button type="button" className="ad-btn sm danger" aria-label={`Remove price line ${n + 1}`} onClick={() => set('lines', f.lines.filter((_, i) => i !== n))}>✕</button>}
                  </div>
                ))}
                <div><button type="button" className="ad-btn sm" onClick={() => set('lines', [...f.lines, emptyLine()])}>+ Add a price line</button></div>
              </div>
            ) : (
              <>
                <Field label="Price (£)" hint={f.page === 'videography' ? '0 shows “Open for consultation”.' : '0 means the price is quoted.'}><input type="number" min="0" step="0.01" value={f.price} onChange={(e) => set('price', e.target.value)} /></Field>
                {page.priceNote ? <Field label="Next to the price"><input type="text" maxLength={200} value={f.priceNote} placeholder={page.priceNote} onChange={(e) => set('priceNote', e.target.value)} /></Field> : <div />}
                {page.includes && (
                  <Field label="What's included" full hint="One per line.">
                    <textarea rows={4} value={f.includes} onChange={(e) => set('includes', e.target.value)} />
                  </Field>
                )}
              </>
            )}
            {isService && <Field label="Button text" full><input type="text" maxLength={40} value={f.cta} onChange={(e) => set('cta', e.target.value)} /></Field>}
            <label className="ad-check" style={{ gridColumn: '1 / -1' }}><input type="checkbox" checked={f.active} onChange={(e) => set('active', e.target.checked)} />Show it on the page now</label>
          </>
        )}
        {err && <p className="ad-err" role="alert" style={{ gridColumn: '1 / -1' }}>{err}</p>}
        {preview && <p className="ad-muted" style={{ gridColumn: '1 / -1' }}>{preview}</p>}
        <div className="ad-formfoot">
          <button className="ad-btn" disabled={busy} onClick={onClose}>Cancel</button>
          <button className="ad-btn primary" disabled={busy || !page} onClick={submit}>{busy ? 'Saving…' : editing ? 'Save package' : 'Add package'}</button>
        </div>
      </div>
      {picking && <PhotoPicker card={{ key: 'form', title: f.title.trim() || 'this package', original: '' }} current={ownPhoto} photos={cp.photos} onPick={async (u) => setPhoto(u)} onClose={() => setPicking(false)} />}
    </Modal>
  )
}

/** The Photography services packages added in the dashboard, at the top of the Prices page. */
export function AddedServicesList({ rows, photos, onEdit, onToggle, onDelete }: {
  rows: BookingService[]; photos: Record<string, string>
  onEdit: (s: BookingService) => void; onToggle: (s: BookingService) => void; onDelete: (s: BookingService) => void
}) {
  if (!rows.length) return null
  return (
    <div className="ad-card" style={{ marginBottom: 16 }} data-added-services>
      <h3>Packages added to Photography services<small>each has its own booking form</small></h3>
      <div className="np-list">
        {rows.map((s) => {
          const photo = safePhoto(photos[servicePhotoKey(s)])
          const prices = (s.options ?? []).map((o) => `${o.label} ${Number(o.price) > 0 ? formatGBP(Number(o.price)) : 'quoted'}`).join(' · ')
          return (
            <div key={s.id} className="np-item" style={!s.active ? { opacity: .5 } : undefined} data-service={serviceFlowId(s)}>
              {photo ? <img src={photo} alt="" /> : <div className="cp-empty">No photo</div>}
              <div className="np-text"><b>{s.title}</b> {!s.active && <Badge tone="grey">hidden</Badge>}<span className="sub">{prices}</span></div>
              <div className="np-actions">
                <button className="ad-btn sm" onClick={() => onEdit(s)}>Edit</button>
                <button className="ad-btn sm" onClick={() => onToggle(s)}>{s.active ? 'Hide' : 'Show'}</button>
                <button className="ad-btn sm danger" onClick={() => onDelete(s)}>Delete</button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
