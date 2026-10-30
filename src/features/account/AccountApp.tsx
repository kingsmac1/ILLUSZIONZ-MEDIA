/**
 * /account/ — the client area. Everything is matched by the verified email, so whatever was booked with that email
 * (before or after signing up) shows up here automatically: bookings, galleries, timeline, downloads, profile.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { configured, supabase } from '../../admin/supabase'
import { isMissingTable } from '../gallery/api'
import { galleryConfig } from '../gallery/gallery.config'
import { clientStatus, describeActivity, fmtDay } from '../gallery/status'
import type { ActivityRow, GalleryRow, MyBooking, ProfileRow } from '../gallery/types'
import { useCover } from '../gallery/useCover'
import { AuthPanel } from './AuthPanel'
import './account.css'

type Section = 'overview' | 'bookings' | 'galleries' | 'activity' | 'downloads' | 'profile'
const SECTIONS: { id: Section; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'bookings', label: 'Bookings' },
  { id: 'galleries', label: 'Galleries' },
  { id: 'activity', label: 'Activity' },
  { id: 'downloads', label: 'Downloads' },
  { id: 'profile', label: 'Profile' },
]

type DownloadRow = { id: string; created_at: string; image_id: string | null; gallery_id: string; gallery_images: { original_filename: string } | null; galleries: { title: string } | null }
type Data = { profile: ProfileRow | null; bookings: MyBooking[]; galleries: GalleryRow[]; activity: ActivityRow[]; downloads: DownloadRow[] }

const shoot = (kind: string) => kind.replace(/ booking$/i, '')

export default function AccountApp() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  useEffect(() => {
    if (!supabase) return setSession(null)
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  if (!configured) return <div className="ca"><div className="ca-wrap"><h1 className="ca-h1">Client area</h1><p>The client area is not connected yet.</p></div></div>
  if (session === undefined) return <div className="ca"><div className="ca-wrap ca-wait" aria-busy="true" /></div>
  if (!session) {
    return (
      <div className="ca">
        <div className="ca-wrap ca-signin">
          <div>
            <h1 className="ca-h1">Your photos, bookings and galleries in one place</h1>
            <p className="ca-lead">Sign in with the email you booked with. We send you a 6-digit code, so there’s no password to remember. If you’re new, this creates your account and everything booked with that email appears straight away.</p>
          </div>
          <AuthPanel />
        </div>
      </div>
    )
  }
  return <Account session={session} />
}

function Account({ session }: { session: Session }) {
  const email = (session.user.email ?? '').toLowerCase()
  const [section, setSection] = useState<Section>(() => {
    const h = typeof window === 'undefined' ? '' : window.location.hash.replace('#', '')
    return (SECTIONS.find((s) => s.id === h)?.id ?? 'overview') as Section
  })
  const go = (s: Section) => { setSection(s); history.replaceState(null, '', s === 'overview' ? window.location.pathname : `#${s}`) }
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)

  const load = useCallback(async () => {
    const [p, b, g, a, d, adm] = await Promise.all([
      supabase!.from('profiles').select('*').eq('id', session.user.id).maybeSingle(),
      supabase!.rpc('my_bookings'),
      supabase!.from('galleries').select('*').eq('client_email', email).order('created_at', { ascending: false }),
      supabase!.from('activity_log').select('*').eq('client_email', email).order('created_at', { ascending: false }).limit(100),
      supabase!.from('gallery_downloads').select('id, created_at, image_id, gallery_id, gallery_images(original_filename), galleries(title)').eq('client_email', email).order('created_at', { ascending: false }).limit(200),
      supabase!.rpc('is_admin'),
    ])
    const err = [p, b, g, a, d].map((x) => x.error?.message).find(Boolean)
    if (err) { setError(isMissingTable(err) ? 'Your client area is being set up. Please check back soon.' : err); return }
    setIsAdmin(adm.data === true)
    const profile = p.data as ProfileRow | null
    const bookingName = ((b.data ?? []) as MyBooking[]).find((x) => x.name)?.name
    if (profile && !profile.full_name && bookingName) {
      // first visit: take the name from their booking
      profile.full_name = bookingName
      await supabase!.from('profiles').update({ full_name: bookingName }).eq('id', profile.id)
    }
    setData({ profile, bookings: (b.data ?? []) as MyBooking[], galleries: (g.data ?? []) as GalleryRow[], activity: (a.data ?? []) as ActivityRow[], downloads: (d.data ?? []) as unknown as DownloadRow[] })
  }, [email, session.user.id])
  useEffect(() => { load() }, [load])

  const first = (data?.profile?.full_name || '').trim().split(/\s+/)[0]
  return (
    <div className="ca">
      <div className="ca-wrap">
        <div className="ca-top">
          <div>
            <h1 className="ca-h1">{first ? `Hello, ${first}` : 'Your client area'}</h1>
            <p className="ca-muted">Signed in as {email}</p>
          </div>
          {isAdmin && <a className="cg-btn line" href="/dashboard/">Open the studio dashboard</a>}
        </div>
        <nav className="ca-nav" aria-label="Client area">
          {SECTIONS.map((s) => <button key={s.id} aria-current={section === s.id ? 'page' : undefined} onClick={() => go(s.id)}>{s.label}</button>)}
        </nav>
        {error ? <p className="ca-note">{error}</p> : !data ? <div className="ca-wait" aria-busy="true" /> : (
          <>
            {section === 'overview' && <Overview data={data} go={go} />}
            {section === 'bookings' && <Bookings bookings={data.bookings} />}
            {section === 'galleries' && <Galleries data={data} />}
            {section === 'activity' && <Activity rows={data.activity} />}
            {section === 'downloads' && <Downloads rows={data.downloads} />}
            {section === 'profile' && <Profile profile={data.profile} email={email} onSaved={load} />}
          </>
        )}
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- overview */
function Overview({ data, go }: { data: Data; go: (s: Section) => void }) {
  const today = new Date().toISOString().slice(0, 10)
  const next = [...data.bookings].filter((b) => b.event_date && b.event_date >= today && b.status !== 'cancelled').sort((a, b) => a.event_date!.localeCompare(b.event_date!))[0]
  const downloaded = new Set(data.downloads.map((d) => d.gallery_id))
  const actions = data.galleries.flatMap((g) => {
    if (g.kind === 'proof' && ['sent', 'viewed', 'selecting'].includes(g.status))
      return [{ g, title: g.status === 'selecting' ? 'Finish picking your photos' : 'Your previews are ready', text: g.selection_limit ? `Pick ${g.selection_limit} photos from “${g.title}”.` : `Pick your favourites from “${g.title}”.`, cta: g.status === 'selecting' ? 'Continue picking' : 'Start picking' }]
    if (g.kind === 'final' && g.status === 'delivered' && !downloaded.has(g.id))
      return [{ g, title: 'Your photos are ready', text: `Download your edited photos from “${g.title}”.`, cta: 'Download photos' }]
    return []
  })
  return (
    <div className="ca-grid">
      {actions.length > 0 && (
        <section className="ca-actions" aria-label="Needs your attention">
          {actions.map((a) => (
            <a key={a.g.id} className="ca-action" href={`/gallery/${a.g.id}/`}>
              <ActionCover id={a.g.id} />
              <span className="ca-action-t"><b>{a.title}</b><span>{a.text}</span><em className="cg-btn solid red">{a.cta}</em></span>
            </a>
          ))}
        </section>
      )}
      <section className="ca-card">
        <h2>Next shoot</h2>
        {next ? (
          <>
            <p className="ca-big">{fmtDay(next.event_date)}{next.event_time ? `, ${next.event_time}` : ''}</p>
            <p>{shoot(next.kind)}{next.packages ? ` — ${next.packages}` : ''}</p>
            <p className="ca-muted">Booking #{next.ref}, {next.status}</p>
          </>
        ) : <p className="ca-muted">Nothing booked yet. <a href="/photography-services/">See our services</a>.</p>}
      </section>
      <section className="ca-card">
        <h2>Recent activity</h2>
        {data.activity.length ? <Activity rows={data.activity.slice(0, 4)} compact /> : <p className="ca-muted">Your bookings and galleries will show up here.</p>}
        {data.activity.length > 4 && <button className="cg-link" onClick={() => go('activity')}>See all activity</button>}
      </section>
    </div>
  )
}

function ActionCover({ id }: { id: string }) {
  const c = useCover(id)
  return <span className="ca-action-img" style={c?.url ? { backgroundImage: `url("${c.url}")` } : undefined} aria-hidden="true" />
}

/* ---------------------------------------------------------------- bookings */
function Bookings({ bookings }: { bookings: MyBooking[] }) {
  if (!bookings.length) return <Empty text="No bookings with this email yet." link={['/photography-services/', 'Book a shoot']} />
  return (
    <div className="ca-list">
      {bookings.map((b) => (
        <article key={b.id} className="ca-row">
          <div className="ca-date"><b>{b.event_date ? new Date(b.event_date + 'T12:00:00').getDate() : '—'}</b><span>{b.event_date ? new Date(b.event_date + 'T12:00:00').toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : 'Date TBC'}</span></div>
          <div className="ca-row-main"><b>{shoot(b.kind)}</b><span>{b.packages || '—'}</span><span className="ca-muted">#{b.ref}{b.event_time ? `, ${b.event_time}` : ''}</span></div>
          <div className="ca-row-side">
            <span className={'ca-pill ' + b.status}>{b.status}</span>
            <span className="ca-muted">{b.total ? `£${Number(b.total).toLocaleString('en-GB')}` : b.total_text || ''}{b.total ? `, ${b.payment_status.toLowerCase()}` : ''}</span>
          </div>
        </article>
      ))}
    </div>
  )
}

/* ---------------------------------------------------------------- galleries */
function Galleries({ data }: { data: Data }) {
  const groups = useMemo(() => {
    const byBooking = new Map<string, GalleryRow[]>()
    for (const g of data.galleries) {
      const k = g.booking_id ?? g.id
      byBooking.set(k, [...(byBooking.get(k) ?? []), g])
    }
    return [...byBooking.entries()].map(([k, gs]) => ({ booking: data.bookings.find((b) => b.id === k), galleries: gs.sort((a) => (a.kind === 'proof' ? -1 : 1)) }))
  }, [data])
  if (!groups.length) return <Empty text="No galleries yet. After your shoot you’ll find your previews here." />
  return (
    <div className="ca-shoots">
      {groups.map(({ booking, galleries }, i) => (
        <section key={booking?.id ?? i} className="ca-shoot">
          <h2>{booking ? `${shoot(booking.kind)}${booking.event_date ? `, ${fmtDay(booking.event_date)}` : ''}` : galleries[0].title}</h2>
          <div className="ca-gcards">{galleries.map((g) => <GalleryCard key={g.id} g={g} />)}</div>
        </section>
      ))}
    </div>
  )
}

function GalleryCard({ g }: { g: GalleryRow }) {
  const c = useCover(g.id, !g.previews_purged_at)
  const expires = g.kind === 'proof' && g.previews_purge_at && !g.previews_purged_at ? `Previews available until ${fmtDay(g.previews_purge_at)}` : g.expires_at ? `Available until ${fmtDay(g.expires_at)}` : ''
  return (
    <a className="ca-gcard" href={`/gallery/${g.id}/`}>
      <span className="ca-gcard-img" style={c?.url ? { backgroundImage: `url("${c.url}")` } : undefined}>
        <span className="ca-kind">{g.kind === 'proof' ? 'Previews' : 'Final photos'}</span>
      </span>
      <span className="ca-gcard-b">
        <b>{g.title}</b>
        <span>{clientStatus(g.kind, g.status)}{c ? `, ${c.total} photos` : ''}</span>
        {expires && <span className="ca-muted">{expires}</span>}
      </span>
    </a>
  )
}

/* ---------------------------------------------------------------- activity + downloads */
function Activity({ rows, compact }: { rows: ActivityRow[]; compact?: boolean }) {
  if (!rows.length) return <Empty text="Nothing here yet." />
  return (
    <ol className={'ca-timeline' + (compact ? ' compact' : '')}>
      {rows.map((a) => { const t = describeActivity(a, true); return (
        <li key={a.id}><span className="ca-tl-i" aria-hidden="true">{t.icon}</span><span>{t.text}</span><time dateTime={a.created_at}>{fmtDay(a.created_at, !compact)}</time></li>
      ) })}
    </ol>
  )
}

function Downloads({ rows }: { rows: DownloadRow[] }) {
  if (!rows.length) return <Empty text="You haven’t downloaded any photos yet." />
  return (
    <div className="ca-list">
      {rows.map((d) => (
        <div key={d.id} className="ca-row slim">
          <div className="ca-row-main"><b>{d.image_id ? d.gallery_images?.original_filename ?? 'Photo' : 'All photos (zip)'}</b><span className="ca-muted">{d.galleries?.title}</span></div>
          <div className="ca-row-side"><time className="ca-muted" dateTime={d.created_at}>{fmtDay(d.created_at)}</time><a href={`/gallery/${d.gallery_id}/`}>Open gallery</a></div>
        </div>
      ))}
    </div>
  )
}

/* ---------------------------------------------------------------- profile */
function Profile({ profile, email, onSaved }: { profile: ProfileRow | null; email: string; onSaved: () => void }) {
  const [name, setName] = useState(profile?.full_name ?? '')
  const [phone, setPhone] = useState(profile?.phone ?? '')
  const [pw, setPw] = useState('')
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null)
  async function save() {
    const { error } = await supabase!.from('profiles').update({ full_name: name.trim(), phone: phone.trim() }).eq('id', profile!.id)
    setMsg(error ? { t: error.message, ok: false } : { t: 'Saved.', ok: true })
    if (!error) onSaved()
  }
  async function setPassword() {
    if (pw.length < 8) return setMsg({ t: 'Use at least 8 characters.', ok: false })
    const { error } = await supabase!.auth.updateUser({ password: pw })
    setMsg(error ? { t: error.message, ok: false } : { t: 'Password set. You can now sign in with it, or keep using email codes.', ok: true })
    if (!error) setPw('')
  }
  return (
    <div className="ca-grid">
      <section className="ca-card ca-form">
        <h2>Your details</h2>
        <label>Email<input value={email} readOnly /></label>
        <label>Name<input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></label>
        <label>Phone / WhatsApp<input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" autoComplete="tel" /></label>
        <button className="cg-btn solid" onClick={save} disabled={!profile}>Save details</button>
      </section>
      <section className="ca-card ca-form">
        <h2>Password (optional)</h2>
        <p className="ca-muted">You can always sign in with a code sent to your email. Set a password if you prefer.</p>
        <label>New password<input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" minLength={8} /></label>
        <button className="cg-btn line" onClick={setPassword}>Set password</button>
        <hr />
        <button className="cg-btn line" onClick={() => supabase!.auth.signOut()}>Sign out</button>
      </section>
      {msg && <p className={'ca-msg' + (msg.ok ? '' : ' err')} role="status">{msg.t}</p>}
      <p className="ca-muted ca-help">Need to change your email or a booking? Message us on <a href={`https://wa.me/${galleryConfig.ownerWhatsapp}`} target="_blank" rel="noreferrer">WhatsApp</a> or <a href={`mailto:${galleryConfig.ownerEmail}`}>email</a>.</p>
    </div>
  )
}

function Empty({ text, link }: { text: string; link?: [string, string] }) {
  return <div className="ca-empty"><p>{text}</p>{link && <a className="cg-btn solid" href={link[0]}>{link[1]}</a>}</div>
}
