import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from './supabase'

export type R = Record<string, any>
const TABLES = ['contacts', 'companies', 'deals', 'tasks', 'bookings', 'submissions', 'pipeline_stages', 'payments', 'expenses', 'expense_categories', 'other_income', 'promo_codes', 'price_overrides', 'segments', 'email_templates', 'settings', 'blog_posts', 'store_products', 'testimonials', 'site_images', 'page_seo'] as const
export type Table = (typeof TABLES)[number]

const ORDER: Partial<Record<Table, string>> = {
  contacts: 'created_at', companies: 'name', deals: 'created_at', tasks: 'due_at', bookings: 'created_at', submissions: 'created_at',
  pipeline_stages: 'sort_order', payments: 'paid_at', expenses: 'spent_on', expense_categories: 'sort_order', other_income: 'received_on',
  promo_codes: 'created_at', segments: 'created_at', email_templates: 'key', blog_posts: 'created_at', store_products: 'sort_order', testimonials: 'sort_order', site_images: 'sort_order', page_seo: 'path',
}
const ASC = new Set<Table>(['companies', 'pipeline_stages', 'expense_categories', 'email_templates', 'tasks', 'store_products', 'testimonials', 'site_images', 'page_seo'])

type Ctx = {
  d: Record<Table, R[]>
  loading: boolean
  error: string
  refresh: (...t: Table[]) => Promise<void>
  toast: (msg: string, kind?: 'ok' | 'err') => void
  setting: <T = R>(key: string, fallback: T) => T
}
const DataCtx = createContext<Ctx>(null as any)
export const useData = () => useContext(DataCtx)

export function DataProvider({ children }: { children: ReactNode }) {
  const [d, setD] = useState<Record<Table, R[]>>(() => Object.fromEntries(TABLES.map((t) => [t, []])) as any)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toasts, setToasts] = useState<{ id: number; msg: string; kind: string }[]>([])

  const load = useCallback(async (tables: readonly Table[]) => {
    const results = await Promise.all(
      tables.map(async (t) => {
        let query = supabase!.from(t).select('*')
        const col = ORDER[t]
        if (col) query = query.order(col, { ascending: ASC.has(t), nullsFirst: false })
        const { data, error } = await query.limit(5000)
        if (error) throw new Error(`${t}: ${error.message}`)
        return [t, data ?? []] as const
      }),
    )
    setD((cur) => ({ ...cur, ...Object.fromEntries(results) }))
  }, [])

  useEffect(() => {
    load(TABLES)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [load])

  const refresh = useCallback((...t: Table[]) => load(t.length ? t : TABLES).catch((e) => setError(e.message)), [load])
  const toast = useCallback((msg: string, kind: 'ok' | 'err' = 'ok') => {
    const id = Date.now() + Math.random()
    setToasts((c) => [...c, { id, msg, kind }])
    setTimeout(() => setToasts((c) => c.filter((x) => x.id !== id)), 4200)
  }, [])
  const setting = useCallback(<T,>(key: string, fallback: T): T => ((d.settings.find((s) => s.key === key)?.value as T) ?? fallback), [d.settings])

  const value = useMemo(() => ({ d, loading, error, refresh, toast, setting }), [d, loading, error, refresh, toast, setting])
  return (
    <DataCtx.Provider value={value}>
      {children}
      <div className="ad-toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={'ad-toast ' + t.kind}>{t.msg}</div>
        ))}
      </div>
    </DataCtx.Provider>
  )
}

/** Run a Supabase write, refresh the affected tables and report errors as toasts. */
export function useDb() {
  const { refresh, toast } = useData()
  return useMemo(() => {
    const run = async (p: PromiseLike<{ error: any; data?: any }>, tables: Table[], ok?: string) => {
      const { error, data } = await p
      if (error) {
        toast(error.message, 'err')
        return { ok: false as const, data: null as any }
      }
      await refresh(...tables)
      if (ok) toast(ok)
      return { ok: true as const, data }
    }
    const s = () => supabase!
    return {
      insert: (t: Table, row: R | R[], ok?: string, also: Table[] = []) => run(s().from(t).insert(row).select(), [t, ...also], ok),
      update: (t: Table, match: R, patch: R, ok?: string, also: Table[] = []) => run(s().from(t).update(patch).match(match).select(), [t, ...also], ok),
      upsert: (t: Table, row: R | R[], onConflict?: string, ok?: string) => run(s().from(t).upsert(row, onConflict ? { onConflict } : undefined).select(), [t], ok),
      remove: (t: Table, match: R, ok?: string, also: Table[] = []) => run(s().from(t).delete().match(match), [t, ...also], ok),
      /** log a timeline entry (no refresh needed — timelines load on demand) */
      log: async (row: R) => {
        const { data } = await supabase!.auth.getUser()
        await s().from('activities').insert({ created_by: data.user?.email ?? '', ...row })
      },
    }
  }, [refresh, toast])
}
