import { createFileRoute } from '@tanstack/react-router'
import Page from '../generated/Form'
import { seoHead } from '../seo'

export const Route = createFileRoute('/form')({
  head: () => seoHead('form'),
  component: Page,
})
