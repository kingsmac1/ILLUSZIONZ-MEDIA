/** GET /sitemap.xml — static pages + every published blog post (replaces the old static file). */
import { db, dbReady, type DbEnv } from '../src/server/db'
import { sitemapXml, type Post } from '../src/server/blogPage'

export const onRequestGet = async ({ env }: { env: DbEnv }) => {
  let posts: Post[] = []
  let hidden: string[] = []
  if (dbReady(env)) {
    posts = (await db.select(env, 'blog_posts', `published=eq.true&published_at=lte.${new Date().toISOString()}&select=slug,updated_at,published_at,noindex`).catch(() => [])) as Post[]
    hidden = (await db.select(env, 'page_seo', 'noindex=eq.true&select=path').catch(() => [])).map((r) => r.path as string)
  }
  return new Response(sitemapXml(posts, hidden), { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=300' } })
}
