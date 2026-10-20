/**
 * Server-side rendering of the public blog (index + posts) as HTML fragments, plus the SEO head tags,
 * JSON-LD, RSS and sitemap. The Cloudflare function injects the fragment into the site's own prerendered
 * shell page (header, footer, menu), so blog pages are full HTML for crawlers and share the site's design.
 */
import { site } from '../site'
import { cleanParagraphHtml } from './emailBlocks'

export type Post = {
  id?: string; slug: string; title: string; excerpt: string; content: string; cover_url: string; cover_alt: string; category: string; tags: string[]
  author: string; published_at: string | null; updated_at?: string; seo_title: string; seo_description: string; og_image: string; noindex: boolean; read_minutes: number
}

export const esc = (v: string) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
export const abs = (u: string, base = site.url) => (!u ? '' : /^https?:\/\//i.test(u) ? u : base.replace(/\/$/, '') + (u.startsWith('/') ? u : '/' + u))
const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '')
export const readMinutes = (html: string) => Math.max(1, Math.round(html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length / 200))

export const BLOG_CSS = `
.bl{font-family:Inter,-apple-system,sans-serif;color:#111;background:#fff;-webkit-font-smoothing:antialiased}
.bl *{box-sizing:border-box}
.bl a{color:inherit}
.bl-wrap{max-width:1140px;margin:0 auto;padding:0 24px}
.bl-hero{background:#000;color:#fff;padding:90px 24px 80px;text-align:center}
.bl-eyebrow{font-size:12px;letter-spacing:.28em;text-transform:uppercase;color:rgba(255,255,255,.62);margin:0 0 16px;font-weight:600}
.bl-hero h1{font-family:'Playfair Display',serif;font-weight:600;font-size:clamp(34px,5.4vw,62px);line-height:1.08;margin:0 auto;max-width:900px}
.bl-hero p.lead{max-width:640px;margin:22px auto 0;color:rgba(255,255,255,.75);font-size:17px;line-height:1.7}
.bl-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:34px;padding:70px 0 90px}
.bl-card{display:flex;flex-direction:column;text-decoration:none;color:inherit}
.bl-card .img{aspect-ratio:16/10;overflow:hidden;background:#efeee9;border-radius:6px}
.bl-card img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .5s ease}
.bl-card:hover img{transform:scale(1.04)}
.bl-cat{margin:18px 0 8px;font-size:11px;letter-spacing:.2em;text-transform:uppercase;font-weight:700;color:#85847e}
.bl-card h2{font-family:'Playfair Display',serif;font-weight:600;font-size:23px;line-height:1.25;margin:0 0 10px}
.bl-card p{margin:0 0 14px;color:#525252;line-height:1.65;font-size:15px}
.bl-meta{font-size:13px;color:#85847e}
.bl-more{margin-top:auto;font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;border-bottom:1px solid #111;align-self:flex-start;padding-bottom:2px}
.bl-empty{padding:90px 0;text-align:center;color:#525252}
.bl-crumbs{font-size:13px;color:rgba(255,255,255,.6);margin:0 0 22px}
.bl-crumbs a{color:rgba(255,255,255,.8);text-decoration:none}
.bl-art-hero h1{font-size:clamp(30px,4.6vw,52px)}
.bl-byline{margin-top:22px;color:rgba(255,255,255,.7);font-size:14px}
.bl-cover{max-width:980px;margin:-40px auto 0;padding:0 24px;position:relative}
.bl-cover img{width:100%;height:auto;display:block;border-radius:8px;box-shadow:0 30px 70px -30px rgba(0,0,0,.5);background:#efeee9}
.bl-article{max-width:740px;margin:0 auto;padding:56px 24px 40px}
.bl-content{font-size:18px;line-height:1.85;color:#222}
.bl-content h2{font-family:'Playfair Display',serif;font-weight:600;font-size:30px;line-height:1.2;margin:2.2em 0 .6em;color:#000}
.bl-content h3{font-family:'Playfair Display',serif;font-weight:600;font-size:23px;margin:1.8em 0 .5em;color:#000}
.bl-content p{margin:0 0 1.3em}
.bl-content ul,.bl-content ol{margin:0 0 1.4em;padding-left:1.3em}
.bl-content li{margin:.4em 0}
.bl-content a{color:#000;text-decoration:underline;text-underline-offset:3px}
.bl-content img{max-width:100%;height:auto;border-radius:6px;margin:1.2em 0}
.bl-content blockquote{margin:1.6em 0;padding:.2em 0 .2em 1.3em;border-left:3px solid #000;font-family:'Playfair Display',serif;font-size:22px;line-height:1.55;color:#000}
.bl-tags{display:flex;flex-wrap:wrap;gap:8px;margin:34px 0 0}
.bl-tags span{border:1px solid #dcdad2;border-radius:99px;padding:5px 13px;font-size:13px;color:#525252}
.bl-share{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:30px 0 0;padding-top:24px;border-top:1px solid #e6e5e0;font-size:13px;color:#85847e}
.bl-share a{border:1px solid #111;border-radius:99px;padding:8px 16px;font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;text-decoration:none}
.bl-share a:hover{background:#111;color:#fff}
.bl-cta{max-width:980px;margin:30px auto 0;padding:0 24px}
.bl-cta div{background:#000;color:#fff;border-radius:10px;padding:48px 36px;text-align:center}
.bl-cta h2{font-family:'Playfair Display',serif;font-weight:600;font-size:clamp(26px,3.4vw,38px);margin:0 0 12px}
.bl-cta p{margin:0 auto 24px;max-width:520px;color:rgba(255,255,255,.75);line-height:1.7}
.bl-cta a{display:inline-block;margin:4px 6px;padding:14px 30px;border-radius:99px;border:1px solid #fff;color:#fff;text-decoration:none;font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase}
.bl-cta a.solid{background:#fff;color:#000}
.bl-related{padding:30px 0 90px}
.bl-related>h2{font-family:'Playfair Display',serif;font-weight:600;font-size:30px;text-align:center;margin:60px 0 0}
.bp{padding:34px 24px 0}
.bp-wrap{max-width:1140px;margin:0 auto}
.bp-crumbs{font-size:13px;color:#85847e;margin:0 0 22px}
.bp-crumbs a{text-decoration:none}
.bp-crumbs a:hover{color:#000;text-decoration:underline}
.bp-cover{margin:0;border-radius:20px;overflow:hidden;background:#efeee9;aspect-ratio:16/7}
.bp-cover img{width:100%;height:100%;object-fit:cover;display:block}
.bp-grid{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:64px;align-items:start;padding:44px 0 30px}
.bp-pill{display:inline-block;padding:5px 14px;border:1px solid #cfcdc3;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#525252}
.bp-main h1{font-family:'Playfair Display',serif;font-weight:500;font-size:clamp(32px,4.4vw,50px);line-height:1.12;margin:18px 0 22px;color:#000}
.bp-by{display:flex;align-items:center;gap:12px;font-size:14px;color:#525252}
.bp-av{display:grid;place-items:center;flex:none;width:36px;height:36px;border-radius:9px;background:#000;color:#fff;font-weight:700;font-size:13px;letter-spacing:.02em}
.bp-by time{margin-left:auto;white-space:nowrap;color:#85847e}
.bp-lead{margin:26px 0 0;font-size:19px;line-height:1.7;color:#444}
.bp-rule{border:0;border-top:1px solid #e6e5e0;margin:30px 0 34px}
.bp-main .bl-content{font-size:17.5px}
.bp-main .bl-content h2{font-size:27px}
.bp-end{margin:40px 0 0;padding:26px 28px;border:1px solid #e6e5e0;border-radius:16px;background:#faf9f6;display:flex;align-items:center;gap:22px;flex-wrap:wrap}
.bp-end-text{flex:1;min-width:220px}
.bp-end strong{display:block;font-family:'Playfair Display',serif;font-weight:600;font-size:22px;line-height:1.25;color:#000}
.bp-end span{display:block;margin-top:4px;color:#666;font-size:15px;line-height:1.55}
.bp-btn{display:inline-block;padding:13px 26px;border-radius:999px;background:#000;color:#fff!important;text-decoration:none;font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;transition:transform .2s,background .2s}
.bp-btn:hover{background:#262626;transform:translateY(-1px)}
.bp-btn.ghost{background:transparent;color:#000!important;border:1px solid #000}
.bp-btn.ghost:hover{background:#000;color:#fff!important}
.bp-side{position:sticky;top:112px;display:grid;gap:18px}
.bp-card{padding:26px;border-radius:18px;background:#fff;border:1px solid #e6e5e0;box-shadow:0 20px 40px -32px rgba(0,0,0,.35)}
.bp-card.dark{background:#000;border-color:#000;color:#fff}
.bp-card h3{font-family:'Playfair Display',serif;font-weight:600;font-size:24px;line-height:1.25;margin:0 0 8px}
.bp-card p{margin:0 0 18px;font-size:14.5px;line-height:1.65;color:#666}
.bp-card.dark p{color:rgba(255,255,255,.72)}
.bp-card .bp-btn{display:block;text-align:center;margin-top:10px}
.bp-card.dark .bp-btn{background:#fff;color:#000!important}
.bp-card.dark .bp-btn:hover{background:#e9e8e3}
.bp-card.dark .bp-btn.ghost{background:transparent;color:#fff!important;border-color:rgba(255,255,255,.55)}
.bp-card.dark .bp-btn.ghost:hover{background:#fff;color:#000!important}
.bp-eyebrow{display:block;margin-bottom:12px;font-size:11px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:rgba(255,255,255,.55)}
.bp-share-title{display:block;margin-bottom:12px;font-size:13px;font-weight:600;color:#000}
.bp-icons{display:flex;gap:10px;flex-wrap:wrap}
.bp-icons a,.bp-icons button{display:grid;place-items:center;width:42px;height:42px;border-radius:50%;border:1px solid #cfcdc3;background:#fff;color:#000;cursor:pointer;transition:background .2s,color .2s,border-color .2s}
.bp-icons a:hover,.bp-icons button:hover{background:#000;color:#fff;border-color:#000}
.bp-icons svg{width:17px;height:17px;display:block}
@media(max-width:1000px){.bp-grid{grid-template-columns:minmax(0,1fr);gap:40px}.bp-side{position:static}}
@media(max-width:600px){.bp{padding:20px 16px 0}.bp-cover{border-radius:14px;aspect-ratio:4/3}.bp-grid{padding-top:30px}.bp-lead{font-size:17.5px}.bp-by time{display:none}.bp-end{padding:22px}.bp-card{padding:22px}}
@media(max-width:900px){.bl-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:600px){.bl-grid{grid-template-columns:1fr;gap:40px;padding:44px 0 60px}.bl-hero{padding:60px 20px 56px}.bl-content{font-size:17px}.bl-cover{margin-top:-24px}}
`

const card = (p: Post) => `<a class="bl-card" href="/blog/${esc(p.slug)}/">
  <div class="img">${p.cover_url ? `<img src="${esc(p.cover_url)}" alt="${esc(p.cover_alt || p.title)}" loading="lazy" width="800" height="500">` : ''}</div>
  ${p.category ? `<div class="bl-cat">${esc(p.category)}</div>` : '<div class="bl-cat">&nbsp;</div>'}
  <h2>${esc(p.title)}</h2><p>${esc(p.excerpt)}</p>
  <div class="bl-meta">${esc(fmt(p.published_at))} · ${p.read_minutes} min read</div>
</a>`

export function indexHtml(posts: Post[]) {
  return `<style>${BLOG_CSS}</style><div class="bl">
  <section class="bl-hero"><p class="bl-eyebrow">The Journal</p><h1>Photography tips, wedding planning &amp; behind the scenes</h1>
  <p class="lead">Advice from the Illuszionz Media team to help you prepare for your session, plan your event and get the most from your pictures and films.</p></section>
  <div class="bl-wrap">${posts.length ? `<div class="bl-grid">${posts.map(card).join('')}</div>` : '<div class="bl-empty"><p>New articles are on their way — check back soon.</p></div>'}</div></div>`
}

/** Shown (with a 503) when the database cannot be reached, so a connection problem is never mistaken for "no articles". */
export const unavailableHtml = () => `<style>${BLOG_CSS}</style><div class="bl"><section class="bl-hero"><p class="bl-eyebrow">The Journal</p><h1>Back in a moment</h1><p class="lead">We could not load the articles just now. Please refresh in a minute.</p></section></div>`

export function postHtml(p: Post, related: Post[]) {
  const url = `${site.url}/blog/${p.slug}/`
  const body = cleanParagraphHtml(p.content).replace(/<img /g, '<img loading="lazy" ')
  const enc = encodeURIComponent
  const icon = (d: string) => `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="${d}"/></svg>`
  const X = 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z'
  const FB = 'M13.5 21v-8h2.7l.4-3.2h-3.1V7.8c0-.9.3-1.5 1.6-1.5h1.7V3.4c-.3 0-1.3-.1-2.4-.1-2.4 0-4.1 1.5-4.1 4.2v2.3H7.6V13h2.7v8z'
  const WA = 'M12 3a9 9 0 0 0-7.7 13.6L3 21l4.5-1.2A9 9 0 1 0 12 3zm4.6 12.6c-.2.5-1.1 1-1.6 1-.4.1-.9.1-2.8-.6-2.3-1-3.8-3.3-3.9-3.5-.1-.2-.9-1.2-.9-2.2s.5-1.5.7-1.7c.2-.2.4-.3.6-.3h.4c.1 0 .3 0 .5.4l.7 1.7c.1.1.1.3 0 .4l-.3.4-.3.3c-.1.1-.2.3-.1.5.1.2.6 1 1.4 1.6.9.8 1.7 1 1.9 1.1.2.1.4.1.5-.1l.7-.9c.2-.2.3-.2.5-.1l1.6.8c.2.1.4.2.4.3.1.1.1.6-.1 1.1z'
  const LINK = 'M10.6 13.4a1 1 0 0 1 0-1.4l3.4-3.4a3 3 0 1 1 4.2 4.2l-1.6 1.6-1.4-1.4 1.6-1.6a1 1 0 0 0-1.4-1.4L12 13.4a1 1 0 0 1-1.4 0zm2.8-2.8a1 1 0 0 1 0 1.4L10 15.4a3 3 0 1 1-4.2-4.2l1.6-1.6 1.4 1.4-1.6 1.6a1 1 0 0 0 1.4 1.4L12 10.6a1 1 0 0 1 1.4 0z'
  const share = `<span class="bp-share-title">Share this article</span><div class="bp-icons">
      <a href="https://wa.me/?text=${enc(p.title + ' ' + url)}" target="_blank" rel="noopener" aria-label="Share on WhatsApp">${icon(WA)}</a>
      <a href="https://twitter.com/intent/tweet?text=${enc(p.title)}&url=${enc(url)}" target="_blank" rel="noopener" aria-label="Share on X">${icon(X)}</a>
      <a href="https://www.facebook.com/sharer/sharer.php?u=${enc(url)}" target="_blank" rel="noopener" aria-label="Share on Facebook">${icon(FB)}</a>
      <button type="button" data-copy-link aria-label="Copy link" title="Copy link">${icon(LINK)}</button></div>`
  return `<style>${BLOG_CSS}</style><article class="bl bp"><div class="bp-wrap">
  <nav class="bp-crumbs" aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/blog/">Journal</a>${p.category ? ` / ${esc(p.category)}` : ''}</nav>
  ${p.cover_url ? `<figure class="bp-cover"><img src="${esc(p.cover_url)}" alt="${esc(p.cover_alt || p.title)}" width="1200" height="525" fetchpriority="high"></figure>` : ''}
  <div class="bp-grid">
    <div class="bp-main">
      ${p.category ? `<span class="bp-pill">${esc(p.category)}</span>` : ''}
      <h1>${esc(p.title)}</h1>
      <div class="bp-by"><span class="bp-av" aria-hidden="true">iL</span><span>By ${esc(p.author)}</span><time datetime="${esc(p.published_at ?? '')}">${esc(fmt(p.published_at))} · ${p.read_minutes} min read</time></div>
      ${p.excerpt ? `<p class="bp-lead">${esc(p.excerpt)}</p>` : ''}
      <hr class="bp-rule">
      <div class="bl-content">${body}</div>
      ${p.tags?.length ? `<div class="bl-tags">${p.tags.map((t) => `<span>#${esc(t)}</span>`).join('')}</div>` : ''}
      <div class="bp-end"><div class="bp-end-text"><strong>Planning a session or an event?</strong><span>Tell us what you have in mind and we will help you choose the right package.</span></div>
        <a class="bp-btn" href="/photography-services/">Book a session</a></div>
    </div>
    <aside class="bp-side" aria-label="Article sidebar">
      <div class="bp-card dark"><span class="bp-eyebrow">Work with us</span><h3>Your story, beautifully told</h3><p>Portraits, weddings, events and film — book your date or ask us anything.</p>
        <a class="bp-btn" href="/photography-services/">Book a session</a><a class="bp-btn ghost" href="/contact/">Get in touch</a></div>
      <div class="bp-card">${share}</div>
    </aside>
  </div>
  ${related.length ? `<div class="bl-related"><h2>Keep reading</h2><div class="bl-grid">${related.map(card).join('')}</div></div>` : '<div style="height:60px"></div>'}
  </div><script>document.querySelectorAll('[data-copy-link]').forEach(function(b){b.addEventListener('click',function(){if(navigator.clipboard)navigator.clipboard.writeText(location.href).then(function(){b.title='Copied!';b.setAttribute('aria-label','Link copied')})})})</script></article>`
}

/** Head tags appended to the shell for a blog page. */
export function blogHead(o: { title: string; description: string; url: string; image?: string; noindex?: boolean; type?: 'website' | 'article'; published?: string | null; modified?: string; jsonLd?: unknown[] }) {
  const img = o.image || `${site.url}/og-image.jpg`
  return [
    `<meta name="description" content="${esc(o.description)}">`,
    `<meta name="robots" content="${o.noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large'}">`,
    `<link rel="canonical" href="${esc(o.url)}">`,
    `<meta property="og:type" content="${o.type ?? 'website'}"><meta property="og:site_name" content="${esc(site.name)}"><meta property="og:locale" content="en_GB">`,
    `<meta property="og:title" content="${esc(o.title)}"><meta property="og:description" content="${esc(o.description)}"><meta property="og:url" content="${esc(o.url)}"><meta property="og:image" content="${esc(img)}">`,
    o.type === 'article' && o.published ? `<meta property="article:published_time" content="${esc(o.published)}">` : '',
    o.type === 'article' && o.modified ? `<meta property="article:modified_time" content="${esc(o.modified)}">` : '',
    `<meta name="twitter:card" content="summary_large_image"><meta name="twitter:site" content="@illuszionzfoto"><meta name="twitter:title" content="${esc(o.title)}"><meta name="twitter:description" content="${esc(o.description)}"><meta name="twitter:image" content="${esc(img)}">`,
    `<link rel="alternate" type="application/rss+xml" title="${esc(site.name)} Journal" href="${site.url}/blog/rss.xml">`,
    ...(o.jsonLd ?? []).map((j) => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, '\\u003c')}</script>`),
  ].join('')
}

export const postJsonLd = (p: Post) => [
  {
    '@context': 'https://schema.org', '@type': 'BlogPosting', headline: p.title, description: p.seo_description || p.excerpt,
    image: [abs(p.og_image || p.cover_url) || `${site.url}/og-image.jpg`], datePublished: p.published_at, dateModified: p.updated_at || p.published_at,
    author: { '@type': 'Organization', name: p.author || site.name, url: site.url },
    publisher: { '@type': 'Organization', name: site.name, logo: { '@type': 'ImageObject', url: `${site.url}/images/Illusionz-Media-Logo-Black.png` } },
    mainEntityOfPage: { '@type': 'WebPage', '@id': `${site.url}/blog/${p.slug}/` }, keywords: (p.tags ?? []).join(', '), articleSection: p.category || undefined,
  },
  {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: site.url + '/' },
      { '@type': 'ListItem', position: 2, name: 'Journal', item: site.url + '/blog/' },
      { '@type': 'ListItem', position: 3, name: p.title, item: `${site.url}/blog/${p.slug}/` },
    ],
  },
]

export function rssXml(posts: Post[]) {
  const items = posts.map((p) => `<item><title>${esc(p.title)}</title><link>${site.url}/blog/${p.slug}/</link><guid isPermaLink="true">${site.url}/blog/${p.slug}/</guid><pubDate>${new Date(p.published_at ?? Date.now()).toUTCString()}</pubDate><description>${esc(p.excerpt)}</description>${p.category ? `<category>${esc(p.category)}</category>` : ''}</item>`).join('')
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${esc(site.name)} Journal</title><link>${site.url}/blog/</link><description>Photography tips, wedding planning and behind the scenes from ${esc(site.name)}.</description><language>en-gb</language>${items}</channel></rss>`
}

const STATIC_PAGES: [string, string][] = [['/', '1.0'], ['/about-us/', '0.8'], ['/photography-services/', '0.8'], ['/wedding/', '0.8'], ['/videography-services/', '0.8'], ['/360-photo-booth/', '0.8'], ['/academy/', '0.8'], ['/agency/', '0.8'], ['/careers/', '0.8'], ['/store/', '0.8'], ['/contact/', '0.8'], ['/form/', '0.8'], ['/media/', '0.8'], ['/review/', '0.8'], ['/blog/', '0.9']]
export function sitemapXml(posts: Post[], noindexPaths: string[] = []) {
  const skip = new Set(noindexPaths)
  const urls = [
    ...STATIC_PAGES.filter(([p]) => !skip.has(p)).map(([p, pr]) => `<url><loc>${site.url}${p}</loc><changefreq>monthly</changefreq><priority>${pr}</priority></url>`),
    ...posts.filter((p) => !p.noindex).map((p) => `<url><loc>${site.url}/blog/${esc(p.slug)}/</loc><lastmod>${(p.updated_at || p.published_at || '').slice(0, 10)}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>`),
  ]
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  ${urls.join('\n  ')}\n</urlset>\n`
}
