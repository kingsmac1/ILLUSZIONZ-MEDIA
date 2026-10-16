import { useEffect, useLayoutEffect } from 'react'
import { useRouterState } from '@tanstack/react-router'
import { CARD, EXCLUDE, HEADINGS, IMAGES, TEXT } from './targets'
import './motion.css'

const FINE = '(hover: hover) and (pointer: fine)'

/** DOM changes (split headings, counters) must never race React's hydration, so wait until the router reports it is done. */
async function hydrated() {
  const w = window as unknown as { $_TSR?: unknown }
  const t0 = performance.now()
  while (w.$_TSR && performance.now() - t0 < 4000) await new Promise((r) => setTimeout(r, 40))
  if (document.readyState !== 'complete') await new Promise((r) => window.addEventListener('load', () => r(null), { once: true }))
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null))))
  await new Promise((r) => setTimeout(r, 120))
}
const NUMBER = /^(\d[\d,]*(?:\.\d+)?)\s*([+%kKmM]?)$/

/**
 * The site's motion layer: Lenis smooth scrolling, GSAP ScrollTrigger reveals (SplitText headings, staggered text/cards, image reveals,
 * parallax), animated counters, magnetic buttons, a cursor lens, a smart header and a scroll-progress bar.
 * Everything is skipped for visitors who prefer reduced motion, and the content is never left hidden if something fails.
 */
export function Motion() {
  const path = useRouterState({ select: (s) => s.location.pathname })

  // before paint on every navigation: hide what is about to be revealed (prevents a flash of full-opacity content)
  useLayoutEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const d = document.documentElement
    d.classList.add('motion-pre')
    const t = setTimeout(() => d.classList.remove('motion-pre'), 4000)
    return () => clearTimeout(t)
  }, [path])

  /* ───────── once: smooth scroll, header, progress, cursor, magnets ───────── */
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.documentElement.classList.add('motion-off')
      return
    }
    let dispose = () => {}
    let dead = false
    ;(async () => {
      const [{ default: gsap }, { ScrollTrigger }, { default: Lenis }] = await Promise.all([import('gsap'), import('gsap/ScrollTrigger'), import('lenis')])
      if (dead) return
      gsap.registerPlugin(ScrollTrigger)
      const root = document.documentElement
      root.classList.add('motion-on')

      const lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 0.95, smoothWheel: true, anchors: { offset: -90 } })
      ;(window as unknown as { __lenis?: unknown }).__lenis = lenis
      lenis.on('scroll', ScrollTrigger.update)
      const tick = (t: number) => lenis.raf(t * 1000)
      gsap.ticker.add(tick)
      gsap.ticker.lagSmoothing(0)

      // stop page scrolling while the full-screen menu is open
      const mo = new MutationObserver(() => (document.querySelector('.fm') ? lenis.stop() : lenis.start()))
      mo.observe(document.body, { childList: true })

      /* progress bar */
      const bar = document.createElement('div')
      bar.className = 'scroll-progress'
      document.body.appendChild(bar)
      const setBar = gsap.quickSetter(bar, 'scaleX')

      /* header: glass after 24px, hides when scrolling down, returns when scrolling up */
      const header = document.querySelector<HTMLElement>('.site-header')
      const st = ScrollTrigger.create({
        start: 0,
        end: 'max',
        onUpdate: (self) => {
          setBar(self.progress)
          const y = self.scroll()
          header?.classList.toggle('is-scrolled', y > 24)
          header?.classList.toggle('is-hidden', self.direction === 1 && y > 520 && !document.querySelector('.fm'))
        },
      })

      /* cursor lens + magnetic buttons (mouse only) */
      let offPointer = () => {}
      if (matchMedia(FINE).matches) {
        const lens = document.createElement('div')
        lens.className = 'cursor-lens'
        document.body.appendChild(lens)
        const x = gsap.quickTo(lens, 'x', { duration: 0.4, ease: 'power3' })
        const y = gsap.quickTo(lens, 'y', { duration: 0.4, ease: 'power3' })
        const HOT = 'a, button, [role=button], summary, label, .gallery__item, .sc-img'
        const move = (e: MouseEvent) => {
          lens.classList.add('is-on')
          x(e.clientX)
          y(e.clientY)
          const t = e.target as HTMLElement | null
          lens.classList.toggle('is-hot', !!t?.closest?.(HOT))
          lens.classList.toggle('is-view', !!t?.closest?.('.gallery__item'))
        }
        const leave = () => lens.classList.remove('is-on')
        window.addEventListener('mousemove', move, { passive: true })
        document.addEventListener('mouseleave', leave)

        const MAG = '.hom-13, .hom-18, .ftr-btn, .sc-cta, .bk-btn.is-light, .fm-cta, .ftr-social a'
        const over = (e: MouseEvent) => {
          const el = (e.target as HTMLElement | null)?.closest?.(MAG) as HTMLElement | null
          if (!el || (el as HTMLElement & { _mag?: boolean })._mag) return
          ;(el as HTMLElement & { _mag?: boolean })._mag = true
          const qx = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3' })
          const qy = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3' })
          const mm = (ev: MouseEvent) => {
            const r = el.getBoundingClientRect()
            qx((ev.clientX - (r.left + r.width / 2)) * 0.28)
            qy((ev.clientY - (r.top + r.height / 2)) * 0.28)
          }
          const out = () => {
            qx(0)
            qy(0)
            el.removeEventListener('mousemove', mm)
            el.removeEventListener('mouseleave', out)
            ;(el as HTMLElement & { _mag?: boolean })._mag = false
          }
          el.addEventListener('mousemove', mm)
          el.addEventListener('mouseleave', out)
        }
        document.addEventListener('mouseover', over)
        offPointer = () => {
          window.removeEventListener('mousemove', move)
          document.removeEventListener('mouseleave', leave)
          document.removeEventListener('mouseover', over)
          lens.remove()
        }
      }

      dispose = () => {
        offPointer()
        mo.disconnect()
        st.kill()
        bar.remove()
        gsap.ticker.remove(tick)
        lenis.destroy()
        delete (window as unknown as { __lenis?: unknown }).__lenis
        root.classList.remove('motion-on')
      }
    })()
    return () => {
      dead = true
      dispose()
    }
  }, [])

  /* ───────── per page: reveals, parallax, counters ───────── */
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let ctx: { revert: () => void } | undefined
    let dead = false
    const release = () => document.documentElement.classList.remove('motion-pre')
    ;(async () => {
      try {
        const [{ default: gsap }, { ScrollTrigger }, { SplitText }] = await Promise.all([import('gsap'), import('gsap/ScrollTrigger'), import('gsap/SplitText')])
        gsap.registerPlugin(ScrollTrigger, SplitText)
        await Promise.all([document.fonts?.ready, hydrated()])
        if (dead) return
        const lenis = (window as unknown as { __lenis?: { scrollTo: (n: number, o: object) => void } }).__lenis
        if (!window.location.hash) lenis?.scrollTo(0, { immediate: true, force: true })

        ctx = gsap.context(() => {
          const all = (sel: string) => [...document.querySelectorAll<HTMLElement>(`:is(main, .ftr) :is(${sel})`)].filter((el) => !el.closest(EXCLUDE))
          const cards = all(CARD)
          const insideCard = (el: HTMLElement) => !!el.parentElement?.closest(CARD)

          /* nested items of a card appear with the card */
          const nested = [...all(`${HEADINGS}, ${TEXT}, ${IMAGES}`)].filter(insideCard)
          gsap.set(nested, { opacity: 1 })

          /* headings: masked line-by-line reveal */
          for (const h of all(HEADINGS).filter((el) => !insideCard(el))) {
            if (!h.textContent?.trim()) { gsap.set(h, { opacity: 1 }); continue }
            SplitText.create(h, {
              type: 'lines',
              mask: 'lines',
              autoSplit: true,
              linesClass: 'split-line',
              onSplit(self) {
                gsap.set(h, { opacity: 1 })
                return gsap.from(self.lines, { yPercent: 115, duration: 1.15, ease: 'expo.out', stagger: 0.09, scrollTrigger: { trigger: h, start: 'top 90%', once: true } })
              },
            })
          }

          /* paragraphs + list items */
          const texts = all(TEXT).filter((el) => !insideCard(el) && !el.closest('.split-line'))
          gsap.set(texts, { opacity: 0, y: 26 })
          ScrollTrigger.batch(texts, {
            start: 'top 93%',
            once: true,
            onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, duration: 0.95, ease: 'power3.out', stagger: 0.07, overwrite: true }),
          })

          /* cards */
          gsap.set(cards, { opacity: 0, y: 56, scale: 0.97 })
          ScrollTrigger.batch(cards, {
            start: 'top 92%',
            once: true,
            onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, scale: 1, duration: 1.05, ease: 'expo.out', stagger: 0.12, overwrite: true, clearProps: 'transform' }),
          })

          /* images: clip-path + scale reveal (small icons just appear) */
          for (const img of all(IMAGES).filter((el) => !insideCard(el) && !el.closest('.bg-slideshow'))) {
            const big = (img.getAttribute('width') ? Number(img.getAttribute('width')) : img.getBoundingClientRect().width) > 120
            if (!big) { gsap.set(img, { opacity: 1 }); continue }
            gsap.fromTo(
              img,
              { opacity: 0, clipPath: 'inset(9% 9% 9% 9%)', scale: 1.14 },
              { opacity: 1, clipPath: 'inset(0% 0% 0% 0%)', scale: 1, duration: 1.4, ease: 'expo.out', clearProps: 'clipPath,transform', scrollTrigger: { trigger: img, start: 'top 92%', once: true } },
            )
          }

          /* hero slideshow parallax */
          for (const bg of document.querySelectorAll<HTMLElement>('.bg-slideshow')) {
            gsap.to(bg, { yPercent: 14, ease: 'none', scrollTrigger: { trigger: bg.parentElement ?? bg, start: 'top top', end: 'bottom top', scrub: true } })
          }

          /* counters: "850+", "5.0", "1,200" */
          for (const el of document.querySelectorAll<HTMLElement>('main span, main strong, main b, main div')) {
            if (el.children.length || el.closest(EXCLUDE)) continue
            const m = NUMBER.exec(el.textContent?.trim() ?? '')
            if (!m) continue
            const target = Number(m[1].replace(/,/g, ''))
            if (!Number.isFinite(target) || target === 0) continue
            const dec = (m[1].split('.')[1] ?? '').length
            const comma = m[1].includes(',')
            const final = el.textContent!
            const o = { v: 0 }
            const fmt = () => { const n = o.v.toFixed(dec); el.textContent = (comma ? Number(n).toLocaleString('en-GB', { minimumFractionDigits: dec, maximumFractionDigits: dec }) : n) + m[2] }
            fmt()
            gsap.to(o, {
              v: target, duration: 2.2, ease: 'power3.out',
              onUpdate: fmt,
              onComplete: () => { el.textContent = final },
              scrollTrigger: { trigger: el, start: 'top 90%', once: true },
            })
          }

          /* gallery columns drift at different speeds on desktop */
          const mm = gsap.matchMedia()
          mm.add('(min-width: 1025px)', () => {
            document.querySelectorAll<HTMLElement>('.gallery__cols--d').forEach((g) => {
              g.querySelectorAll<HTMLElement>('.gallery__col').forEach((col, i) => {
                gsap.to(col, { y: i % 2 ? -64 : 28, ease: 'none', scrollTrigger: { trigger: g, start: 'top bottom', end: 'bottom top', scrub: true } })
              })
            })
          })
        })

        release()
        const refresh = () => ScrollTrigger.refresh()
        const t1 = setTimeout(refresh, 700)
        const t2 = setTimeout(refresh, 2200)
        window.addEventListener('load', refresh)
        const prev = ctx
        ctx = { revert: () => { clearTimeout(t1); clearTimeout(t2); window.removeEventListener('load', refresh); prev?.revert() } }
      } catch (err) {
        console.error('motion setup failed', err)
        release()
      }
    })()
    return () => {
      dead = true
      ctx?.revert()
      release()
    }
  }, [path])

  return null
}
