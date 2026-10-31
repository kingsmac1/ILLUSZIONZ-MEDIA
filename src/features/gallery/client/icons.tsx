/** Gallery icons (inline SVG, inherit the text colour). */
export const Heart = ({ filled }: { filled: boolean }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.3-9.4C1.4 7.6 3.6 4 7.2 4c2 0 3.6 1.1 4.8 2.8C13.2 5.1 14.8 4 16.8 4c3.6 0 5.8 3.6 4.5 7.1-1.8 4.8-9.3 9.4-9.3 9.4z" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /></svg>
)
export const DownloadIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 19h14" /></svg>
)
export const Thumb = ({ down = false, filled = false }: { down?: boolean; filled?: boolean }) => (
  <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true" style={down ? { transform: 'rotate(180deg)' } : undefined}><path d="M7 10v10H4V10zM7 10l4-7c1.5 0 2.5 1.2 2.2 2.7L12.6 9H19a2 2 0 012 2.3l-1.2 7A2 2 0 0117.8 20H7" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /></svg>
)
export const CommentIcon = ({ filled = false }: { filled?: boolean }) => (
  <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z" />{filled ? <path d="M8 9h8M8 12h5" /> : null}</svg>
)
