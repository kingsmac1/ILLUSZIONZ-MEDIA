import { useMemo, useState } from 'react'
import { useData, useDb, type R } from '../data'
import { BulkBar, BulkBtn, RowBox, SelectAllBox, confirmN, useSelection } from '../bulk'
import { Badge, Confirm, Empty, Field, Modal, PageHead, Pager, fmtDate, useDebounced } from '../ui'
import { RichText } from '../builder/RichText'
import { Counter, ImageField, slugify, uploadSiteImage } from './shared'
import { site } from '../../site'

const wordCount = (html: string) => html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length
const toLocalInput = (iso?: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date(iso).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '')

function Editor({ post, onClose }: { post?: R; onClose: () => void }) {
  const { d, toast } = useData()
  const db = useDb()
  const [f, setF] = useState<R>({ title: '', slug: '', excerpt: '', content: '', cover_url: '', cover_alt: '', category: '', tags: [], author: 'Illuszionz Media', published: false, published_at: null, seo_title: '', seo_description: '', og_image: '', noindex: false, ...post })
  const [tags, setTags] = useState<string>((post?.tags ?? []).join(', '))
  const [slugTouched, setSlugTouched] = useState(!!post)
  const [tab, setTab] = useState<'write' | 'seo'>('write')
  const set = (k: string, v: unknown) => setF((c) => ({ ...c, [k]: v }))
  const cats = [...new Set(d.blog_posts.map((p) => p.category).filter(Boolean))]
  const words = wordCount(f.content)
  const slug = f.slug || slugify(f.title)
  const dup = d.blog_posts.some((p) => p.slug === slug && p.id !== post?.id)
  const title = f.seo_title || f.title
  const desc = f.seo_description || f.excerpt

  const checks: [boolean, string][] = [
    [f.title.length >= 20 && f.title.length <= 70, 'Title is 20–70 characters'],
    [(f.seo_description || f.excerpt).length >= 120 && (f.seo_description || f.excerpt).length <= 160, 'Meta description is 120–160 characters'],
    [words >= 300, `At least 300 words (${words} now)`],
    [!!f.cover_url && !!f.cover_alt, 'Cover image with alt text'],
    [/<h2/i.test(f.content), 'Has at least one H2 heading'],
    [/<a [^>]*href=["']\//i.test(f.content), 'Links to another page on the site'],
  ]

  async function save(publish?: boolean) {
    if (!f.title.trim()) return toast('A title is required', 'err')
    if (!slug) return toast('A URL slug is required', 'err')
    if (dup) return toast('Another post already uses that slug', 'err')
    const pub = publish ?? !!f.published
    const row = {
      slug, title: f.title.trim(), excerpt: f.excerpt, content: f.content, cover_url: f.cover_url, cover_alt: f.cover_alt, category: f.category,
      tags: tags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean), author: f.author || site.name, published: pub,
      published_at: pub ? (f.published_at ? new Date(f.published_at).toISOString() : new Date().toISOString()) : f.published_at, seo_title: f.seo_title, seo_description: f.seo_description,
      og_image: f.og_image, noindex: !!f.noindex, read_minutes: Math.max(1, Math.round(words / 200)), updated_at: new Date().toISOString(),
    }
    const r = post ? await db.update('blog_posts', { id: post.id }, row, pub ? 'Saved' : 'Saved as draft') : await db.insert('blog_posts', row, pub ? 'Post published' : 'Draft saved')
    if (r.ok) onClose()
  }

  return (
    <Modal xl title={post ? 'Edit post' : 'New post'} onClose={onClose}>
      <div className="ad-grid" style={{ gridTemplateColumns: 'minmax(0,1fr) 320px', alignItems: 'start' }}>
        <div>
          <div className="ad-form" style={{ gridTemplateColumns: '1fr', marginBottom: 14 }}>
            <Field label="Title"><input type="text" value={f.title} onChange={(e) => { set('title', e.target.value); if (!slugTouched) set('slug', slugify(e.target.value)) }} placeholder="A clear, specific headline" style={{ fontSize: 18, fontWeight: 600 }} /></Field>
            <Field label="URL" hint={`${site.url}/blog/${slug || '…'}/`}><input type="text" value={f.slug} onChange={(e) => { setSlugTouched(true); set('slug', slugify(e.target.value)) }} />{dup && <small className="ad-err">That slug is already used.</small>}</Field>
            <Field label="Short summary (shown on the Journal page and as the default meta description)"><textarea style={{ minHeight: 70 }} value={f.excerpt} onChange={(e) => set('excerpt', e.target.value)} /><Counter value={f.excerpt} min={120} max={160} /></Field>
          </div>
          <div className="ad-tabs"><button className={tab === 'write' ? 'on' : ''} onClick={() => setTab('write')}>Write</button><button className={tab === 'seo' ? 'on' : ''} onClick={() => setTab('seo')}>SEO &amp; sharing</button></div>
          {tab === 'write' ? (
            <>
              <RichText extended value={f.content} onChange={(h) => set('content', h)} minHeight={420} onPickImage={async () => {
                const choice = window.prompt('Paste an image URL, or leave empty to upload a file:')
                if (choice) return choice
                return new Promise<string | null>((resolve) => {
                  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'
                  inp.onchange = async () => { const file = inp.files?.[0]; if (!file) return resolve(null); try { resolve((await uploadSiteImage(file)).url) } catch (e) { toast(`Upload failed: ${e instanceof Error ? e.message : ''}`, 'err'); resolve(null) } }
                  inp.click()
                })
              }} />
              <p className="ad-muted" style={{ marginTop: 6 }}>{words} words · about {Math.max(1, Math.round(words / 200))} min read. Use headings (H2/H3), short paragraphs and link to your service pages.</p>
            </>
          ) : (
            <div className="ad-form" style={{ gridTemplateColumns: '1fr' }}>
              <Field label="SEO title" hint="Shown in Google. Leave empty to use the post title."><input type="text" value={f.seo_title} onChange={(e) => set('seo_title', e.target.value)} placeholder={f.title} /><Counter value={f.seo_title || f.title} min={30} max={60} /></Field>
              <Field label="Meta description" hint="Leave empty to use the short summary."><textarea style={{ minHeight: 80 }} value={f.seo_description} onChange={(e) => set('seo_description', e.target.value)} placeholder={f.excerpt} /><Counter value={f.seo_description || f.excerpt} min={120} max={160} /></Field>
              <ImageField label="Social share image" hint="Shown on WhatsApp, Facebook, X. 1200×630 works best. Leave empty to use the cover image." value={f.og_image} onChange={(u) => set('og_image', u)} />
              <label className="ad-check"><input type="checkbox" checked={!!f.noindex} onChange={(e) => set('noindex', e.target.checked)} />Hide this post from search engines (noindex)</label>
              <div className="ad-card" style={{ background: '#fff' }}>
                <h3>Google preview</h3>
                <div style={{ fontFamily: 'Arial, sans-serif' }}>
                  <div style={{ color: '#202124', fontSize: 13 }}>{site.url.replace('https://', '')} › blog › {slug}</div>
                  <div style={{ color: '#1a0dab', fontSize: 20, margin: '2px 0' }}>{(title || 'Your title').slice(0, 62)}{title.length > 62 ? '…' : ''}</div>
                  <div style={{ color: '#4d5156', fontSize: 14, lineHeight: 1.5 }}>{(desc || 'Your description appears here.').slice(0, 165)}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gap: 14 }}>
          <div className="ad-card">
            <h3>Publish</h3>
            <p style={{ marginBottom: 10 }}>Status: <Badge tone={f.published ? 'green' : 'grey'}>{f.published ? 'published' : 'draft'}</Badge></p>
            <Field label="Publish date" hint="Set a future date to schedule the post."><input type="datetime-local" value={toLocalInput(f.published_at)} onChange={(e) => set('published_at', e.target.value ? new Date(e.target.value).toISOString() : null)} /></Field>
            <div className="ad-actions" style={{ marginTop: 12 }}>
              {f.published ? <button className="ad-btn primary" onClick={() => save(true)}>Update</button> : <button className="ad-btn primary" onClick={() => save(true)}>Publish</button>}
              <button className="ad-btn" onClick={() => save(false)}>{f.published ? 'Unpublish' : 'Save draft'}</button>
            </div>
            {post?.published && <a className="ad-btn sm" style={{ marginTop: 10 }} href={`/blog/${post.slug}/`} target="_blank" rel="noreferrer">View live ↗</a>}
          </div>
          <div className="ad-card">
            <h3>Details</h3>
            <div className="ad-form" style={{ gridTemplateColumns: '1fr' }}>
              <Field label="Category"><input type="text" list="blog-cats" value={f.category} onChange={(e) => set('category', e.target.value)} placeholder="e.g. Weddings" /><datalist id="blog-cats">{cats.map((c) => <option key={c} value={c} />)}</datalist></Field>
              <Field label="Tags" hint="Comma separated"><input type="text" value={tags} onChange={(e) => setTags(e.target.value)} /></Field>
              <Field label="Author"><input type="text" value={f.author} onChange={(e) => set('author', e.target.value)} /></Field>
              <ImageField label="Cover image" value={f.cover_url} onChange={(u) => set('cover_url', u)} />
              <Field label="Cover alt text" hint="Describe the picture — helps accessibility and SEO."><input type="text" value={f.cover_alt} onChange={(e) => set('cover_alt', e.target.value)} /></Field>
            </div>
          </div>
          <div className="ad-card">
            <h3>SEO checklist <small>{checks.filter((c) => c[0]).length}/{checks.length}</small></h3>
            <div className="ad-list">{checks.map(([ok, t]) => <div key={t} style={{ justifyContent: 'flex-start', gap: 8, padding: '7px 0' }}><span style={{ color: ok ? '#15803d' : '#b45309', fontWeight: 800 }}>{ok ? '✓' : '○'}</span><span style={{ color: ok ? undefined : '#7a7a82' }}>{t}</span></div>)}</div>
          </div>
          {post && <Confirm text={`Delete “${post.title}” permanently?`} onYes={async () => { const r = await db.remove('blog_posts', { id: post.id }, 'Post deleted'); if (r.ok) onClose() }}>Delete post</Confirm>}
        </div>
      </div>
    </Modal>
  )
}

export function Blog() {
  const { d } = useData()
  const db = useDb()
  const [q, setQ] = useState('')
  const dq = useDebounced(q)
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [edit, setEdit] = useState<R | 'new' | null>(null)
  const now = Date.now()
  const state = (p: R) => (!p.published ? 'draft' : p.published_at && new Date(p.published_at).getTime() > now ? 'scheduled' : 'published')
  const list = useMemo(() => d.blog_posts.filter((p) => (!status || state(p) === status) && (!dq || `${p.title} ${p.category} ${p.tags.join(' ')}`.toLowerCase().includes(dq.toLowerCase()))).sort((a, b) => (b.published_at ?? b.created_at).localeCompare(a.published_at ?? a.created_at)), [d.blog_posts, status, dq])
  const pages = Math.max(1, Math.ceil(list.length / 15))
  const view = list.slice((Math.min(page, pages) - 1) * 15, Math.min(page, pages) * 15)
  const sel = useSelection(list.map((p) => p.id))
  async function publish(on: boolean) {
    const picked = d.blog_posts.filter((p) => sel.has(p.id))
    const undated = picked.filter((p) => !p.published_at).map((p) => p.id)
    if (on && undated.length) await db.updateMany('blog_posts', undated, { published_at: new Date().toISOString() })
    await db.updateMany('blog_posts', sel.ids, { published: on }, on ? `${sel.count} published` : `${sel.count} moved to drafts`)
  }
  const live = d.blog_posts.filter((p) => state(p) === 'published').length
  return (
    <>
      <PageHead title="Blog" sub={`${live} published · ${d.blog_posts.length - live} drafts or scheduled · public at /blog/`} actions={<><a className="ad-btn" href="/blog/" target="_blank" rel="noreferrer">View Journal ↗</a><button className="ad-btn primary" onClick={() => setEdit('new')}>+ New post</button></>} />
      <div className="ad-toolbar">
        <input type="search" placeholder="Search posts…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} />
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }}><option value="">All</option><option value="published">Published</option><option value="draft">Drafts</option><option value="scheduled">Scheduled</option></select>
      </div>
      <BulkBar s={sel} noun="post">
        <BulkBtn onClick={() => publish(true)}>Publish</BulkBtn>
        <BulkBtn onClick={() => publish(false)}>Unpublish</BulkBtn>
        <BulkBtn onClick={() => db.updateMany('blog_posts', sel.ids, { noindex: true }, `${sel.count} hidden from search engines`)}>Noindex</BulkBtn>
        <BulkBtn onClick={() => db.updateMany('blog_posts', sel.ids, { noindex: false }, `${sel.count} visible to search engines`)}>Allow indexing</BulkBtn>
        <BulkBtn danger onClick={async () => { if (confirmN('Delete', sel.count, 'post', 'This cannot be undone.')) { const r = await db.removeMany('blog_posts', sel.ids, `${sel.count} post${sel.count === 1 ? '' : 's'} deleted`); if (r.ok) sel.clear() } }}>Delete</BulkBtn>
      </BulkBar>
      <div className="ad-tablewrap"><table><thead><tr><th className="sel"><SelectAllBox s={sel} view={view.map((p) => p.id)} /></th><th>Post</th><th>Category</th><th>Status</th><th>Date</th><th className="num">Words</th></tr></thead><tbody>
        {view.map((p) => (
          <tr key={p.id} className={'click' + (sel.has(p.id) ? ' picked' : '')} onClick={() => setEdit(p)}>
            <td className="sel"><RowBox s={sel} id={p.id} label={p.title} /></td>
            <td><div className="ad-who">{p.cover_url ? <img src={p.cover_url} alt="" style={{ width: 54, height: 38, objectFit: 'cover', borderRadius: 6 }} /> : <span className="ad-avatar" style={{ borderRadius: 6 }}>✎</span>}<div><strong>{p.title}</strong><span className="ad-muted" style={{ fontSize: 12 }}>/blog/{p.slug}/</span></div></div></td>
            <td className="ad-muted">{p.category || '—'}</td><td><Badge tone={state(p) === 'published' ? 'green' : state(p) === 'scheduled' ? 'amber' : 'grey'}>{state(p)}</Badge></td>
            <td className="ad-muted">{fmtDate(p.published_at ?? p.created_at)}</td><td className="num">{wordCount(p.content)}</td>
          </tr>
        ))}
      </tbody></table>{!view.length && <Empty title="No posts yet" hint="Write your first article — good posts bring in search traffic." />}<Pager page={Math.min(page, pages)} pages={pages} onChange={setPage} /></div>
      {edit && <Editor post={edit === 'new' ? undefined : edit} onClose={() => setEdit(null)} />}
    </>
  )
}
