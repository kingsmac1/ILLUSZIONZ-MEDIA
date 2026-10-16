/**
 * Fetches a prerendered shell page (site header/footer/menu, correct dehydrated router state for the blog route) and injects
 * the article + SEO head. Two shells exist because the client router must find the route it expects: one for /blog/ and one
 * for /blog/:slug/ (prerendered with the placeholder slug __post__, swapped for the real slug here).
 */
export type ShellEnv = { ASSETS: { fetch: (r: Request) => Promise<Response> } }

export async function renderInShell(env: ShellEnv, request: Request, o: { kind: 'index' | 'post'; slug?: string; title: string; html: string; head: string; status?: number; cache?: string }) {
  const shell = await env.ASSETS.fetch(new Request(new URL(`/_shell/${o.kind}/`, request.url).toString()))
  let text = await shell.text()
  if (o.kind === 'post') text = text.replace(/__post__/g, o.slug && /^[a-z0-9-]+$/.test(o.slug) ? o.slug : 'not-found')
  const res = new HTMLRewriter()
    .on('title', { element(e) { e.remove() } })
    .on('meta[name="robots"]', { element(e) { e.remove() } })
    .on('head', { element(e) { e.append(`<title>${o.title.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</title>${o.head}`, { html: true }) } })
    .on('#blog-slot', { element(e) { e.setInnerContent(o.html, { html: true }) } })
    .transform(new Response(text, { headers: { 'content-type': 'text/html; charset=utf-8' } }))
  return new Response(res.body, { status: o.status ?? 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': o.cache ?? 'public, max-age=60' } })
}
