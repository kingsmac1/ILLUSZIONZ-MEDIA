/**
 * Everything brand-specific about the client gallery lives here. To reuse the gallery on another photography site,
 * copy src/features/gallery + src/features/account + supabase/functions/gallery-* + the gallery migration, then edit this file
 * (and BRAND in supabase/functions/_shared/email-templates.ts, PURGE_DAYS in supabase/functions/_shared/gallery.ts).
 */
import { site } from '../../site'

const env = import.meta.env as Record<string, string | undefined>

export const galleryConfig = {
  brandName: site.name,
  /** shown in the gallery's top bar and cover (dark backgrounds) */
  logoLight: '/images/illuszionz-logo-white.png',
  /** shown on light backgrounds */
  logoDark: '/images/Illusionz-Media-Logo-Black.png',

  siteUrl: (env.VITE_SITE_URL || site.url).replace(/\/$/, ''),
  ownerEmail: env.VITE_OWNER_EMAIL || site.email,
  /** digits only, for wa.me links */
  ownerWhatsapp: (env.VITE_OWNER_WHATSAPP || site.whatsapp).replace(/[^\d]/g, ''),

  watermark: {
    /** the logo drawn on every proof image — a white logo on a transparent background works best */
    logo: '/images/illuszionz-logo-white.png',
    /** big centred logo: share of the image width, and its opacity */
    size: 0.6,
    opacity: 0.35,
    /** subtle repeated diagonal tile so the mark can't be cropped out */
    tileSize: 0.16,
    tileOpacity: 0.1,
    tileAngleDeg: -30,
    /** soft shadow so the white mark also shows on bright photos */
    shadow: true,
  },

  images: {
    thumbEdge: 600,
    previewEdge: 2048,
    webEdge: 2560,
    jpegQuality: 0.82,
    accept: ['image/jpeg', 'image/png', 'image/webp'],
  },

  upload: { concurrency: 3, retries: 3, batch: 25 },

  /** watermarked previews are deleted this many days after finals are delivered (keep in sync with the Edge Function) */
  purgeDays: 30,
  /** storage meter on Dashboard → Galleries (R2: first 10 GB free, then about $0.015 per GB per month) */
  storageBudgetGb: 10,

  /** "Download all" builds zips in the browser in parts of this size */
  zipPart: { maxFiles: 100, maxBytes: 2 * 1024 ** 3 },
}

export type GalleryConfig = typeof galleryConfig
