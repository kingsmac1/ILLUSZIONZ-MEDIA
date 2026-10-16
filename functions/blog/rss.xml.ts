/** GET /blog/rss.xml */
import { db, dbReady, type DbEnv } from '../../src/server/db'
import { rssXml, type Post } from '../../src/server/blogPage'

export const onRequestGet = async ({ env }: { env: DbEnv }) => {
  let posts: Post[] = []
  if (dbReady(env)) posts = (await db.select(env, 'blog_posts', `published=eq.true&published_at=lte.${new Date().toISOString()}&noindex=eq.false&order=published_at.desc&limit=50`).catch(() => [])) as Post[]
  return new Response(rssXml(posts), { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8', 'Cache-Control': 'public, max-age=300' } })
}
