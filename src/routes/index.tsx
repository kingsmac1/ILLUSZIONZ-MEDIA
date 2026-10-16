import { createFileRoute } from '@tanstack/react-router'
import Page from '../generated/Home'
import { seoHead } from '../seo'
import { homeHero } from '../cms/builtin'

export const Route = createFileRoute('/')({
  head: () => {
    const h = seoHead('home')
    // the first hero picture is the largest thing on the page: fetch it at top priority
    return { ...h, links: [...h.links, { rel: 'preload', as: 'image', href: homeHero[0], fetchPriority: 'high' }] }
  },
  component: Page,
})
