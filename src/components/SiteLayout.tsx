import type { ReactNode } from 'react'
import { MenuProvider } from './MenuContext'
import { MenuPopup } from './MenuPopup'
import { Footer } from './Footer'
import { NoticeBar } from './NoticeBar'
import HeaderBar from '../generated/HeaderBar'

export function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <MenuProvider>
      <div className="site-shell" id="top">
        <NoticeBar />
        <header className="site-header">
          <HeaderBar />
        </header>
        <main>{children}</main>
        <Footer />
      </div>
      <MenuPopup />
    </MenuProvider>
  )
}
