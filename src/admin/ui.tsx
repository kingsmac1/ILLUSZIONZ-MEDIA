import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { R } from './data'

/* ----------------------------- formatting ----------------------------- */
export const gbp = (n: number | string | null | undefined) => `£${Number(n ?? 0).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
export const fmtDate = (v?: string | null, withTime = false) => {
  if (!v) return '—'
  const d = new Date(v.length === 10 ? v + 'T12:00:00' : v)
  if (Number.isNaN(d.getTime())) return v
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}) })
}
export const ago = (v?: string | null) => {
  if (!v) return '—'
  const s = (Date.now() - new Date(v).getTime()) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`
  return fmtDate(v)
}
export const todayIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export const addDaysIso = (iso: string, n: number) => {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export const initials = (n: string) => n.split(/\s+/).map((x) => x[0]).slice(0, 2).join('').toUpperCase()
export const waLink = (phone: string, text = '') => `https://wa.me/${phone.replace(/[^\d]/g, '')}${text ? `?text=${encodeURIComponent(text)}` : ''}`

export function downloadCsv(name: string, rows: R[]) {
  if (!rows.length) return
  const cols = Object.keys(rows[0])
  const cell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => cell(Array.isArray(r[c]) ? r[c].join('; ') : r[c])).join(','))].join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `${name}-${todayIso()}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

/** Minimal CSV parser (quotes, commas, newlines) for contact import. */
export function parseCsv(text: string): R[] {
  const rows: string[][] = []
  let row: string[] = []
  let cur = ''
  let q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cur += '"'; i++ }
      else if (c === '"') q = false
      else cur += c
    } else if (c === '"') q = true
    else if (c === ',') { row.push(cur); cur = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(cur); cur = ''
      if (row.some((x) => x.trim())) rows.push(row)
      row = []
    } else cur += c
  }
  row.push(cur)
  if (row.some((x) => x.trim())) rows.push(row)
  const [head, ...rest] = rows
  if (!head) return []
  const keys = head.map((h) => h.trim().toLowerCase())
  return rest.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()])))
}

/* ------------------------------- components ------------------------------- */
const TONES: Record<string, string> = {
  new: 'blue', confirmed: 'green', completed: 'dark', cancelled: 'red', read: 'grey', replied: 'green', archived: 'grey',
  'Not Paid': 'red', 'Deposit Paid': 'amber', Paid: 'green', Refunded: 'grey',
  lead: 'blue', opportunity: 'violet', client: 'green', vip: 'gold', subscriber: 'grey', inactive: 'grey', lost: 'red',
  sent: 'green', failed: 'red', pending: 'amber', skipped: 'grey', draft: 'grey', sending: 'amber',
  high: 'red', normal: 'grey', low: 'grey',
}
export const Badge = ({ children, tone }: { children: ReactNode; tone?: string }) => <span className={'ad-badge ' + (tone ?? TONES[String(children)] ?? 'grey')}>{children}</span>

export function Modal({ title, onClose, children, wide, drawer, xl }: { title: ReactNode; onClose: () => void; children: ReactNode; wide?: boolean; drawer?: boolean; xl?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', k)
      document.body.style.overflow = ''
    }
  }, [onClose])
  return (
    <div className="ad-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={'ad-modal' + (wide ? ' wide' : '') + (xl ? ' xl' : '') + (drawer ? ' drawer' : '')} role="dialog" aria-modal="true">
        <header>
          <h3>{title}</h3>
          <button className="ad-x" onClick={onClose} aria-label="Close">×</button>
        </header>
        <div className="ad-modal-body">{children}</div>
      </div>
    </div>
  )
}

export const Field = ({ label, children, hint, full }: { label: string; children: ReactNode; hint?: string; full?: boolean }) => (
  <label className={'ad-field' + (full ? ' full' : '')}>
    <span>{label}</span>
    {children}
    {hint && <small>{hint}</small>}
  </label>
)

export const Empty = ({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) => (
  <div className="ad-empty">
    <strong>{title}</strong>
    {hint && <p>{hint}</p>}
    {action}
  </div>
)

export function PageHead({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) {
  return (
    <div className="ad-pagehead">
      <div>
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      <div className="ad-actions">{actions}</div>
    </div>
  )
}

export const Stat = ({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: string }) => (
  <div className={'ad-stat ' + (tone ?? '')}>
    <span>{label}</span>
    <strong>{value}</strong>
    {sub && <small>{sub}</small>}
  </div>
)

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string; count?: number }[]; value: T; onChange: (t: T) => void }) {
  return (
    <div className="ad-tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} className={value === t.id ? 'on' : ''} onClick={() => onChange(t.id)}>
          {t.label}
          {t.count != null && <em>{t.count}</em>}
        </button>
      ))}
    </div>
  )
}

export function Confirm({ text, onYes, children, className }: { text: string; onYes: () => void; children: ReactNode; className?: string }) {
  return (
    <button className={className ?? 'ad-btn danger sm'} onClick={() => window.confirm(text) && onYes()}>
      {children}
    </button>
  )
}

/** Horizontal bar list for simple charts. */
export function Bars({ rows, money, color }: { rows: { label: string; value: number; sub?: string }[]; money?: boolean; color?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <div className="ad-bars">
      {rows.map((r) => (
        <div key={r.label} className="ad-bar">
          <span className="l">{r.label}</span>
          <span className="t"><i style={{ width: `${(r.value / max) * 100}%`, background: color }} /></span>
          <b>{money ? gbp(r.value) : r.value}{r.sub ? <small> {r.sub}</small> : null}</b>
        </div>
      ))}
      {!rows.length && <p className="ad-muted">No data yet.</p>}
    </div>
  )
}

/** Vertical column chart (months etc). */
export function Columns({ rows, money }: { rows: { label: string; a: number; b?: number }[]; money?: boolean }) {
  const max = Math.max(1, ...rows.flatMap((r) => [r.a, r.b ?? 0]))
  return (
    <div className="ad-cols">
      {rows.map((r) => (
        <div key={r.label} className="col" title={`${r.label}: ${money ? gbp(r.a) : r.a}${r.b != null ? ` / ${money ? gbp(r.b) : r.b}` : ''}`}>
          <div className="stack">
            <i className="a" style={{ height: `${(r.a / max) * 100}%` }} />
            {r.b != null && <i className="b" style={{ height: `${(r.b / max) * 100}%` }} />}
          </div>
          <span>{r.label}</span>
        </div>
      ))}
    </div>
  )
}

export function useDebounced<T>(v: T, ms = 250) {
  const [x, setX] = useState(v)
  useEffect(() => {
    const t = setTimeout(() => setX(v), ms)
    return () => clearTimeout(t)
  }, [v, ms])
  return x
}

export function useLocalState<T>(key: string, initial: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(() => {
    try {
      const raw = localStorage.getItem('ad:' + key)
      return raw ? (JSON.parse(raw) as T) : initial
    } catch {
      return initial
    }
  })
  const ref = useRef(key)
  return [v, (n: T) => {
    setV(n)
    try { localStorage.setItem('ad:' + ref.current, JSON.stringify(n)) } catch { /* ignore */ }
  }]
}

export function Pager({ page, pages, onChange }: { page: number; pages: number; onChange: (n: number) => void }) {
  if (pages <= 1) return null
  return (
    <div className="ad-pager">
      <button className="ad-btn sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>← Prev</button>
      <span>Page {page} of {pages}</span>
      <button className="ad-btn sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>Next →</button>
    </div>
  )
}
