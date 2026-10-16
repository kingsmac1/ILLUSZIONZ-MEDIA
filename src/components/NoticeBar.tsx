import { useEffect, useState } from 'react'
import { useContent } from '../cms/content'

const TONES = { dark: ['#000', '#fff'], light: ['#f4f3ef', '#000'], gold: ['#b8941f', '#000'] } as const

/** Site-wide announcement banner, controlled from Dashboard → Site banner. */
export function NoticeBar() {
  const n = useContent()?.notice
  const [hidden, setHidden] = useState(true)
  const key = n ? 'notice:' + n.text : ''
  useEffect(() => {
    if (!n) return
    try { setHidden(sessionStorage.getItem(key) === '1') } catch { setHidden(false) }
  }, [n, key])
  if (!n || hidden) return null
  const [bg, fg] = TONES[n.tone] ?? TONES.dark
  const close = () => { setHidden(true); try { sessionStorage.setItem(key, '1') } catch { /* ignore */ } }
  return (
    <div role="region" aria-label="Announcement" style={{ background: bg, color: fg, fontFamily: 'Inter, sans-serif', fontSize: 14, lineHeight: 1.4, padding: '10px 48px 10px 16px', textAlign: 'center', position: 'relative' }}>
      <span>{n.text}</span>
      {n.link && <a href={n.link} style={{ color: fg, marginLeft: 10, fontWeight: 700, textDecoration: 'underline' }}>{n.label || 'Learn more'}</a>}
      <button type="button" onClick={close} aria-label="Dismiss announcement" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 0, color: fg, fontSize: 22, lineHeight: 1, cursor: 'pointer', padding: 6 }}>×</button>
    </div>
  )
}
