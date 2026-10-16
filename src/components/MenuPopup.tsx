import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useRouterState } from '@tanstack/react-router'
import { A } from './A'
import { useMenu } from './MenuContext'
import { site, whatsappLink } from '../site'
import './full-menu.css'

type Item = { label: string; href?: string; children?: Item[] }

const MENU: Item[] = [
  { label: 'Home', href: '/' },
  { label: 'About', href: '/about-us/' },
  {
    label: 'Media Services',
    children: [
      { label: 'Portrait Photography', href: '/photography-services/' },
      { label: 'Wedding Photography', href: '/wedding/' },
      { label: 'Videography', href: '/videography-services/' },
      { label: '360 Photo Booth', href: '/360-photo-booth/' },
    ],
  },
  { label: 'Academy', href: '/academy/' },
  { label: 'Agency', href: '/agency/' },
  { label: 'Careers', href: '/careers/' },
  { label: 'Store', href: '/store/' },
  { label: 'Contact', href: '/contact/' },
]

const EASE = [0.76, 0, 0.24, 1] as const

/** Full-screen black menu: slides in from the right, slides back out to the right. */
export function MenuPopup() {
  const { open, closeMenu } = useMenu()
  const path = useRouterState({ select: (s) => s.location.pathname })
  const [sub, setSub] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const t = setTimeout(() => closeRef.current?.focus(), 400)
    return () => {
      document.body.style.overflow = prev
      clearTimeout(t)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    // keep the submenu open when you are on one of its pages
    setSub(MENU.some((m) => m.children?.some((c) => c.href && path.startsWith(c.href))))
  }, [open, path])

  const isActive = (href?: string) => !!href && (href === '/' ? path === '/' : path.startsWith(href.replace(/\/$/, '')))

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fm"
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ duration: 0.75, ease: EASE }}
        >
          <div className="fm-top">
            <A href="/" className="fm-logo" onClick={() => closeMenu()} aria-label={`${site.name} home`}>
              <img src="/images/illuszionz-logo-white.png" alt="" width={170} height={47} />
            </A>
            <button ref={closeRef} type="button" className="fm-close" onClick={() => closeMenu()} aria-label="Close menu">
              <span>Close</span>
              <i aria-hidden="true" />
            </button>
          </div>

          <div className="fm-body">
            <nav className="fm-nav" aria-label="Main">
              <ol>
                {MENU.map((it, n) => (
                  <motion.li
                    key={it.label}
                    initial={{ y: 70, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.38 + n * 0.055, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                  >
                    {it.children ? (
                      <>
                        <button type="button" className={'fm-link' + (sub ? ' is-open' : '')} aria-expanded={sub} onClick={() => setSub((s) => !s)}>
                          <small>{String(n + 1).padStart(2, '0')}</small>
                          <span>{it.label}</span>
                          <b aria-hidden="true">{sub ? '−' : '+'}</b>
                        </button>
                        <AnimatePresence initial={false}>
                          {sub && (
                            <motion.ul
                              className="fm-sub"
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                            >
                              {it.children.map((c) => (
                                <li key={c.label}>
                                  <A href={c.href} className={'fm-sublink' + (isActive(c.href) ? ' is-active' : '')} onClick={() => closeMenu()}>
                                    {c.label}
                                    <b aria-hidden="true">↗</b>
                                  </A>
                                </li>
                              ))}
                            </motion.ul>
                          )}
                        </AnimatePresence>
                      </>
                    ) : (
                      <A href={it.href} className={'fm-link' + (isActive(it.href) ? ' is-active' : '')} aria-current={isActive(it.href) ? 'page' : undefined} onClick={() => closeMenu()}>
                        <small>{String(n + 1).padStart(2, '0')}</small>
                        <span>{it.label}</span>
                        <b aria-hidden="true">↗</b>
                      </A>
                    )}
                  </motion.li>
                ))}
              </ol>
            </nav>

            <motion.aside
              className="fm-side"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            >
              <p className="fm-eyebrow">Let’s create together</p>
              <A href="/photography-services/" className="fm-cta" onClick={() => closeMenu()}>
                Book a session <span aria-hidden="true">→</span>
              </A>
              <div className="fm-block">
                <p className="fm-eyebrow">Contact</p>
                <a href={`tel:${site.phone}`}>{site.phoneDisplay}</a>
                <a href={whatsappLink()} target="_blank" rel="noreferrer">WhatsApp us</a>
                <a href={`mailto:${site.email}`}>{site.email}</a>
              </div>
              <div className="fm-block">
                <p className="fm-eyebrow">Follow</p>
                <div className="fm-social">
                  <a href={site.instagram} target="_blank" rel="noreferrer">Instagram</a>
                  <a href={site.facebook} target="_blank" rel="noreferrer">Facebook</a>
                  <a href={site.x} target="_blank" rel="noreferrer">X</a>
                </div>
              </div>
            </motion.aside>
          </div>
          <p className="fm-foot">© {new Date().getFullYear()} {site.shortName}</p>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
