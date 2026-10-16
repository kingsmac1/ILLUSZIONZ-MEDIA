import { useEffect, useRef, useState } from 'react'
import './careers.css'

export type Role = { title: string; meta: string; text: string; open?: boolean }

/** "Open Roles" accordion (smooth expand/collapse, several rows may be open at once). */
export function CareersAccordion({ items }: { items: Role[] }) {
  const [open, setOpen] = useState<boolean[]>(() => items.map((i) => !!i.open))
  const [heights, setHeights] = useState<number[]>(() => items.map(() => 0))
  const refs = useRef<(HTMLDivElement | null)[]>([])

  const measure = () => setHeights(items.map((_, i) => refs.current[i]?.scrollHeight ?? 0))
  useEffect(() => {
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggle = (i: number) => {
    measure()
    setOpen((o) => o.map((v, j) => (j === i ? !v : v)))
  }

  return (
    <div className="careers">
      {items.map((it, i) => (
        <div className={'career-item' + (open[i] ? ' active' : '')} key={it.title}>
          <div
            className="career-header"
            role="button"
            tabIndex={0}
            aria-expanded={open[i]}
            onClick={() => toggle(i)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                toggle(i)
              }
            }}
          >
            <div className="career-left">
              <h2 className="career-title">{it.title}</h2>
              <span className="career-meta">{it.meta}</span>
            </div>
            <div className="toggle-btn">
              <svg viewBox="0 0 24 24">
                {!open[i] && <line x1="12" y1="5" x2="12" y2="19" />}
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </div>
          </div>
          <div
            className="career-content"
            ref={(el) => {
              refs.current[i] = el
            }}
            style={{ maxHeight: open[i] ? heights[i] || undefined : 0 }}
          >
            <p>{it.text}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
