import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  return createRouter({
    routeTree,
    scrollRestoration: true,
    trailingSlash: 'always',
    defaultPreload: 'intent',
    // crossfade between pages only; hash-only changes (dashboard sections, #book- links) navigate without a transition
    defaultViewTransition: { types: ({ fromLocation, toLocation }) => (fromLocation && fromLocation.pathname !== toLocation.pathname ? ['page'] : false) },
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
