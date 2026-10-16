import { createFileRoute } from '@tanstack/react-router'
import Page from '../generated/Home'
import { seoHead } from '../seo'

export const Route = createFileRoute('/')({
  head: () => seoHead('home'),
  component: Page,
})
