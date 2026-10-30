import { lazy, Suspense, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { adminApi, configured, supabase } from './supabase'
import { DataProvider, useData } from './data'
import { Overview } from './sections/Overview'
import { Bookings } from './sections/Bookings'
import { Schedule } from './sections/Schedule'
import { Inbox } from './sections/Inbox'
import { Finance } from './sections/Finance'
import { Prices } from './sections/Prices'
import { Promos } from './sections/Promos'
import { Emails } from './sections/Emails'
import { Settings } from './sections/Settings'
import { Contacts } from './crm/Contacts'
import { Pipeline } from './crm/Pipeline'
import { Tasks } from './crm/Tasks'
import { Companies } from './crm/Companies'
import { CrmReports } from './crm/Reports'
import { Blog } from './cms/Blog'
import { StoreCms } from './cms/Store'
import { TestimonialsCms } from './cms/Testimonials'
import { ImagesCms } from './cms/Images'
import { BannerCms } from './cms/Banner'
import { SeoCms } from './cms/Seo'
import { SaveStatus } from './cms/SaveStatus'
import { useGalleryIndex } from '../features/gallery/admin/useGalleryIndex'
import './admin.css'

const GalleriesSection = lazy(() => import('../features/gallery/admin/GalleriesSection').then((m) => ({ default: m.GalleriesSection })))
const GalleryManager = lazy(() => import('../features/gallery/admin/GalleryManager').then((m) => ({ default: m.GalleryManager })))

const I: Record<string, string> = {
  overview: 'M3 12l9-9 9 9M5 10v10h14V10',
  schedule: 'M4 6h16v14H4zM4 10h16M8 3v6M16 3v6',
  bookings: 'M6 3h12v18l-6-4-6 4z',
  inbox: 'M3 6h18v12H3zM3 7l9 7 9-7',
  contacts: 'M16 19v-1a4 4 0 00-4-4H8a4 4 0 00-4 4v1M10 11a3 3 0 100-6 3 3 0 000 6M20 19v-1a3 3 0 00-2-2.8M16 5.2a3 3 0 010 5.6',
  pipeline: 'M4 4h4v16H4zM10 4h4v10h-4zM16 4h4v6h-4z',
  tasks: 'M9 11l3 3 8-8M20 12v7H4V5h10',
  companies: 'M4 21V7l8-4 8 4v14M9 21v-6h6v6M9 10h.01M15 10h.01',
  reports: 'M4 20V10M10 20V4M16 20v-8M22 20H2',
  finance: 'M12 3v18M16 7H10a3 3 0 000 6h4a3 3 0 010 6H7',
  prices: 'M3 12l9-9h9v9l-9 9zM16 8h.01',
  promos: 'M4 8h16v3a2 2 0 000 4v3H4v-3a2 2 0 000-4zM10 8v10',
  emails: 'M3 6h18v12H3zM3 7l9 7 9-7M17 3l4 3',
  blog: 'M4 4h16v16H4zM8 9h8M8 13h8M8 17h5',
  store: 'M3 9l1-5h16l1 5M4 9v11h16V9M9 20v-6h6v6',
  quote: 'M7 7h4v4H7zM13 7h4v4h-4zM7 11c0 3-1 5-3 6M13 11c0 3-1 5-3 6',
  images: 'M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6M9 9h.01',
  galleries: 'M7 3h14v14H7zM3 7v14h14M7 13l4-4 3 3 2-2 5 5M12 7h.01',
  banner: 'M3 6h18v8H3zM8 18h8',
  seo: 'M11 4a7 7 0 100 14 7 7 0 000-14M21 21l-5-5',
  settings: 'M12 15a3 3 0 100-6 3 3 0 000 6M19 12a7 7 0 00-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 00-2-1.2L14.2 3h-4l-.4 2.6a7 7 0 00-2 1.2l-2.3-.9-2 3.4 2 1.5a7 7 0 000 2.4l-2 1.5 2 3.4 2.3-.9a7 7 0 002 1.2l.4 2.6h4l.4-2.6a7 7 0 002-1.2l2.3.9 2-3.4-2-1.5c.1-.4.1-.8.1-1.2',
}
const Icon = ({ n }: { n: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={I[n]} /></svg>
)

type Item = { id: string; label: string; icon: string; badge?: number }
/** where each Website page shows up on the live site */
const LIVE: Record<string, string> = { 'cms/blog': '/blog/', 'cms/store': '/store/', 'cms/testimonials': '/', 'cms/images': '/', 'cms/banner': '/', 'cms/seo': '/' }

function useHash() {
  const [h, setH] = useState(() => (typeof window === 'undefined' ? '' : window.location.hash.replace(/^#\/?/, '')))
  useEffect(() => {
    const f = () => setH(window.location.hash.replace(/^#\/?/, ''))
    window.addEventListener('hashchange', f)
    return () => window.removeEventListener('hashchange', f)
  }, [])
  return h || 'overview'
}

function Login() {
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  async function go(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErr('')
    const { error } = await supabase!.auth.signInWithPassword({ email: email.trim(), password: pw })
    if (error) setErr(error.message)
    setBusy(false)
  }
  return (
    <div className="ad ad-login">
      <form onSubmit={go}>
        <div className="ad-login-head">
          <img src="/images/illuszionz-logo-white.png" alt="Illuszionz Media" />
          <p>Studio dashboard — sign in to continue.</p>
        </div>
        <label className="ad-field"><span>Email</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required /></label>
        <label className="ad-field"><span>Password</span>
          <span className="ad-pw">
            <input type={showPw ? 'text' : 'password'} value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" required />
            <button type="button" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? 'Hide password' : 'Show password'} aria-pressed={showPw} title={showPw ? 'Hide password' : 'Show password'}>
              {showPw ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 5.1A9.8 9.8 0 0112 5c5 0 9 4.5 10 7a11 11 0 01-3.2 4.2M6.1 6.1A11.2 11.2 0 002 12c1 2.5 5 7 10 7a9.6 9.6 0 004-.9" /></svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 12c1-2.5 5-7 10-7s9 4.5 10 7c-1 2.5-5 7-10 7S3 14.5 2 12z" /><circle cx="12" cy="12" r="3" /></svg>
              )}
            </button>
          </span>
        </label>
        {err && <p className="ad-err" role="alert">{err}</p>}
        <button className="ad-btn primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </div>
  )
}

function Shell({ session }: { session: Session }) {
  const { d, loading, error } = useData()
  const route = useHash()
  const [open, setOpen] = useState(false)
  const [meta, setMeta] = useState<{ mail: boolean; dryRun?: boolean } | null>(null)
  useEffect(() => setOpen(false), [route])
  useEffect(() => { adminApi({ action: 'whoami' }).then((r) => r.ok && setMeta({ mail: (r as any).mail, dryRun: (r as any).dryRun })).catch(() => undefined) }, [])

  const unread = d.submissions.filter((s) => s.status === 'new').length
  const newBookings = d.bookings.filter((b) => b.status === 'new').length
  const dueTasks = d.tasks.filter((t) => !t.done && t.due_at && new Date(t.due_at).getTime() < Date.now() + 86_400_000).length
  const gx = useGalleryIndex()
  const waitingSelections = gx.galleries.filter((g) => g.kind === 'proof' && g.status === 'submitted').length
  const groups: { title: string; items: Item[] }[] = [
    { title: 'Studio', items: [
      { id: 'overview', label: 'Overview', icon: 'overview' },
      { id: 'bookings', label: 'Bookings', icon: 'bookings', badge: newBookings },
      { id: 'galleries', label: 'Galleries', icon: 'galleries', badge: waitingSelections },
      { id: 'schedule', label: 'Schedule', icon: 'schedule' },
      { id: 'inbox', label: 'Inbox', icon: 'inbox', badge: unread },
    ] },
    { title: 'CRM', items: [
      { id: 'crm/contacts', label: 'Contacts', icon: 'contacts' },
      { id: 'crm/pipeline', label: 'Pipeline', icon: 'pipeline' },
      { id: 'crm/tasks', label: 'Tasks', icon: 'tasks', badge: dueTasks },
      { id: 'crm/companies', label: 'Companies', icon: 'companies' },
      { id: 'crm/reports', label: 'CRM reports', icon: 'reports' },
    ] },
    { title: 'Website', items: [
      { id: 'cms/blog', label: 'Blog', icon: 'blog' },
      { id: 'cms/store', label: 'Store', icon: 'store' },
      { id: 'cms/testimonials', label: 'Testimonials', icon: 'quote' },
      { id: 'cms/images', label: 'Images', icon: 'images' },
      { id: 'cms/banner', label: 'Site banner', icon: 'banner' },
      { id: 'cms/seo', label: 'Page SEO', icon: 'seo' },
    ] },
    { title: 'Business', items: [
      { id: 'finance', label: 'Finance', icon: 'finance' },
      { id: 'prices', label: 'Prices', icon: 'prices' },
      { id: 'promos', label: 'Promo codes', icon: 'promos' },
      { id: 'emails', label: 'Emails', icon: 'emails' },
      { id: 'settings', label: 'Settings', icon: 'settings' },
    ] },
  ]
  const all = groups.flatMap((g) => g.items)
  const [base, ...rest] = route.split('?')[0].split('/')
  const key = base === 'crm' ? `crm/${rest[0] ?? 'contacts'}` : base === 'cms' ? `cms/${rest[0] ?? 'blog'}` : base
  const current = all.find((i) => i.id === key) ?? all[0]

  let page: ReactNode
  switch (current.id) {
    case 'bookings': page = rest[1] === 'gallery' && rest[0] ? <Suspense fallback={<p className="ad-muted">Loading…</p>}><GalleryManager key={rest[0]} bookingId={rest[0]} /></Suspense> : <Bookings />; break
    case 'galleries': page = <Suspense fallback={<p className="ad-muted">Loading…</p>}><GalleriesSection /></Suspense>; break
    case 'schedule': page = <Schedule />; break
    case 'inbox': page = <Inbox />; break
    case 'crm/contacts': page = <Contacts openId={rest[1]} />; break
    case 'crm/pipeline': page = <Pipeline />; break
    case 'crm/tasks': page = <Tasks />; break
    case 'crm/companies': page = <Companies />; break
    case 'crm/reports': page = <CrmReports />; break
    case 'cms/blog': page = <Blog />; break
    case 'cms/store': page = <StoreCms />; break
    case 'cms/testimonials': page = <TestimonialsCms />; break
    case 'cms/images': page = <ImagesCms />; break
    case 'cms/banner': page = <BannerCms />; break
    case 'cms/seo': page = <SeoCms />; break
    case 'finance': page = <Finance />; break
    case 'prices': page = <Prices />; break
    case 'promos': page = <Promos />; break
    case 'emails': page = <Emails mail={meta} />; break
    case 'settings': page = <Settings email={session.user.email ?? ''} />; break
    default: page = <Overview />
  }

  return (
    <div className="ad">
      <div className="ad-top"><button onClick={() => setOpen(true)} aria-label="Open menu">☰</button>{current.label}</div>
      {open && <div className="ad-scrim" onClick={() => setOpen(false)} />}
      <aside className={'ad-side' + (open ? ' open' : '')}>
        <a className="ad-brand" href="#/overview" aria-label="Illuszionz Media dashboard"><img src="/images/illuszionz-logo-white.png" alt="Illuszionz Media" /></a>
        <nav className="ad-nav">
          {groups.map((g) => (
            <div key={g.title} style={{ display: 'contents' }}>
              <h6>{g.title}</h6>
              {g.items.map((it) => (
                <a key={it.id} href={`#/${it.id}`} className={it.id === current.id ? 'on' : ''}>
                  <Icon n={it.icon} />{it.label}{it.badge ? <em>{it.badge}</em> : null}
                </a>
              ))}
            </div>
          ))}
        </nav>
        <div className="ad-user">
          <b>{session.user.email}</b>
          <a href="/" target="_blank" rel="noreferrer">View site ↗</a>
          <button onClick={() => supabase!.auth.signOut()}>Sign out</button>
        </div>
      </aside>
      <main className="ad-main">
        {error && <div className="ad-note" style={{ marginBottom: 16 }}>Could not load some data: {error}. Did you run <b>supabase/schema.sql</b> and add your email to <b>admin_users</b>?</div>}
        {loading ? <p className="ad-muted">Loading…</p> : <>{current.id.startsWith('cms/') && <SaveStatus liveHref={LIVE[current.id] ?? '/'} />}{page}</>}
      </main>
    </div>
  )
}

export default function AdminApp() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [admin, setAdmin] = useState<boolean | undefined>(undefined)
  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])
  // clients share the same sign-in; anyone who is not a studio admin is sent to their client area
  const uid = session?.user.id
  useEffect(() => {
    if (!uid) return setAdmin(undefined)
    supabase!.rpc('is_admin').then(({ data, error }) => {
      if (!error && data === false) window.location.replace('/account/')
      else setAdmin(true)
    })
  }, [uid])
  if (!configured)
    return (
      <div className="ad ad-login"><div style={{ background: '#fff', borderRadius: 18, padding: 32, maxWidth: 520 }}>
        <h1 style={{ fontFamily: 'Playfair Display, serif' }}>Dashboard not connected</h1>
        <p className="ad-muted" style={{ marginTop: 10 }}>Set <b>VITE_SUPABASE_URL</b> and <b>VITE_SUPABASE_ANON_KEY</b> (see README → Dashboard), then rebuild.</p>
      </div></div>
    )
  if (session === undefined) return <div className="ad ad-login" />
  if (!session) return <Login />
  if (!admin) return <div className="ad ad-login" />
  return (
    <DataProvider>
      <Shell session={session} />
    </DataProvider>
  )
}
