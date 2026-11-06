/**
 * Prices → "Packages on the website": every package card on every page, the built-in ones (Portrait Photography,
 * Silver Package …) and the ones added in the dashboard, each with Edit and Delete.
 * Built-in cards live in the code, so their changes are saved on top of them (settings.card_edits / option_edits and
 * price_overrides) and "Delete" takes the card off the website, where Restore can bring it back.
 */
import { useMemo, useState } from 'react'
import { PAGE_CARDS } from '../../booking/cards'
import { flows, formatGBP } from '../../booking/catalog'
import { cardKey, safePhoto } from '../../booking/cardPhotos'
import { applyCardEdits, cleanCardEdits, cleanOptionEdits, optionKey, type CardEdit, type CardEdits, type OptionEdits } from '../../booking/cardEdits'
import { packageItemId, type BookingPackage, type PriceOverride } from '../../booking/overrides'
import { servicePhotoKey, type BookingService } from '../../booking/services'
import type { CardDef } from '../../components/BookableGrid'
import { useData, useDb } from '../data'
import { Badge, Field, Modal } from '../ui'
import { PhotoPicker, cardPerPackage, firstPhoto, useCardPhotos } from './CardPhotos'

const SERVICE_PAGE = '/photography-services'

function useEdits() {
  const { setting, d } = useData()
  const db = useDb()
  const cardEdits = cleanCardEdits(setting('card_edits', {}))
  const optionEdits = cleanOptionEdits(setting('option_edits', {}))
  const overrides = d.price_overrides as PriceOverride[]
  const now = () => new Date().toISOString()
  return {
    cardEdits, optionEdits, overrides,
    saveCard: (next: CardEdits, ok: string) => db.upsert('settings', { key: 'card_edits', value: next, updated_at: now() }, 'key', ok),
    saveOptions: (next: OptionEdits, ok: string) => db.upsert('settings', { key: 'option_edits', value: next, updated_at: now() }, 'key', ok),
    savePrices: (rows: { flow_id: string; item_id: string; price: number; active: boolean }[], ok: string) =>
      rows.length ? db.upsert('price_overrides', rows.map((r) => ({ ...r, kind: 'option', updated_at: now() })), 'flow_id,kind,item_id', ok) : Promise.resolve({ ok: true as const, data: null }),
  }
}

type Line = { optionId: string; label: string; note: string; price: string; show: boolean; base: { label: string; note: string; price: number } }

/** Edit a built-in package card: its name, photo, description, price lines and button. */
function BuiltInForm({ card, onClose }: { card: CardDef; onClose: () => void }) {
  const ed = useEdits()
  const cp = useCardPhotos()
  const key = cardKey(card)
  const e: CardEdit = ed.cardEdits[key] ?? {}
  const flow = flows[card.flowId]
  const perPackage = !card.rows?.some((r) => r.optionId) && !!card.optionId
  const lineIds = perPackage ? [card.optionId!] : (card.rows ?? []).filter((r) => r.optionId).map((r) => r.optionId!)
  const ov = (id: string) => ed.overrides.find((r) => r.flow_id === card.flowId && r.kind === 'option' && r.item_id === id)
  const [title, setTitle] = useState(e.title ?? card.title)
  const [description, setDescription] = useState(e.description ?? card.description ?? '')
  const [priceNote, setPriceNote] = useState(e.priceNote ?? card.priceNote ?? '')
  const [bullets, setBullets] = useState((e.bullets ?? card.bullets ?? []).join('\n'))
  const [cta, setCta] = useState(e.cta ?? card.cta)
  const [lines, setLines] = useState<Line[]>(() => lineIds.map((id) => {
    const o = flow?.options.find((x) => x.id === id)
    const row = card.rows?.find((r) => r.optionId === id)
    const oe = ed.optionEdits[optionKey(card.flowId, id)] ?? {}
    const base = { label: row?.label ?? o?.label ?? id, note: row?.note ?? o?.note ?? '', price: o?.price ?? 0 }
    const p = ov(id)
    return { optionId: id, label: oe.label ?? base.label, note: oe.note ?? base.note, price: String(p ? Number(p.price) : base.price), show: p ? p.active : true, base }
  }))
  const [photo, setPhoto] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const savedPhoto = safePhoto(cp.photos[key])
  const shownPhoto = photo ?? (savedPhoto || card.image || '')
  const setLine = (n: number, p: Partial<Line>) => { setLines((ls) => ls.map((l, i) => (i === n ? { ...l, ...p } : l))); setErr('') }
  const edited = !!ed.cardEdits[key] || lineIds.some((id) => ed.optionEdits[optionKey(card.flowId, id)] || ov(id)) || !!savedPhoto

  async function save() {
    if (!title.trim()) return setErr('Enter the package name.')
    for (const [n, l] of lines.entries()) {
      if (!l.label.trim()) return setErr(`Price line ${n + 1} needs a name.`)
      const p = Number(l.price)
      if (l.price.trim() === '' || !Number.isFinite(p) || p < 0) return setErr(`${perPackage ? 'The price' : `Price line ${n + 1}`}: enter a price of 0 or more.`)
    }
    if (!perPackage && lines.length && !lines.some((l) => l.show)) return setErr('Keep at least one price line showing, or use Delete to take the whole package off the website.')
    setBusy(true)
    // wording: only what differs from the original is kept, so later changes to the built-in text still come through
    const ce: CardEdit = {}
    if (title.trim() !== card.title) ce.title = title.trim()
    if (description.trim() !== (card.description ?? '')) ce.description = description.trim()
    if (priceNote.trim() !== (card.priceNote ?? '')) ce.priceNote = priceNote.trim()
    const bl = bullets.split('\n').map((b) => b.replace(/^[•\-*]\s*/, '').trim()).filter(Boolean)
    if (bl.join('\n') !== (card.bullets ?? []).join('\n')) ce.bullets = bl
    if (cta.trim() && cta.trim() !== card.cta) ce.cta = cta.trim()
    const nextCards = { ...ed.cardEdits }
    if (Object.keys(ce).length) nextCards[key] = { ...ce, ...(e.hidden ? { hidden: true } : {}) }
    else if (e.hidden) nextCards[key] = { hidden: true }
    else delete nextCards[key]
    const nextOptions = { ...ed.optionEdits }
    for (const l of lines) {
      const k = optionKey(card.flowId, l.optionId)
      // a card that is one package is that package in the booking form, so its name is the option's name too
      const label = perPackage ? title.trim() : l.label.trim()
      const oe: { label?: string; note?: string } = {}
      if (label !== (perPackage ? card.title : l.base.label)) oe.label = label
      if (!perPackage && l.note.trim() !== l.base.note) oe.note = l.note.trim()
      if (Object.keys(oe).length) nextOptions[k] = oe
      else delete nextOptions[k]
    }
    const prices = lines.filter((l) => { const p = ov(l.optionId); return Number(l.price) !== (p ? Number(p.price) : l.base.price) || l.show !== (p ? p.active : true) })
      .map((l) => ({ flow_id: card.flowId, item_id: l.optionId, price: Math.round(Number(l.price) * 100) / 100, active: perPackage ? true : l.show }))
    const r1 = await ed.saveCard(nextCards, 'Package saved, live on the website')
    const r2 = r1.ok ? await ed.saveOptions(nextOptions, 'Price lines saved') : r1
    const r3 = r2.ok ? await ed.savePrices(prices, 'Prices saved') : r2
    if (r3.ok && photo !== null && photo !== savedPhoto) await cp.apply({ [key]: photo || null })
    setBusy(false)
    if (r3.ok) onClose()
  }

  async function resetAll() {
    if (!window.confirm(`Put ${card.title} back to how it was built (name, wording, prices and photo)?`)) return
    setBusy(true)
    const nextCards = { ...ed.cardEdits }
    if (e.hidden) nextCards[key] = { hidden: true }; else delete nextCards[key]
    const nextOptions = { ...ed.optionEdits }
    for (const id of lineIds) delete nextOptions[optionKey(card.flowId, id)]
    await ed.saveCard(nextCards, 'Back to the original wording')
    await ed.saveOptions(nextOptions, 'Price lines back to the original')
    await ed.savePrices(lineIds.filter((id) => ov(id)).map((id) => ({ flow_id: card.flowId, item_id: id, price: flow?.options.find((o) => o.id === id)?.price ?? 0, active: true })), 'Original prices back')
    if (savedPhoto) await cp.reset(key)
    setBusy(false)
    onClose()
  }

  return (
    <Modal title={`Edit ${card.title}`} onClose={onClose}>
      <div className="ad-form" data-builtin-form>
        <Field label="Package name" full><input type="text" maxLength={120} value={title} onChange={(ev) => { setTitle(ev.target.value); setErr('') }} /></Field>
        {(card.image || shownPhoto) && (
          <div className="ad-field full" data-package-photo>
            <span>Cover photo</span>
            <div className="cp-field">
              {shownPhoto ? <img src={shownPhoto} alt={`Cover photo for ${title}`} /> : <div className="cp-empty">No photo</div>}
              <div>
                <button type="button" className="ad-btn sm" onClick={() => setPicking(true)}>Change photo</button>{' '}
                {(photo ?? savedPhoto) && <button type="button" className="ad-btn sm" onClick={() => setPhoto('')}>Use the original photo</button>}
              </div>
            </div>
          </div>
        )}
        <Field label="Short description" full hint="Shown on the card. Leave empty for none.">
          <textarea rows={3} maxLength={600} value={description} onChange={(ev) => setDescription(ev.target.value)} />
        </Field>
        {perPackage ? (
          <>
            <Field label="Price (£)" hint={lines[0] && Number(lines[0].price) === 0 ? 'Shown as quoted.' : undefined}>
              <input type="number" min="0" step="0.01" value={lines[0]?.price ?? ''} onChange={(ev) => setLine(0, { price: ev.target.value })} />
            </Field>
            <Field label="Next to the price" hint="e.g. 8 hours"><input type="text" maxLength={120} value={priceNote} onChange={(ev) => setPriceNote(ev.target.value)} /></Field>
          </>
        ) : lines.length > 0 && (
          <div className="ad-field full">
            <span>Price lines</span>
            <small style={{ marginBottom: 8 }}>The choices on the card and in the booking form. Untick a line to stop offering it.</small>
            {lines.map((l, n) => (
              <div className="np-line np-builtin" key={l.optionId} data-price-line style={!l.show ? { opacity: .55 } : undefined}>
                <input type="text" aria-label={`Price line ${n + 1} name`} value={l.label} onChange={(ev) => setLine(n, { label: ev.target.value })} />
                <input type="text" aria-label={`Price line ${n + 1} detail`} value={l.note} onChange={(ev) => setLine(n, { note: ev.target.value })} />
                <input type="number" min="0" step="0.01" aria-label={`Price line ${n + 1} price (£)`} value={l.price} onChange={(ev) => setLine(n, { price: ev.target.value })} />
                <label className="ad-check" title="Offer this line"><input type="checkbox" aria-label={`Offer price line ${n + 1}`} checked={l.show} onChange={(ev) => setLine(n, { show: ev.target.checked })} />Show</label>
              </div>
            ))}
          </div>
        )}
        {(card.bullets || perPackage) && (
          <Field label="What's included" full hint="One per line.">
            <textarea rows={5} value={bullets} onChange={(ev) => setBullets(ev.target.value)} />
          </Field>
        )}
        <Field label="Button text" full><input type="text" maxLength={40} value={cta} onChange={(ev) => setCta(ev.target.value)} /></Field>
        {err && <p className="ad-err" role="alert" style={{ gridColumn: '1 / -1' }}>{err}</p>}
        <div className="ad-formfoot">
          {edited && <button type="button" className="ad-btn" style={{ marginRight: 'auto' }} disabled={busy} onClick={resetAll}>Reset to original</button>}
          <button className="ad-btn" disabled={busy} onClick={onClose}>Cancel</button>
          <button className="ad-btn primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save package'}</button>
        </div>
      </div>
      {picking && <PhotoPicker card={{ key, title, original: card.image ?? '' }} current={shownPhoto} photos={cp.photos} onPick={async (u) => setPhoto(u)} onClose={() => setPicking(false)} />}
    </Modal>
  )
}

type Item =
  | { kind: 'builtin'; card: CardDef; shown: CardDef | undefined; removed: boolean }
  | { kind: 'service'; service: BookingService }
  | { kind: 'added'; pkg: BookingPackage }

/** Every package card on the website, by page, with Edit and Delete. */
export function WebsitePackages({ services, added, onEditService, onDeleteService, onToggleService, onEditAdded, onDeleteAdded, onToggleAdded }: {
  services: BookingService[]; added: BookingPackage[]
  onEditService: (s: BookingService) => void; onDeleteService: (s: BookingService) => void; onToggleService: (s: BookingService) => void
  onEditAdded: (p: BookingPackage) => void; onDeleteAdded: (p: BookingPackage) => void; onToggleAdded: (p: BookingPackage) => void
}) {
  const ed = useEdits()
  const cp = useCardPhotos()
  const [editing, setEditing] = useState<CardDef | null>(null)
  const [open, setOpen] = useState<string>(PAGE_CARDS[0].path)

  const pages = useMemo(() => PAGE_CARDS.map((p) => {
    const builtin: Item[] = p.cards.filter((c) => !c.href).map((c) => {
      const shown = applyCardEdits([c], { edits: ed.cardEdits, optionEdits: ed.optionEdits, overrides: ed.overrides })[0]
      return { kind: 'builtin', card: c, shown, removed: !!ed.cardEdits[cardKey(c)]?.hidden }
    })
    const pageFlows = new Set(p.cards.map((c) => c.flowId))
    const extra: Item[] = [
      ...(p.path === SERVICE_PAGE ? services.map((s): Item => ({ kind: 'service', service: s })) : []),
      ...added.filter((r) => r.kind === 'option' && pageFlows.has(r.flow_id) && cardPerPackage(r.flow_id)).map((r): Item => ({ kind: 'added', pkg: r })),
    ]
    return { ...p, items: [...builtin, ...extra] }
  }), [services, added, ed.cardEdits, ed.optionEdits, ed.overrides])

  async function remove(c: CardDef) {
    if (!window.confirm(`Delete ${c.title} from the website? It comes off the page and can no longer be booked. Bookings already made keep it, and you can restore it here at any time.`)) return
    const key = cardKey(c)
    await ed.saveCard({ ...ed.cardEdits, [key]: { ...(ed.cardEdits[key] ?? {}), hidden: true } }, `${c.title} deleted from the website`)
    // a card that is one package (Silver …) is also taken out of the page's booking form
    if (c.optionId && !c.rows?.some((r) => r.optionId)) {
      const p = ed.overrides.find((r) => r.flow_id === c.flowId && r.kind === 'option' && r.item_id === c.optionId)
      await ed.savePrices([{ flow_id: c.flowId, item_id: c.optionId, price: p ? Number(p.price) : flows[c.flowId]?.options.find((o) => o.id === c.optionId)?.price ?? 0, active: false }], 'Taken out of the booking form')
    }
  }
  async function restore(c: CardDef) {
    const key = cardKey(c)
    const next = { ...ed.cardEdits }
    const { hidden: _h, ...rest } = next[key] ?? {}
    if (Object.keys(rest).length) next[key] = rest; else delete next[key]
    await ed.saveCard(next, `${c.title} is back on the website`)
    if (c.optionId && !c.rows?.some((r) => r.optionId)) {
      const p = ed.overrides.find((r) => r.flow_id === c.flowId && r.kind === 'option' && r.item_id === c.optionId)
      if (p && !p.active) await ed.savePrices([{ flow_id: c.flowId, item_id: c.optionId, price: Number(p.price), active: true }], 'Back in the booking form')
    }
  }

  const priceOf = (c: CardDef | undefined) => (c ? [c.fromLabel && c.price ? `from ${c.price}` : c.price, c.priceNote].filter(Boolean).join(' · ') || c.quoteLabel || '' : '')
  const current = pages.find((p) => p.path === open) ?? pages[0]

  return (
    <div className="ad-card" style={{ marginBottom: 16 }} data-website-packages>
      <h3>Packages on the website<small>edit or delete any package card</small></h3>
      <div className="ad-seg" role="tablist" aria-label="Website page">
        {pages.map((p) => <button key={p.path} type="button" role="tab" aria-selected={p.path === open} className={p.path === open ? 'on' : ''} onClick={() => setOpen(p.path)}>{p.page}<em>{p.items.length}</em></button>)}
      </div>
      <div className="np-list">
        {current.items.map((it) => {
          if (it.kind === 'builtin') {
            const c = it.shown ?? it.card
            const photo = safePhoto(cp.photos[cardKey(it.card)]) || it.card.image
            return (
              <div key={cardKey(it.card)} className="np-item" style={it.removed ? { opacity: .55 } : undefined} data-pkg={cardKey(it.card)}>
                {photo ? <img src={photo} alt="" /> : <div className="cp-empty">No photo</div>}
                <div className="np-text"><b>{c.title}</b> {it.removed && <Badge tone="red">deleted</Badge>}<span className="sub">{priceOf(it.shown) || priceOf(it.card)}{c.rows?.some((r) => r.optionId) ? ` · ${c.rows.filter((r) => r.optionId).map((r) => r.label).join(', ')}` : ''}</span></div>
                <div className="np-actions">
                  {it.removed ? <button className="ad-btn sm" onClick={() => restore(it.card)}>Restore</button> : <>
                    <button className="ad-btn sm" onClick={() => setEditing(it.card)}>Edit</button>
                    <button className="ad-btn sm danger" onClick={() => remove(it.card)}>Delete</button>
                  </>}
                </div>
              </div>
            )
          }
          if (it.kind === 'service') {
            const s = it.service
            const photo = safePhoto(cp.photos[servicePhotoKey(s)])
            const prices = (s.options ?? []).map((o) => `${o.label} ${Number(o.price) > 0 ? formatGBP(Number(o.price)) : 'quoted'}`).join(' · ')
            return (
              <div key={s.id} className="np-item" style={!s.active ? { opacity: .55 } : undefined} data-service={s.id}>
                {photo ? <img src={photo} alt="" /> : <div className="cp-empty">No photo</div>}
                <div className="np-text"><b>{s.title}</b> <Badge tone="blue">added</Badge> {!s.active && <Badge tone="grey">hidden</Badge>}<span className="sub">{prices}</span></div>
                <div className="np-actions">
                  <button className="ad-btn sm" onClick={() => onEditService(s)}>Edit</button>
                  <button className="ad-btn sm" onClick={() => onToggleService(s)}>{s.active ? 'Hide' : 'Show'}</button>
                  <button className="ad-btn sm danger" onClick={() => onDeleteService(s)}>Delete</button>
                </div>
              </div>
            )
          }
          const r = it.pkg
          const photo = safePhoto(cp.photos[`${r.flow_id}:${packageItemId(r)}`]) || firstPhoto(r.flow_id)
          return (
            <div key={r.id} className="np-item" style={!r.active ? { opacity: .55 } : undefined} data-added={r.id}>
              {photo ? <img src={photo} alt="" /> : <div className="cp-empty">No photo</div>}
              <div className="np-text"><b>{r.label}</b> <Badge tone="blue">added</Badge> {!r.active && <Badge tone="grey">hidden</Badge>}<span className="sub">{Number(r.price) > 0 ? formatGBP(Number(r.price)) : 'Quoted'}{r.note ? ` · ${r.note}` : ''}</span></div>
              <div className="np-actions">
                <button className="ad-btn sm" onClick={() => onEditAdded(r)}>Edit</button>
                <button className="ad-btn sm" onClick={() => onToggleAdded(r)}>{r.active ? 'Hide' : 'Show'}</button>
                <button className="ad-btn sm danger" onClick={() => onDeleteAdded(r)}>Delete</button>
              </div>
            </div>
          )
        })}
      </div>
      {editing && <BuiltInForm card={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
