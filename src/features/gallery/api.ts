/** Calls the gallery Edge Functions with the signed-in user's token (or the anon key when signed out). */
import { supabase } from '../../admin/supabase'

export type FnResult<T> = (T & { ok: true }) | { ok: false; error: string; status?: number }

export async function callFn<T = Record<string, unknown>>(name: string, body: Record<string, unknown>): Promise<FnResult<T>> {
  if (!supabase) return { ok: false, error: 'The gallery is not connected yet.' }
  const { data, error } = await supabase.functions.invoke(name, { body })
  if (error) {
    // FunctionsHttpError carries the JSON body with our friendly message
    const ctx = (error as { context?: Response }).context
    let msg = ''
    let status: number | undefined
    if (ctx && typeof ctx.json === 'function') {
      status = ctx.status
      msg = await ctx.json().then((j: { error?: string }) => j?.error ?? '', () => '')
    }
    if (!msg) msg = status === 404 ? 'Not found.' : /Failed to send|fetch/i.test(error.message) ? 'Could not reach the server. Check your connection and try again.' : error.message
    return { ok: false, error: msg, status }
  }
  if (data && data.ok === false) return { ok: false, error: data.error ?? 'Something went wrong.' }
  return data as FnResult<T>
}

/** "The gallery tables are not installed yet" — the dashboard shows a setup hint instead of an error. */
export const isMissingTable = (msg?: string) => !!msg && /relation .* does not exist|Could not find the table|schema cache/i.test(msg)
