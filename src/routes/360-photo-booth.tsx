import { createFileRoute } from '@tanstack/react-router'
import Page from '../generated/PhotoBooth360'
import { seoHead } from '../seo'

export const Route = createFileRoute('/360-photo-booth')({
  head: () => seoHead('360-photo-booth'),
  component: Page,
})
