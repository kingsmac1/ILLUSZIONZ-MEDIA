/**
 * The studio's gallery billing state, asked of the dashboard (via the gallery-billing-status function) once the admin is
 * signed in, then every 5 minutes and when the tab regains focus. `active` is false when billing is not switched on for
 * this site (or the studio is "not activated"), and then nothing about billing shows anywhere.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { supabase } from '../../admin/supabase'
import { callFn } from '../gallery/api'

export type Billing = {
  studio_name: string
  status: string
  plan: { code: string; name: string; limit_gb: number; price_usd: number; price_ngn: number } | null
  limit_bytes: number
  used_bytes: number
  paid_until: string | null
  grace_ends_at: string | null
  locked_at: string | null
  purge_due_at: string | null
  signup_deadline: string | null
  trial_ends_at: string | null
  uploads_allowed: boolean
  gallery_enabled: boolean
  pay_url: string | null
  manage_card_url: string | null
  banner: { level: 'info' | 'warning' | 'danger'; message: string; cta: string } | null
  payments: { created_at: string; amount_ngn: number; channel: string; status: string; period_end: string | null }[]
  checked_at: string
  stale?: boolean
}

type Ctx = { billing: Billing | null; active: boolean; loading: boolean; refresh: () => Promise<void> }
const BillingContext = createContext<Ctx>({ billing: null, active: false, loading: false, refresh: async () => {} })
export const useBilling = () => useContext(BillingContext)

const EVERY_MS = 5 * 60_000

export function BillingProvider({ children }: { children: ReactNode }) {
  const [billing, setBilling] = useState<Billing | null>(null)
  const [loading, setLoading] = useState(false)
  const busy = useRef(false)

  const refresh = useCallback(async () => {
    if (busy.current) return
    busy.current = true
    setLoading(true)
    try {
      const { data } = await supabase!.auth.getSession()
      if (!data.session) { setBilling(null); return }
      const r = await callFn<{ configured: boolean; billing: Billing | null }>('gallery-billing-status', {})
      setBilling(r.ok && r.configured ? r.billing : null)
    } catch {
      /* keep what we have: a failed check never changes what the studio sees */
    } finally {
      busy.current = false
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!supabase) return
    void refresh()
    const { data: sub } = supabase!.auth.onAuthStateChange((event) => { if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') void refresh() })
    const timer = setInterval(() => void refresh(), EVERY_MS)
    const onFocus = () => void refresh()
    window.addEventListener('focus', onFocus)
    return () => { sub.subscription.unsubscribe(); clearInterval(timer); window.removeEventListener('focus', onFocus) }
  }, [refresh])

  const value = useMemo<Ctx>(() => ({ billing, active: !!billing && billing.status !== 'not_activated', loading, refresh }), [billing, loading, refresh])
  return <BillingContext.Provider value={value}>{children}</BillingContext.Provider>
}
