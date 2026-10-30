/** Admin: delete some images (R2 objects + rows) or a whole gallery. */
import { handle, HttpError, isUuid, json, pool } from '../_shared/http.ts'
import { loadGallery, logActivity, requireAdmin, service } from '../_shared/auth.ts'
import { remove } from '../_shared/r2.ts'

Deno.serve(handle(async (req, body) => {
  await requireAdmin(req)
  if (!isUuid(body.gallery_id)) throw new HttpError('Missing gallery.')
  const g = await loadGallery(body.gallery_id)
  const whole = !Array.isArray(body.image_ids)
  const ids = whole ? [] : (body.image_ids as unknown[]).filter(isUuid)
  if (!whole && !ids.length) throw new HttpError('Choose photos to delete.')

  let q = service().from('gallery_images').select('id, thumb_key, display_key, original_key').eq('gallery_id', g.id)
  if (!whole) q = q.in('id', ids)
  const { data: images, error } = await q.limit(5000)
  if (error) throw error
  const objectKeys = (images ?? []).flatMap((i) => [i.thumb_key, i.display_key, i.original_key]).filter(Boolean) as string[]
  const results = await pool(objectKeys, 16, (k) => remove(k).then(() => true, () => false))
  const failed = results.filter((x) => !x).length
  if (failed) console.error(`gallery-delete: ${failed} objects could not be removed from R2`)

  if (whole) {
    const { error: e } = await service().from('galleries').delete().eq('id', g.id)
    if (e) throw e
    await logActivity({ client_email: g.client_email, booking_id: g.booking_id, actor: 'admin', event: 'gallery_deleted', meta: { title: g.title, kind: g.kind } })
  } else {
    const { error: e } = await service().from('gallery_images').delete().eq('gallery_id', g.id).in('id', ids)
    if (e) throw e
  }
  return json({ ok: true, deleted: (images ?? []).length, objects_failed: failed })
}))
