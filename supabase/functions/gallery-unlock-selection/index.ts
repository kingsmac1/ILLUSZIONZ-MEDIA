/** Admin: reopen a submitted selection so the client can change it (their picks are kept), and tell them by email. */
import { handle, HttpError, isUuid, json } from '../_shared/http.ts'
import { loadGallery, logActivity, requireAdmin, service } from '../_shared/auth.ts'
import { mailConfig, sendEmail } from '../_shared/email.ts'
import { selectionUnlocked } from '../_shared/email-templates.ts'
import { clientLink } from '../_shared/gallery.ts'

Deno.serve(handle(async (req, body) => {
  await requireAdmin(req)
  if (!isUuid(body.gallery_id)) throw new HttpError('Missing gallery.')
  const g = await loadGallery(body.gallery_id)
  if (g.kind !== 'proof' || g.status !== 'submitted') throw new HttpError('Only a submitted selection can be unlocked.')
  if (g.previews_purged_at) throw new HttpError('The previews of this gallery were already removed.')
  const { error } = await service().from('galleries').update({ status: 'selecting', submitted_at: null }).eq('id', g.id)
  if (error) throw error
  const cfg = mailConfig()
  const mail = body.notify === false ? { sent: false } : await sendEmail({ to: g.client_email, replyTo: cfg.owners[0], message: selectionUnlocked({ siteUrl: cfg.siteUrl, clientName: g.client_name, title: g.title, link: clientLink(g), limit: g.selection_limit }) })
  await logActivity({ client_email: g.client_email, booking_id: g.booking_id, gallery_id: g.id, actor: 'admin', event: 'selection_unlocked', meta: { title: g.title, emailed: mail.sent } })
  return json({ ok: true, emailed: mail.sent, email_error: (mail as { error?: string }).error })
}))
