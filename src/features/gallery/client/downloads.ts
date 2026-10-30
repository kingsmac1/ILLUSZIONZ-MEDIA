/**
 * Finals downloads. One photo: a 15-minute signed link that saves under its original filename. "Download all": zips built
 * in the browser with client-zip, in parts (≈100 photos / 2 GB; smaller on phones), streamed straight to disk where the
 * browser allows it (Chrome/Edge desktop), otherwise assembled in memory and saved.
 */
import { callFn } from '../api'
import { galleryConfig } from '../gallery.config'
import type { ViewImage } from '../types'

type Signed = { files: { id: string; filename: string; bytes: number; url: string }[] }

export async function downloadOne(galleryId: string, imageId: string) {
  const r = await callFn<Signed>('gallery-download-url', { gallery_id: galleryId, image_id: imageId })
  if (!r.ok) throw new Error(r.error)
  const f = r.files[0]
  if (!f) throw new Error('This photo is not available for download.')
  const a = document.createElement('a')
  a.href = f.url
  a.download = f.filename // the signed URL also sets Content-Disposition: attachment
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

const canStreamToDisk = () => typeof (window as any).showSaveFilePicker === 'function'
const isTouch = () => typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches

/** Split into zip parts by count and (approximate) size. */
export function planParts(images: Pick<ViewImage, 'id' | 'bytes'>[]) {
  const small = !canStreamToDisk() && isTouch()
  const maxFiles = small ? 40 : galleryConfig.zipPart.maxFiles
  const maxBytes = small ? 600 * 1024 ** 2 : canStreamToDisk() ? galleryConfig.zipPart.maxBytes : 1.2 * 1024 ** 3
  const parts: string[][] = []
  let cur: string[] = []
  let size = 0
  for (const img of images) {
    const b = img.bytes ?? 8 * 1024 ** 2
    if (cur.length && (cur.length >= maxFiles || size + b > maxBytes)) { parts.push(cur); cur = []; size = 0 }
    cur.push(img.id)
    size += b
  }
  if (cur.length) parts.push(cur)
  return parts
}

export type ZipProgress = { part: number; parts: number; done: number; total: number; bytes: number }

/** Builds and saves one zip part. */
export async function downloadZipPart(o: { galleryId: string; ids: string[]; part: number; parts: number; total: number; name: string; onProgress: (p: { done: number; bytes: number }) => void; signal?: AbortSignal }) {
  const { downloadZip } = await import('client-zip')
  const r = await callFn<Signed>('gallery-download-url', { gallery_id: o.galleryId, image_ids: o.ids, zip: true, part: o.part, total: o.total })
  if (!r.ok) throw new Error(r.error)
  const fileName = `${o.name}${o.parts > 1 ? ` (part ${o.part} of ${o.parts})` : ''}.zip`

  // pick where to save first — each part is started by its own click, which this needs
  let writable: any = null
  if (canStreamToDisk()) {
    try {
      const handle = await (window as any).showSaveFilePicker({ suggestedName: fileName, types: [{ description: 'Zip archive', accept: { 'application/zip': ['.zip'] } }] })
      writable = await handle.createWritable()
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw e
    }
  }

  let done = 0
  let bytes = 0
  const used = new Map<string, number>()
  async function* entries() {
    for (const f of r.ok ? r.files : []) {
      if (o.signal?.aborted) throw new DOMException('Cancelled', 'AbortError')
      const res = await fetch(f.url, { signal: o.signal })
      if (!res.ok || !res.body) throw new Error(`Could not download ${f.filename} (${res.status})`)
      // same filename twice in one zip -> "name (2).jpg"
      const n = (used.get(f.filename) ?? 0) + 1
      used.set(f.filename, n)
      const name = n > 1 ? f.filename.replace(/(\.[^.]+)?$/, ` (${n})$1`) : f.filename
      const counted = res.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, ctl) { bytes += chunk.byteLength; o.onProgress({ done, bytes }); ctl.enqueue(chunk) },
        flush() { done++; o.onProgress({ done, bytes }) },
      }))
      yield { name, input: counted, size: Number(res.headers.get('content-length')) || undefined }
    }
  }
  const zip = downloadZip(entries())
  if (writable) {
    await zip.body!.pipeTo(writable, { signal: o.signal })
    return
  }
  const blob = await zip.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
