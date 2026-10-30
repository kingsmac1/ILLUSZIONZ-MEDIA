import { useEffect, useRef, useState } from 'react'

/**
 * The account icon in the site header. Signed out: "Sign in / Sign up" link to /account/ (icon only on phones; the menu
 * has it in words too). Signed in: opens a small menu — My account, My galleries, Profile, Sign out. Reads only the
 * stored Supabase session, so the public pages load the Supabase library only when someone actually signs out.
 */
function storedSession(): { email: string } | null {
  try {
    const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
    if (!url) return null
    const raw = localStorage.getItem(`sb-${new URL(url).hostname.split('.')[0]}-auth-token`)
    if (!raw) return null
    return { email: JSON.parse(raw)?.user?.email ?? '' }
  } catch {
    return null
  }
}

const Icon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="8.5" r="3.8" /><path d="M4.5 20c1.2-3.6 4-5.4 7.5-5.4s6.3 1.8 7.5 5.4" /></svg>
)

export function AccountLink({ className }: { className?: string }) {
  const [session, setSession] = useState<{ email: string } | null>(null)
  const [open, setOpen] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const box = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    setSession(storedSession())
    const f = () => setSession(storedSession())
    window.addEventListener('storage', f)
    return () => window.removeEventListener('storage', f)
  }, [])
  useEffect(() => {
    if (!open) return
    const out = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); box.current?.querySelector('button')?.focus() } }
    document.addEventListener('pointerdown', out)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('pointerdown', out); document.removeEventListener('keydown', esc) }
  }, [open])

  async function signOut() {
    setLeaving(true)
    try {
      const { supabase } = await import('../admin/supabase')
      await supabase?.auth.signOut()
    } finally {
      window.location.href = '/'
    }
  }

  if (!session) {
    return (
      <a className={className} href="/account/" aria-label="Sign in / Sign up" title="Returning clients sign in, new clients create an account">
        <Icon /><span>Sign in / Sign up</span>
      </a>
    )
  }
  return (
    <span className="hd-acc" ref={box}>
      <button type="button" className={className} aria-expanded={open} aria-haspopup="true" aria-label="My account" onClick={() => setOpen((o) => !o)}>
        <Icon /><span>My Account</span>
      </button>
      {open && (
        <span className="hd-acc-menu">
          {session.email && <span className="hd-acc-who">Signed in as<b>{session.email}</b></span>}
          <a href="/account/" onClick={() => setOpen(false)}>My account</a>
          <a href="/account/#galleries" onClick={() => setOpen(false)}>My galleries</a>
          <a href="/account/#bookings" onClick={() => setOpen(false)}>My bookings</a>
          <a href="/account/#profile" onClick={() => setOpen(false)}>Profile and password</a>
          <button type="button" className="hd-acc-out" onClick={signOut} disabled={leaving}>{leaving ? 'Signing out…' : 'Sign out'}</button>
        </span>
      )}
    </span>
  )
}
