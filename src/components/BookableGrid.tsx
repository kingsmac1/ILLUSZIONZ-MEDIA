import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { flows } from '../booking/catalog'
import { BookingPanel } from '../booking/BookingPanel'
import './service-cards.css'

export type CardRow = { label: string; note?: string; price?: string; optionId?: string }

export type CardDef = {
  flowId: string
  /** option preselected when the card CTA is used */
  optionId?: string
  title: string
  image?: string
  /** small text above the price, e.g. "From" */
  fromLabel?: string
  /** big bold price, e.g. "£170" ; omit for quoted services */
  price?: string
  priceNote?: string
  /** text shown instead of a price: "Open for consultation" */
  quoteLabel?: string
  description?: string
  bullets?: string[]
  rows?: CardRow[]
  cta: string
  /** CMS products without a booking form: the CTA is an external link (e.g. Selar) */
  href?: string
}

type Open = { flowId: string; optionId?: string; key: number } | null

/**
 * A grid of price cards. Choosing a card (or one of its price rows) slides a multi-step booking
 * form open directly underneath and scrolls to it.
 */
export function BookableGrid({ cards, columns = 3, id, children }: { cards: CardDef[]; columns?: 2 | 3 | 4; id?: string; children?: ReactNode }) {
  const [open, setOpen] = useState<Open>(null)
  const slotRef = useRef<HTMLDivElement>(null)

  const choose = useCallback((flowId: string, optionId?: string) => {
    setOpen((cur) => ({ flowId, optionId, key: (cur?.key ?? 0) + 1 }))
  }, [])

  // any element with data-book="flow:option" (e.g. a button elsewhere on the page) opens the form
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest?.('[data-book]') as HTMLElement | null
      if (!el) return
      const [f, o] = (el.getAttribute('data-book') ?? '').split(':')
      if (cards.some((c) => c.flowId === f)) {
        e.preventDefault()
        choose(f, o || undefined)
      }
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [cards, choose])

  // deep link: /page/#book-portrait opens the form
  useEffect(() => {
    const h = window.location.hash.replace('#book-', '')
    if (h && cards.some((c) => c.flowId === h)) choose(h, cards.find((c) => c.flowId === h)?.optionId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => slotRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 140)
    return () => clearTimeout(t)
  }, [open?.key]) // eslint-disable-line react-hooks/exhaustive-deps

  const flow = open ? flows[open.flowId] : null

  return (
    <div className="sc-wrap" id={id}>
      <div className={`sc-grid sc-cols-${columns}`}>
        {cards.map((c) => {
          const active = open?.flowId === c.flowId
          return (
            <article key={c.title} className={'sc-card' + (active ? ' is-active' : '')}>
              {c.image && (
                c.href ? (
                  <a className="sc-img" href={c.href} target="_blank" rel="noreferrer" aria-label={`${c.cta}: ${c.title}`} tabIndex={-1}>
                    <img src={c.image} alt={c.title} loading="lazy" />
                  </a>
                ) : (
                  <button type="button" className="sc-img" onClick={() => choose(c.flowId, c.optionId)} aria-label={`${c.cta}: ${c.title}`} tabIndex={-1}>
                    <img src={c.image} alt={c.title} loading="lazy" />
                  </button>
                )
              )}
              <div className="sc-body">
                <h3>{c.title}</h3>
                {c.description && <p className="sc-desc">{c.description}</p>}
                {c.price ? (
                  <div className="sc-price">
                    {c.fromLabel && <span>{c.fromLabel}</span>}
                    <strong>{c.price}</strong>
                    {c.priceNote && <em>{c.priceNote}</em>}
                  </div>
                ) : (
                  c.quoteLabel && <div className="sc-price is-quote"><strong>{c.quoteLabel}</strong></div>
                )}
                {c.bullets && (
                  <ul className="sc-bullets">
                    {c.bullets.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                )}
                {c.rows && (
                  <ul className="sc-rows">
                    {c.rows.map((r) => (
                      <li key={r.label}>
                        {r.optionId ? (
                          <button type="button" onClick={() => choose(c.flowId, r.optionId)}>
                            <span>{r.label}{r.note && <small>{r.note}</small>}</span>
                            {r.price && <b>{r.price}</b>}
                          </button>
                        ) : (
                          <div>
                            <span>{r.label}{r.note && <small>{r.note}</small>}</span>
                            {r.price && <b>{r.price}</b>}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {c.href ? (
                  <a className="sc-cta" href={c.href} target="_blank" rel="noreferrer">
                    {c.cta} <span aria-hidden="true">→</span>
                  </a>
                ) : (
                  <button type="button" className="sc-cta" onClick={() => choose(c.flowId, c.optionId)} aria-expanded={active}>
                    {c.cta} <span aria-hidden="true">→</span>
                  </button>
                )}
              </div>
            </article>
          )
        })}
      </div>
      {children}
      <div ref={slotRef} className="bk-slot">
        <AnimatePresence mode="wait" initial={false}>
          {flow && open && (
            <motion.div
              key={open.key}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              style={{ overflow: 'hidden' }}
            >
              <div className="bk-slot-inner">
                <BookingPanel flow={flow} initialOptionId={open.optionId} onClose={() => setOpen(null)} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

/** A single call-to-action button that slides a booking form open under itself (360 booth, agency …). */
export function BookNow({ flowId, optionId, label, className }: { flowId: string; optionId?: string; label: string; className?: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 140)
    return () => clearTimeout(t)
  }, [open])
  useEffect(() => {
    if (window.location.hash === `#book-${flowId}`) setOpen(true)
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest?.('[data-book]') as HTMLElement | null
      if (el && (el.getAttribute('data-book') ?? '').split(':')[0] === flowId) {
        e.preventDefault()
        setOpen(true)
      }
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [flowId])
  return (
    <div className="sc-book">
      <button type="button" className={className ?? 'sc-book-btn'} onClick={() => setOpen(true)} aria-expanded={open}>
        {label}
      </button>
      <div ref={ref} className="bk-slot">
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              style={{ overflow: 'hidden' }}
            >
              <div className="bk-slot-inner">
                <BookingPanel flow={flows[flowId]} initialOptionId={optionId} onClose={() => setOpen(false)} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
