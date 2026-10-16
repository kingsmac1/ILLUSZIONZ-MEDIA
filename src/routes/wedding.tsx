import { createFileRoute } from '@tanstack/react-router'
import Page from '../generated/Wedding'
import { seoHead } from '../seo'

export const Route = createFileRoute('/wedding')({
  head: () => seoHead('wedding'),
  component: Page,
})
