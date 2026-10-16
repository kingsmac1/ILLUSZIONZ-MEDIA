/** What the scroll animations touch. The same lists drive the CSS "pre-hide" (no flash of unstyled content) and the GSAP setup. */
export const EXCLUDE = '.bk-panel, .lightbox, .fm, [data-no-motion]'
export const CARD = '.sc-card, .bl-card'
export const HEADINGS = 'h1, h2, h3'
export const TEXT = 'p, li'
export const IMAGES = 'img'

const inScope = (s: string) => `:is(main, .ftr) ${s}`
/** CSS applied while `html.motion-pre` is present: hides only what JS will reveal. A 4 s failsafe in the head script removes the class. */
export const motionPreCss = [
  `html.motion-pre ${inScope(`:is(${HEADINGS}, ${TEXT}, ${IMAGES}, ${CARD})`)}:not(:is(${EXCLUDE}) *){opacity:0}`,
  `html.motion-pre ${inScope(`:is(${EXCLUDE})`)} *{opacity:1}`,
].join('\n')

/** Runs before first paint: only enables the pre-hide when motion is allowed, and always lifts it after 4 s. */
export const motionPreScript =
  "try{if(!matchMedia('(prefers-reduced-motion: reduce)').matches){var d=document.documentElement;d.classList.add('motion-pre');setTimeout(function(){d.classList.remove('motion-pre')},4000)}}catch(e){}"
