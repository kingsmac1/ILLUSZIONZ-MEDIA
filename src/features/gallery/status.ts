/** Human labels for gallery statuses and timeline events — shared by the dashboard and the client area. */
import type { ActivityRow, GalleryKind, GalleryStatus } from './types'

export const STATUS_TONE: Record<GalleryStatus, string> = {
  draft: 'grey', sent: 'blue', viewed: 'violet', selecting: 'amber', submitted: 'gold', delivered: 'green', archived: 'grey',
}

export function statusLabel(kind: GalleryKind, status: GalleryStatus, picks?: number, limit?: number | null) {
  if (status === 'selecting') return `Selecting (${picks ?? 0}${limit ? `/${limit}` : ''})`
  if (status === 'submitted') return `Submitted${picks != null ? ` (${picks})` : ''}`
  if (kind === 'final' && status === 'draft') return 'Finals draft'
  return status[0].toUpperCase() + status.slice(1)
}

/** What the client sees in their account. */
export function clientStatus(kind: GalleryKind, status: GalleryStatus) {
  if (kind === 'final') return status === 'delivered' ? 'Ready to download' : 'Being edited'
  switch (status) {
    case 'sent': case 'viewed': return 'Ready for your picks'
    case 'selecting': return 'Picking in progress'
    case 'submitted': return "Submitted — we're editing"
    case 'archived': return 'Previews removed'
    default: return status
  }
}

export const fmtDay = (iso?: string | null, withYear = true) => {
  if (!iso) return ''
  const d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) })
}

export const fmtBytes = (n: number) => {
  if (!n) return '0 MB'
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(n < 10 * 1024 ** 2 ? 1 : 0)} MB`
  return `${(n / 1024 ** 3).toFixed(2)} GB`
}

/** One timeline line. `you` = written for the client ("You submitted…"), otherwise for the studio. */
export function describeActivity(a: Pick<ActivityRow, 'event' | 'meta' | 'actor'>, you: boolean): { icon: string; text: string } {
  const m = a.meta ?? {}
  const t = m.title ? `“${m.title}”` : 'your gallery'
  const who = you ? 'You' : 'Client'
  switch (a.event) {
    case 'booking_created': return { icon: '📅', text: you ? `Booking made${m.kind ? ` — ${String(m.kind).replace(/ booking$/i, '')}` : ''}${m.ref ? ` (#${m.ref})` : ''}` : `Booking created${m.ref ? ` #${m.ref}` : ''}` }
    case 'gallery_sent': return { icon: '✉️', text: you ? `Your previews arrived — ${t}` : `Previews sent to the client${m.emailed === false ? ' (email not sent)' : ''}` }
    case 'gallery_resent': return { icon: '✉️', text: you ? `We re-sent the link to ${t}` : 'Gallery link re-sent' }
    case 'gallery_reminder': return { icon: '🔔', text: you ? `Reminder: ${t} is waiting for your picks` : 'Reminder sent' }
    case 'gallery_viewed': return { icon: '👀', text: you ? `You opened ${t}` : `${who} opened the ${m.kind === 'final' ? 'finals' : 'previews'}` }
    case 'selection_submitted': return { icon: '♥', text: you ? `You submitted ${m.count} photos for editing` : `${who} submitted ${m.count} picks${m.notes ? ` with ${m.notes} note${m.notes === 1 ? '' : 's'}` : ''}` }
    case 'selection_unlocked': return { icon: '🔓', text: you ? 'Your selection was reopened so you can change it' : 'Selection unlocked for changes' }
    case 'finals_delivered': return { icon: '✨', text: you ? `Your final photos are ready — ${m.count} photos` : `Finals delivered (${m.count} photos)${m.emailed === false ? ' — email not sent' : ''}` }
    case 'finals_resent': return { icon: '✉️', text: you ? 'We re-sent your download link' : 'Finals email re-sent' }
    case 'downloaded': return { icon: '⬇️', text: m.all ? `${who} downloaded all photos${m.count ? ` (${m.count})` : ''}` : `${who} downloaded ${m.filename ?? 'a photo'}` }
    case 'previews_purged': return { icon: '🧹', text: you ? 'Your watermarked previews were removed (finals are kept)' : `Previews removed from storage (${m.objects ?? 0} files)` }
    case 'gallery_deleted': return { icon: '🗑', text: `Gallery ${t} deleted` }
    default: return { icon: '•', text: a.event.replace(/_/g, ' ') }
  }
}
