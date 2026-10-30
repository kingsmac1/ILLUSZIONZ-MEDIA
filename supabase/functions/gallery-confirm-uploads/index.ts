/**
 * Admin: after the browser's PUTs finish, check each object really exists in R2 (HEAD), record the stored size and mark
 * the image 'ready'. Anything missing is marked 'failed' so the dashboard can offer "retry".
 */
import { handle, HttpError, isUuid, json, pool } from '../_shared/http.ts'
import { loadGallery, requireAdmin, service } from '../_shared/auth.ts'
import { head } from '../_shared/r2.ts'

Deno.serve(handle(async (req, body) => {
  await requireAdmin(req)
  if (!isUuid(body.gallery_id)) throw new HttpError('Missing gallery.')
  const g = await loadGallery(body.gallery_id)
  const done = ((body.done ?? []) as unknown[]).filter(isUuid).slice(0, 200)
  const failed = ((body.failed ?? []) as unknown[]).filter(isUuid).slice(0, 200)

  const ready: string[] = []
  const missing: string[] = [...failed]
  if (done.length) {
    const { data, error } = await service().from('gallery_images').select('id, thumb_key, display_key, original_key').eq('gallery_id', g.id).in('id', done)
    if (error) throw error
    const sizes = await pool(data ?? [], 12, async (img) => {
      const list = [img.thumb_key, img.display_key, img.original_key].filter(Boolean) as string[]
      const s = await Promise.all(list.map((k) => head(k).catch(() => null)))
      return s.some((x) => x === null) ? null : s.reduce<number>((a, b) => a + (b ?? 0), 0)
    })
    await pool(data ?? [], 12, async (img, i) => {
      if (sizes[i] === null) return missing.push(img.id)
      const { error: e } = await service().from('gallery_images').update({ status: 'ready', bytes: sizes[i] }).eq('id', img.id)
      if (e) throw e
      ready.push(img.id)
    })
  }
  if (missing.length) await service().from('gallery_images').update({ status: 'failed' }).eq('gallery_id', g.id).in('id', missing)
  if (!g.cover_image_id && ready.length) {
    const { data: first } = await service().from('gallery_images').select('id').eq('gallery_id', g.id).eq('status', 'ready').order('sort_order').limit(1)
    if (first?.[0]) await service().from('galleries').update({ cover_image_id: first[0].id }).eq('id', g.id)
  }
  return json({ ok: true, ready, failed: missing })
}))
