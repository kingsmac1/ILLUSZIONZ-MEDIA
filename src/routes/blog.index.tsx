import { createFileRoute } from '@tanstack/react-router'
import { BlogSlot } from '../components/BlogSlot'

// Rendered by functions/blog/index.ts; this route only lets the client router recognise /blog/ (no head tags, so the server's SEO tags are kept).
export const Route = createFileRoute('/blog/')({ component: BlogSlot })
