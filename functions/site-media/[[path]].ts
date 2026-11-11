/**
 * GET /site-media/<path> — a website photo from Supabase Storage, cached at Cloudflare's edge for a year (files are never
 * changed in place: a new upload gets a new name). See src/server/media.ts.
 */
import { originFor } from '../../src/server/media'
import type { DbEnv } from '../../src/server/db'

type Ctx = { request: Request; env: DbEnv; params: { path?: string | string[] }; waitUntil: (p: Promise<unknown>) => void }

export const onRequestGet = async ({ request, env, params, waitUntil }: Ctx) => {
  const path = (Array.isArray(params.path) ? params.path : [params.path ?? '']).join('/')
  const src = originFor(env, path)
  if (!src) return new Response('Not found', { status: 404 })
  const cache = (caches as unknown as { default: Cache }).default
  const key = new Request(new URL(request.url).origin + '/site-media/' + path)
  const hit = await cache.match(key)
  if (hit) return hit
  const up = await fetch(src, { cf: { cacheEverything: true, cacheTtl: 31536000 } } as RequestInit)
  if (!up.ok) return new Response('Not found', { status: up.status === 404 || up.status === 400 ? 404 : 502, headers: { 'Cache-Control': 'public, max-age=60' } })
  const res = new Response(up.body, {
    headers: {
      'Content-Type': up.headers.get('content-type') ?? 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  })
  waitUntil(cache.put(key, res.clone()))
  return res
}
export const onRequestHead = onRequestGet
