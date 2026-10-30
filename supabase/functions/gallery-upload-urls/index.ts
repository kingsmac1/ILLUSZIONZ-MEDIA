/**
 * Admin: register new images and get presigned PUT URLs for each variant. The browser uploads straight to R2.
 * Proof galleries only accept watermarked 'thumb' + 'preview' (never the original); finals take 'thumb' + 'web' + 'original'.
 */
import { handle, HttpError, isUuid, json } from '../_shared/http.ts'
import { loadGallery, requireAdmin, service } from '../_shared/auth.ts'
import { keys, signPut } from '../_shared/r2.ts'
import { MAX_FILES_PER_CALL } from '../_shared/gallery.ts'

type FileIn = { client_ref: string; original_filename: string; content_type: string; bytes: number; width: number; height: number; taken_at?: string | null; variants: string[] }

const ORIGINAL_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

Deno.serve(handle(async (req, body) => {
  await requireAdmin(req)
  if (!isUuid(body.gallery_id)) throw new HttpError('Missing gallery.')
  const files = (Array.isArray(body.files) ? body.files : []) as FileIn[]
  if (!files.length) throw new HttpError('No files to upload.')
  if (files.length > MAX_FILES_PER_CALL) throw new HttpError(`Send at most ${MAX_FILES_PER_CALL} files per request.`)
  const g = await loadGallery(body.gallery_id)
  const want = g.kind === 'proof' ? ['thumb', 'preview'] : ['thumb', 'web', 'original']

  const { data: last } = await service().from('gallery_images').select('sort_order').eq('gallery_id', g.id).order('sort_order', { ascending: false }).limit(1)
  let sort = (last?.[0]?.sort_order ?? -1) + 1

  const rows: Record<string, unknown>[] = []
  const items: { client_ref: string; image_id: string; urls: Record<string, string> }[] = []
  for (const f of files) {
    const variants = [...new Set(f.variants ?? [])].sort()
    if (variants.join() !== [...want].sort().join()) throw new HttpError(g.kind === 'proof' ? 'Proof galleries only take watermarked previews (thumb + preview).' : 'Finals need thumb + web + original.')
    const name = String(f.original_filename ?? '').replace(/^.*[\\/]/, '').slice(0, 200)
    if (!name) throw new HttpError('A file has no name.')
    const id = crypto.randomUUID()
    const row: Record<string, unknown> = {
      id, gallery_id: g.id, original_filename: name, status: 'uploading', sort_order: sort++,
      width: Math.round(Number(f.width)) || null, height: Math.round(Number(f.height)) || null, bytes: Math.max(0, Math.round(Number(f.bytes) || 0)),
      taken_at: f.taken_at && !Number.isNaN(Date.parse(f.taken_at)) ? f.taken_at : null, content_type: 'image/jpeg',
    }
    const urls: Record<string, string> = {}
    if (g.kind === 'proof') {
      row.thumb_key = keys.proofThumb(g.id, id)
      row.display_key = keys.proofPreview(g.id, id)
      urls.thumb = await signPut(row.thumb_key as string, 'image/jpeg')
      urls.preview = await signPut(row.display_key as string, 'image/jpeg')
    } else {
      const ext = ORIGINAL_TYPES[f.content_type]
      if (!ext) throw new HttpError(`${name}: only JPG, PNG and WebP files can be uploaded.`)
      row.thumb_key = keys.finalThumb(g.id, id)
      row.display_key = keys.finalWeb(g.id, id)
      row.original_key = keys.finalOriginal(g.id, id, ext)
      row.content_type = f.content_type
      urls.thumb = await signPut(row.thumb_key as string, 'image/jpeg')
      urls.web = await signPut(row.display_key as string, 'image/jpeg')
      urls.original = await signPut(row.original_key as string, f.content_type)
    }
    rows.push(row)
    items.push({ client_ref: String(f.client_ref ?? id), image_id: id, urls })
  }
  const { error } = await service().from('gallery_images').insert(rows)
  if (error) throw error
  return json({ ok: true, items })
}))
