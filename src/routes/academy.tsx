import { createFileRoute } from '@tanstack/react-router'
import Page from '../generated/Academy'
import { seoHead } from '../seo'

export const Route = createFileRoute('/academy')({
  head: () => seoHead('academy'),
  component: Page,
})
