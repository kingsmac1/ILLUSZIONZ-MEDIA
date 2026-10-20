import { useEffect, useState } from 'react'
import { useData } from '../data'

const fmtTime = (ms: number) => new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

/** Always-visible confirmation for the Website pages: there is no Save button, every change saves the moment you make it. */
export function SaveStatus({ liveHref, liveLabel = 'View live page' }: { liveHref: string; liveLabel?: string }) {
  const { saved } = useData()
  const [, tick] = useState(0)
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 15000); return () => clearInterval(t) }, [])
  const secs = saved ? Math.floor((Date.now() - saved) / 1000) : 0
  const live = saved && secs >= 60
  return (
    <div className={'ad-savebar' + (saved ? ' is-saved' : '')} role="status" aria-live="polite">
      <span className="ad-savebar-dot" aria-hidden="true">{saved ? '✓' : 'i'}</span>
      <span className="ad-savebar-text">
        {saved ? (
          <><b>All changes saved</b> at {fmtTime(saved)} · {live ? 'live on the website now' : 'live on the website within about a minute'}</>
        ) : (
          <><b>Changes save automatically</b> — there is no Save button. A ✓ message confirms each change, and it goes live within about a minute.</>
        )}
      </span>
      <a className="ad-btn sm" href={liveHref} target="_blank" rel="noreferrer">{liveLabel} ↗</a>
    </div>
  )
}
