import { Modal, gbp } from '../../admin/ui'

/** Link to a booking's invoice. It reuses the booking's invoice when it has one; `send` opens the email step straight away. */
export const bookingInvoiceHref = (bookingId: string, send = false) => `#/invoices/booking/${bookingId}${send ? '/send' : ''}`

/** Asked after every payment that is recorded: does the client get an updated invoice? */
export function InvoicePrompt({ bookings, onClose }: { bookings: { id: string; name: string; paid: number; total: number }[]; onClose: () => void }) {
  const one = bookings.length === 1 ? bookings[0] : null
  return (
    <Modal title={one ? 'Payment recorded' : `${bookings.length} payments recorded`} onClose={onClose}>
      {one ? (
        <>
          <p>{one.name} has now paid <b>{gbp(one.paid)}</b>{one.total > 0 ? <> of <b>{gbp(one.total)}</b></> : null}. Do you want to send them an updated invoice?</p>
          <div className="ad-formfoot" style={{ marginTop: 18 }}>
            <button className="ad-btn" onClick={onClose}>Not now</button>
            <a className="ad-btn primary" href={bookingInvoiceHref(one.id, true)} onClick={onClose}>Send invoice</a>
          </div>
        </>
      ) : (
        <>
          <p style={{ marginBottom: 12 }}>Do you want to send these clients an updated invoice? Each one opens in a new tab.</p>
          <div className="ad-list">
            {bookings.map((b) => (
              <div key={b.id}>
                <span><b>{b.name}</b> <span className="ad-muted">paid {gbp(b.paid)}</span></span>
                <a className="ad-btn sm" href={bookingInvoiceHref(b.id, true)} target="_blank" rel="noreferrer">Send invoice</a>
              </div>
            ))}
          </div>
          <div className="ad-formfoot" style={{ marginTop: 18 }}><button className="ad-btn" onClick={onClose}>Not now</button></div>
        </>
      )}
    </Modal>
  )
}
