/**
 * Upload queue for the Gallery Manager: process (resize/watermark) -> ask for presigned URLs -> PUT straight to R2 ->
 * confirm. 3 files at a time, every file retried up to 3x with backoff, a warning when the tab is closed mid-upload.
 * Any file still waiting or uploading can be cancelled (one, or all at once): its transfers are aborted and anything it
 * already put in storage is deleted. Photos that finished stay; delete them from the grid if needed.
 */
import { callFn } from '../api'
import { galleryConfig } from '../gallery.config'
import { processFile } from '../imaging'
import { byFilename } from '../filenames'
import type { Mode } from '../imaging/core'

export type QueueItem = {
  ref: string
  file: File
  name: string
  status: 'queued' | 'processing' | 'uploading' | 'done' | 'failed' | 'cancelled'
  progress: number
  error?: string
  imageId?: string
}

type Snapshot = { items: QueueItem[]; active: boolean }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

class Cancelled extends Error {}

function put(url: string, blob: Blob, onProgress: (loaded: number) => void, track: (xhr: XMLHttpRequest) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    track(xhr)
    xhr.onabort = () => reject(new Cancelled('Cancelled'))
    xhr.open('PUT', url)
    xhr.setRequestHeader('Content-Type', blob.type || 'image/jpeg')
    xhr.upload.onprogress = (e) => onProgress(e.loaded)
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Storage refused the file (${xhr.status})`)))
    xhr.onerror = () => reject(new Error('Network error — check the connection (or the storage CORS settings).'))
    xhr.ontimeout = () => reject(new Error('Upload timed out'))
    xhr.timeout = 10 * 60_000
    xhr.send(blob)
  })
}

async function takenAt(file: File): Promise<string | null> {
  if (file.type !== 'image/jpeg') return null
  try {
    const exifr = (await import('exifr/dist/lite.esm.mjs')).default
    const d = (await exifr.parse(file, ['DateTimeOriginal']))?.DateTimeOriginal
    return d instanceof Date && !Number.isNaN(d.getTime()) ? d.toISOString() : null
  } catch {
    return null
  }
}

export class UploadQueue {
  private snap: Snapshot = { items: [], active: false }
  private listeners = new Set<() => void>()
  private running = 0
  private confirmDone: string[] = []
  private confirmFailed: string[] = []
  private confirming: Promise<void> = Promise.resolve()
  private unloadGuard = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
  private cancelled = new Set<string>()
  private xhrs = new Map<string, XMLHttpRequest[]>()

  /** `set`: finals galleries hold the edited photos and, optionally, all the unedited ones */
  constructor(private galleryId: string, private mode: Mode, private onSettled: () => void, private set: 'edited' | 'unedited' = 'edited') {}

  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => this.listeners.delete(fn) }
  getSnapshot = () => this.snap

  private emit() {
    const items = this.snap.items
    const active = items.some((i) => i.status === 'queued' || i.status === 'processing' || i.status === 'uploading')
    if (active !== this.snap.active) {
      if (active) window.addEventListener('beforeunload', this.unloadGuard)
      else window.removeEventListener('beforeunload', this.unloadGuard)
    }
    this.snap = { items: [...items], active }
    this.listeners.forEach((f) => f())
  }

  private patch(ref: string, p: Partial<QueueItem>) {
    this.snap.items = this.snap.items.map((i) => (i.ref === ref ? { ...i, ...p } : i))
    this.emit()
  }

  /** Returns the names of rejected files (wrong type). */
  add(files: File[]): string[] {
    const accept = galleryConfig.images.accept
    const ok = files.filter((f) => accept.includes(f.type)).sort((a, b) => byFilename(a.name, b.name))
    const rejected = files.filter((f) => !accept.includes(f.type)).map((f) => f.name)
    this.snap.items = [...this.snap.items, ...ok.map((file) => ({ ref: crypto.randomUUID(), file, name: file.name, status: 'queued' as const, progress: 0 }))]
    this.emit()
    this.pump()
    return rejected
  }

  async retryFailed() {
    const failed = this.snap.items.filter((i) => i.status === 'failed')
    const stale = failed.map((i) => i.imageId).filter(Boolean) as string[]
    if (stale.length) await callFn('gallery-delete', { gallery_id: this.galleryId, image_ids: stale })
    this.snap.items = this.snap.items.map((i) => (i.status === 'failed' ? { ...i, status: 'queued', progress: 0, error: undefined, imageId: undefined } : i))
    this.emit()
    this.pump()
  }

  clearFinished() {
    this.snap.items = this.snap.items.filter((i) => i.status !== 'done' && i.status !== 'cancelled')
    this.emit()
  }

  /** Stop one file (`ref`) or every file that hasn't finished yet. */
  cancel(ref?: string) {
    for (const i of this.snap.items) {
      if (ref && i.ref !== ref) continue
      if (i.status === 'queued') this.patch(i.ref, { status: 'cancelled', error: undefined })
      else if (i.status === 'processing' || i.status === 'uploading') {
        this.cancelled.add(i.ref)
        this.xhrs.get(i.ref)?.forEach((x) => x.abort())
        this.patch(i.ref, { status: 'cancelled', error: undefined })
      } else if (i.status === 'failed' && !ref) this.patch(i.ref, { status: 'cancelled', error: undefined })
    }
  }

  /** a cancelled file that already has a database row (and maybe objects in storage): remove it */
  private discard(item: QueueItem, imageId?: string) {
    this.xhrs.delete(item.ref)
    if (imageId) callFn('gallery-delete', { gallery_id: this.galleryId, image_ids: [imageId] }).then(() => this.onSettled())
  }

  private pump() {
    while (this.running < galleryConfig.upload.concurrency) {
      const next = this.snap.items.find((i) => i.status === 'queued')
      if (!next) break
      this.running++
      this.patch(next.ref, { status: 'processing' })
      this.run(next).finally(() => {
        this.running--
        this.pump()
        if (!this.running && !this.snap.items.some((i) => i.status === 'queued')) this.flush(true)
      })
    }
  }

  private async run(item: QueueItem) {
    let processed
    try {
      const [p, taken] = await Promise.all([processFile(item.file, this.mode), takenAt(item.file)])
      processed = { ...p, taken }
    } catch (err) {
      if (this.cancelled.has(item.ref)) return
      return this.patch(item.ref, { status: 'failed', error: err instanceof Error ? err.message : 'Could not read this image' })
    }
    if (this.cancelled.has(item.ref)) return
    const parts: [string, Blob][] = this.mode === 'proof'
      ? [['thumb', processed.blobs.thumb!], ['preview', processed.blobs.preview!]]
      : [['thumb', processed.blobs.thumb!], ['web', processed.blobs.web!], ['original', item.file]]
    const total = parts.reduce((s, [, b]) => s + b.size, 0)

    let imageId: string | undefined
    let lastError = ''
    for (let attempt = 0; attempt < galleryConfig.upload.retries; attempt++) {
      if (attempt) await sleep(1000 * 3 ** (attempt - 1))
      if (this.cancelled.has(item.ref)) return this.discard(item, imageId)
      try {
        if (!imageId) {
          const r = await callFn<{ items: { image_id: string; urls: Record<string, string> }[] }>('gallery-upload-urls', {
            gallery_id: this.galleryId,
            image_set: this.set,
            files: [{ client_ref: item.ref, original_filename: item.name, content_type: item.file.type, bytes: total, width: processed.width, height: processed.height, taken_at: processed.taken, variants: parts.map(([k]) => k) }],
          })
          if (!r.ok) throw new Error(r.error)
          imageId = r.items[0].image_id
          if (this.cancelled.has(item.ref)) return this.discard(item, imageId)
          ;(item as QueueItem & { urls?: Record<string, string> }).urls = r.items[0].urls
        }
        const urls = (item as QueueItem & { urls?: Record<string, string> }).urls!
        this.patch(item.ref, { status: 'uploading', imageId, error: undefined })
        const loaded: Record<string, number> = {}
        this.xhrs.set(item.ref, [])
        await Promise.all(parts.map(([k, blob]) => put(urls[k], blob, (n) => {
          loaded[k] = n
          this.patch(item.ref, { progress: Math.min(0.99, Object.values(loaded).reduce((a, b) => a + b, 0) / total) })
        }, (x) => this.xhrs.get(item.ref)?.push(x))))
        this.xhrs.delete(item.ref)
        if (this.cancelled.has(item.ref)) return this.discard(item, imageId)
        this.patch(item.ref, { status: 'done', progress: 1 })
        this.confirmDone.push(imageId)
        if (this.confirmDone.length >= 10) this.flush()
        return
      } catch (err) {
        if (err instanceof Cancelled || this.cancelled.has(item.ref)) {
          this.xhrs.get(item.ref)?.forEach((x) => x.abort())
          return this.discard(item, imageId)
        }
        lastError = err instanceof Error ? err.message : 'Upload failed'
        this.patch(item.ref, { error: `${lastError} — retrying…` })
      }
    }
    if (imageId) this.confirmFailed.push(imageId)
    this.patch(item.ref, { status: 'failed', error: lastError, imageId })
  }

  /** Tell the server which uploads finished (it double-checks each object exists). */
  private flush(final = false) {
    const done = this.confirmDone.splice(0)
    const failed = this.confirmFailed.splice(0)
    if (!done.length && !failed.length) {
      if (final) this.confirming.then(this.onSettled)
      return
    }
    this.confirming = this.confirming.then(async () => {
      const r = await callFn<{ ready: string[]; failed: string[] }>('gallery-confirm-uploads', { gallery_id: this.galleryId, done, failed })
      if (r.ok && r.failed.length) {
        const bad = new Set(r.failed)
        this.snap.items = this.snap.items.map((i) => (i.imageId && bad.has(i.imageId) && i.status === 'done' ? { ...i, status: 'failed', error: 'The file did not arrive in storage' } : i))
        this.emit()
      }
    })
    this.confirming.then(() => this.onSettled())
  }
}
