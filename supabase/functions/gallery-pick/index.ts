/**
 * Client: heart / un-heart a proof, or save its note. Works for anyone holding the private link (body.key) and for the
 * owning client signed in with the gallery's email. Picks are stored against the gallery's client email, so they are the
 * same whether the client used the link or their account. The selection limit is enforced by the gallery_selection_rules
 * trigger; the studio's own preview is read-only.
 *   body: { gallery_id, key?, image_id, action: 'add' | 'remove' | 'note', note? }
 */
import { handle, HttpError, isUuid, json } from '../_shared/http.ts'
import { caller, canAct, loadGallery, service } from '../_shared/auth.ts'
import { OPEN_FOR_PICKS } from '../_shared/gallery.ts'

Deno.serve(handle(async (req, body) => {
  if (!isUuid(body.gallery_id) || !isUuid(body.image_id)) throw new HttpError('Missing photo.')
  const action = body.action as string
  if (!['add', 'remove', 'note'].includes(action)) throw new HttpError('Unknown action.')
  const who = await caller(req)
  const g = await loadGallery(body.gallery_id)
  if (!canAct(who, g, body.key)) throw new HttpError('Open this gallery from the link in your email to pick photos.', 403)
  if (g.kind !== 'proof') throw new HttpError('There is nothing to select in this gallery.')
  if (!OPEN_FOR_PICKS.includes(g.status)) throw new HttpError('Your selection is submitted. Message us if you’d like to change it.', 409)

  const db = service()
  const { data: img } = await db.from('gallery_images').select('id').eq('id', body.image_id).eq('gallery_id', g.id).eq('status', 'ready').maybeSingle()
  if (!img) throw new HttpError('That photo is no longer in this gallery.', 404)
  const match = { gallery_id: g.id, image_id: img.id, client_email: g.client_email }

  if (action === 'remove') {
    const { error } = await db.from('gallery_selections').delete().match(match)
    if (error) throw error
  } else if (action === 'add') {
    const { error } = await db.from('gallery_selections').upsert(match, { onConflict: 'image_id,client_email', ignoreDuplicates: true })
    if (error) throw error.code === 'P0001' ? new HttpError(error.message, 409) : error
  } else {
    const note = typeof body.note === 'string' ? body.note.trim().slice(0, 1000) || null : null
    const { error } = await db.from('gallery_selections').upsert({ ...match, note }, { onConflict: 'image_id,client_email' })
    if (error) throw error.code === 'P0001' ? new HttpError(error.message, 409) : error
  }
  const { count } = await db.from('gallery_selections').select('image_id', { count: 'exact', head: true }).eq('gallery_id', g.id).eq('client_email', g.client_email)
  return json({ ok: true, count: count ?? 0 })
}))
