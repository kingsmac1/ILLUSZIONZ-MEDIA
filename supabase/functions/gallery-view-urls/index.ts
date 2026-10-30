/**
 * Signed thumb + display URLs for a gallery (200 per page), for the owning client or an admin.
 * Anyone else (signed out, or signed in with another email) only gets the cover screen: title, date, a blurred cover
 * thumbnail and a masked hint of the email the gallery was sent to.
 * The client's first visit sets first_viewed_at, moves the status to "viewed" and logs it.
 */
import { handle, HttpError, isUuid, json } from '../_shared/http.ts'
import { caller, canView, loadGallery, logActivity, service, type Gallery } from '../_shared/auth.ts'
import { signGet } from '../_shared/r2.ts'
import { PAGE_SIZE } from '../_shared/gallery.ts'

const maskEmail = (e: string) => {
  const [user, domain] = e.split('@')
  return `${user.slice(0, 1)}${'•'.repeat(Math.max(2, Math.min(6, user.length - 1)))}@${domain}`
}

Deno.serve(handle(async (req, body) => {
  if (!isUuid(body.gallery_id)) throw new HttpError('This gallery link is not valid.', 404)
  const who = await caller(req)
  const g = await loadGallery(body.gallery_id)
  if (g.status === 'draft' && !who.isAdmin) throw new HttpError('This gallery is not ready yet.', 404)

  const { data: booking } = g.booking_id
    ? await service().from('bookings').select('kind, event_date').eq('id', g.booking_id).maybeSingle()
    : { data: null }
  const purged = !!g.previews_purged_at
  let cover: { url: string; width: number | null; height: number | null } | null = null
  const coverId = g.cover_image_id
  const { data: coverImg } = coverId
    ? await service().from('gallery_images').select('id, thumb_key, display_key, width, height').eq('id', coverId).maybeSingle()
    : await service().from('gallery_images').select('id, thumb_key, display_key, width, height').eq('gallery_id', g.id).eq('status', 'ready').order('sort_order').limit(1).maybeSingle()
  if (coverImg?.thumb_key && !purged) cover = { url: await signGet(coverImg.thumb_key), width: coverImg.width, height: coverImg.height }

  const publicInfo = {
    id: g.id, title: g.title, kind: g.kind, client_first_name: g.client_name.trim().split(/\s+/)[0] ?? '',
    event_date: booking?.event_date ?? null, shoot: booking?.kind?.replace(/ booking$/i, '') ?? null,
  }
  if (!canView(who, g)) {
    return json({ ok: true, access: who.email ? 'wrong_email' : 'signin', gallery: publicInfo, cover, email_hint: maskEmail(g.client_email), signed_in_as: who.email })
  }

  // first look by the client
  if (!who.isAdmin && who.email === g.client_email && !g.first_viewed_at) {
    const patch: Partial<Gallery> = { first_viewed_at: new Date().toISOString() }
    if (g.status === 'sent') patch.status = 'viewed'
    await service().from('galleries').update(patch).eq('id', g.id)
    Object.assign(g, patch)
    await logActivity({ client_email: g.client_email, booking_id: g.booking_id, gallery_id: g.id, actor: 'client', event: 'gallery_viewed', meta: { title: g.title, kind: g.kind } })
  }

  const page = Math.max(0, Math.floor(Number(body.page) || 0))
  let q = service().from('gallery_images').select('id, original_filename, width, height, thumb_key, display_key, original_key, sort_order, taken_at, source_proof_image_id, status, bytes', { count: 'exact' }).eq('gallery_id', g.id)
  if (!who.isAdmin || !body.include_unready) q = q.eq('status', 'ready')
  const { data: rows, count, error } = await q.order('sort_order').order('original_filename').range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)
  if (error) throw error
  const images = await Promise.all((rows ?? []).map(async (r) => ({
    id: r.id, filename: r.original_filename, width: r.width, height: r.height, sort_order: r.sort_order, taken_at: r.taken_at,
    source_proof_image_id: r.source_proof_image_id, status: r.status, bytes: who.isAdmin ? r.bytes : undefined, has_original: !!r.original_key,
    thumb: r.thumb_key && !purged ? await signGet(r.thumb_key) : null,
    display: r.display_key && !purged ? await signGet(r.display_key) : null,
  })))

  const { data: selections } = page === 0 && g.kind === 'proof'
    ? await service().from('gallery_selections').select('image_id, note, created_at').eq('gallery_id', g.id).eq('client_email', g.client_email)
    : { data: null }

  // the other half of the shoot: finals for a proof gallery, the proofs for a finals gallery
  const { data: related } = g.booking_id
    ? await service().from('galleries').select('id, kind, status, delivered_at').eq('booking_id', g.booking_id).neq('id', g.id)
    : { data: [] }
  const visibleRelated = (related ?? []).filter((r) => who.isAdmin || r.status !== 'draft')

  return json({
    ok: true, access: 'full', is_admin: who.isAdmin,
    gallery: {
      ...publicInfo, status: g.status, selection_limit: g.selection_limit, allow_extra_selections: g.allow_extra_selections, extra_price_note: g.extra_price_note,
      message_to_client: g.message_to_client, sent_at: g.sent_at, submitted_at: g.submitted_at, delivered_at: g.delivered_at,
      expires_at: g.expires_at, previews_purge_at: g.previews_purge_at, previews_purged: purged, cover_image_id: coverImg?.id ?? null, client_name: g.client_name,
    },
    cover, images, total: count ?? images.length, page, pages: Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE)),
    selections: selections ?? undefined, related: visibleRelated,
  })
}))
