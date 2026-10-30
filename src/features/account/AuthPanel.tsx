/**
 * Client sign in / create account / forgot password — email + password only.
 * New accounts get a "Confirm your email" email; the link lands on /account/ which finishes it (see AccountApp). Same
 * email = same account, so every past and future shoot booked with that email shows up once they're in.
 */
import { useState, type FormEvent } from 'react'
import { supabase } from '../../admin/supabase'
import './auth.css'

export type AuthMode = 'signin' | 'signup' | 'forgot'
const MIN_PW = 8

function friendly(msg: string) {
  if (/rate limit|too many|security purposes/i.test(msg)) return 'Too many attempts. Wait a minute, then try again.'
  if (/invalid login credentials/i.test(msg)) return 'Email or password is not right. Check them, or reset your password.'
  if (/email not confirmed/i.test(msg)) return 'confirm'
  if (/password should be|weak|at least/i.test(msg)) return `Choose a stronger password: at least ${MIN_PW} characters.`
  if (/already registered|already been registered/i.test(msg)) return 'exists'
  if (/signups not allowed/i.test(msg)) return 'New accounts are switched off at the moment. Please contact the studio.'
  if (/fetch|network/i.test(msg)) return 'Could not reach the server. Check your connection and try again.'
  return msg
}

export function AuthPanel({ defaultEmail = '', defaultMode = 'signin', onSignedIn, dark = false, heading, note }: {
  defaultEmail?: string
  defaultMode?: AuthMode
  onSignedIn?: () => void
  dark?: boolean
  heading?: string
  /** a line under the tabs, e.g. "Use the email this gallery was sent to" */
  note?: React.ReactNode
}) {
  const [mode, setMode] = useState<AuthMode>(defaultMode)
  const [email, setEmail] = useState(defaultEmail)
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [sent, setSent] = useState<null | { kind: 'confirm' | 'reset'; to: string }>(null)

  const addr = email.trim().toLowerCase()
  const go = (m: AuthMode) => { setMode(m); setErr(''); setSent(null) }
  const validEmail = () => /^\S+@\S+\.\S+$/.test(addr) || (setErr('Enter your email address.'), false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!validEmail()) return
    setErr('')
    if (mode !== 'forgot' && password.length < (mode === 'signup' ? MIN_PW : 1)) return setErr(mode === 'signup' ? `Use at least ${MIN_PW} characters for your password.` : 'Enter your password.')
    setBusy(true)
    try {
      if (mode === 'signin') {
        const { error } = await supabase!.auth.signInWithPassword({ email: addr, password })
        if (error) return setErr(friendly(error.message))
        onSignedIn?.()
      } else if (mode === 'signup') {
        const { data, error } = await supabase!.auth.signUp({ email: addr, password, options: { data: { full_name: name.trim() } } })
        if (error) return setErr(friendly(error.message))
        // an email that already has an account comes back with no identities (Supabase hides whether it exists)
        if (data.user && !data.user.identities?.length) return setErr('exists')
        if (data.session) return onSignedIn?.()
        setSent({ kind: 'confirm', to: addr })
      } else {
        const { error } = await supabase!.auth.resetPasswordForEmail(addr)
        if (error) return setErr(friendly(error.message))
        setSent({ kind: 'reset', to: addr })
      }
    } finally {
      setBusy(false)
    }
  }

  async function resendConfirm() {
    if (!validEmail()) return
    setBusy(true)
    const { error } = await supabase!.auth.resend({ type: 'signup', email: addr })
    setBusy(false)
    if (error) return setErr(friendly(error.message))
    setErr('')
    setSent({ kind: 'confirm', to: addr })
  }

  const errorText = err === 'confirm'
    ? <>Please confirm your email first — open the link we sent to <b>{addr}</b>. <button type="button" className="cg-link" onClick={resendConfirm}>Send it again</button></>
    : err === 'exists'
      ? <>There’s already an account with this email. <button type="button" className="cg-link" onClick={() => go('signin')}>Sign in</button> or <button type="button" className="cg-link" onClick={() => go('forgot')}>reset your password</button>.</>
      : err

  if (sent) {
    return (
      <div className={'cg-auth' + (dark ? ' dark' : '')}>
        <div className="cg-auth-sent" role="status">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3.5 6.5l8.5 6.5 8.5-6.5" /></svg>
          <h2>Check your email</h2>
          <p>
            {sent.kind === 'confirm'
              ? <>We sent a link to <b>{sent.to}</b>. Open it to confirm your email and finish creating your account.</>
              : <>If there’s an account for <b>{sent.to}</b>, we’ve sent a link to choose a new password. It works for one hour.</>}
          </p>
          <p className="cg-auth-small">Not there after a minute? Check spam or promotions.{' '}
            {sent.kind === 'confirm' && <button type="button" className="cg-link" disabled={busy} onClick={resendConfirm}>Send it again</button>}
          </p>
          <button type="button" className="cg-btn line" onClick={() => go('signin')}>Back to sign in</button>
        </div>
      </div>
    )
  }

  return (
    <div className={'cg-auth' + (dark ? ' dark' : '')}>
      {heading && <h2>{heading}</h2>}
      {mode !== 'forgot' ? (
        <div className="cg-auth-tabs" role="tablist" aria-label="Account">
          <button type="button" role="tab" aria-selected={mode === 'signin'} onClick={() => go('signin')}>Sign in</button>
          <button type="button" role="tab" aria-selected={mode === 'signup'} onClick={() => go('signup')}>Create account</button>
        </div>
      ) : (
        <div className="cg-auth-forgot-head">
          <h3>Reset your password</h3>
          <p className="cg-auth-hint">Enter your email and we’ll send you a link to choose a new password.</p>
        </div>
      )}
      {note && mode !== 'forgot' && <p className="cg-auth-hint">{note}</p>}
      <form onSubmit={submit} noValidate>
        {mode === 'signup' && (
          <div className="cg-field">
            <label htmlFor="cg-name">Your name</label>
            <input id="cg-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        )}
        <div className="cg-field">
          <label htmlFor="cg-email">Email</label>
          <input id="cg-email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
        </div>
        {mode !== 'forgot' && (
          <div className="cg-field">
            <span className="cg-field-top">
              <label htmlFor="cg-pw">Password</label>
              {mode === 'signin' && <button type="button" className="cg-link" onClick={() => go('forgot')}>Forgot password?</button>}
            </span>
            <span className="cg-pw">
              <input
                id="cg-pw" type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} minLength={mode === 'signup' ? MIN_PW : undefined} required
                aria-describedby={mode === 'signup' ? 'cg-pw-rule' : undefined}
              />
              <button type="button" onClick={() => setShow((v) => !v)} aria-pressed={show} aria-label={show ? 'Hide password' : 'Show password'}>{show ? 'Hide' : 'Show'}</button>
            </span>
            {mode === 'signup' && <small id="cg-pw-rule" className="cg-auth-small">At least {MIN_PW} characters.</small>}
          </div>
        )}
        <button className="cg-btn solid cg-auth-go" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link'}
        </button>
        {mode === 'signup' && <p className="cg-auth-small">Use the email you booked with, so your bookings and galleries appear in your account. We’ll email you a link to confirm it.</p>}
        {mode === 'forgot' && <p className="cg-auth-small"><button type="button" className="cg-link" onClick={() => go('signin')}>Back to sign in</button></p>}
      </form>
      {err && <p className="cg-auth-err" role="alert">{errorText}</p>}
    </div>
  )
}

/** Choose a new password after opening the reset link (the link already signed them in). */
export function NewPasswordPanel({ onDone }: { onDone: () => void }) {
  const [pw, setPw] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  async function save(e: FormEvent) {
    e.preventDefault()
    if (pw.length < MIN_PW) return setErr(`Use at least ${MIN_PW} characters.`)
    setBusy(true)
    const { error } = await supabase!.auth.updateUser({ password: pw })
    setBusy(false)
    if (error) return setErr(/different from the old/i.test(error.message) ? 'Choose a password you haven’t used before.' : friendly(error.message))
    onDone()
  }
  return (
    <div className="cg-auth">
      <form onSubmit={save} noValidate>
        <div className="cg-field">
          <label htmlFor="cg-newpw">New password</label>
          <span className="cg-pw">
            <input id="cg-newpw" type={show ? 'text' : 'password'} autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} minLength={MIN_PW} required autoFocus />
            <button type="button" onClick={() => setShow((v) => !v)} aria-pressed={show} aria-label={show ? 'Hide password' : 'Show password'}>{show ? 'Hide' : 'Show'}</button>
          </span>
          <small className="cg-auth-small">At least {MIN_PW} characters.</small>
        </div>
        <button className="cg-btn solid cg-auth-go" disabled={busy}>{busy ? 'Saving…' : 'Save new password'}</button>
      </form>
      {err && <p className="cg-auth-err" role="alert">{err}</p>}
    </div>
  )
}
