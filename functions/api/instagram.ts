/** POST /api/instagram — Instagram gallery sync. Called hourly by Supabase pg_cron (header x-cron-secret); it only syncs when the dashboard interval has passed. */
import { dbReady } from '../../src/server/db'
import { syncInstagram, type IgEnv } from '../../src/server/instagram'

const json = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })

export const onRequest = async ({ request, env }: { request: Request; env: IgEnv & { CRON_SECRET?: string } }) => {
  if (!env.CRON_SECRET || request.headers.get('x-cron-secret') !== env.CRON_SECRET) return json({ ok: false, error: 'Unauthorized' }, 401)
  if (!dbReady(env)) return json({ ok: false, error: 'Database is not configured.' }, 503)
  try {
    return json(await syncInstagram(env))
  } catch (err) {
    console.error('instagram failed', err)
    return json({ ok: false, error: err instanceof Error ? err.message : 'failed' }, 500)
  }
}
