/**
 * Finals downloads. One photo: a 15-minute signed link that saves under its original filename. "Download all": the same
 * photos saved one after the other as separate files, each finished before the next starts.
 */
import { callFn } from '../api'

type Signed = { files: { id: string; filename: string; bytes: number; url: string }[] }

export async function downloadOne(galleryId: string, imageId: string, key: string | null) {
  const r = await callFn<Signed>('gallery-download-url', { gallery_id: galleryId, image_id: imageId, key })
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

const SIGN_BATCH = 100
const SIGN_FRESH_MS = 10 * 60_000 // links last 15 minutes; slow connections can outlive a batch
const SAVE_GAP_MS = 500 // browsers drop downloads that start too close together

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 20_000)
}

/** Saves each photo as its own file. Returns the ids that didn't save, so they can be tried again. */
export async function downloadAll(o: { galleryId: string; key: string | null; ids: string[]; onProgress: (done: number) => void; signal: AbortSignal }) {
  const signed = new Map<string, Signed['files'][number]>()
  const failed: string[] = []
  let signedUpTo = 0
  let signedAt = 0
  let calls = 0

  for (let i = 0; i < o.ids.length; i++) {
    if (o.signal.aborted) throw new DOMException('Cancelled', 'AbortError')
    if (i >= signedUpTo || Date.now() - signedAt > SIGN_FRESH_MS) {
      // `zip` is the function's flag for a whole-set request: it logs one download, not one per photo
      const r = await callFn<Signed>('gallery-download-url', { gallery_id: o.galleryId, key: o.key, image_ids: o.ids.slice(i, i + SIGN_BATCH), zip: true, part: ++calls, total: o.ids.length })
      if (!r.ok) return { failed: [...failed, ...o.ids.slice(i)], error: r.error }
      signed.clear()
      r.files.forEach((f) => signed.set(f.id, f))
      signedUpTo = i + SIGN_BATCH
      signedAt = Date.now()
    }
    const f = signed.get(o.ids[i])
    try {
      if (!f) throw new Error('Not available')
      const res = await fetch(f.url, { signal: o.signal })
      if (!res.ok) throw new Error(`Could not download ${f.filename} (${res.status})`)
      saveBlob(await res.blob(), f.filename)
      await new Promise((done) => setTimeout(done, SAVE_GAP_MS))
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw e
      failed.push(o.ids[i])
    }
    o.onProgress(i + 1)
  }
  return { failed, error: null }
}
