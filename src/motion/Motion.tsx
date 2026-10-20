import { useEffect, useLayoutEffect } from 'react'
import { useRouterState } from '@tanstack/react-router'
import { CARD, EXCLUDE, HEADINGS, IMAGES, TEXT } from './targets'
import './motion.css'

const FINE = '(hover: hover) and (pointer: fine)'

/** Start fetching the animation libraries as soon as this module loads (in parallel with React hydration), not after it. */
const libs = typeof window === 'undefined' || matchMedia('(prefers-reduced-motion: reduce)').matches
  ? null
  : Promise.all([import('gsap'), import('gsap/ScrollTrigger'), import('gsap/SplitText'), import('lenis')])

/** DOM changes (split headings, counters) must never race React's hydration, so wait until the router reports it is done. */
async function hydrated() {
  const w = window as unknown as { $_TSR?: unknown }
  const t0 = performance.now()
  while (w.$_TSR && performance.now() - t0 < 2500) await new Promise((r) => setTimeout(r, 25))
  // the router flag flips before React has walked the DOM, so also wait until every element React owns has been claimed
  while (!reactClaimedDom() && performance.now() - t0 < 5000) await new Promise((r) => setTimeout(r, 40))
  await new Promise((r) => requestAnimationFrame(() => r(null)))
}

/** True once React has attached itself to every element it renders (hydration finished, including lazily hydrated boundaries). */
function reactClaimedDom() {
  const els = document.querySelectorAll('main *, .ftr *, .site-header *')
  for (const el of els) {
    if ((el as HTMLElement).closest('#blog-slot')) continue
    if (!Object.keys(el).some((k) => k.startsWith('__reactFiber'))) return false
  }
  return els.length > 0
}
const NUMBER = /^(\d[\d,]*(?:\.\d+)?)\s*([+%kKmM]?)$/
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/** Decode the pictures in the first screen (and the hero slideshow's first slide), but never wait more than 1.2 s. */
async function aboveFoldReady() {
  const imgs = [...document.querySelectorAll<HTMLImageElement>('main img')].filter((i) => i.getBoundingClientRect().top < window.innerHeight && !i.closest('.bk-panel'))
  const slide = document.querySelector<HTMLElement>('.bg-slideshow__slide.is-active')
  const url = slide ? /url\(["']?(.*?)["']?\)/.exec(getComputedStyle(slide).backgroundImage)?.[1] : null
  const jobs: Promise<unknown>[] = imgs.map((i) => (i.complete ? Promise.resolve() : i.decode?.().catch(() => undefined) ?? Promise.resolve()))
  if (url) jobs.push(new Promise((r) => { const im = new Image(); im.onload = im.onerror = () => r(null); im.src = url }))
  await Promise.race([Promise.all(jobs), wait(1200)])
}

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
    const t = setTimeout(() => d.classList.remove('motion-pre'), 2600)
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
      const [{ default: gsap }, { ScrollTrigger }, , { default: Lenis }] = await libs!
      await hydrated() // never add elements to <body> while React is still hydrating it
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

  /* ───────── per page: ordered reveals, parallax, counters ───────── */
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let ctx: { revert: () => void } | undefined
    let dead = false
    const release = () => document.documentElement.classList.remove('motion-pre')
    ;(async () => {
      try {
        const [{ default: gsap }, { ScrollTrigger }, { SplitText }] = await libs!
        gsap.registerPlugin(ScrollTrigger, SplitText)
        await Promise.all([Promise.race([document.fonts?.ready, wait(700)]), hydrated()])
        if (dead) return
        const lenis = (window as unknown as { __lenis?: { scrollTo: (n: number, o: object) => void } }).__lenis
        if (!window.location.hash) lenis?.scrollTo(0, { immediate: true, force: true })

        // everything visible on first screen must have its pictures ready, so nothing pops in half-way through the entrance
        await aboveFoldReady()
        if (dead) return

        ctx = gsap.context(() => {
          const all = (sel: string) => [...document.querySelectorAll<HTMLElement>(`:is(main, .ftr) :is(${sel})`)].filter((el) => !el.closest(EXCLUDE))
          const insideCard = (el: HTMLElement) => !!el.parentElement?.closest(CARD)

          /* one scheduler for every kind of element: whatever enters the viewport together plays top → bottom, left → right */
          type Item = { el: HTMLElement; play: (delay: number) => void }
          const pending: Item[] = []
          const done = new WeakSet<HTMLElement>()
          let scheduled = false
          const flush = () => {
            scheduled = false
            const batch = pending.splice(0).sort((a, b) => {
              const ra = a.el.getBoundingClientRect()
              const rb = b.el.getBoundingClientRect()
              return Math.abs(ra.top - rb.top) > 24 ? ra.top - rb.top : ra.left - rb.left
            })
            batch.forEach((it, i) => it.play(Math.min(i, 9) * 0.085))
          }
          const enter = (it: Item) => {
            if (done.has(it.el)) return
            done.add(it.el)
            pending.push(it)
            if (!scheduled) { scheduled = true; requestAnimationFrame(flush) }
          }
          const watch = (el: HTMLElement, play: Item['play'], start = 'top 94%') =>
            ScrollTrigger.create({ trigger: el, start, once: true, onEnter: () => enter({ el, play }) })

          /* nested items of a card appear with the card */
          gsap.set(all(`${HEADINGS}, ${TEXT}, ${IMAGES}`).filter(insideCard), { opacity: 1 })

          /* headings: masked line-by-line reveal */
          for (const h of all(HEADINGS).filter((el) => !insideCard(el))) {
            if (!h.textContent?.trim()) { gsap.set(h, { opacity: 1 }); continue }
            const lines: { current: HTMLElement[] } = { current: [] }
            SplitText.create(h, {
              type: 'lines',
              mask: 'lines',
              autoSplit: true,
              linesClass: 'split-line',
              onSplit(self) {
                lines.current = self.lines as HTMLElement[]
                if (!done.has(h)) gsap.set(self.lines, { yPercent: 115 })
                gsap.set(h, { opacity: 1 })
              },
            })
            watch(h, (delay) => gsap.to(lines.current, { yPercent: 0, duration: 1, ease: 'expo.out', stagger: 0.08, delay }))
          }

          /* paragraphs + list items */
          const texts = all(TEXT).filter((el) => !insideCard(el) && !el.closest('.split-line'))
          gsap.set(texts, { opacity: 0, y: 24 })
          for (const t of texts) watch(t, (delay) => gsap.to(t, { opacity: 1, y: 0, duration: 0.85, ease: 'power3.out', delay, clearProps: 'transform' }))

          /* cards */
          const cards = all(CARD)
          gsap.set(cards, { opacity: 0, y: 48, scale: 0.97 })
          for (const c of cards) watch(c, (delay) => gsap.to(c, { opacity: 1, y: 0, scale: 1, duration: 1, ease: 'expo.out', delay, clearProps: 'transform' }))

          /* images: wait until decoded, then clip-path + scale reveal (small icons just appear) */
          for (const img of all(IMAGES).filter((el) => !insideCard(el) && !el.closest('.bg-slideshow')) as HTMLImageElement[]) {
            const big = (img.getAttribute('width') ? Number(img.getAttribute('width')) : img.getBoundingClientRect().width) > 120
            if (!big) { gsap.set(img, { opacity: 1 }); continue }
            gsap.set(img, { opacity: 0, clipPath: 'inset(9% 9% 9% 9%)', scale: 1.12 })
            watch(img, (delay) => {
              const go = () => gsap.to(img, { opacity: 1, clipPath: 'inset(0% 0% 0% 0%)', scale: 1, duration: 1.2, ease: 'expo.out', delay, clearProps: 'clipPath,transform' })
              if (img.complete && img.naturalWidth) go()
              else Promise.race([img.decode?.().catch(() => undefined), wait(900)]).then(go)
            })
          }

          /* hero slideshow parallax */
          for (const bg of document.querySelectorAll<HTMLElement>('.bg-slideshow')) {
            gsap.to(bg, { yPercent: 5, ease: 'none', scrollTrigger: { trigger: bg.parentElement ?? bg, start: 'top top', end: 'bottom top', scrub: true } })
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
            gsap.to(o, { v: target, duration: 2.2, ease: 'power3.out', onUpdate: fmt, onComplete: () => { el.textContent = final }, scrollTrigger: { trigger: el, start: 'top 90%', once: true } })
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
        const t1 = setTimeout(refresh, 900)
        const t2 = setTimeout(refresh, 2600)
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
