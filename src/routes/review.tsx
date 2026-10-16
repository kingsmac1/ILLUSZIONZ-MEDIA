import { createFileRoute } from '@tanstack/react-router'
import Page from '../generated/Review'
import { seoHead } from '../seo'

export const Route = createFileRoute('/review')({
  head: () => seoHead('review'),
  component: Page,
})
