import { Badge, PageHead } from '../../admin/ui'
import { useBilling } from './BillingProvider'
import { CTA_LABEL, fmtBytes, fmtDay, fmtNaira } from './format'

const STATUS: Record<string, { label: string; tone: string }> = {
  trial: { label: 'Free trial', tone: 'blue' },
  awaiting_payment: { label: 'Choose a plan', tone: 'gold' },
  active: { label: 'Active', tone: 'green' },
  grace: { label: 'Payment late', tone: 'gold' },
  locked: { label: 'Paused', tone: 'red' },
  purged: { label: 'Photos removed', tone: 'red' },
  cancelled: { label: 'Cancelled', tone: 'grey' },
}

function Row({ k, v }: { k: string; v: string | null }) {
  if (!v || v === '—') return null
  return <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24, padding: '9px 0', borderBottom: '1px solid var(--line, #e6e3dc)' }}><span className="ad-muted">{k}</span><b style={{ textAlign: 'right' }}>{v}</b></div>
}

export function BillingSection() {
  const { billing: b, active, refresh, loading } = useBilling()
  if (!active || !b) return <><PageHead title="Billing" /><p className="ad-muted">Billing is not switched on for this site.</p></>
  const st = STATUS[b.status] ?? { label: b.status, tone: 'grey' }
  const pct = b.limit_bytes ? Math.min(100, (b.used_bytes / b.limit_bytes) * 100) : 0
  return (
    <>
      <PageHead title="Billing" sub="Your client gallery plan" />
      {b.stale && <p className="ad-muted" style={{ marginBottom: 12 }}>Showing the last answer we received, the billing service could not be reached just now.</p>}
      <div className="ad-card" style={{ maxWidth: 760 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <h3>{b.plan ? b.plan.name : 'No plan yet'}</h3>
            {b.plan && <p className="ad-muted">{b.plan.limit_gb >= 1000 ? `${b.plan.limit_gb / 1000} TB` : `${b.plan.limit_gb} GB`} · ${b.plan.price_usd}/month · {fmtNaira(b.plan.price_ngn)} today</p>}
          </div>
          <Badge tone={st.tone}>{st.label}</Badge>
        </div>

        <div style={{ marginTop: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Storage used</span><span>{fmtBytes(b.used_bytes)} of {fmtBytes(b.limit_bytes)}</span></div>
          <div role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} style={{ height: 8, background: '#e5e2da', marginTop: 8, borderRadius: 4 }}>
            <div style={{ height: 8, width: `${pct}%`, borderRadius: 4, background: pct >= 100 ? '#c0392b' : pct >= 90 ? '#d9962b' : '#111' }} />
          </div>
          {!b.uploads_allowed && b.gallery_enabled && <p style={{ marginTop: 8, color: '#b42318' }}>Storage is full, so uploads are paused. Upgrade your plan to add more photos.</p>}
        </div>

        <div style={{ marginTop: 18 }}>
          <Row k="Free trial ends" v={b.status === 'trial' ? fmtDay(b.trial_ends_at) : null} />
          <Row k="Choose a plan by" v={b.status === 'awaiting_payment' ? fmtDay(b.signup_deadline) : null} />
          <Row k="Paid until" v={fmtDay(b.paid_until)} />
          <Row k="Grace period ends" v={b.status === 'grace' ? fmtDay(b.grace_ends_at) : null} />
          <Row k="Paused since" v={fmtDay(b.locked_at)} />
          <Row k="Photos kept until" v={b.status === 'locked' ? fmtDay(b.purge_due_at) : null} />
        </div>

        <div className="ad-actions" style={{ marginTop: 18 }}>
          {b.pay_url && <a className="ad-btn primary" href={b.pay_url} target="_blank" rel="noreferrer">{CTA_LABEL[b.banner?.cta ?? ''] ?? (b.status === 'active' ? 'Change plan or pay' : 'Open payment page')}</a>}
          {b.manage_card_url && <a className="ad-btn" href={b.manage_card_url} target="_blank" rel="noreferrer">Manage card</a>}
          <button className="ad-btn" onClick={() => void refresh()} disabled={loading}>{loading ? 'Checking…' : 'Refresh'}</button>
        </div>
      </div>

      <div className="ad-card" style={{ maxWidth: 760, marginTop: 16 }}>
        <h3>Payments</h3>
        {b.payments.length === 0 ? <p className="ad-muted" style={{ marginTop: 8 }}>No payments yet.</p> : (
          <div className="ad-tablewrap" style={{ marginTop: 10 }}><table>
            <thead><tr><th>Date</th><th>Amount</th><th>Method</th><th>Status</th><th>Covers until</th></tr></thead>
            <tbody>{b.payments.map((p, i) => <tr key={i}><td>{fmtDay(p.created_at)}</td><td>{fmtNaira(p.amount_ngn)}</td><td>{p.channel}</td><td>{p.status}</td><td>{fmtDay(p.period_end)}</td></tr>)}</tbody>
          </table></div>
        )}
      </div>
    </>
  )
}
