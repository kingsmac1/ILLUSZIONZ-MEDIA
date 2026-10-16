import { createFileRoute } from '@tanstack/react-router'
import Page from '../generated/Contact'
import { seoHead } from '../seo'

export const Route = createFileRoute('/contact')({
  head: () => seoHead('contact'),
  component: Page,
})
