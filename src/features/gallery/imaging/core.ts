/**
 * Resize + watermark, shared by the Web Worker (OffscreenCanvas) and the main-thread fallback (HTMLCanvasElement).
 * Proofs: thumb + preview, both watermarked. Finals: thumb + web, never watermarked (the original is uploaded untouched).
 */
import type { GalleryConfig } from '../gallery.config'

type AnyCanvas = OffscreenCanvas | HTMLCanvasElement
type Ctx = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D
type Source = ImageBitmap | AnyCanvas

export type Mode = 'proof' | 'final'
export type Variant = 'thumb' | 'preview' | 'web'
export type Processed = { width: number; height: number; blobs: Partial<Record<Variant, Blob>> }
export type ImagingSettings = { watermark: GalleryConfig['watermark']; images: GalleryConfig['images'] }

export function makeCanvas(w: number, h: number): AnyCanvas {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h)
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

function ctx2d(c: AnyCanvas): Ctx {
  const ctx = c.getContext('2d') as Ctx | null
  if (!ctx) throw new Error('Canvas is not available in this browser.')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  return ctx
}

/** Downscale in halving steps for a sharp, alias-free result. */
export function resize(src: Source, sw: number, sh: number, maxEdge: number): AnyCanvas {
  const scale = Math.min(1, maxEdge / Math.max(sw, sh))
  const tw = Math.max(1, Math.round(sw * scale))
  const th = Math.max(1, Math.round(sh * scale))
  let cur: Source = src
  let cw = sw
  let ch = sh
  while (cw / 2 >= tw * 1.0001 && ch / 2 >= th) {
    const nw = Math.round(cw / 2)
    const nh = Math.round(ch / 2)
    const step = makeCanvas(nw, nh)
    ctx2d(step).drawImage(cur as CanvasImageSource, 0, 0, nw, nh)
    cur = step
    cw = nw
    ch = nh
  }
  const out = makeCanvas(tw, th)
  const c = ctx2d(out)
  c.fillStyle = '#fff' // PNGs with transparency become white, not black, as JPEG
  c.fillRect(0, 0, tw, th)
  c.drawImage(cur as CanvasImageSource, 0, 0, tw, th)
  return out
}

/** Big centred logo + a faint diagonal tile of small logos, so the mark can't be cropped out. */
export function watermark(canvas: AnyCanvas, logo: Source, lw: number, lh: number, wm: ImagingSettings['watermark']) {
  const c = ctx2d(canvas)
  const W = canvas.width
  const H = canvas.height
  const ratio = lh / lw

  // tile
  const tw = Math.max(24, W * wm.tileSize)
  const th = tw * ratio
  const gapX = tw * 0.9
  const gapY = th * 2.6
  c.save()
  c.globalAlpha = wm.tileOpacity
  c.translate(W / 2, H / 2)
  c.rotate((wm.tileAngleDeg * Math.PI) / 180)
  const span = Math.hypot(W, H)
  let row = 0
  for (let y = -span / 2; y < span / 2; y += th + gapY, row++) {
    const offset = row % 2 ? (tw + gapX) / 2 : 0
    for (let x = -span / 2 - offset; x < span / 2; x += tw + gapX) c.drawImage(logo as CanvasImageSource, x, y, tw, th)
  }
  c.restore()

  // centre mark
  const bw = Math.min(W * wm.size, (H * 0.8) / ratio)
  const bh = bw * ratio
  c.save()
  c.globalAlpha = wm.opacity
  if (wm.shadow) {
    c.shadowColor = 'rgba(0,0,0,0.55)'
    c.shadowBlur = Math.max(4, bw * 0.012)
  }
  c.drawImage(logo as CanvasImageSource, (W - bw) / 2, (H - bh) / 2, bw, bh)
  c.restore()
}

export async function toJpeg(canvas: AnyCanvas, quality: number): Promise<Blob> {
  if ('convertToBlob' in canvas) return canvas.convertToBlob({ type: 'image/jpeg', quality })
  return new Promise((res, rej) => (canvas as HTMLCanvasElement).toBlob((b) => (b ? res(b) : rej(new Error('Could not encode JPEG'))), 'image/jpeg', quality))
}

export async function decode(file: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    return createImageBitmap(file) // older Safari: no options (it already applies EXIF orientation)
  }
}

export async function processImage(file: Blob, mode: Mode, logo: ImageBitmap | null, s: ImagingSettings): Promise<Processed> {
  const bmp = await decode(file)
  try {
    const { width, height } = bmp
    const blobs: Processed['blobs'] = {}
    const variants: [Variant, number][] = mode === 'proof' ? [['preview', s.images.previewEdge], ['thumb', s.images.thumbEdge]] : [['web', s.images.webEdge], ['thumb', s.images.thumbEdge]]
    let prev: AnyCanvas | null = null
    for (const [name, edge] of variants) {
      // the thumb is made from the (unwatermarked) larger version, which is faster than starting from the full file again
      const base: AnyCanvas = prev ? resize(prev, prev.width, prev.height, edge) : resize(bmp, width, height, edge)
      if (!prev) prev = base
      const out: AnyCanvas = name === variants[0][0] && mode === 'proof' ? cloneCanvas(base) : base
      if (mode === 'proof') {
        if (!logo) throw new Error('The watermark logo could not be loaded, so nothing was uploaded.')
        watermark(out, logo, logo.width, logo.height, s.watermark)
      }
      blobs[name] = await toJpeg(out, s.images.jpegQuality)
    }
    return { width, height, blobs }
  } finally {
    bmp.close?.()
  }
}

function cloneCanvas(c: AnyCanvas): AnyCanvas {
  const out = makeCanvas(c.width, c.height)
  ctx2d(out).drawImage(c as CanvasImageSource, 0, 0)
  return out
}
