/**
 * Hourly (pg_cron, header x-cron-secret = GALLERY_CRON_SECRET) or by an admin:
 *   1. asks the dashboard for the current billing state (refreshing the 60-second cache),
 *   2. reports the live total of gallery_images.bytes, which the dashboard shows next to the Cloudflare figure,
 *   3. when the dashboard says the studio is purged AND deletion is switched on, deletes every object in the R2 bucket,
 *      removes the gallery rows, and confirms with /purge-done.
 * The purge never runs on a cached answer: only when this very call heard "purged" and "purge_enabled" from the dashboard.
 */
import { handle, HttpError, json, pool } from '../_shared/http.ts'
import { caller, service } from '../_shared/auth.ts'
import { listObjects, remove } from '../_shared/r2.ts'
import { billingConfigured, getBilling, reportPurgeDone, reportUsage } from '../_shared/billing.ts'

const BUDGET_MS = 90_000

async function purgeBucket() {
  const started = Date.now()
  const { data: prog } = await service().from('billing_cache').select('purge_objects, purge_bytes').eq('id', 1).maybeSingle()
  let objects = Number(prog?.purge_objects ?? 0)
  let bytes = Number(prog?.purge_bytes ?? 0)
  while (Date.now() - started < BUDGET_MS) {
    const page = await listObjects('galleries/', 1000) // gallery files only: clients' booking inspiration images are not part of the gallery plan
    if (!page.length) {
      // bucket is empty: clear the rows that pointed at it, then confirm to the dashboard
      const db = service()
      await db.from('gallery_images').delete().not('id', 'is', null)
      await db.from('galleries').delete().not('id', 'is', null)
      await reportPurgeDone(objects, bytes)
      await db.from('billing_cache').update({ purge_objects: 0, purge_bytes: 0 }).eq('id', 1)
      return { done: true, objects, bytes }
    }
    const results = await pool(page, 16, (o) => remove(o.key).then(() => true, () => false))
    page.forEach((o, i) => { if (results[i]) { objects += 1; bytes += o.size } })
    await service().from('billing_cache').update({ purge_objects: objects, purge_bytes: bytes }).eq('id', 1)
    if (results.some((ok) => !ok)) return { done: false, objects, bytes, note: 'some objects could not be removed, will retry' }
  }
  return { done: false, objects, bytes, note: 'time budget used, continues next run' }
}

Deno.serve(handle(async (req) => {
  const secret = Deno.env.get('GALLERY_CRON_SECRET')
  const cron = !!secret && req.headers.get('x-cron-secret') === secret
  if (!cron && !(await caller(req)).isAdmin) throw new HttpError('Not authorised.', 401)
  if (!billingConfigured()) return json({ ok: true, skipped: 'billing is not switched on for this site' })

  const { billing: b, fresh } = await getBilling(true)
  if (!b || !fresh) return json({ ok: true, skipped: 'the dashboard could not be reached' })

  let reported: number | null = null
  const { data: total, error } = await service().rpc('gallery_total_bytes')
  if (!error && total !== null) {
    reported = Number(total)
    await reportUsage(reported).catch((e) => console.error('billing usage report failed', e instanceof Error ? e.message : e))
  }

  const purge = b.purged && b.purge_enabled ? await purgeBucket() : null
  return json({ ok: true, status: b.status, reported_bytes: reported, purge })
}))
