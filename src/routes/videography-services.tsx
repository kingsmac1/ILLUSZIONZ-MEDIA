import { createFileRoute } from '@tanstack/react-router'
import Page from '../generated/VideographyServices'
import { seoHead } from '../seo'

export const Route = createFileRoute('/videography-services')({
  head: () => seoHead('videography-services'),
  component: Page,
})
