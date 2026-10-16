/** Who a segment / campaign targets. Pure (no server imports) so the dashboard and the server evaluate it identically. */
export type AudienceFilter = {
  q?: string
  lifecycle?: string[]
  source?: string[]
  tag?: string
  /** 'yes' = has at least one non-cancelled booking, 'no' = none */
  booked?: 'yes' | 'no' | ''
  /** has booked this service (flow id) */
  service?: string
  /** last activity at least this many days ago */
  inactiveDays?: number
  /** only people who can receive marketing (default true for campaigns) */
  marketingOnly?: boolean
}

export type AudContact = {
  id: string
  name: string
  email: string | null
  phone: string
  lifecycle: string
  source: string
  tags: string[]
  marketing_opt_in: boolean
  do_not_contact: boolean
  last_activity_at: string
  city?: string
}
export type AudBooking = { contact_id: string | null; flow_id: string; status: string }

export function matchesAudience(c: AudContact, bookings: AudBooking[], f: AudienceFilter, now = Date.now()): boolean {
  if (f.marketingOnly && (!c.marketing_opt_in || c.do_not_contact || !c.email)) return false
  if (f.q) {
    const hay = `${c.name} ${c.email ?? ''} ${c.phone} ${c.city ?? ''} ${c.tags.join(' ')}`.toLowerCase()
    if (!hay.includes(f.q.toLowerCase())) return false
  }
  if (f.lifecycle?.length && !f.lifecycle.includes(c.lifecycle)) return false
  if (f.source?.length && !f.source.includes(c.source)) return false
  if (f.tag && !c.tags.includes(f.tag)) return false
  const mine = bookings.filter((b) => b.contact_id === c.id && b.status !== 'cancelled')
  if (f.booked === 'yes' && !mine.length) return false
  if (f.booked === 'no' && mine.length) return false
  if (f.service && !mine.some((b) => b.flow_id === f.service)) return false
  if (f.inactiveDays && now - new Date(c.last_activity_at).getTime() < f.inactiveDays * 86_400_000) return false
  return true
}
