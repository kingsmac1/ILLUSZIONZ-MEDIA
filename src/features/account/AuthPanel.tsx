/**
 * Sign in / create an account with a 6-digit email code (no password needed). Same email = same account, so every past and
 * future shoot booked with that email shows up. A password can be set later in the account area and used here instead.
 */
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { supabase } from '../../admin/supabase'
import './auth.css'

const CODE_LENGTH = 6

function friendly(msg: string) {
  if (/rate limit|too many|security purposes/i.test(msg)) return 'Too many codes were requested. Wait a minute, then try again.'
  if (/expired|invalid|token/i.test(msg)) return 'That code is not right or has expired. Check the newest email, or send a new code.'
  if (/invalid login credentials/i.test(msg)) return 'Email or password is not right. You can also sign in with a code instead.'
  if (/signups not allowed/i.test(msg)) return 'New accounts are switched off at the moment. Please contact the studio.'
  return msg
}

export function AuthPanel({ defaultEmail = '', hint, onSignedIn, dark = false, heading }: {
  defaultEmail?: string
  /** e.g. the masked address the gallery was sent to */
  hint?: string
  onSignedIn?: () => void
  dark?: boolean
  heading?: string
}) {
  const [step, setStep] = useState<'email' | 'code' | 'password'>('email')
  const [email, setEmail] = useState(defaultEmail)
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [wait, setWait] = useState(0)
  const codeRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!wait) return
    const t = setTimeout(() => setWait((w) => w - 1), 1000)
    return () => clearTimeout(t)
  }, [wait])
  useEffect(() => { if (step === 'code') codeRef.current?.focus() }, [step])

  async function sendCode(e?: FormEvent) {
    e?.preventDefault()
    const addr = email.trim().toLowerCase()
    if (!/^\S+@\S+\.\S+$/.test(addr)) return setErr('Enter the email address your booking was made with.')
    setBusy(true)
    setErr('')
    const { error } = await supabase!.auth.signInWithOtp({ email: addr, options: { shouldCreateUser: true, emailRedirectTo: window.location.href } })
    setBusy(false)
    if (error) return setErr(friendly(error.message))
    setEmail(addr)
    setCode('')
    setStep('code')
    setWait(60)
  }

  async function verify(token = code) {
    if (token.length < CODE_LENGTH) return
    setBusy(true)
    setErr('')
    const { error } = await supabase!.auth.verifyOtp({ email, token, type: 'email' })
    setBusy(false)
    if (error) return setErr(friendly(error.message))
    onSignedIn?.()
  }

  async function withPassword(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErr('')
    const { error } = await supabase!.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
    setBusy(false)
    if (error) return setErr(friendly(error.message))
    onSignedIn?.()
  }

  return (
    <div className={'cg-auth' + (dark ? ' dark' : '')}>
      {heading && <h2>{heading}</h2>}
      {step === 'email' && (
        <form onSubmit={sendCode} noValidate>
          <label htmlFor="cg-email">Your email</label>
          {hint && <p className="cg-auth-hint">This gallery was sent to <b>{hint}</b></p>}
          <div className="cg-auth-row">
            <input id="cg-email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
            <button className="cg-btn solid" disabled={busy}>{busy ? 'Sending…' : 'Send me a code'}</button>
          </div>
          <p className="cg-auth-small">New here? This creates your account. <button type="button" className="cg-link" onClick={() => { setErr(''); setStep('password') }}>Use a password instead</button></p>
        </form>
      )}
      {step === 'code' && (
        <form onSubmit={(e) => { e.preventDefault(); verify() }} noValidate>
          <label htmlFor="cg-code">Enter the {CODE_LENGTH}-digit code we sent to <b>{email}</b></label>
          <div className="cg-auth-row">
            <input
              id="cg-code" ref={codeRef} className="cg-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={8}
              value={code} placeholder={'•'.repeat(CODE_LENGTH)}
              onChange={(e) => { const v = e.target.value.replace(/\D/g, '').slice(0, 8); setCode(v); if (v.length === CODE_LENGTH) verify(v) }}
            />
            <button className="cg-btn solid" disabled={busy || code.length < CODE_LENGTH}>{busy ? 'Checking…' : 'Continue'}</button>
          </div>
          <p className="cg-auth-small">
            Not there? Check spam, or{' '}
            {wait ? <span>send a new code in {wait}s</span> : <button type="button" className="cg-link" onClick={() => sendCode()}>send a new code</button>}
            {' · '}<button type="button" className="cg-link" onClick={() => { setStep('email'); setErr('') }}>use another email</button>
          </p>
        </form>
      )}
      {step === 'password' && (
        <form onSubmit={withPassword} noValidate>
          <label htmlFor="cg-email2">Email</label>
          <input id="cg-email2" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <label htmlFor="cg-pw" style={{ marginTop: 12 }}>Password</label>
          <div className="cg-auth-row">
            <input id="cg-pw" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <button className="cg-btn solid" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
          </div>
          <p className="cg-auth-small">No password yet? <button type="button" className="cg-link" onClick={() => { setStep('email'); setErr('') }}>Get a code by email</button></p>
        </form>
      )}
      {err && <p className="cg-auth-err" role="alert">{err}</p>}
    </div>
  )
}
