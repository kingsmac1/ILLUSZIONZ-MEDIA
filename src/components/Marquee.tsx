const WORDS = ['Photography', 'Videography', 'Weddings', '360 Booth', 'Academy', 'Creative Agency', 'Portraits', 'Events']

/** Infinite service ticker (pure CSS, pauses on hover, static for reduced-motion). */
export function Marquee() {
  const group = (key: string) => (
    <div className="mq-group" aria-hidden={key === 'b'} key={key}>
      {WORDS.map((w) => (
        <span key={w} style={{ display: 'contents' }}>
          <span className="mq-item">{w}</span>
          <i className="mq-dot" />
        </span>
      ))}
    </div>
  )
  return (
    <div className="mq" role="region" aria-label="What we do">
      <div className="mq-track">{[group('a'), group('b')]}</div>
    </div>
  )
}
