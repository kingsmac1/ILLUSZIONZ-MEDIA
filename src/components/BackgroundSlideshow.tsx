import { useEffect, useState } from 'react'

/**
 * Cross-fading slideshow with a gentle "Ken Burns" zoom (replaces Elementor's background slideshow).
 * Slides play in exactly the order given, starting with the first one as soon as its picture has loaded;
 * the other pictures are fetched quietly afterwards so the hero never competes with the rest of the page.
 */
export function BackgroundSlideshow({ images, duration = 5000, transition = 500 }: { images: string[]; duration?: number; transition?: number }) {
  const [active, setActive] = useState(0)
  const [ready, setReady] = useState<Set<string>>(() => new Set())
  const key = images.join('|') // the parent builds a new array on every render; only a real change of pictures restarts the show

  // load the first picture straight away (the page also preloads it), the rest a little later; every list change starts again
  useEffect(() => {
    let dead = false
    const load = (src: string) => {
      const im = new Image()
      im.onload = im.onerror = () => !dead && setReady((r) => (r.has(src) ? r : new Set(r).add(src)))
      im.src = src
    }
    if (images[0]) load(images[0])
    const t = setTimeout(() => images.slice(1).forEach(load), 1200)
    return () => { dead = true; clearTimeout(t) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  useEffect(() => {
    setActive(0)
  }, [key])

  useEffect(() => {
    if (images.length < 2) return
    const t = setInterval(() => setActive((a) => { for (let i = 1; i <= images.length; i++) { const n = (a + i) % images.length; if (ready.has(images[n])) return n } return a }), duration)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, duration, ready])

  return (
    <div className="bg-slideshow" aria-hidden="true">
      {images.map((src, i) => (
        <div
          key={src}
          className={'bg-slideshow__slide' + (i === active ? ' is-active' : '')}
          style={{ backgroundImage: ready.has(src) ? `url("${src}")` : undefined, transition: `opacity ${transition}ms ease`, animationDuration: `${duration + transition}ms` }}
        />
      ))}
    </div>
  )
}
