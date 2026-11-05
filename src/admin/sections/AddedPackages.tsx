/**
 * Packages and add-ons added from the Prices page (table booking_packages). The form asks for the page first
 * (Portrait, Wedding …), then the name, price and what's included. Loaded on its own, so the rest of the dashboard
 * keeps working before the table exists.
 */
import { useCallback, useEffect, useState } from 'react'
import { flows } from '../../booking/catalog'
import type { BookingPackage } from '../../booking/overrides'
import { supabase } from '../supabase'
import { useData } from '../data'
import { Field, Modal, gbp } from '../ui'
import { PhotoPicker, cardPerPackage, photoCardsFor, useCardPhotos } from './CardPhotos'
import { packageItemId } from '../../booking/overrides'

/** the pages a package can be added to: every booking form except the shop (its products live under Store) */
export const PACKAGE_PAGES = Object.values(flows).filter((f) => f.id !== 'store')

export const PACKAGES_SETUP = 'Adding packages needs one database update. Run npm run gallery:go-live once, then reload this page.'
const missing = (m: string) => /booking_packages/.test(m) && /(does not exist|could not find|schema cache)/i.test(m)

export function useAddedPackages() {
  const { toast, markSaved } = useData()
  const [rows, setRows] = useState<BookingPackage[]>([])
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    const { data, error: err } = await supabase!.from('booking_packages').select('*').order('sort_order', { ascending: true }).limit(2000)
    if (err) setError(missing(err.message) ? PACKAGES_SETUP : err.message)
    else { setError(''); setRows((data ?? []) as BookingPackage[]) }
  }, [])
  useEffect(() => { load() }, [load])
  const run = async (p: PromiseLike<{ error: { message: string } | null }>, ok: string) => {
    const { error: err } = await p
    if (err) { toast(missing(err.message) ? PACKAGES_SETUP : err.message, 'err'); return false }
    await load()
    markSaved()
    toast(`✓ ${ok}`)
    return true
  }
  const now = () => new Date().toISOString()
  return {
    rows, error,
    /** returns the package's id, or null when it could not be saved */
    save: async (row: Partial<BookingPackage>, id?: string): Promise<string | null> => {
      const q = id ? supabase!.from('booking_packages').update({ ...row, updated_at: now() }).eq('id', id).select('id').single() : supabase!.from('booking_packages').insert(row).select('id').single()
      let savedId: string | null = null
      const ok = await run(q.then((r) => { savedId = (r.data as { id?: string } | null)?.id ?? null; return r }), id ? 'Package saved, live on the page' : 'Package added, live on the page')
      return ok ? savedId ?? id ?? null : null
    },
    setPrice: (id: string, price: number) => run(supabase!.from('booking_packages').update({ price, updated_at: now() }).eq('id', id), 'Price saved, live on the page'),
    setActive: (id: string, active: boolean) => run(supabase!.from('booking_packages').update({ active, updated_at: now() }).eq('id', id), active ? 'Shown again' : 'Hidden from the page'),
    remove: (id: string) => run(supabase!.from('booking_packages').delete().eq('id', id), 'Package deleted'),
  }
}

type Form = {
  flow_id: string; kind: 'option' | 'extra'; label: string; note: string; includes: string; price: string
  perUnit: boolean; unitLabel: string; unitPlural: string; unitMin: string; unitMax: string; maxQty: string; active: boolean
}
const blank = (flowId = ''): Form => ({ flow_id: flowId, kind: 'option', label: '', note: '', includes: '', price: '', perUnit: false, unitLabel: '', unitPlural: '', unitMin: '1', unitMax: '10', maxQty: '', active: true })
const fromRow = (r: BookingPackage): Form => ({
  flow_id: r.flow_id, kind: r.kind, label: r.label, note: r.note ?? '', includes: (r.includes ?? []).join('\n'), price: String(Number(r.price) || 0),
  perUnit: !!r.unit?.label, unitLabel: r.unit?.label ?? '', unitPlural: r.unit?.plural ?? '', unitMin: String(r.unit?.min ?? 1), unitMax: String(r.unit?.max ?? 10),
  maxQty: r.max_qty ? String(r.max_qty) : '', active: r.active,
})

/** The "+ Add package" form (also used to edit one). */
export function PackageForm({ initial, flowId, rows, onSave, onClose }: {
  initial?: BookingPackage; flowId?: string; rows: BookingPackage[]
  onSave: (row: Partial<BookingPackage>, id?: string) => Promise<string | null>; onClose: () => void
}) {
  const cp = useCardPhotos()
  const [f, setF] = useState<Form>(initial ? fromRow(initial) : blank(flowId))
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const set = <K extends keyof Form>(k: K, v: Form[K]) => { setF((c) => ({ ...c, [k]: v })); setErr('') }
  const page = flows[f.flow_id]
  const isPackage = f.kind === 'option'
  // pages with one card per package (Wedding, Videography, Academy …) give an added package its own card and photo
  const hasPhoto = isPackage && !!page && cardPerPackage(f.flow_id)
  const photoCard = hasPhoto ? photoCardsFor(f.flow_id, initial ? [initial] : [{ id: 'new', flow_id: f.flow_id, kind: 'option', label: f.label || 'this package', price: 0, active: true }]).find((c) => c.added) : undefined
  const savedPhoto = initial && photoCard ? cp.current(photoCard) : ''
  const [photo, setPhoto] = useState('')
  const [picking, setPicking] = useState(false)
  const shownPhoto = photo || savedPhoto || photoCard?.original || ''

  async function submit() {
    const price = f.price.trim() === '' ? 0 : Number(f.price)
    const min = Number(f.unitMin), max = Number(f.unitMax)
    if (!page) return setErr('Choose the page this package goes on.')
    if (!f.label.trim()) return setErr('Enter a name.')
    if (!Number.isFinite(price) || price < 0) return setErr('Enter a price of 0 or more (0 means you quote it).')
    if (isPackage && f.perUnit) {
      if (!f.unitLabel.trim()) return setErr('Say what the price is per, e.g. look or hour.')
      if (!Number.isInteger(min) || !Number.isInteger(max) || min < 1 || max < min || max > 99) return setErr('The fewest and most must be whole numbers, with the most at least the fewest (up to 99).')
    }
    if (!isPackage && f.maxQty.trim() && !(Number.isInteger(Number(f.maxQty)) && Number(f.maxQty) >= 1 && Number(f.maxQty) <= 100)) return setErr('The most a client can choose must be a whole number from 1 to 100.')
    const unitLabel = f.unitLabel.trim().replace(/^per\s+/i, '')
    const row: Partial<BookingPackage> = {
      flow_id: f.flow_id,
      kind: f.kind,
      label: f.label.trim(),
      note: f.note.trim(),
      includes: isPackage ? f.includes.split('\n').map((x) => x.replace(/^[•\-*]\s*/, '').trim()).filter(Boolean) : [],
      price: Math.round(price * 100) / 100,
      unit: isPackage && f.perUnit ? { label: unitLabel, plural: f.unitPlural.trim() || `${unitLabel}s`, min, max, def: min } : null,
      max_qty: !isPackage && f.maxQty.trim() ? Number(f.maxQty) : null,
      active: f.active,
    }
    if (!initial) row.sort_order = Math.max(0, ...rows.filter((r) => r.flow_id === f.flow_id && r.kind === f.kind).map((r) => Number(r.sort_order) || 0)) + 1
    setBusy(true)
    const savedId = await onSave(row, initial?.id)
    if (savedId && hasPhoto && photo && photo !== savedPhoto) await cp.set(`${f.flow_id}:${packageItemId({ id: savedId })}`, photo)
    setBusy(false)
    if (savedId) onClose()
  }

  return (
    <Modal title={initial ? `Edit ${initial.label}` : 'Add a package'} onClose={onClose}>
      <div className="ad-form">
        <Field label="Page" full hint={initial ? undefined : 'The page and booking form this package is added to.'}>
          <select value={f.flow_id} autoFocus={!initial} onChange={(e) => set('flow_id', e.target.value)}>
            <option value="">Choose a page…</option>
            {PACKAGE_PAGES.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        </Field>
        <div className="ad-field full">
          <span>Type</span>
          <div className="ad-seg" role="group" aria-label="Type" style={{ marginBottom: 0 }}>
            <button type="button" className={isPackage ? 'on' : ''} aria-pressed={isPackage} onClick={() => set('kind', 'option')}>Package</button>
            <button type="button" className={!isPackage ? 'on' : ''} aria-pressed={!isPackage} onClick={() => set('kind', 'extra')}>Add-on</button>
          </div>
          <small>{isPackage ? 'Clients choose it as their package, and it is shown on the page’s price cards.' : `An extra clients can add in the ${page?.extrasTitle?.toLowerCase() ?? 'add-ons'} step of the booking form.`}</small>
        </div>
        <Field label="Name" full><input type="text" value={f.label} maxLength={120} onChange={(e) => set('label', e.target.value)} placeholder={isPackage ? 'e.g. 3 Looks' : 'e.g. Hair styling'} /></Field>
        <Field label="Short line under the name" full><input type="text" value={f.note} maxLength={200} onChange={(e) => set('note', e.target.value)} placeholder={isPackage ? 'e.g. 12 edited pictures' : 'e.g. per person'} /></Field>
        <Field label="Price (£)" hint="0 means the price is quoted later.">
          <input type="number" min="0" step="0.01" inputMode="decimal" value={f.price} onChange={(e) => set('price', e.target.value)} />
        </Field>
        {isPackage ? (
          <Field label="Price is">
            <select value={f.perUnit ? 'unit' : 'fixed'} onChange={(e) => set('perUnit', e.target.value === 'unit')}>
              <option value="fixed">One price for the package</option>
              <option value="unit">Per look, hour or person …</option>
            </select>
          </Field>
        ) : (
          <Field label="Most a client can choose" hint="Leave empty for a simple tick box.">
            <input type="number" min="1" max="100" value={f.maxQty} onChange={(e) => set('maxQty', e.target.value)} />
          </Field>
        )}
        {isPackage && f.perUnit && (
          <>
            <Field label="Per" hint="e.g. look, hour, person"><input type="text" value={f.unitLabel} onChange={(e) => set('unitLabel', e.target.value)} /></Field>
            <Field label="Plural" hint={`Empty = “${(f.unitLabel.trim() || 'look')}s”`}><input type="text" value={f.unitPlural} onChange={(e) => set('unitPlural', e.target.value)} /></Field>
            <Field label="Fewest"><input type="number" min="1" max="99" value={f.unitMin} onChange={(e) => set('unitMin', e.target.value)} /></Field>
            <Field label="Most"><input type="number" min="1" max="99" value={f.unitMax} onChange={(e) => set('unitMax', e.target.value)} /></Field>
          </>
        )}
        {isPackage && (
          <Field label="What's included" full hint="One per line. Shown on the card and in the booking form.">
            <textarea rows={4} value={f.includes} onChange={(e) => set('includes', e.target.value)} placeholder={'All pictures in an online gallery\nA photo frame'} />
          </Field>
        )}
        {hasPhoto && photoCard && (
          <div className="ad-field full">
            <span>Card photo</span>
            <div className="cp-field">
              <img src={shownPhoto} alt="" />
              <div>
                <button type="button" className="ad-btn sm" onClick={() => setPicking(true)}>Choose photo</button>
                <small style={{ display: 'block', marginTop: 6 }}>{photo || (initial && cp.changed(photoCard)) ? 'Your photo for this card.' : `Starts with the page’s first photo until you choose one.`}</small>
              </div>
            </div>
          </div>
        )}
        {isPackage && page && !cardPerPackage(f.flow_id) && <p className="ad-muted" style={{ gridColumn: '1 / -1' }}>On {page.title} packages are rows on one card, so this package has no photo of its own. Change the card’s photo under Card photos.</p>}
        <label className="ad-check" style={{ gridColumn: '1 / -1' }}><input type="checkbox" checked={f.active} onChange={(e) => set('active', e.target.checked)} />Show it on the page now</label>
        {err && <p className="ad-err full" role="alert" style={{ gridColumn: '1 / -1' }}>{err}</p>}
        {page && f.label.trim() && (
          <p className="ad-muted" style={{ gridColumn: '1 / -1' }}>
            Clients will see <b>{f.label.trim()}</b> on {page.title}
            {Number(f.price) > 0 ? <> for <b>{gbp(Number(f.price))}{isPackage && f.perUnit && f.unitLabel.trim() ? ` per ${f.unitLabel.trim().replace(/^per\s+/i, '')}` : ''}</b></> : ', priced on request'}.
          </p>
        )}
        <div className="ad-formfoot">
          <button className="ad-btn" disabled={busy} onClick={onClose}>Cancel</button>
          <button className="ad-btn primary" disabled={busy} onClick={submit}>{busy ? 'Saving…' : initial ? 'Save package' : 'Add package'}</button>
        </div>
      </div>
      {picking && photoCard && <PhotoPicker card={{ ...photoCard, title: f.label.trim() || 'this package' }} current={shownPhoto} photos={cp.photos} onPick={async (u) => setPhoto(u)} onClose={() => setPicking(false)} />}
    </Modal>
  )
}
