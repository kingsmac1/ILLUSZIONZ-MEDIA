import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

/** Row selection for a table: select one, select the visible page, select everything that matches the filters. */
export function useSelection(allIds: string[]) {
  const [sel, setSel] = useState<Set<string>>(new Set())
  // rows that disappear (deleted, filtered out) are dropped from the selection
  const key = allIds.join('|')
  useEffect(() => {
    setSel((cur) => {
      if (!cur.size) return cur
      const live = new Set(allIds)
      const next = new Set([...cur].filter((x) => live.has(x)))
      return next.size === cur.size ? cur : next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return useMemo(
    () => ({
      sel,
      ids: [...sel],
      count: sel.size,
      has: (id: string) => sel.has(id),
      toggle: (id: string) => setSel((c) => { const n = new Set(c); n.has(id) ? n.delete(id) : n.add(id); return n }),
      setMany: (ids: string[], on: boolean) => setSel((c) => { const n = new Set(c); ids.forEach((i) => (on ? n.add(i) : n.delete(i))); return n }),
      selectAll: () => setSel(new Set(allIds)),
      clear: () => setSel(new Set()),
      total: allIds.length,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sel, key],
  )
}
export type Selection = ReturnType<typeof useSelection>

/** Header checkbox: selects/deselects the rows currently shown. */
export function SelectAllBox({ s, view }: { s: Selection; view: string[] }) {
  const ref = useRef<HTMLInputElement>(null)
  const n = view.filter((id) => s.has(id)).length
  useEffect(() => { if (ref.current) ref.current.indeterminate = n > 0 && n < view.length }, [n, view.length])
  return <input ref={ref} type="checkbox" className="ad-cb" aria-label="Select all rows on this page" checked={view.length > 0 && n === view.length} onChange={() => s.setMany(view, n !== view.length)} />
}

/** Row checkbox (stops the row click from opening the detail view). */
export function RowBox({ s, id, label }: { s: Selection; id: string; label: string }) {
  return (
    <input type="checkbox" className="ad-cb" aria-label={`Select ${label}`} checked={s.has(id)} onChange={() => s.toggle(id)} onClick={(e) => e.stopPropagation()} />
  )
}

/** Bar that appears while rows are selected. Children are the actions (use BulkBtn). */
export function BulkBar({ s, noun, plural, children }: { s: Selection; noun: string; plural?: string; children: ReactNode }) {
  if (!s.count) return null
  return (
    <div className="ad-bulk" role="region" aria-label="Bulk actions">
      <b>{s.count} {s.count === 1 ? noun : plural ?? `${noun}s`} selected</b>
      {s.count < s.total && <button type="button" className="ad-link" onClick={s.selectAll}>Select all {s.total}</button>}
      <span className="ad-bulk-actions">{children}</span>
      <button type="button" className="ad-btn sm" onClick={s.clear}>Clear</button>
    </div>
  )
}

export const BulkBtn = ({ onClick, danger, children, title }: { onClick: () => void; danger?: boolean; children: ReactNode; title?: string }) => (
  <button type="button" className={'ad-btn sm' + (danger ? ' danger' : '')} onClick={onClick} title={title}>{children}</button>
)

/** A compact dropdown of options that runs an action when one is picked. */
export function BulkSelect({ label, options, onPick }: { label: string; options: { value: string; label: string }[]; onPick: (v: string) => void }) {
  const [v, setV] = useState('')
  return (
    <select className="ad-btn sm" style={{ width: 'auto' }} value={v} aria-label={label} onChange={(e) => { const x = e.target.value; setV(''); if (x) onPick(x) }}>
      <option value="">{label}…</option>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

export const confirmN = (action: string, n: number, noun: string, extra = '') =>
  window.confirm(`${action} ${n} ${noun}${n === 1 ? '' : 's'}?${extra ? `\n\n${extra}` : ''}`)
