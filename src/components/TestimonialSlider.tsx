import { useCallback, useEffect, useRef, useState } from 'react'

export type Testimonial = { quote: string; author: string; role: string }
export type TestimonialClasses = {
  section?: string; container?: string; content?: string; quote?: string; author?: string
  role?: string; controls?: string; prev?: string; next?: string
}

/** Fading testimonials carousel: auto-advances every 6s, prev/next buttons reset the timer. */
export function TestimonialSlider({ items, cls = {} }: { items: Testimonial[]; cls?: TestimonialClasses }) {
  const [index, setIndex] = useState(0)
  const [shown, setShown] = useState(0)
  const [fading, setFading] = useState(false)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  const swap = useRef<ReturnType<typeof setTimeout> | null>(null)

  const go = useCallback((dir: number) => setIndex((i) => (i + dir + items.length) % items.length), [items.length])

  const startAuto = useCallback(() => {
    if (timer.current) clearInterval(timer.current)
    timer.current = setInterval(() => go(1), 6000)
  }, [go])

  useEffect(() => {
    startAuto()
    return () => { if (timer.current) clearInterval(timer.current) }
  }, [startAuto])

  // fade out, swap text after 300ms, fade back in
  useEffect(() => {
    if (index === shown) return
    setFading(true)
    if (swap.current) clearTimeout(swap.current)
    swap.current = setTimeout(() => { setShown(index); setFading(false) }, 300)
    return () => { if (swap.current) clearTimeout(swap.current) }
  }, [index, shown])

  const t = items[shown]
  return (
    <section className={cls.section}>
      <div className={cls.container}>
        <div className={cls.content} style={{ opacity: fading ? 0 : 1, transform: fading ? 'translateX(12px)' : 'translateX(0)' }}>
          <p className={cls.quote}>{`“${t.quote}”`}</p>
          <h4 className={cls.author}>{t.author}</h4>
          <span className={cls.role}>{t.role}</span>
        </div>
        <div className={cls.controls}>
          <button className={cls.prev} aria-label="Previous testimonial" onClick={() => { go(-1); startAuto() }}>❮</button>
          <button className={cls.next} aria-label="Next testimonial" onClick={() => { go(1); startAuto() }}>❯</button>
        </div>
      </div>
    </section>
  )
}
