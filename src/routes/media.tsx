import { createFileRoute } from '@tanstack/react-router'
import Page from '../generated/Media'
import { seoHead } from '../seo'

export const Route = createFileRoute('/media')({
  head: () => seoHead('media'),
  component: Page,
})
