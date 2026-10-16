import { createFileRoute } from '@tanstack/react-router'
import { BlogSlot } from '../components/BlogSlot'

// Rendered by functions/blog/[slug].ts; the client router just recognises the URL and keeps the server-rendered article.
export const Route = createFileRoute('/blog/$slug')({ component: BlogSlot })
