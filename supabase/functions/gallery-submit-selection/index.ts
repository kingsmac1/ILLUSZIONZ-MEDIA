/**
 * Client: submit (and lock) the selection. Emails the photographer the picks with a copy-ready filename list and a
 * Lightroom filter, emails the client a confirmation, logs it, and returns the WhatsApp message for the hand-off.
 */
import { handle, HttpError, isUuid, json } from '../_shared/http.ts'
import { caller, canAct, loadGallery, logActivity, service } from '../_shared/auth.ts'
import { mailConfig, sendEmail } from '../_shared/email.ts'
import { money, selectionConfirmation, selectionReceived } from '../_shared/email-templates.ts'
import { adminLink, clientLink, OPEN_FOR_PICKS } from '../_shared/gallery.ts'
import { byFilename, lightroomFilter } from '../_shared/filenames.ts'

Deno.serve(handle(async (req, body) => {
  const who = await caller(req)
  if (!isUuid(body.gallery_id)) throw new HttpError('Missing gallery.')
  const g = await loadGallery(body.gallery_id)
  if (!canAct(who, g, body.key)) throw new HttpError('Open this gallery from the link in your email to submit.', 403)
  if (g.kind !== 'proof') throw new HttpError('There is nothing to select in this gallery.')
  if (g.status === 'submitted') throw new HttpError('Your selection was already submitted.', 409)
  if (!OPEN_FOR_PICKS.includes(g.status)) throw new HttpError('This gallery is closed for selection.', 409)

  const { data: picks, error } = await service()
    .from('gallery_selections').select('image_id, note, gallery_images!inner(original_filename, status)')
    .eq('gallery_id', g.id).eq('client_email', g.client_email)
  if (error) throw error
  const list = (picks ?? []).map((p: any) => ({ file: p.gallery_images.original_filename as string, note: (p.note ?? '').trim() as string }))
  if (!list.length) throw new HttpError('Pick at least one photo first.')
  if (g.selection_limit && !g.allow_extra_selections && list.length > g.selection_limit) throw new HttpError(`You can pick up to ${g.selection_limit} photos — please remove ${list.length - g.selection_limit}.`)

  const now = new Date().toISOString()
  // "I want all unedited images" — only when the studio offers it on this gallery (a price is set)
  const wantsUnedited = !!body.wants_unedited && g.unedited_price != null
  const unedited = wantsUnedited ? Number(g.unedited_price) : null
  const { error: upErr } = await service().from('galleries').update({ status: 'submitted', submitted_at: now, wants_unedited: wantsUnedited }).eq('id', g.id).in('status', OPEN_FOR_PICKS)
  if (upErr) throw upErr

  const cfg = mailConfig()
  const filenames = list.map((x) => x.file).sort(byFilename)
  const notes = list.filter((x) => x.note).sort((a, b) => byFilename(a.file, b.file))
  const base = { siteUrl: cfg.siteUrl, clientName: g.client_name || g.client_email, title: g.title, link: clientLink(g) }
  const [owner, client] = await Promise.all([
    sendEmail({ to: cfg.owners, replyTo: g.client_email, message: selectionReceived({ ...base, clientEmail: g.client_email, adminLink: adminLink(g), count: list.length, limit: g.selection_limit, filenames, lightroom: lightroomFilter(filenames), notes, unedited }) }),
    sendEmail({ to: g.client_email, replyTo: cfg.owners[0], message: selectionConfirmation({ ...base, count: list.length, unedited }) }),
  ])
  await logActivity({ client_email: g.client_email, booking_id: g.booking_id, gallery_id: g.id, actor: 'client', event: 'selection_submitted', meta: { title: g.title, count: list.length, notes: notes.length, wants_unedited: wantsUnedited, emailed: owner.sent } })

  const whatsapp_text = `Hi Illuszionz Media 👋 I've submitted my photo selection — ${list.length} photos from "${g.title}"${wantsUnedited ? `, plus all the unedited images (${money(unedited!)})` : ''}. Name: ${g.client_name || '—'}. Email: ${g.client_email}. Link: ${adminLink(g)}`
  return json({ ok: true, count: list.length, submitted_at: now, emailed: owner.sent && client.sent, whatsapp_text, whatsapp_url: `https://wa.me/${cfg.whatsapp}?text=${encodeURIComponent(whatsapp_text)}` })
}))
