/// <reference types="vite/client" />
import { HeadContent, Outlet, Scripts, createRootRoute, useRouterState } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import appCss from '../styles.css?url'
import { SiteLayout } from '../components/SiteLayout'
import { jsonLd } from '../seo'
import { motionPreCss, motionPreScript } from '../motion/targets'

export const Route = createRootRoute({
  head: () => ({
    meta: [{ charSet: 'utf-8' }, { name: 'viewport', content: 'width=device-width, initial-scale=1' }],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
    ],
    styles: [{ children: motionPreCss }],
    scripts: [{ children: motionPreScript }, { type: 'application/ld+json', children: JSON.stringify(jsonLd) }],
  }),
  component: RootComponent,
  notFoundComponent: NotFound,
})

function NotFound() {
  return (
    <section style={{ padding: '120px 30px', textAlign: 'center', fontFamily: "'Playfair Display', serif" }}>
      <h1 style={{ fontSize: 48, fontWeight: 500, margin: 0 }}>Page not found</h1>
      <p style={{ fontFamily: 'Inter, sans-serif', color: '#525252' }}>The page you are looking for does not exist.</p>
      <a href="/" style={{ fontFamily: 'Inter, sans-serif', color: '#000', borderBottom: '1px solid #000', textDecoration: 'none' }}>Back to home</a>
    </section>
  )
}

function RootComponent() {
  const admin = useRouterState({ select: (s) => s.location.pathname.startsWith('/dashboard') })
  return (
    <html lang="en-US">
      <head>
        <HeadContent />
      </head>
      <body>
        {admin ? (
          <Outlet />
        ) : (
          <SiteLayout>
            <Outlet />
          </SiteLayout>
        )}
        <Scripts />
      </body>
    </html>
  )
}
