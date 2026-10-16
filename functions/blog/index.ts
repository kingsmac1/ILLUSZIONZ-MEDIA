/** GET /blog/ — the Journal index, rendered at the edge inside the site shell. */
import { db, dbReady, type DbEnv } from '../../src/server/db'
import { blogHead, indexHtml, type Post } from '../../src/server/blogPage'
import { renderInShell, type ShellEnv } from '../../src/server/blogShell'
import { site } from '../../src/site'

export const onRequestGet = async ({ request, env }: { request: Request; env: DbEnv & ShellEnv }) => {
  let posts: Post[] = []
  if (dbReady(env)) {
    try {
      posts = (await db.select(env, 'blog_posts', `published=eq.true&published_at=lte.${new Date().toISOString()}&noindex=eq.false&order=published_at.desc&limit=60&select=slug,title,excerpt,cover_url,cover_alt,category,tags,author,published_at,read_minutes`)) as Post[]
    } catch (err) {
      console.error('blog index failed', err)
    }
  }
  const title = `The Journal – Photography Tips & Wedding Planning | ${site.name}`
  const description = 'Photography tips, wedding planning guides, maternity and portrait advice and behind-the-scenes stories from the Illuszionz Media team in London.'
  return renderInShell(env, request, { kind: 'index', title, html: indexHtml(posts), head: blogHead({ title, description, url: `${site.url}/blog/`, jsonLd: [{ '@context': 'https://schema.org', '@type': 'Blog', name: `${site.name} Journal`, url: `${site.url}/blog/`, description }] }) })
}
