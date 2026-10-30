import { useEffect, useState } from 'react'

/**
 * "Sign in" / "My Account" in the site header. Reads only whether a Supabase session is stored, so the public pages don't
 * load the Supabase library just for this label.
 */
function hasSession() {
  try {
    const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
    if (!url) return false
    const ref = new URL(url).hostname.split('.')[0]
    return !!localStorage.getItem(`sb-${ref}-auth-token`)
  } catch {
    return false
  }
}

export function AccountLink({ className }: { className?: string }) {
  const [signedIn, setSignedIn] = useState(false)
  useEffect(() => {
    setSignedIn(hasSession())
    const f = () => setSignedIn(hasSession())
    window.addEventListener('storage', f)
    return () => window.removeEventListener('storage', f)
  }, [])
  const label = signedIn ? 'My Account' : 'Sign in'
  return (
    <a className={className} href="/account/" aria-label={label} title={signedIn ? 'Your bookings and galleries' : 'Client sign in'}>
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="8.5" r="3.8" /><path d="M4.5 20c1.2-3.6 4-5.4 7.5-5.4s6.3 1.8 7.5 5.4" /></svg>
      <span>{label}</span>
    </a>
  )
}
