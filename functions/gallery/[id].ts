/**
 * GET /gallery/:id/ — serves the prerendered gallery shell (built at /gallery/__gallery__/, moved to /_shell/gallery/ by
 * scripts/postbuild.mjs) with the real id swapped in, so the client router hydrates on the right route. The gallery itself
 * loads in the browser after sign-in; nothing private is in this HTML.
 */
type Env = { ASSETS: { fetch: (r: Request) => Promise<Response> } }

export const onRequestGet = async ({ request, env, params }: { request: Request; env: Env; params: { id: string } }) => {
  const id = String(params.id ?? '')
  const url = new URL(request.url)
  if (!url.pathname.endsWith('/')) return Response.redirect(`${url.origin}${url.pathname}/${url.search}`, 301)
  const shell = await env.ASSETS.fetch(new Request(new URL('/_shell/gallery/', request.url).toString()))
  const text = (await shell.text()).replace(/__gallery__/g, /^[0-9a-f-]{36}$/i.test(id) ? id.toLowerCase() : 'not-found')
  return new Response(text, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'same-origin' },
  })
}
