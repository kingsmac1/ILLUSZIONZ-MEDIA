/**
 * Daily (pg_cron, header x-cron-secret = GALLERY_CRON_SECRET) or by an admin: deletes the watermarked preview files of
 * proof galleries whose previews_purge_at has passed (set to delivery + PURGE_DAYS). The rows, picks and notes are kept,
 * so the selection history stays readable; the proof gallery is marked "archived".
 */
import { handle, HttpError, json, pool } from '../_shared/http.ts'
import { caller, logActivity, service } from '../_shared/auth.ts'
import { remove } from '../_shared/r2.ts'

const GALLERIES_PER_RUN = 5

Deno.serve(handle(async (req) => {
  const secret = Deno.env.get('GALLERY_CRON_SECRET')
  const cron = !!secret && req.headers.get('x-cron-secret') === secret
  if (!cron && !(await caller(req)).isAdmin) throw new HttpError('Not authorised.', 401)

  const { data: due, error } = await service().from('galleries').select('id, client_email, booking_id, title')
    .eq('kind', 'proof').lt('previews_purge_at', new Date().toISOString()).is('previews_purged_at', null).limit(GALLERIES_PER_RUN)
  if (error) throw error
  const done: { id: string; objects: number }[] = []
  for (const g of due ?? []) {
    const { data: imgs } = await service().from('gallery_images').select('thumb_key, display_key').eq('gallery_id', g.id).limit(5000)
    const objectKeys = (imgs ?? []).flatMap((i) => [i.thumb_key, i.display_key]).filter(Boolean) as string[]
    const ok = await pool(objectKeys, 16, (k) => remove(k).then(() => true, () => false))
    if (ok.some((x) => !x)) continue // try again tomorrow
    await service().from('galleries').update({ previews_purged_at: new Date().toISOString(), status: 'archived' }).eq('id', g.id)
    await logActivity({ client_email: g.client_email, booking_id: g.booking_id, gallery_id: g.id, actor: 'system', event: 'previews_purged', meta: { title: g.title, objects: objectKeys.length } })
    done.push({ id: g.id, objects: objectKeys.length })
  }
  return json({ ok: true, purged: done, more: (due ?? []).length === GALLERIES_PER_RUN })
}))
