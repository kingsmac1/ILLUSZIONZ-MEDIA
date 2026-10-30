import { createFileRoute } from '@tanstack/react-router'
import { lazy, Suspense, useEffect, useState } from 'react'

const GalleryPage = lazy(() => import('../features/gallery/client/GalleryPage'))

function Gallery() {
  const { galleryId } = Route.useParams()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  // client-only: private, rendered in the browser after sign-in (the prerendered shell is served by functions/gallery/[id].ts)
  return mounted ? (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#000' }} />}>
      <GalleryPage id={galleryId} />
    </Suspense>
  ) : <div style={{ minHeight: '100vh', background: '#000' }} />
}

export const Route = createFileRoute('/gallery/$galleryId')({
  head: () => ({
    meta: [{ title: 'Your gallery · Illuszionz Media' }, { name: 'robots', content: 'noindex, nofollow' }, { name: 'referrer', content: 'same-origin' }],
  }),
  component: Gallery,
})
