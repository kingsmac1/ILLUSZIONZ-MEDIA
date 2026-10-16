/** POST /api/cron — runs the email automations. Called every 10 minutes by Supabase pg_cron (header x-cron-secret). */
import { runAutomations, type AutoEnv } from '../../src/server/automations'
import { dbReady } from '../../src/server/db'

const json = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })

export const onRequest = async ({ request, env }: { request: Request; env: AutoEnv & { CRON_SECRET?: string } }) => {
  if (!env.CRON_SECRET || request.headers.get('x-cron-secret') !== env.CRON_SECRET) return json({ ok: false, error: 'Unauthorized' }, 401)
  if (!dbReady(env)) return json({ ok: false, error: 'Database is not configured.' }, 503)
  try {
    const dry = new URL(request.url).searchParams.get('dry') === '1'
    return json({ ok: true, ...(await runAutomations(env, { dry })) })
  } catch (err) {
    console.error('cron failed', err)
    return json({ ok: false, error: err instanceof Error ? err.message : 'failed' }, 500)
  }
}
