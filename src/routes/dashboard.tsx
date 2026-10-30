import { createFileRoute } from '@tanstack/react-router'
import { lazy, Suspense, useEffect, useState } from 'react'
import { Preloader } from '../components/Preloader'

const AdminApp = lazy(() => import('../admin/AdminApp'))

function AdminPage() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  // client-only: the dashboard is never rendered on the server and is not indexed
  return mounted ? (
    <Suspense fallback={<Preloader />}>
      <AdminApp />
    </Suspense>
  ) : null
}

export const Route = createFileRoute('/dashboard')({
  head: () => ({
    meta: [{ title: 'Dashboard · Illuszionz Media' }, { name: 'robots', content: 'noindex, nofollow' }],
  }),
  component: AdminPage,
})
