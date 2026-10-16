import { useEffect, useRef, useState } from 'react'
import { supabase } from '../supabase'
import { useData, type R } from '../data'
import { BLOCK_LABELS, SOCIAL_LINKS, makeBlock, regenerateIds, type BlockAlign, type BlockType, type EmailBlock, type NestedColumnBlock } from '../../server/emailBlocks'
import { RichText } from './RichText'
import './builder.css'

const PALETTE: { type: BlockType; icon: string }[] = [
  { type: 'heading', icon: 'H' }, { type: 'paragraph', icon: '¶' }, { type: 'image', icon: '🖼' }, { type: 'button', icon: '▭' },
  { type: 'divider', icon: '—' }, { type: 'spacer', icon: '↕' }, { type: 'social', icon: '@' }, { type: 'columns', icon: '▥' },
]
const NESTED = ['heading', 'paragraph', 'button'] as const
const COLORS = ['#0a0a0a', '#b8941f', '#1f4d2c', '#7c3aed', '#dc2626']

function Align({ value, onChange }: { value: BlockAlign; onChange: (a: BlockAlign) => void }) {
  return <div className="ab-seg">{(['left', 'center', 'right'] as const).map((a) => <button type="button" key={a} className={value === a ? 'on' : ''} onClick={() => onChange(a)}>{a}</button>)}</div>
}

function Nested({ b, onUpdate }: { b: NestedColumnBlock; onUpdate: (p: Record<string, unknown>) => void }) {
  if (b.type === 'heading') return <input className="ab-plain strong" value={b.text} placeholder="Heading" onChange={(e) => onUpdate({ text: e.target.value })} />
  if (b.type === 'paragraph')
    return <textarea className="ab-plain" rows={3} placeholder="Text…" value={b.html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')} onChange={(e) => onUpdate({ html: e.target.value.split('\n').map((l) => l.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!)).join('<br/>') })} />
  return <div className="ab-col-btn"><input value={b.label} placeholder="Button label" onChange={(e) => onUpdate({ label: e.target.value })} /><input value={b.link} placeholder="https://" onChange={(e) => onUpdate({ link: e.target.value })} /></div>
}

function Preview({ b, onUpdate, uploading, onFile }: { b: EmailBlock; onUpdate: (p: Record<string, unknown>) => void; uploading: boolean; onFile: (f: File) => void }) {
  const file = useRef<HTMLInputElement>(null)
  switch (b.type) {
    case 'heading':
      return <input className="ab-heading" value={b.text} placeholder="Your headline here" onChange={(e) => onUpdate({ text: e.target.value })} style={{ fontSize: b.level === 'h1' ? 28 : b.level === 'h2' ? 22 : 18, textAlign: b.align }} />
    case 'paragraph':
      return <RichText value={b.html} onChange={(html) => onUpdate({ html })} />
    case 'image':
      return (
        <div style={{ textAlign: b.align }}>
          {b.src ? <img src={b.src} alt={b.alt} style={{ width: `${b.width}%`, maxWidth: '100%', borderRadius: 10 }} /> : (
            <button type="button" className="ab-drop" onClick={() => file.current?.click()} disabled={uploading}>{uploading ? 'Uploading…' : '⬆ Click to upload an image (or paste a link in the settings)'}</button>
          )}
          <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = '' }} />
        </div>
      )
    case 'button':
      return <div style={{ textAlign: b.align }}><span className="ab-btn-prev" style={{ background: b.color }}>{b.label || 'Click here'}</span></div>
    case 'divider':
      return <hr style={{ border: 'none', borderTop: `${b.thickness}px solid ${b.color}`, margin: `${b.spacing}px 0` }} />
    case 'spacer':
      return <div className="ab-spacer" style={{ height: Math.max(b.height, 22) }}>{b.height}px</div>
    case 'social':
      return <div style={{ textAlign: b.align }}>{SOCIAL_LINKS.map((s) => <span key={s.label} className="ab-social">{s.label}</span>)}</div>
    case 'columns': {
      const set = (cols: NestedColumnBlock[][]) => onUpdate({ columns: cols })
      return (
        <div className="ab-cols" style={{ gridTemplateColumns: `repeat(${b.columns.length}, 1fr)` }}>
          {b.columns.map((col, ci) => (
            <div key={ci} className="ab-cell">
              {col.map((n) => (
                <div key={n.id} className="ab-nested">
                  <button type="button" className="ab-nx" aria-label="Remove" onClick={(e) => { e.stopPropagation(); set(b.columns.map((c, i) => (i === ci ? c.filter((x) => x.id !== n.id) : c))) }}>×</button>
                  <Nested b={n} onUpdate={(p) => set(b.columns.map((c, i) => (i === ci ? c.map((x) => (x.id === n.id ? ({ ...x, ...p } as NestedColumnBlock) : x)) : c)))} />
                </div>
              ))}
              <div className="ab-addrow">{NESTED.map((t) => <button type="button" key={t} onClick={(e) => { e.stopPropagation(); set(b.columns.map((c, i) => (i === ci ? [...c, makeBlock(t) as NestedColumnBlock] : c))) }}>+ {BLOCK_LABELS[t]}</button>)}</div>
            </div>
          ))}
        </div>
      )
    }
  }
}

function Settings({ b, onUpdate }: { b: EmailBlock; onUpdate: (p: Record<string, unknown>) => void }) {
  const L = (t: string) => <span className="ab-lab">{t}</span>
  switch (b.type) {
    case 'heading':
      return <div className="ab-set">{L('Size')}<div className="ab-seg">{(['h1', 'h2', 'h3'] as const).map((l) => <button type="button" key={l} className={b.level === l ? 'on' : ''} onClick={() => onUpdate({ level: l })}>{l === 'h1' ? 'Large' : l === 'h2' ? 'Medium' : 'Small'}</button>)}</div>{L('Align')}<Align value={b.align} onChange={(align) => onUpdate({ align })} /></div>
    case 'paragraph':
      return <p className="ab-hint">Use the toolbar above the text for bold, italic, lists and links. Type <code>{'{{first_name}}'}</code> to personalise.</p>
    case 'image':
      return <div className="ab-set">{L('Image link (URL)')}<input value={b.src} onChange={(e) => onUpdate({ src: e.target.value })} placeholder="https://…" />{L('Alt text')}<input value={b.alt} onChange={(e) => onUpdate({ alt: e.target.value })} />{L('Click goes to (optional)')}<input value={b.link} onChange={(e) => onUpdate({ link: e.target.value })} placeholder="https://" />{L(`Width — ${b.width}%`)}<input type="range" min={20} max={100} step={5} value={b.width} onChange={(e) => onUpdate({ width: Number(e.target.value) })} />{L('Align')}<Align value={b.align} onChange={(align) => onUpdate({ align })} />{b.src && <button type="button" className="ab-link" onClick={() => onUpdate({ src: '' })}>Remove image</button>}</div>
    case 'button':
      return <div className="ab-set">{L('Label')}<input value={b.label} onChange={(e) => onUpdate({ label: e.target.value })} />{L('Link')}<input value={b.link} onChange={(e) => onUpdate({ link: e.target.value })} placeholder="https://" />{L('Colour')}<div className="ab-swatches"><input type="color" value={b.color} onChange={(e) => onUpdate({ color: e.target.value })} />{COLORS.map((c) => <button type="button" key={c} style={{ background: c }} onClick={() => onUpdate({ color: c })} aria-label={c} />)}</div>{L('Align')}<Align value={b.align} onChange={(align) => onUpdate({ align })} /></div>
    case 'divider':
      return <div className="ab-set">{L('Colour')}<input type="color" value={b.color} onChange={(e) => onUpdate({ color: e.target.value })} />{L(`Thickness — ${b.thickness}px`)}<input type="range" min={1} max={6} value={b.thickness} onChange={(e) => onUpdate({ thickness: Number(e.target.value) })} />{L(`Spacing — ${b.spacing}px`)}<input type="range" min={0} max={60} step={4} value={b.spacing} onChange={(e) => onUpdate({ spacing: Number(e.target.value) })} /></div>
    case 'spacer':
      return <div className="ab-set">{L(`Height — ${b.height}px`)}<input type="range" min={8} max={80} step={4} value={b.height} onChange={(e) => onUpdate({ height: Number(e.target.value) })} /></div>
    case 'social':
      return <div className="ab-set">{L('Align')}<Align value={b.align} onChange={(align) => onUpdate({ align })} /><p className="ab-hint">Links to the studio's Instagram, Facebook and X accounts.</p></div>
    case 'columns':
      return <div className="ab-set">{L('Layout')}<div className="ab-seg">{[2, 3].map((n) => <button type="button" key={n} className={b.columns.length === n ? 'on' : ''} onClick={() => onUpdate({ columns: Array.from({ length: n }, (_, i) => b.columns[i] ?? []) })}>{n} columns</button>)}</div><p className="ab-hint">Add a heading, text or button to each column directly in the canvas.</p></div>
  }
}

/** Palette (left) · live canvas (middle, drag to reorder) · selected block's settings (right). */
export function EmailBuilder({ blocks, onChange }: { blocks: EmailBlock[]; onChange: (b: EmailBlock[]) => void }) {
  const { toast } = useData()
  const [sel, setSel] = useState<string | null>(null)
  const [width, setWidth] = useState<'desktop' | 'mobile'>('desktop')
  const [uploading, setUploading] = useState<string | null>(null)
  const [tab, setTab] = useState<'blocks' | 'saved'>('blocks')
  const [sections, setSections] = useState<R[]>([])
  const drag = useRef<number | null>(null)
  const [over, setOver] = useState<number | null>(null)

  const loadSections = () => supabase!.from('email_sections').select('*').order('created_at', { ascending: false }).then(({ data }) => setSections(data ?? []))
  useEffect(() => { loadSections() }, [])

  const selected = blocks.find((b) => b.id === sel) ?? null
  const update = (id: string, patch: Record<string, unknown>) => onChange(blocks.map((b) => (b.id === id ? ({ ...b, ...patch } as EmailBlock) : b)))
  const add = (t: BlockType) => { const b = makeBlock(t); onChange([...blocks, b]); setSel(b.id) }
  const remove = (id: string) => { onChange(blocks.filter((b) => b.id !== id)); if (sel === id) setSel(null) }
  const dup = (id: string) => { const i = blocks.findIndex((b) => b.id === id); if (i < 0) return; const next = [...blocks]; next.splice(i + 1, 0, regenerateIds([blocks[i]])[0]); onChange(next) }
  const move = (id: string, d: -1 | 1) => { const i = blocks.findIndex((b) => b.id === id); const j = i + d; if (i < 0 || j < 0 || j >= blocks.length) return; const n = [...blocks]; [n[i], n[j]] = [n[j], n[i]]; onChange(n) }
  const reorder = (from: number, to: number) => { if (from === to) return; const n = [...blocks]; const [m] = n.splice(from, 1); n.splice(to, 0, m); onChange(n) }

  async function upload(id: string, file: File) {
    setUploading(id)
    try {
      const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${file.name.replace(/[^\w.\-]/g, '_')}`
      const { error } = await supabase!.storage.from('email-images').upload(path, file, { contentType: file.type })
      if (error) throw error
      update(id, { src: supabase!.storage.from('email-images').getPublicUrl(path).data.publicUrl })
    } catch (e) {
      toast(`Upload failed (${e instanceof Error ? e.message : 'error'}). Paste an image link in the settings instead.`, 'err')
      setSel(id)
    } finally { setUploading(null) }
  }
  async function saveSection() {
    if (!blocks.length) return
    const name = window.prompt('Name this layout (e.g. “Monthly newsletter”):')?.trim()
    if (!name) return
    const { error } = await supabase!.from('email_sections').insert({ name, blocks })
    if (error) return toast(error.message, 'err')
    toast('Layout saved'); loadSections()
  }

  return (
    <div className="ab" onClick={() => setSel(null)}>
      <div className="ab-side" onClick={(e) => e.stopPropagation()}>
        <div className="ab-seg tabs">{(['blocks', 'saved'] as const).map((t) => <button type="button" key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t === 'blocks' ? 'Blocks' : 'Saved'}</button>)}</div>
        {tab === 'blocks' ? (
          <div className="ab-palette">{PALETTE.map((p) => <button type="button" key={p.type} onClick={() => add(p.type)} title={`Add ${BLOCK_LABELS[p.type]}`}><b>{p.icon}</b><span>{BLOCK_LABELS[p.type]}</span></button>)}</div>
        ) : (
          <div className="ab-saved">
            <button type="button" className="ab-save" disabled={!blocks.length} onClick={saveSection}>💾 Save this email as a layout</button>
            {!sections.length && <p className="ab-hint">Nothing saved yet. Build an email, then save it to reuse next time.</p>}
            {sections.map((s) => (
              <div key={s.id} className="ab-sec">
                <button type="button" onClick={() => onChange([...blocks, ...regenerateIds(s.blocks)])} title="Add to this email"><b>{s.name}</b><small>{s.blocks.length} blocks</small></button>
                <button type="button" aria-label="Delete" onClick={async () => { if (window.confirm(`Delete “${s.name}”?`)) { await supabase!.from('email_sections').delete().eq('id', s.id); loadSections() } }}>🗑</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="ab-main" onClick={(e) => e.stopPropagation()}>
        <div className="ab-top"><span>Drag blocks to reorder · click one to edit</span><div className="ab-seg"><button type="button" className={width === 'desktop' ? 'on' : ''} onClick={() => setWidth('desktop')}>🖥 Desktop</button><button type="button" className={width === 'mobile' ? 'on' : ''} onClick={() => setWidth('mobile')}>📱 Mobile</button></div></div>
        <div className="ab-stage">
          <div className="ab-paper" style={{ maxWidth: width === 'mobile' ? 375 : 560 }}>
            <div className="ab-logo">ILLUSZIONZ MEDIA</div>
            <div className="ab-body">
              {!blocks.length && <p className="ab-empty">Add a block from the left to start building.</p>}
              {blocks.map((b, i) => (
                <div key={b.id} draggable onDragStart={() => (drag.current = i)} onDragOver={(e) => { e.preventDefault(); setOver(i) }} onDragLeave={() => setOver((p) => (p === i ? null : p))}
                  onDrop={(e) => { e.preventDefault(); if (drag.current !== null) reorder(drag.current, i); drag.current = null; setOver(null) }} onDragEnd={() => { drag.current = null; setOver(null) }}
                  onClick={(e) => { e.stopPropagation(); setSel(b.id) }} className={'ab-block' + (sel === b.id ? ' sel' : '') + (over === i ? ' over' : '')} data-type={b.type}>
                  <div className="ab-tools">
                    <span title="Drag">⠿</span>
                    <button type="button" aria-label="Move up" onClick={(e) => { e.stopPropagation(); move(b.id, -1) }}>↑</button>
                    <button type="button" aria-label="Move down" onClick={(e) => { e.stopPropagation(); move(b.id, 1) }}>↓</button>
                    <button type="button" aria-label="Duplicate" onClick={(e) => { e.stopPropagation(); dup(b.id) }}>⧉</button>
                    <button type="button" aria-label="Delete block" onClick={(e) => { e.stopPropagation(); remove(b.id) }}>🗑</button>
                  </div>
                  <Preview b={b} onUpdate={(p) => update(b.id, p)} uploading={uploading === b.id} onFile={(f) => upload(b.id, f)} />
                </div>
              ))}
            </div>
            <div className="ab-foot">Illuszionz Media · {SOCIAL_LINKS.map((s) => s.label).join(' · ')}</div>
          </div>
        </div>
      </div>

      <div className="ab-right" onClick={(e) => e.stopPropagation()}>
        {selected ? <><h4>{BLOCK_LABELS[selected.type]} settings</h4><Settings b={selected} onUpdate={(p) => update(selected.id, p)} /></> : <p className="ab-hint">Select a block in the email to change its settings.</p>}
      </div>
    </div>
  )
}
