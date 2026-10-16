/** Minimal Supabase (PostgREST) client for Cloudflare Pages Functions — uses the service-role key, so it must never reach the browser. */
export type DbEnv = { SUPABASE_URL?: string; SUPABASE_SERVICE_ROLE_KEY?: string }

export const dbReady = (env: DbEnv) => !!(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY)

type Row = Record<string, any>

async function call(env: DbEnv, method: string, path: string, body?: unknown, prefer?: string): Promise<any> {
  const res = await fetch(`${env.SUPABASE_URL!.replace(/\/$/, '')}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`Database ${method} ${path.split('?')[0]} failed (${res.status}): ${text.slice(0, 300)}`)
  return text ? JSON.parse(text) : null
}

export const db = {
  /** db.select(env, 'bookings', 'status=eq.new&order=created_at.desc&limit=20') */
  select: (env: DbEnv, table: string, query = ''): Promise<Row[]> => call(env, 'GET', `${table}?${query}`),
  insert: async (env: DbEnv, table: string, rows: Row | Row[]): Promise<Row[]> => call(env, 'POST', table, rows, 'return=representation'),
  /** Inserts and ignores a conflict (used to "claim" a dedupe key). Returns the row, or null if it already existed. */
  claim: async (env: DbEnv, table: string, row: Row, conflict: string): Promise<Row | null> => {
    const out = await call(env, 'POST', `${table}?on_conflict=${conflict}`, row, 'resolution=ignore-duplicates,return=representation')
    return Array.isArray(out) && out.length ? out[0] : null
  },
  update: (env: DbEnv, table: string, filter: string, patch: Row): Promise<Row[]> => call(env, 'PATCH', `${table}?${filter}`, patch, 'return=representation'),
  rpc: (env: DbEnv, fn: string, args: Row = {}) => call(env, 'POST', `rpc/${fn}`, args),
  remove: (env: DbEnv, table: string, filter: string) => call(env, 'DELETE', `${table}?${filter}`),
}

/** PostgREST filter value escaping. */
export const q = (v: string) => encodeURIComponent(v)
