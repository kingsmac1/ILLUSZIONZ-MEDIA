import { useEffect } from 'react'

/**
 * The brand preloader: black screen, white logo breathing. Same look as the client gallery's loading screen.
 * `boot` is the copy rendered into every page's HTML by the root route, so it is there from the very first paint; it
 * fades out when `html.ilz-ready` is set — by the site's motion system just as the page entrance starts, by the
 * dashboard and the gallery once they take over with their own loading state, or by the 4 s failsafe in the head.
 */
export const releasePreloader = () => {
  if (typeof document !== 'undefined') document.documentElement.classList.add('ilz-ready')
}

/** Head script: never leave the boot preloader up for more than 4 s, whatever happens. */
export const preloaderFailsafe = "setTimeout(function(){document.documentElement.classList.add('ilz-ready')},4000)"

export function Preloader({ boot = false }: { boot?: boolean }) {
  return (
    <div className={'ilz-pl' + (boot ? ' ilz-pl-boot' : '')} role="status" aria-label="Loading">
      <img src="/images/illuszionz-logo-white.png" alt="" width={143} height={40} />
    </div>
  )
}

/** For screens that show their own loader: hides the boot copy as soon as they mount. */
export function useReleasePreloader() {
  useEffect(releasePreloader, [])
}
