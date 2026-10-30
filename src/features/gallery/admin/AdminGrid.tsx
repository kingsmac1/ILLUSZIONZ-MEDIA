/** Thumbnail grid for the Gallery Manager: select, delete, set cover, drag to reorder, picks + notes + finals matching. */
import { useMemo, useState, type ReactNode } from 'react'
import type { ViewImage } from '../types'

export type PickInfo = { note: string | null }

export function AdminGrid({ images, picks, coverId, matches, onCover, onDelete, onReorder, onSortByName, extraTools }: {
  images: ViewImage[]
  picks?: Map<string, PickInfo>
  coverId?: string | null
  /** finals: image id -> matched proof filename (or null = no match) */
  matches?: Map<string, string | null>
  onCover: (id: string) => void
  onDelete: (ids: string[]) => Promise<void>
  onReorder: (ids: string[]) => void
  onSortByName: () => void
  extraTools?: ReactNode
}) {
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [drag, setDrag] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'picked' | 'problems'>('all')
  const view = useMemo(() => images.filter((i) => filter === 'all' || (filter === 'picked' ? picks?.has(i.id) : i.status !== 'ready' || matches?.get(i.id) === null)), [images, filter, picks, matches])

  const toggle = (id: string) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  function drop(target: string) {
    if (!drag || drag === target) return
    const ids = images.map((i) => i.id).filter((id) => id !== drag)
    ids.splice(ids.indexOf(target), 0, drag)
    onReorder(ids)
  }
  const problems = images.filter((i) => i.status !== 'ready').length + (matches ? [...matches.values()].filter((v) => v === null).length : 0)

  return (
    <div>
      <div className="gm-toolbar">
        <div className="ad-seg" role="group" aria-label="Filter photos" style={{ display: 'flex', gap: 4 }}>
          <button className={'ad-btn sm' + (filter === 'all' ? ' primary' : '')} onClick={() => setFilter('all')}>All {images.length}</button>
          {picks && <button className={'ad-btn sm' + (filter === 'picked' ? ' primary' : '')} onClick={() => setFilter('picked')}>♥ Picked {picks.size}</button>}
          {problems > 0 && <button className={'ad-btn sm' + (filter === 'problems' ? ' primary' : '')} onClick={() => setFilter('problems')}>Needs attention {problems}</button>}
        </div>
        <span className="sp" />
        {extraTools}
        <button className="ad-btn sm" onClick={onSortByName} title="Camera order">Sort by filename</button>
        {sel.size > 0 && <>
          <button className="ad-btn sm" onClick={() => setSel(new Set())}>Clear selection ({sel.size})</button>
          {sel.size === 1 && <button className="ad-btn sm" onClick={() => { onCover([...sel][0]); setSel(new Set()) }}>Set as cover</button>}
          <button className="ad-btn sm danger" onClick={async () => { if (window.confirm(`Delete ${sel.size} photo${sel.size === 1 ? '' : 's'} permanently?`)) { await onDelete([...sel]); setSel(new Set()) } }}>Delete {sel.size}</button>
        </>}
        {sel.size === 0 && images.length > 0 && <button className="ad-btn sm" onClick={() => setSel(new Set(view.map((i) => i.id)))}>Select all</button>}
      </div>
      <div className="gm-grid">
        {view.map((img) => {
          const pick = picks?.get(img.id)
          const match = matches?.get(img.id)
          return (
            <div
              key={img.id}
              className={'gm-tile' + (sel.has(img.id) ? ' sel' : '') + (pick ? ' picked' : '') + (drag === img.id ? ' dragging' : '') + (overId === img.id && drag !== img.id ? ' dropbefore' : '')}
              draggable={filter === 'all'}
              onDragStart={(e) => { setDrag(img.id); e.dataTransfer.effectAllowed = 'move' }}
              onDragEnd={() => { setDrag(null); setOverId(null) }}
              onDragOver={(e) => { if (drag) { e.preventDefault(); setOverId(img.id) } }}
              onDrop={(e) => { e.preventDefault(); drop(img.id); setDrag(null); setOverId(null) }}
              onClick={() => toggle(img.id)}
              title={img.filename}
            >
              {img.thumb ? <img src={img.thumb} alt={img.filename} loading="lazy" draggable={false} /> : null}
              {img.status !== 'ready' && <div className={'st ' + img.status}>{img.status === 'failed' ? 'Upload failed' : 'Uploading…'}</div>}
              <button className="cb" aria-label={`Select ${img.filename}`} aria-pressed={sel.has(img.id)} onClick={(e) => { e.stopPropagation(); toggle(img.id) }}>{sel.has(img.id) ? '✓' : ''}</button>
              {coverId === img.id && <span className="cover">Cover</span>}
              {pick && <span className="heart" aria-label="Picked by the client">♥</span>}
              {matches && img.status === 'ready' && <span className={'match' + (match ? '' : ' no')}>{match ? `↔ ${match}` : 'no matching pick'}</span>}
              <span className="cap">{img.filename}{pick?.note ? <em>“{pick.note}”</em> : null}</span>
            </div>
          )
        })}
      </div>
      {!view.length && <p className="ad-muted" style={{ padding: '18px 0' }}>{images.length ? 'Nothing matches this filter.' : 'No photos yet — drop some above.'}</p>}
    </div>
  )
}
