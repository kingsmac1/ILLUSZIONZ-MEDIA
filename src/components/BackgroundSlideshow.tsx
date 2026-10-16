import { useEffect, useState } from 'react'

/**
 * Cross-fading background slideshow with a slow "Ken Burns" zoom (replaces Elementor's background slideshow).
 * Only the first slide is requested immediately (and preloaded by the page); the others are fetched quietly once the page has settled,
 * so the hero never competes with the rest of the page for bandwidth.
 */
export function BackgroundSlideshow({ images, duration = 5000, transition = 500 }: { images: string[]; duration?: number; transition?: number }) {
  const [active, setActive] = useState(0)
  const [ready, setReady] = useState<Set<string>>(() => new Set(images.slice(0, 1)))

  useEffect(() => {
    if (images.length < 2) return
    let dead = false
    const warm = () => {
      images.slice(1).forEach((src) => {
        const im = new Image()
        im.onload = () => !dead && setReady((r) => new Set(r).add(src))
        im.src = src
      })
    }
    const t = setTimeout(warm, 1800)
    return () => { dead = true; clearTimeout(t) }
  }, [images])

  useEffect(() => {
    if (images.length < 2) return
    const t = setInterval(() => setActive((a) => { for (let i = 1; i <= images.length; i++) { const n = (a + i) % images.length; if (ready.has(images[n])) return n } return a }), duration)
    return () => clearInterval(t)
  }, [images, duration, ready])

  return (
    <div className="bg-slideshow" aria-hidden="true">
      {images.map((src, i) => (
        <div
          key={src}
          className={'bg-slideshow__slide' + (i === active ? ' is-active' : '')}
          style={{
            backgroundImage: ready.has(src) ? `url("${src}")` : undefined,
            transition: `opacity ${transition}ms ease`,
            animationDuration: `${duration + transition}ms`,
          }}
        />
      ))}
    </div>
  )
}
