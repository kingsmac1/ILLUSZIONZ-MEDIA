/** Public business details (single source for header, footer, menu, emails). */
export const site = {
  name: 'Illuszionz Media',
  shortName: 'IlluszionzMedia',
  url: 'https://illuszionzmedia.com',
  email: 'info@illuszionzmedia.com',
  phone: '+447864748937',
  phoneDisplay: '+447864748937',
  /** digits only, for wa.me links */
  whatsapp: '447864748937',
  facebook: 'https://web.facebook.com/Illuszionzweddings',
  instagram: 'https://www.instagram.com/illuszionzphotostudio/',
  x: 'https://x.com/illuszionzfoto',
  tagline: 'Transforming moments, brands, and ideas into powerful visual experiences. World-class media solutions for the modern age.',
} as const

export const whatsappLink = (message?: string) =>
  `https://wa.me/${site.whatsapp}${message ? `?text=${encodeURIComponent(message)}` : ''}`
