/**
 * Types for the gallery tables (supabase/migrations/20261030120000_gallery_foundations.sql) and the Edge Function
 * responses. Written by hand to match the migration — regenerate with `supabase gen types` if you prefer generated types.
 */
export type GalleryKind = 'proof' | 'final'
export type GalleryStatus = 'draft' | 'sent' | 'viewed' | 'selecting' | 'submitted' | 'delivered' | 'archived'

export type GalleryRow = {
  id: string
  created_at: string
  updated_at: string
  booking_id: string | null
  client_email: string
  client_name: string
  title: string
  kind: GalleryKind
  status: GalleryStatus
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
  /** private link key: /gallery/<id>/?k=<share_token> opens the gallery without signing in */
  share_token: string
}

export type GalleryImageRow = {
  id: string
  created_at: string
  gallery_id: string
  original_filename: string
  thumb_key: string | null
  display_key: string | null
  original_key: string | null
  content_type: string
  width: number | null
  height: number | null
  bytes: number
  sort_order: number
  taken_at: string | null
  source_proof_image_id: string | null
  status: 'uploading' | 'ready' | 'failed'
}

export type SelectionRow = { gallery_id: string; image_id: string; client_email: string; note: string | null; created_at: string; updated_at: string }
export type DownloadRow = { id: string; gallery_id: string; image_id: string | null; client_email: string; created_at: string }
export type ActivityRow = { id: string; client_email: string; booking_id: string | null; gallery_id: string | null; actor: 'client' | 'admin' | 'system'; event: string; meta: Record<string, any>; created_at: string }
export type ProfileRow = { id: string; email: string; full_name: string; phone: string; role: 'client' | 'admin' }
export type MyBooking = { id: string; ref: string; name: string; kind: string; flow_id: string; packages: string; event_date: string | null; event_time: string | null; status: string; total: number; total_text: string; amount_paid: number; payment_status: string; created_at: string }

/** One image as returned by gallery-view-urls (signed URLs). */
export type ViewImage = {
  id: string
  filename: string
  width: number | null
  height: number | null
  sort_order: number
  taken_at: string | null
  source_proof_image_id: string | null
  status: 'uploading' | 'ready' | 'failed'
  bytes?: number
  has_original: boolean
  thumb: string | null
  display: string | null
}

export type ViewGallery = {
  id: string
  title: string
  kind: GalleryKind
  client_first_name: string
  client_name?: string
  event_date: string | null
  shoot: string | null
  status?: GalleryStatus
  selection_limit?: number | null
  allow_extra_selections?: boolean
  extra_price_note?: string | null
  message_to_client?: string | null
  sent_at?: string | null
  submitted_at?: string | null
  delivered_at?: string | null
  expires_at?: string | null
  previews_purge_at?: string | null
  previews_purged?: boolean
  cover_image_id?: string | null
}

export type ViewResponse = {
  ok: true
  access: 'full' | 'signin' | 'wrong_email'
  is_admin?: boolean
  gallery: ViewGallery
  cover: { url: string; width: number | null; height: number | null } | null
  email_hint?: string
  signed_in_as?: string | null
  /** with full access: the gallery's email (to offer "save to your account") and whether the viewer is signed in as it */
  client_email?: string
  is_owner?: boolean
  images?: ViewImage[]
  total?: number
  page?: number
  pages?: number
  selections?: { image_id: string; note: string | null; created_at: string }[]
  related?: { id: string; kind: GalleryKind; status: GalleryStatus; delivered_at: string | null; key?: string }[]
}
