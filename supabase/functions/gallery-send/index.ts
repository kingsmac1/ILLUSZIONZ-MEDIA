/**
 * Admin: send a gallery to the client (or resend / remind).
 *  - proofs: status -> "sent" (only from draft), sent_at, "Your previews are ready" email
 *  - finals: status -> "delivered", delivered_at; the proof gallery's previews are scheduled for deletion PURGE_DAYS later
 * The status change happens even when email is not configured yet; the response says whether the email went out.
 */
import { handle, HttpError, isUuid, json } from '../_shared/http.ts'
import { loadGallery, logActivity, requireAdmin, service } from '../_shared/auth.ts'
import { mailConfig, sendEmail } from '../_shared/email.ts'
import { finalsReady, previewsReady } from '../_shared/email-templates.ts'
import { addDays, clientLink, OPEN_FOR_PICKS, PURGE_DAYS } from '../_shared/gallery.ts'

Deno.serve(handle(async (req, body) => {
  await requireAdmin(req)
  if (!isUuid(body.gallery_id)) throw new HttpError('Missing gallery.')
  const g = await loadGallery(body.gallery_id)
  const reminder = !!body.reminder
  const { count } = await service().from('gallery_images').select('id', { count: 'exact', head: true }).eq('gallery_id', g.id).eq('status', 'ready')
  if (!count) throw new HttpError('Upload at least one photo before sending.')
  if (!/^\S+@\S+\.\S+$/.test(g.client_email)) throw new HttpError('This gallery has no valid client email. Add one to the booking first.')

  const now = new Date().toISOString()
  const cfg = mailConfig()
  const link = clientLink(g)
  const patch: Record<string, unknown> = {}
  let message
  let event: string

  if (g.kind === 'proof') {
    if (reminder && !OPEN_FOR_PICKS.includes(g.status)) throw new HttpError('A reminder only makes sense while the client is still choosing.')
    if (g.status === 'draft') patch.status = 'sent'
    if (!g.sent_at || g.status === 'draft') patch.sent_at = now
    message = previewsReady({ siteUrl: cfg.siteUrl, clientName: g.client_name, title: g.title, link, message: g.message_to_client, limit: g.selection_limit, extrasNote: g.allow_extra_selections ? g.extra_price_note : null, reminder })
    event = reminder ? 'gallery_reminder' : g.status === 'draft' ? 'gallery_sent' : 'gallery_resent'
  } else {
    const first = g.status !== 'delivered'
    patch.status = 'delivered'
    if (first) patch.delivered_at = now
    const deliveredAt = (patch.delivered_at as string) ?? g.delivered_at ?? now
    let purgeAt: string | null = null
    const parentId = g.parent_gallery_id ?? (g.booking_id ? (await service().from('galleries').select('id').eq('booking_id', g.booking_id).eq('kind', 'proof').maybeSingle()).data?.id : null)
    if (parentId) {
      purgeAt = addDays(deliveredAt, PURGE_DAYS)
      await service().from('galleries').update({ previews_purge_at: purgeAt }).eq('id', parentId).is('previews_purged_at', null)
      if (!g.parent_gallery_id) patch.parent_gallery_id = parentId
    }
    message = finalsReady({ siteUrl: cfg.siteUrl, clientName: g.client_name, title: g.title, link, count, message: g.message_to_client, previewsExpire: purgeAt })
    event = first ? 'finals_delivered' : 'finals_resent'
  }

  if (Object.keys(patch).length) {
    const { error } = await service().from('galleries').update(patch).eq('id', g.id)
    if (error) throw error
  }
  const mail = await sendEmail({ to: g.client_email, replyTo: cfg.owners[0], message })
  await logActivity({ client_email: g.client_email, booking_id: g.booking_id, gallery_id: g.id, actor: 'admin', event, meta: { title: g.title, kind: g.kind, count, emailed: mail.sent } })
  return json({ ok: true, status: patch.status ?? g.status, emailed: mail.sent, email_error: mail.error, link })
}))
