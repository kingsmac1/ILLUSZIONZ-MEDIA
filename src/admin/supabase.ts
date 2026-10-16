import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const configured = !!(url && key)
export const supabase: SupabaseClient | null = configured ? createClient(url!, key!, { auth: { persistSession: true, autoRefreshToken: true } }) : null

/** Calls /api/admin (needs server secrets: sending email) with the signed-in admin's token. */
export async function adminApi<T = any>(body: Record<string, unknown>): Promise<T & { ok: boolean; error?: string }> {
  const { data } = await supabase!.auth.getSession()
  const res = await fetch('/api/admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token ?? ''}` },
    body: JSON.stringify(body),
  })
  return (await res.json().catch(() => ({ ok: false, error: 'Bad response' }))) as any
}
