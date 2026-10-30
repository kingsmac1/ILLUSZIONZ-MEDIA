import { useData } from '../../../admin/data'
import { ago } from '../../../admin/ui'
import { useGalleryIndex } from './useGalleryIndex'

/** Overview widget: selections the client has submitted that still need finals. */
export function SelectionsWaiting() {
  const { d } = useData()
  const idx = useGalleryIndex()
  if (idx.missing || !idx.loadedAt) return null
  const finals = new Set(idx.galleries.filter((g) => g.kind === 'final' && g.status === 'delivered').map((g) => g.booking_id))
  const waiting = idx.galleries.filter((g) => g.kind === 'proof' && g.status === 'submitted' && !finals.has(g.booking_id)).sort((a, b) => (a.submitted_at ?? '').localeCompare(b.submitted_at ?? ''))
  return (
    <div className="ad-card" style={{ marginBottom: 16 }}>
      <h3>Selections waiting for you <small>{waiting.length ? 'oldest first' : ''}</small></h3>
      <div className="ad-list">
        {waiting.slice(0, 6).map((g) => {
          const b = d.bookings.find((x) => x.id === g.booking_id)
          return (
            <div key={g.id}>
              <a href={`#/bookings/${g.booking_id}/gallery`}><b>{g.client_name}</b> <span className="ad-muted">· {idx.stats.get(g.id)?.picks ?? 0} photos{b ? ` · ${String(b.kind).replace(/ booking$/i, '')}` : ''}</span></a>
              <span className="ad-muted">submitted {ago(g.submitted_at)}</span>
            </div>
          )
        })}
        {!waiting.length && <p className="ad-muted">No selections waiting — you’re all caught up.</p>}
      </div>
    </div>
  )
}
