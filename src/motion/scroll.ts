/** Smooth-scroll helpers shared by the page components (Lenis when running, native smooth scrolling otherwise). */
type LenisLike = { scrollTo: (t: number | string | HTMLElement, o?: { offset?: number; duration?: number; immediate?: boolean }) => void }
export const getLenis = (): LenisLike | undefined => (typeof window === 'undefined' ? undefined : (window as unknown as { __lenis?: LenisLike }).__lenis)

export function smoothScrollTo(el: HTMLElement | null | undefined, offset = -90) {
  if (!el) return
  const l = getLenis()
  if (l) l.scrollTo(el, { offset, duration: 1.1 })
  else el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
export function scrollToTop() {
  const l = getLenis()
  if (l) l.scrollTo(0, { duration: 1.2 })
  else window.scrollTo({ top: 0, behavior: 'smooth' })
}
