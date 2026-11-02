import { PageHead } from '../../admin/ui'
import { useBilling } from './BillingProvider'
import { fmtDay } from './format'

/** Shown in place of Galleries while the dashboard says galleries are paused. Clients only ever see "temporarily unavailable". */
export function GalleryPaywall() {
  const { billing } = useBilling()
  if (!billing) return null
  return (
    <>
      <PageHead title="Galleries" />
      <div className="ad-card" style={{ maxWidth: 640 }}>
        <h3>Client galleries are paused</h3>
        <p className="ad-muted" style={{ margin: '8px 0 16px' }}>
          Your gallery plan needs attention. While it is paused your clients see “This gallery is temporarily unavailable”, and nothing can be uploaded or opened.
          {billing.purge_due_at && <> Your photos are kept until <b>{fmtDay(billing.purge_due_at)}</b>.</>} Settle it and everything comes back exactly as it was.
        </p>
        <div className="ad-actions">
          {billing.pay_url && <a className="ad-btn primary" href={billing.pay_url} target="_blank" rel="noreferrer">Pay now</a>}
          <a className="ad-btn" href="#/billing">See billing details</a>
        </div>
      </div>
    </>
  )
}
