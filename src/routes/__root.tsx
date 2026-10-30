/// <reference types="vite/client" />
import { HeadContent, Outlet, Scripts, createRootRoute, useRouterState } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import appCss from '../styles.css?url'
import { SiteLayout } from '../components/SiteLayout'
import { jsonLd } from '../seo'
import { motionPreCss, motionPreScript } from '../motion/targets'
import { Preloader, preloaderFailsafe } from '../components/Preloader'

export const Route = createRootRoute({
  head: () => ({
    meta: [{ charSet: 'utf-8' }, { name: 'viewport', content: 'width=device-width, initial-scale=1' }],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'preload', as: 'font', type: 'font/woff2', href: '/fonts/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa1ZL7W0Q5nw.woff2', crossOrigin: 'anonymous' },
      { rel: 'preload', as: 'font', type: 'font/woff2', href: '/fonts/nuFiD-vYSZviVYUb_rj3ij__anPXDTzYgEM86xQ.woff2', crossOrigin: 'anonymous' },
      { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
      { rel: 'icon', href: '/favicon-32.png', type: 'image/png', sizes: '32x32' },
      { rel: 'apple-touch-icon', href: '/apple-touch-icon.png', sizes: '180x180' },
    ],
    styles: [{ children: motionPreCss }],
    scripts: [{ children: motionPreScript }, { children: preloaderFailsafe }, { type: 'application/ld+json', children: JSON.stringify(jsonLd) }],
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

import CookieConsent from '../components/CookieConsent'

function RootComponent() {
  // the dashboard and the client gallery render without the site header/footer
  const admin = useRouterState({ select: (s) => s.location.pathname.startsWith('/dashboard') || s.location.pathname.startsWith('/gallery') })
  return (
    <html lang="en-US">
      <head>
        <HeadContent />
        <noscript><style>{'.ilz-pl-boot{display:none}'}</style></noscript>
      </head>
      <body>
        <Preloader boot />
        {admin ? (
          <Outlet />
        ) : (
          <SiteLayout>
            <Outlet />
          </SiteLayout>
        )}
        {!admin && <CookieConsent />}
        <Scripts />
      </body>
    </html>
  )
}
