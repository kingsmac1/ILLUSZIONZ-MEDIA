/**
 * Client feedback on the final photos (private link holder or the owning client):
 *   { action: 'react', image_id, reaction: 1 | -1 | 0 }   👍 / 👎 / clear
 *   { action: 'comment', image_id, comment }             a note for the photographer ('' clears it)
 *   { action: 'send' }                                   email everything to the studio (can be sent again after changes)
 * Stored against the gallery's client email, like picks. The studio's own preview is read-only.
 */
import { handle, HttpError, isUuid, json } from '../_shared/http.ts'
import { caller, canAct, loadGallery, logActivity, service } from '../_shared/auth.ts'
import { mailConfig, sendEmail } from '../_shared/email.ts'
import { feedbackReceived } from '../_shared/email-templates.ts'
import { adminLink, clientLink } from '../_shared/gallery.ts'
import { byFilename, lightroomFilter } from '../_shared/filenames.ts'

Deno.serve(handle(async (req, body) => {
  if (!isUuid(body.gallery_id)) throw new HttpError('Missing gallery.')
  const action = body.action as string
  if (!['react', 'comment', 'send'].includes(action)) throw new HttpError('Unknown action.')
  const who = await caller(req)
  const g = await loadGallery(body.gallery_id)
  if (!canAct(who, g, body.key)) throw new HttpError('Open this gallery from the link in your email to send feedback.', 403)
  if (g.kind !== 'final' || g.status !== 'delivered') throw new HttpError('Feedback opens once your final photos are delivered.', 409)
  const db = service()

  if (action !== 'send') {
    if (!isUuid(body.image_id)) throw new HttpError('Missing photo.')
    const { data: img } = await db.from('gallery_images').select('id').eq('id', body.image_id).eq('gallery_id', g.id).eq('status', 'ready').maybeSingle()
    if (!img) throw new HttpError('That photo is no longer in this gallery.', 404)
    const key = { gallery_id: g.id, image_id: img.id, client_email: g.client_email }
    const { data: cur } = await db.from('gallery_feedback').select('reaction, comment').eq('image_id', img.id).eq('client_email', g.client_email).maybeSingle()
    const next = {
      reaction: action === 'react' ? ([1, -1].includes(Number(body.reaction)) ? Number(body.reaction) : null) : cur?.reaction ?? null,
      comment: action === 'comment' ? (typeof body.comment === 'string' ? body.comment.trim().slice(0, 2000) || null : null) : cur?.comment ?? null,
    }
    const { error } = next.reaction == null && !next.comment
      ? await db.from('gallery_feedback').delete().match(key)
      : await db.from('gallery_feedback').upsert({ ...key, ...next }, { onConflict: 'image_id,client_email' })
    if (error) throw error
    return json({ ok: true, ...next })
  }

  const { data: rows, error } = await db.from('gallery_feedback')
    .select('reaction, comment, gallery_images!inner(original_filename)').eq('gallery_id', g.id).eq('client_email', g.client_email)
  if (error) throw error
  const list = (rows ?? []).map((r: any) => ({ file: r.gallery_images.original_filename as string, reaction: r.reaction as number | null, comment: ((r.comment ?? '') as string).trim() }))
    .sort((a, b) => byFilename(a.file, b.file))
  if (!list.length) throw new HttpError('Give a photo a 👍 or 👎, or add a comment, first.')
  const liked = list.filter((x) => x.reaction === 1).map((x) => x.file)
  const disliked = list.filter((x) => x.reaction === -1).map(({ file, comment }) => ({ file, comment }))
  const comments = list.filter((x) => x.reaction !== -1 && x.comment).map(({ file, comment }) => ({ file, comment }))

  const cfg = mailConfig()
  const mail = await sendEmail({
    to: cfg.owners, replyTo: g.client_email,
    message: feedbackReceived({ siteUrl: cfg.siteUrl, clientName: g.client_name || g.client_email, clientEmail: g.client_email, title: g.title, link: clientLink(g), adminLink: adminLink(g), liked, disliked, comments, lightroom: lightroomFilter(disliked.map((d) => d.file)) }),
  })
  const now = new Date().toISOString()
  await db.from('galleries').update({ feedback_sent_at: now }).eq('id', g.id)
  await logActivity({ client_email: g.client_email, booking_id: g.booking_id, gallery_id: g.id, actor: 'client', event: 'feedback_sent', meta: { title: g.title, liked: liked.length, disliked: disliked.length, comments: comments.length, emailed: mail.sent } })
  const whatsapp_text = `Hi Illuszionz Media 👋 I've sent my feedback on "${g.title}": ${liked.length} 👍, ${disliked.length} 👎${comments.length ? `, ${comments.length} comment${comments.length === 1 ? '' : 's'}` : ''}. Name: ${g.client_name || '—'}. Link: ${adminLink(g)}`
  return json({ ok: true, sent_at: now, emailed: mail.sent, liked: liked.length, disliked: disliked.length, comments: comments.length, whatsapp_text })
}))
