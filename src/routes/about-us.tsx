import { createFileRoute } from '@tanstack/react-router'
import Page from '../generated/AboutUs'
import { seoHead } from '../seo'

export const Route = createFileRoute('/about-us')({
  head: () => seoHead('about-us'),
  component: Page,
})
