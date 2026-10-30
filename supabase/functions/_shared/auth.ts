/**
 * Who is calling? Every function gets the caller's Supabase JWT (verify_jwt is on). The service-role client is used for
 * all database work, so the checks here (confirmed email, admin, gallery owner) are what keep data private.
 */
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.118.0'
import { HttpError } from './http.ts'

export type Caller = { userId: string | null; email: string | null; isAdmin: boolean }

let client: SupabaseClient | null = null
export function service(): SupabaseClient {
  client ??= createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } })
  return client
}

/** Resolves the caller. Anonymous callers (anon key only) get { userId: null }. Only confirmed emails count. */
export async function caller(req: Request): Promise<Caller> {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return { userId: null, email: null, isAdmin: false }
  const { data } = await service().auth.getUser(token)
  const user = data?.user
  if (!user) return { userId: null, email: null, isAdmin: false }
  const email = user.email && user.email_confirmed_at ? user.email.toLowerCase() : null
  if (!email) return { userId: user.id, email: null, isAdmin: false }
  const { data: admins } = await service().from('admin_users').select('email')
  const isAdmin = (admins ?? []).some((a: { email: string }) => a.email.toLowerCase() === email)
  return { userId: user.id, email, isAdmin }
}

export async function requireAdmin(req: Request): Promise<Caller> {
  const who = await caller(req)
  if (!who.email) throw new HttpError('Please sign in again.', 401)
  if (!who.isAdmin) throw new HttpError('Only the studio can do that.', 403)
  return who
}

export async function requireUser(req: Request): Promise<Caller & { email: string }> {
  const who = await caller(req)
  if (!who.email) throw new HttpError('Please sign in with the email this gallery was sent to.', 401)
  return who as Caller & { email: string }
}

export type Gallery = {
  id: string
  booking_id: string | null
  client_email: string
  client_name: string
  title: string
  kind: 'proof' | 'final'
  status: string
  selection_limit: number | null
  allow_extra_selections: boolean
  extra_price_note: string | null
  cover_image_id: string | null
  message_to_client: string | null
  parent_gallery_id: string | null
  sent_at: string | null
  first_viewed_at: string | null
  submitted_at: string | null
  delivered_at: string | null
  expires_at: string | null
  previews_purge_at: string | null
  previews_purged_at: string | null
  created_at: string
}

export async function loadGallery(id: string): Promise<Gallery> {
  const { data, error } = await service().from('galleries').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  if (!data) throw new HttpError('This gallery does not exist (it may have been removed).', 404)
  return data as Gallery
}

/** The caller may see this gallery: an admin, or the owning client once it has been sent. */
export function canView(who: Caller, g: Gallery) {
  return who.isAdmin || (!!who.email && who.email === g.client_email && g.status !== 'draft')
}

/** Adds a row to the client's timeline (never throws). */
export async function logActivity(row: { client_email: string; booking_id?: string | null; gallery_id?: string | null; actor: 'client' | 'admin' | 'system'; event: string; meta?: Record<string, unknown> }) {
  const { error } = await service().from('activity_log').insert({ meta: {}, ...row })
  if (error) console.error('activity log failed', error.message)
}
