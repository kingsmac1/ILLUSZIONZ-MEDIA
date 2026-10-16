/**
 * Hosts blog HTML that the edge function injected into the page. React must hydrate against exactly what is already
 * in the DOM (otherwise it reports a mismatch and re-renders the slot empty), so on the client we hand React the
 * slot's current innerHTML. During the static prerender (no DOM) the slot is simply empty.
 */
export function BlogSlot() {
  const html = typeof document === 'undefined' ? '' : document.getElementById('blog-slot')?.innerHTML ?? ''
  return <div id="blog-slot" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: html }} />
}
