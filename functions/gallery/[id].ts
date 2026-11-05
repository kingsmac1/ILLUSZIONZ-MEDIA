/**
 * GET /gallery/:id/ — serves the prerendered gallery shell (built at /gallery/__gallery__/, moved to /_shell/gallery/ by
 * scripts/postbuild.mjs) with the real id swapped in, so the client router hydrates on the right route. The gallery itself
 * loads in the browser after sign-in. A valid private link (?k=) also gets the gallery's title and cover as its share
 * preview for WhatsApp and other apps; anything else gets the general share image.
 */
import { galleryShareInfo, type ShareEnv } from '../../src/server/galleryShare'
import { site } from '../../src/site'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

export const onRequestGet = async ({ request, env, params }: { request: Request; env: ShareEnv; params: { id: string } }) => {
  const id = String(params.id ?? '')
  const url = new URL(request.url)
  if (!url.pathname.endsWith('/')) return Response.redirect(`${url.origin}${url.pathname}/${url.search}`, 301)
  const shell = await env.ASSETS.fetch(new Request(new URL('/_shell/gallery/', request.url).toString()))
  const valid = /^[0-9a-f-]{36}$/i.test(id)
  const key = url.searchParams.get('k')
  const info = valid ? await galleryShareInfo(env, request, id, key) : null
  const title = esc(info?.title ?? `Your gallery · ${site.name}`)
  const description = esc(`Your photos from ${site.name}. Open the link to view them.`)
  const image = esc(info?.cover ? `${site.url}/gallery/${id.toLowerCase()}/cover?k=${encodeURIComponent(key!)}` : `${site.url}/og-image.jpg`)
  const share = `<meta name="description" content="${description}"/><meta property="og:type" content="website"/><meta property="og:url" content="${esc(url.href)}"/><meta property="og:site_name" content="${esc(site.name)}"/><meta property="og:title" content="${title}"/><meta property="og:description" content="${description}"/><meta property="og:image" content="${image}"/><meta name="twitter:card" content="summary_large_image"/><meta name="twitter:title" content="${title}"/><meta name="twitter:description" content="${description}"/><meta name="twitter:image" content="${image}"/>`
  const text = (await shell.text()).replace(/__gallery__/g, valid ? id.toLowerCase() : 'not-found').replace('<head>', () => `<head>${share}`)
  return new Response(text, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'same-origin' },
  })
}
