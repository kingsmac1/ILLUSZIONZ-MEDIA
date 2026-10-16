import { site } from './site'

type Page = { path: string; title: string; description: string; image?: string; type?: 'website' | 'article' }

const BRAND = site.name
const OG_IMAGE = `${site.url}/og-image.jpg`

/** Head tags for every page: title, description, canonical, Open Graph and Twitter card. */
export const pages = {
  home: {
    path: '/',
    title: `${BRAND} – Capturing your Best Moments in Pictures`,
    description: 'Illuszionz Media: London photography, wedding and event coverage, cinematic videography, 360 booth hire, creative consulting and a photography academy.',
  },
  'about-us': {
    path: '/about-us/',
    title: `About – ${BRAND}`,
    description: 'Meet Illuszionz Media, a creative media company built on passion, innovation and excellence: our mission, values and the team behind the work.',
  },
  'photography-services': {
    path: '/photography-services/',
    title: `Portrait Photography Services – ${BRAND}`,
    description: 'Portrait, maternity, baby, prewedding, family and event photography in London. Clear packages from £150 with edited pictures included. Book online.',
  },
  wedding: {
    path: '/wedding/',
    title: `Wedding Photography – ${BRAND}`,
    description: 'Cinematic wedding photography in London. Silver, Gold, Diamond and Traditional packages from £900 with galleries, photobooks and frames. Check your date.',
  },
  'videography-services': {
    path: '/videography-services/',
    title: `Videography Services – ${BRAND}`,
    description: 'Wedding films, drone coverage, live streaming, event highlights, reels, podcasts and music videos. Cinematic videography with a tailored quote.',
  },
  '360-photo-booth': {
    path: '/360-photo-booth/',
    title: `360 Photo Booth Hire – ${BRAND}`,
    description: 'Hire a 360 video booth for weddings, parties, conferences and church events across London. Unlimited branded videos and an operator included.',
  },
  academy: {
    path: '/academy/',
    title: `Photography & Videography Academy – ${BRAND}`,
    description: 'Learn photography and videography with working professionals. Courses from £250: Zero to Pro, Introduction, Upgrade classes and Creative AI for juniors.',
  },
  agency: {
    path: '/agency/',
    title: `Creative & Media Agency Services – ${BRAND}`,
    description: 'Location, influencer and crew scouting, premiere and sponsorship consulting, social media marketing and branding. Book an agency consultation.',
  },
  careers: {
    path: '/careers/',
    title: `Careers – ${BRAND}`,
    description: 'Join the collective. Illuszionz Media is hiring photographers, videographers, content creators and editors. See open roles and send us your portfolio.',
  },
  store: {
    path: '/store/',
    title: `Store – ${BRAND}`,
    description: 'Creative resources and sessions for creators. Book a 45-minute clarity and scaling session for your photography business for £25.',
  },
  contact: {
    path: '/contact/',
    title: `Contact – ${BRAND}`,
    description: 'Start a conversation with Illuszionz Media. Call or WhatsApp +447864748937, email info@illuszionzmedia.com or send us a message about your project.',
  },
  form: {
    path: '/form/',
    title: `Service Enquiry – ${BRAND}`,
    description: 'Tell us what you need — videography, agency services, careers, live streaming and more. A member of the Illuszionz Media team replies within one business day.',
  },
  media: {
    path: '/media/',
    title: `Media Collective – ${BRAND}`,
    description: 'Explore the Illuszionz Media divisions: photography services and professional videography, from studio sessions and editorials to cinematic brand films.',
  },
  review: {
    path: '/review/',
    title: `Client Reviews – ${BRAND}`,
    description: 'Read client stories and share your own experience with Illuszionz Media. 850+ happy clients, a 5.0 average rating and 1,200 projects delivered.',
  },
} satisfies Record<string, Page>

export type PageKey = keyof typeof pages

export function seoHead(key: PageKey) {
  const p: Page = pages[key]
  const url = site.url + p.path
  return {
    meta: [
      { title: p.title },
      { name: 'description', content: p.description },
      { name: 'robots', content: 'index, follow, max-image-preview:large' },
      { property: 'og:type', content: p.type ?? 'website' },
      { property: 'og:site_name', content: BRAND },
      { property: 'og:locale', content: 'en_GB' },
      { property: 'og:title', content: p.title },
      { property: 'og:description', content: p.description },
      { property: 'og:url', content: url },
      { property: 'og:image', content: p.image ?? OG_IMAGE },
      { property: 'og:image:width', content: '1200' },
      { property: 'og:image:height', content: '630' },
      { property: 'og:image:alt', content: `${BRAND} – photography, videography and media services` },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:site', content: '@illuszionzfoto' },
      { name: 'twitter:title', content: p.title },
      { name: 'twitter:description', content: p.description },
      { name: 'twitter:image', content: p.image ?? OG_IMAGE },
      { name: 'theme-color', content: '#000000' },
    ],
    links: [{ rel: 'canonical', href: url }],
  }
}

/** Organisation structured data, included on every page. */
export const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'ProfessionalService',
  name: BRAND,
  url: site.url,
  logo: `${site.url}/images/Illusionz-Media-Logo-Black.png`,
  image: OG_IMAGE,
  email: site.email,
  telephone: site.phone,
  areaServed: 'London, United Kingdom',
  description: 'Full-service media agency: photography, videography, 360 photo booth hire, creative consulting and a photography academy.',
  sameAs: [site.facebook, site.instagram, site.x],
}
