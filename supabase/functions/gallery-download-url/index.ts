/**
 * Full-resolution downloads from a delivered finals gallery (owning client or admin). Returns signed original URLs
 * (15 minutes, saved under the original filename). One image = one download row; a zip part = one row with image_id null.
 */
import { handle, HttpError, isUuid, json } from '../_shared/http.ts'
import { loadGallery, logActivity, requireUser, service } from '../_shared/auth.ts'
import { ORIGINAL_TTL, signGet } from '../_shared/r2.ts'

Deno.serve(handle(async (req, body) => {
  const who = await requireUser(req)
  if (!isUuid(body.gallery_id)) throw new HttpError('Missing gallery.')
  const g = await loadGallery(body.gallery_id)
  const owner = who.email === g.client_email
  if (!who.isAdmin && !owner) throw new HttpError('This gallery belongs to another account.', 403)
  if (g.kind !== 'final') throw new HttpError('Downloads are available once your final photos are delivered.', 403)
  if (!who.isAdmin && g.status !== 'delivered') throw new HttpError('Your photos are not ready to download yet.', 403)

  const ids = (Array.isArray(body.image_ids) ? body.image_ids : body.image_id ? [body.image_id] : []).filter(isUuid).slice(0, 120) as string[]
  if (!ids.length) throw new HttpError('Choose at least one photo.')
  const { data, error } = await service().from('gallery_images').select('id, original_filename, original_key, bytes').eq('gallery_id', g.id).eq('status', 'ready').in('id', ids)
  if (error) throw error
  const files = await Promise.all((data ?? []).filter((r) => r.original_key).map(async (r) => ({
    id: r.id, filename: r.original_filename, bytes: r.bytes, url: await signGet(r.original_key!, { ttl: ORIGINAL_TTL, download: r.original_filename }),
  })))

  if (owner && !who.isAdmin) {
    const zip = !!body.zip
    const rows = zip ? [{ gallery_id: g.id, image_id: null, client_email: who.email }] : files.map((f) => ({ gallery_id: g.id, image_id: f.id, client_email: who.email }))
    await service().from('gallery_downloads').insert(rows)
    if (zip ? Number(body.part ?? 1) === 1 : true)
      await logActivity({ client_email: g.client_email, booking_id: g.booking_id, gallery_id: g.id, actor: 'client', event: 'downloaded', meta: zip ? { all: true, title: g.title, count: Number(body.total) || files.length } : { title: g.title, filename: files[0]?.filename } })
  }
  return json({ ok: true, files })
}))
