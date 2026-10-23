/** POST /api/instagram — Instagram gallery sync. Called by the homepage on every page load (at most once a minute is actually checked) and, with x-cron-secret, by anything else you schedule. */
import { dbReady } from '../../src/server/db'
import { syncInstagram, type IgEnv } from '../../src/server/instagram'

const json = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })

export const onRequest = async ({ request, env }: { request: Request; env: IgEnv & { CRON_SECRET?: string } }) => {
  if (!dbReady(env)) return json({ ok: false, error: 'Database is not configured.' }, 503)
  try {
    return json(await syncInstagram(env, { visit: true }))
  } catch (err) {
    console.error('instagram failed', err)
    return json({ ok: false, error: err instanceof Error ? err.message : 'failed' }, 500)
  }
}
