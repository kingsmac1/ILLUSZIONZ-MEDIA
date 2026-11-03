/** GET /gallery/:id/cover?k=… — the gallery's cover as the share image. R2 links expire, so apps get this steady address and it signs a fresh one. */
import { galleryShareInfo, type ShareEnv } from '../../../src/server/galleryShare'

export const onRequestGet = async ({ request, env, params }: { request: Request; env: ShareEnv; params: { id: string } }) => {
  const url = new URL(request.url)
  const info = await galleryShareInfo(env, request, String(params.id ?? ''), url.searchParams.get('k'))
  const image = info?.cover ? await fetch(info.cover).catch(() => null) : null
  if (!image?.ok) return Response.redirect(`${url.origin}/og-image.jpg`, 302)
  return new Response(image.body, {
    headers: { 'Content-Type': image.headers.get('content-type') ?? 'image/jpeg', 'Cache-Control': 'public, max-age=3600', 'X-Robots-Tag': 'noindex, nofollow' },
  })
}
