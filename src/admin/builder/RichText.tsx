import { useEffect, useRef, useState } from 'react'

/** Small WYSIWYG (contentEditable + execCommand) with a raw-HTML toggle — no extra dependency. */
export function RichText({ value, onChange, minHeight = 96 }: { value: string; onChange: (html: string) => void; minHeight?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [source, setSource] = useState(false)

  useEffect(() => {
    if (!source && ref.current && ref.current.innerHTML !== value) ref.current.innerHTML = value
    // sync only when (re)entering visual mode — never on each keystroke, which would reset the caret
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source])

  const exec = (cmd: string, arg?: string) => {
    ref.current?.focus()
    document.execCommand(cmd, false, arg)
    onChange(ref.current?.innerHTML ?? '')
  }
  const tools: [string, string, () => void, string?][] = [
    ['B', 'Bold', () => exec('bold'), 'font-weight:800'],
    ['I', 'Italic', () => exec('italic'), 'font-style:italic'],
    ['U', 'Underline', () => exec('underline'), 'text-decoration:underline'],
    ['•', 'Bullet list', () => exec('insertUnorderedList')],
    ['1.', 'Numbered list', () => exec('insertOrderedList')],
    ['🔗', 'Link', () => { const u = window.prompt('Link URL (include https://):'); if (u) exec('createLink', u) }],
    ['⌫', 'Clear formatting', () => exec('removeFormat')],
  ]
  return (
    <div className="ab-rich">
      <div className="ab-rich-bar" onMouseDown={(e) => e.preventDefault()}>
        {!source && tools.map(([t, label, fn, style]) => (
          <button type="button" key={label} title={label} aria-label={label} onClick={fn} style={style ? Object.fromEntries(style.split(';').map((x) => x.split(':'))) : undefined}>{t}</button>
        ))}
        <button type="button" className="src" onClick={() => setSource(!source)}>{source ? 'Visual' : '</> HTML'}</button>
      </div>
      {source ? (
        <textarea className="ab-rich-src" value={value} onChange={(e) => onChange(e.target.value)} style={{ minHeight }} spellCheck={false} />
      ) : (
        <div ref={ref} className="ab-rich-edit" contentEditable suppressContentEditableWarning style={{ minHeight }} onInput={() => onChange(ref.current?.innerHTML ?? '')} />
      )}
    </div>
  )
}
