/**
 * Image processing pool: Web Workers with OffscreenCanvas where the browser supports them, otherwise the same code on the
 * main thread. Proof images are watermarked here, in the browser, before anything is uploaded.
 */
import { galleryConfig } from '../gallery.config'
import { decode, processImage, type ImagingSettings, type Mode, type Processed } from './core'

const settings: ImagingSettings = { watermark: galleryConfig.watermark, images: galleryConfig.images }

let logoBlob: Promise<Blob | null> | null = null
export const loadLogo = () =>
  (logoBlob ??= fetch(galleryConfig.watermark.logo).then((r) => (r.ok ? r.blob() : null)).catch(() => null))

const canUseWorkers = () =>
  typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined' && typeof createImageBitmap !== 'undefined' &&
  // Safari < 16.4 has OffscreenCanvas without a 2D context
  (() => { try { return !!new OffscreenCanvas(1, 1).getContext('2d') } catch { return false } })()

type Job = { id: number; file: Blob; mode: Mode; resolve: (p: Processed) => void; reject: (e: Error) => void }

class Pool {
  private workers: { w: Worker; busy: boolean }[] = []
  private queue: Job[] = []
  private pending = new Map<number, Job>()
  private seq = 0
  private ready: Promise<void> | null = null
  private mainLogo: Promise<ImageBitmap | null> | null = null

  private start() {
    if (this.ready) return this.ready
    this.ready = (async () => {
      if (!canUseWorkers()) return
      const logo = await loadLogo()
      const n = Math.max(1, Math.min(3, (navigator.hardwareConcurrency || 4) - 1))
      await Promise.all(Array.from({ length: n }, () => new Promise<void>((res) => {
        const w = new Worker(new URL('./imaging.worker.ts', import.meta.url), { type: 'module' })
        const slot = { w, busy: false }
        w.onmessage = (e) => {
          const m = e.data
          if (m.type === 'ready') { this.workers.push(slot); res(); return }
          const job = this.pending.get(m.id)
          this.pending.delete(m.id)
          slot.busy = false
          if (job) m.type === 'done' ? job.resolve({ width: m.width, height: m.height, blobs: m.blobs }) : job.reject(new Error(m.error))
          this.pump()
        }
        w.onerror = () => res() // worker failed to boot: fall back to the main thread for everything
        w.postMessage({ type: 'init', logo, settings })
      })))
    })()
    return this.ready
  }

  private pump() {
    for (const slot of this.workers) {
      if (slot.busy || !this.queue.length) continue
      const job = this.queue.shift()!
      slot.busy = true
      this.pending.set(job.id, job)
      slot.w.postMessage({ type: 'job', id: job.id, file: job.file, mode: job.mode })
    }
  }

  async process(file: Blob, mode: Mode): Promise<Processed> {
    await this.start()
    if (!this.workers.length) {
      this.mainLogo ??= loadLogo().then((b) => (b ? decode(b) : null))
      return processImage(file, mode, await this.mainLogo, settings)
    }
    return new Promise((resolve, reject) => {
      this.queue.push({ id: ++this.seq, file, mode, resolve, reject })
      this.pump()
    })
  }
}

const pool = new Pool()
export const processFile = (file: Blob, mode: Mode) => pool.process(file, mode)

/** Small watermarked preview for the upload panel ("this is what the client will see"). */
export async function watermarkPreview(file: Blob): Promise<string> {
  const logoB = await loadLogo()
  const logo = logoB ? await decode(logoB) : null
  const out = await processImage(file, 'proof', logo, { ...settings, images: { ...settings.images, previewEdge: 1200, thumbEdge: 200 } })
  return URL.createObjectURL(out.blobs.preview!)
}
