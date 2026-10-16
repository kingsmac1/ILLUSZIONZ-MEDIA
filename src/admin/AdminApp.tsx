import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
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
import './admin.css'

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
  settings: 'M12 15a3 3 0 100-6 3 3 0 000 6M19 12a7 7 0 00-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 00-2-1.2L14.2 3h-4l-.4 2.6a7 7 0 00-2 1.2l-2.3-.9-2 3.4 2 1.5a7 7 0 000 2.4l-2 1.5 2 3.4 2.3-.9a7 7 0 002 1.2l.4 2.6h4l.4-2.6a7 7 0 002-1.2l2.3.9 2-3.4-2-1.5c.1-.4.1-.8.1-1.2',
}
const Icon = ({ n }: { n: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={I[n]} /></svg>
)

type Item = { id: string; label: string; icon: string; badge?: number }

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
        <div>
          <h1>Illuszionz Media</h1>
          <p>Studio dashboard — sign in to continue.</p>
        </div>
        <label className="ad-field"><span>Email</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required /></label>
        <label className="ad-field"><span>Password</span><input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" required /></label>
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
  const groups: { title: string; items: Item[] }[] = [
    { title: 'Studio', items: [
      { id: 'overview', label: 'Overview', icon: 'overview' },
      { id: 'bookings', label: 'Bookings', icon: 'bookings', badge: newBookings },
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
  const key = base === 'crm' ? `crm/${rest[0] ?? 'contacts'}` : base
  const current = all.find((i) => i.id === key) ?? all[0]

  let page: ReactNode
  switch (current.id) {
    case 'bookings': page = <Bookings />; break
    case 'schedule': page = <Schedule />; break
    case 'inbox': page = <Inbox />; break
    case 'crm/contacts': page = <Contacts openId={rest[1]} />; break
    case 'crm/pipeline': page = <Pipeline />; break
    case 'crm/tasks': page = <Tasks />; break
    case 'crm/companies': page = <Companies />; break
    case 'crm/reports': page = <CrmReports />; break
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
        <div className="ad-brand"><i>I</i>Illuszionz</div>
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
        {loading ? <p className="ad-muted">Loading…</p> : page}
      </main>
    </div>
  )
}

export default function AdminApp() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])
  if (!configured)
    return (
      <div className="ad ad-login"><div style={{ background: '#fff', borderRadius: 18, padding: 32, maxWidth: 520 }}>
        <h1 style={{ fontFamily: 'Playfair Display, serif' }}>Dashboard not connected</h1>
        <p className="ad-muted" style={{ marginTop: 10 }}>Set <b>VITE_SUPABASE_URL</b> and <b>VITE_SUPABASE_ANON_KEY</b> (see README → Dashboard), then rebuild.</p>
      </div></div>
    )
  if (session === undefined) return <div className="ad ad-login" />
  if (!session) return <Login />
  return (
    <DataProvider>
      <Shell session={session} />
    </DataProvider>
  )
}
