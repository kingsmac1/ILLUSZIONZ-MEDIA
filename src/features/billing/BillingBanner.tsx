import { useBilling } from './BillingProvider'
import { CTA_LABEL } from './format'

const TONE = { info: '#e8f1fb', warning: '#fdf3d7', danger: '#fbe4e1' } as const

/** One line above every admin page, written by the Emkay Digitals dashboard (what is due, by when). */
export function BillingBanner() {
  const { billing, active } = useBilling()
  const b = billing?.banner
  if (!active || !billing || !b) return null
  return (
    <div role="status" className="ad-note" style={{ marginBottom: 16, background: TONE[b.level] ?? TONE.info, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
      <span>{b.message}</span>
      <span style={{ display: 'flex', gap: 8 }}>
        {billing.pay_url && <a className="ad-btn primary sm" href={billing.pay_url} target="_blank" rel="noreferrer">{CTA_LABEL[b.cta] ?? 'Open billing'}</a>}
        <a className="ad-btn sm" href="#/billing">Billing</a>
      </span>
    </div>
  )
}
