/// <reference lib="webworker" />
/** Off-main-thread resize + watermark (OffscreenCanvas). Messages: init (logo + settings), then one job per file. */
import { decode, processImage, type ImagingSettings, type Mode } from './core'

let logo: ImageBitmap | null = null
let settings: ImagingSettings | null = null

self.onmessage = async (e: MessageEvent) => {
  const m = e.data as { type: 'init'; logo: Blob | null; settings: ImagingSettings } | { type: 'job'; id: number; file: Blob; mode: Mode }
  if (m.type === 'init') {
    settings = m.settings
    logo = m.logo ? await decode(m.logo) : null
    ;(self as unknown as Worker).postMessage({ type: 'ready' })
    return
  }
  try {
    const out = await processImage(m.file, m.mode, logo, settings!)
    ;(self as unknown as Worker).postMessage({ type: 'done', id: m.id, ...out })
  } catch (err) {
    ;(self as unknown as Worker).postMessage({ type: 'error', id: m.id, error: err instanceof Error ? err.message : 'Could not read this image' })
  }
}
