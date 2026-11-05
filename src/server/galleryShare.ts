/**
 * What a shared client-gallery link shows on WhatsApp and other apps. The cover and title are only given for a valid
 * private link; anything else gets the general share image. The R2 keys live in Supabase, so this asks the same function
 * the gallery uses. Its public URL and anon key are written to /_shell/public-env.json by scripts/postbuild.mjs.
 */
export type ShareEnv = { ASSETS: { fetch: (r: Request) => Promise<Response> } }

export async function galleryShareInfo(env: ShareEnv, request: Request, id: string, key: string | null) {
  if (!key) return null
  try {
    const pub = (await (await env.ASSETS.fetch(new Request(new URL('/_shell/public-env.json', request.url).toString()))).json()) as { url?: string; anon?: string }
    if (!pub.url || !pub.anon) return null
    const res = await fetch(`${pub.url.replace(/\/$/, '')}/functions/v1/gallery-view-urls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: pub.anon, Authorization: `Bearer ${pub.anon}` },
      // cover_only: not counted as the client's visit
      body: JSON.stringify({ gallery_id: id, key, cover_only: true }),
      signal: AbortSignal.timeout(4000),
    })
    const data = (await res.json()) as { ok?: boolean; access?: string; gallery?: { title?: string }; cover?: { url?: string } | null }
    if (!data.ok || data.access !== 'full') return null
    return { title: data.gallery?.title ?? null, cover: data.cover?.url ?? null }
  } catch {
    return null
  }
}
