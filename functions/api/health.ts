/** GET /api/health — quick self-check for the database connection (counts and status only, no content). */
import { db, dbReady, type DbEnv } from '../../src/server/db'

const roleOf = (jwt?: string) => {
  try { return (JSON.parse(atob((jwt ?? '').split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) as { role?: string }).role ?? 'unknown' } catch { return 'not a JWT' }
}

export const onRequestGet = async ({ env }: { env: DbEnv & { CRON_SECRET?: string; RESEND_API_KEY?: string } }) => {
  const out: Record<string, unknown> = {
    database: dbReady(env) ? 'configured' : 'MISSING — set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on Cloudflare Pages (runtime variables) and redeploy',
    serviceKeyRole: roleOf(env.SUPABASE_SERVICE_ROLE_KEY),
    cronSecret: env.CRON_SECRET ? 'set' : 'missing',
    resend: env.RESEND_API_KEY ? 'set' : 'missing',
  }
  if (out.serviceKeyRole === 'anon') out.problem = 'SUPABASE_SERVICE_ROLE_KEY contains the ANON key — use the service_role key (Supabase → Project Settings → API)'
  if (dbReady(env)) {
    try {
      const posts = (await db.select(env, 'blog_posts', 'select=slug,published,published_at&limit=500')) as { published: boolean; published_at: string | null }[]
      const now = Date.now()
      out.blogPosts = { total: posts.length, published: posts.filter((p) => p.published).length, visibleNow: posts.filter((p) => p.published && p.published_at && new Date(p.published_at).getTime() <= now).length }
      if (!posts.length && out.serviceKeyRole === 'anon') out.problem = 'The anon key cannot read blog_posts (row level security), so the blog looks empty'
    } catch (err) {
      out.blogPosts = `ERROR: ${err instanceof Error ? err.message.slice(0, 200) : 'failed'} — did you run supabase/cms.sql?`
    }
  }
  return new Response(JSON.stringify(out, null, 2), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
}
