import { createFileRoute } from '@tanstack/react-router'
import Page from '../generated/Agency'
import { seoHead } from '../seo'

export const Route = createFileRoute('/agency')({
  head: () => seoHead('agency'),
  component: Page,
})
