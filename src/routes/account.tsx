import { createFileRoute } from '@tanstack/react-router'
import { lazy, Suspense, useEffect, useState } from 'react'

const AccountApp = lazy(() => import('../features/account/AccountApp'))

function AccountPage() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  // client-only: personal data, loaded in the browser after sign-in
  return mounted ? (
    <Suspense fallback={<div style={{ minHeight: '70vh' }} />}>
      <AccountApp />
    </Suspense>
  ) : <div style={{ minHeight: '70vh' }} />
}

export const Route = createFileRoute('/account')({
  head: () => ({
    meta: [{ title: 'My account · Illuszionz Media' }, { name: 'robots', content: 'noindex, nofollow' }],
    links: [{ rel: 'canonical', href: 'https://illuszionzmedia.com/account/' }],
  }),
  component: AccountPage,
})
