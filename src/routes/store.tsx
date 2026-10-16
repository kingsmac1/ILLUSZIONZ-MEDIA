import { createFileRoute } from '@tanstack/react-router'
import Page from '../generated/Store'
import { seoHead } from '../seo'

export const Route = createFileRoute('/store')({
  head: () => seoHead('store'),
  component: Page,
})
