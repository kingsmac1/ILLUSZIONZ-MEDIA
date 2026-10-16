/**
 * Applies the dashboard's per-page SEO overrides (Dashboard → Page SEO) to the static pages at the edge:
 * title, description, Open Graph / Twitter tags and an optional noindex. Rows are cached for 30 s per isolate.
 */
import { db, dbReady, type DbEnv } from '../src/server/db'

type Row = { path: string; title: string; description: string; og_image: string; noindex: boolean }
let cache: { at: number; rows: Map<string, Row> } | null = null

async function rows(env: DbEnv) {
  if (cache && Date.now() - cache.at < 30_000) return cache.rows
  const list = (await db.select(env, 'page_seo', 'select=path,title,description,og_image,noindex').catch(() => [])) as Row[]
  cache = { at: Date.now(), rows: new Map(list.map((r) => [r.path, r])) }
  return cache.rows
}

export const onRequest = async ({ request, env, next }: { request: Request; env: DbEnv; next: () => Promise<Response> }) => {
  const res = await next()
  if (request.method !== 'GET' || !dbReady(env) || !(res.headers.get('content-type') ?? '').includes('text/html')) return res
  const url = new URL(request.url)
  if (url.pathname.startsWith('/blog') || url.pathname.startsWith('/dashboard') || url.pathname.startsWith('/api')) return res
  const path = url.pathname.endsWith('/') ? url.pathname : url.pathname + '/'
  const row = (await rows(env)).get(path)
  if (!row || (!row.title && !row.description && !row.og_image && !row.noindex)) return res
  const rw = new HTMLRewriter()
  if (row.title) rw.on('title', { element(e) { e.setInnerContent(row.title) } }).on('meta[property="og:title"]', { element(e) { e.setAttribute('content', row.title) } }).on('meta[name="twitter:title"]', { element(e) { e.setAttribute('content', row.title) } })
  if (row.description) rw.on('meta[name="description"]', { element(e) { e.setAttribute('content', row.description) } }).on('meta[property="og:description"]', { element(e) { e.setAttribute('content', row.description) } }).on('meta[name="twitter:description"]', { element(e) { e.setAttribute('content', row.description) } })
  if (row.og_image) rw.on('meta[property="og:image"]', { element(e) { e.setAttribute('content', row.og_image) } }).on('meta[name="twitter:image"]', { element(e) { e.setAttribute('content', row.og_image) } })
  if (row.noindex) rw.on('meta[name="robots"]', { element(e) { e.setAttribute('content', 'noindex, nofollow') } })
  const out = rw.transform(res)
  out.headers.set('Cache-Control', 'public, max-age=0, s-maxage=60')
  return out
}
