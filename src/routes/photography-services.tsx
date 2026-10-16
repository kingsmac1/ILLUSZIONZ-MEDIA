import { createFileRoute } from '@tanstack/react-router'
import Page from '../generated/PhotographyServices'
import { seoHead } from '../seo'

export const Route = createFileRoute('/photography-services')({
  head: () => seoHead('photography-services'),
  component: Page,
})
