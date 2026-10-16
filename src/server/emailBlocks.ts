/**
 * Data model behind the dashboard's drag-and-drop email builder (ported from the DMI project).
 * The builder edits plain `EmailBlock` objects; `blocksToHtml` is the single place that turns them into
 * email-safe HTML (inline styles, tables only where side-by-side layout needs them). Pure — shared by the
 * browser (live preview) and the Cloudflare function that actually sends the campaign.
 */
import { site } from '../site'

export type BlockAlign = 'left' | 'center' | 'right'
export type HeadingBlock = { id: string; type: 'heading'; text: string; level: 'h1' | 'h2' | 'h3'; align: BlockAlign }
export type ParagraphBlock = { id: string; type: 'paragraph'; html: string }
export type ImageBlock = { id: string; type: 'image'; src: string; alt: string; link: string; width: number; align: BlockAlign }
export type ButtonBlock = { id: string; type: 'button'; label: string; link: string; color: string; align: BlockAlign }
export type DividerBlock = { id: string; type: 'divider'; color: string; thickness: number; spacing: number }
export type SpacerBlock = { id: string; type: 'spacer'; height: number }
export type SocialBlock = { id: string; type: 'social'; align: BlockAlign }
export type NestedColumnBlock = HeadingBlock | ParagraphBlock | ButtonBlock
export type ColumnsBlock = { id: string; type: 'columns'; columns: NestedColumnBlock[][] }
export type EmailBlock = HeadingBlock | ParagraphBlock | ImageBlock | ButtonBlock | DividerBlock | SpacerBlock | SocialBlock | ColumnsBlock
export type BlockType = EmailBlock['type']

export const BLOCK_LABELS: Record<BlockType, string> = {
  heading: 'Heading', paragraph: 'Paragraph', image: 'Image', button: 'Button', divider: 'Divider', spacer: 'Spacer', social: 'Social links', columns: 'Columns',
}
export const SOCIAL_LINKS = [
  { label: 'Instagram', href: site.instagram },
  { label: 'Facebook', href: site.facebook },
  { label: 'X', href: site.x },
]

const newId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2))

export function makeBlock(type: BlockType): EmailBlock {
  const id = newId()
  switch (type) {
    case 'heading': return { id, type, text: 'Your headline here', level: 'h2', align: 'left' }
    case 'paragraph': return { id, type, html: 'Write your message here…' }
    case 'image': return { id, type, src: '', alt: '', link: '', width: 100, align: 'center' }
    case 'button': return { id, type, label: 'Click here', link: 'https://', color: '#0a0a0a', align: 'left' }
    case 'divider': return { id, type, color: '#dcdad2', thickness: 1, spacing: 24 }
    case 'spacer': return { id, type, height: 24 }
    case 'social': return { id, type, align: 'center' }
    case 'columns': return { id, type, columns: [[], []] }
  }
}
export const defaultBlocks = (): EmailBlock[] => [
  { ...(makeBlock('heading') as HeadingBlock), text: 'Hi {{first_name}},' },
  makeBlock('paragraph'),
]

/** Fresh ids (including nested column blocks) so a duplicated/inserted block never shares a React key. */
export function regenerateIds(blocks: EmailBlock[]): EmailBlock[] {
  return blocks.map((b) => {
    const id = newId()
    if (b.type === 'columns') return { ...b, id, columns: b.columns.map((col) => regenerateIds(col) as NestedColumnBlock[]) }
    return { ...b, id } as EmailBlock
  })
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
const safeUrl = (u: string) => (/^(https?:|mailto:|tel:)/i.test(u.trim()) ? u.trim() : '#')
const HEADING_SIZE = { h1: '34px', h2: '26px', h3: '20px' } as const
const SANS = "-apple-system,'Segoe UI',Helvetica,Arial,sans-serif"
const SERIF = "'Playfair Display',Georgia,'Times New Roman',serif"

/** Paragraph HTML comes from the in-browser editor: keep formatting tags, drop anything script-like. */
export function cleanParagraphHtml(html: string): string {
  return html
    .replace(/<\s*(script|style|iframe|object|embed)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '')
}

function blockToHtml(block: EmailBlock): string {
  switch (block.type) {
    case 'heading':
      return `<${block.level} style="margin:0 0 16px;font-family:${SERIF};font-weight:700;font-size:${HEADING_SIZE[block.level]};line-height:1.2;color:#0a0a0a;text-align:${block.align};">${escapeHtml(block.text)}</${block.level}>`
    case 'paragraph':
      return `<div style="margin:0 0 20px;font-family:${SANS};font-size:15.5px;line-height:1.75;color:#0a0a0a;">${cleanParagraphHtml(block.html)}</div>`
    case 'image': {
      if (!block.src) return ''
      const img = `<img src="${escapeHtml(block.src)}" alt="${escapeHtml(block.alt)}" style="display:block;width:${block.width}%;max-width:100%;height:auto;border:0;border-radius:10px;margin:${block.align === 'center' ? '0 auto' : block.align === 'right' ? '0 0 0 auto' : '0'};" />`
      return `<div style="margin:0 0 18px;text-align:${block.align};">${block.link ? `<a href="${escapeHtml(safeUrl(block.link))}" target="_blank" rel="noopener noreferrer">${img}</a>` : img}</div>`
    }
    case 'button':
      return `<div style="margin:0 0 18px;text-align:${block.align};"><a href="${escapeHtml(safeUrl(block.link))}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:${escapeHtml(block.color)};color:#ffffff;font-family:${SANS};font-weight:700;font-size:12px;letter-spacing:.14em;text-transform:uppercase;text-decoration:none;padding:15px 30px;border-radius:999px;">${escapeHtml(block.label)}</a></div>`
    case 'divider':
      return `<hr style="margin:${block.spacing}px 0;border:none;border-top:${block.thickness}px solid ${escapeHtml(block.color)};" />`
    case 'spacer':
      return `<div style="height:${block.height}px;line-height:${block.height}px;font-size:1px;">&nbsp;</div>`
    case 'social':
      return `<div style="margin:0 0 18px;text-align:${block.align};">${SOCIAL_LINKS.map((s) => `<a href="${escapeHtml(s.href)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin:0 5px 6px;padding:8px 16px;border:1px solid #0a0a0a;border-radius:999px;font-family:${SANS};font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#0a0a0a;text-decoration:none;">${escapeHtml(s.label)}</a>`).join('')}</div>`
    case 'columns': {
      const n = block.columns.length || 1
      const w = (100 / n).toFixed(2)
      const cells = block.columns.map((col, i) => `<td valign="top" style="width:${w}%;padding:${i === 0 ? '0' : '0 0 0 16px'};">${col.map(blockToHtml).join('\n') || '&nbsp;'}</td>`).join('')
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;"><tr>${cells}</tr></table>`
    }
  }
}

export const blocksToHtml = (blocks: EmailBlock[]) => blocks.map(blockToHtml).join('\n')
export const blocksToText = (blocks: EmailBlock[]): string =>
  blocks
    .flatMap((b): string[] => {
      if (b.type === 'heading') return [b.text]
      if (b.type === 'paragraph') return [b.html.replace(/<br\s*\/?>|<\/(p|div|li)>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim()]
      if (b.type === 'button') return [`${b.label}: ${b.link}`]
      if (b.type === 'columns') return [blocksToText(b.columns.flat())]
      return []
    })
    .filter(Boolean)
    .join('\n\n')
