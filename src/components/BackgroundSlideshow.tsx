import { useEffect, useState } from 'react'

/** Cross-fading background slideshow with a slow "Ken Burns" zoom (replaces Elementor's background slideshow). */
export function BackgroundSlideshow({ images, duration = 5000, transition = 500 }: { images: string[]; duration?: number; transition?: number }) {
  const [active, setActive] = useState(0)
  useEffect(() => {
    if (images.length < 2) return
    const t = setInterval(() => setActive((a) => (a + 1) % images.length), duration)
    return () => clearInterval(t)
  }, [images.length, duration])
  return (
    <div className="bg-slideshow" aria-hidden="true">
      {images.map((src, i) => (
        <div
          key={src}
          className={'bg-slideshow__slide' + (i === active ? ' is-active' : '')}
          style={{
            backgroundImage: `url("${src}")`,
            transition: `opacity ${transition}ms ease`,
            animationDuration: `${duration + transition}ms`,
          }}
        />
      ))}
    </div>
  )
}
