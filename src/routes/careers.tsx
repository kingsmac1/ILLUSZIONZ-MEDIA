import { createFileRoute } from '@tanstack/react-router'
import Page from '../generated/Careers'
import { seoHead } from '../seo'

export const Route = createFileRoute('/careers')({
  head: () => seoHead('careers'),
  component: Page,
})
