/** GET /blog/:slug/ — one article, rendered at the edge with full SEO tags. */
import { db, dbReady, q, type DbEnv } from '../../src/server/db'
import { abs, blogHead, postHtml, postJsonLd, type Post } from '../../src/server/blogPage'
import { renderInShell, type ShellEnv } from '../../src/server/blogShell'
import { site } from '../../src/site'

export const onRequestGet = async ({ request, env, params }: { request: Request; env: DbEnv & ShellEnv; params: { slug: string } }) => {
  const slug = String(params.slug ?? '')
  let post: Post | undefined
  let related: Post[] = []
  if (dbReady(env) && /^[a-z0-9-]+$/.test(slug)) {
    try {
      const now = new Date().toISOString()
      post = ((await db.select(env, 'blog_posts', `slug=eq.${q(slug)}&published=eq.true&published_at=lte.${now}&limit=1`)) as Post[])[0]
      if (post) related = (await db.select(env, 'blog_posts', `published=eq.true&published_at=lte.${now}&slug=neq.${q(slug)}&noindex=eq.false&order=published_at.desc&limit=3&select=slug,title,excerpt,cover_url,cover_alt,category,tags,author,published_at,read_minutes`)) as Post[]
    } catch (err) {
      console.error('blog post failed', err)
    }
  }
  if (!post) {
    return renderInShell(env, request, {
      kind: 'post', slug, title: `Article not found | ${site.name}`, status: 404, cache: 'no-store',
      html: '<div style="max-width:700px;margin:0 auto;padding:120px 24px;text-align:center;font-family:Inter,sans-serif"><h1 style="font-family:\'Playfair Display\',serif;font-weight:500;font-size:44px">Article not found</h1><p style="color:#525252">That article does not exist or is no longer published.</p><p><a href="/blog/" style="color:#000;border-bottom:1px solid #000;text-decoration:none">Back to the Journal</a></p></div>',
      head: '<meta name="robots" content="noindex, nofollow">',
    })
  }
  const title = (post.seo_title || `${post.title} | ${site.name}`).trim()
  const description = (post.seo_description || post.excerpt).trim()
  return renderInShell(env, request, {
    kind: 'post', slug,
    title,
    html: postHtml(post, related),
    head: blogHead({ title, description, url: `${site.url}/blog/${post.slug}/`, image: abs(post.og_image || post.cover_url), noindex: post.noindex, type: 'article', published: post.published_at, modified: post.updated_at, jsonLd: postJsonLd(post) }),
  })
}
