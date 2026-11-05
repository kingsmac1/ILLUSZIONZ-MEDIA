/**
 * The booking form's inspiration image upload. Files stay on the client's device until they submit, so abandoned forms
 * upload nothing. Each is then resized to a JPEG here and sent to the gallery-inspiration function.
 */
import { useEffect, useMemo, useRef, useState } from 'react'

const MAX_FILES = 6
const MAX_LONG_EDGE = 2000
const ACCEPT = ['image/jpeg', 'image/png', 'image/webp']

export function InspirationImages({ label, files, onChange }: { label: string; files: File[]; onChange: (f: File[]) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [notice, setNotice] = useState('')
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files])
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews])

  function add(list: FileList | null) {
    if (!list) return
    const picked = [...list]
    const ok = picked.filter((f) => ACCEPT.includes(f.type))
    const next = [...files, ...ok].slice(0, MAX_FILES)
    onChange(next)
    if (ok.length < picked.length) setNotice('Only JPG, PNG and WebP images can be added.')
    else if (files.length + ok.length > MAX_FILES) setNotice(`You can add up to ${MAX_FILES} images.`)
    else setNotice('')
  }

  return (
    <div className="bk-field">
      <label htmlFor="bk-inspiration-images">{label}</label>
      <input ref={input} id="bk-inspiration-images" type="file" multiple accept={ACCEPT.join(',')} hidden onChange={(e) => { add(e.target.files); e.target.value = '' }} />
      {files.length < MAX_FILES && (
        <button type="button" className="bk-upload-pick" onClick={() => input.current?.click()}>
          <b>Choose images</b>
          <small>Up to {MAX_FILES} images, JPG, PNG or WebP</small>
        </button>
      )}
      {files.length > 0 && (
        <ul className="bk-upload-list">
          {files.map((f, i) => (
            <li key={previews[i]}>
              <img src={previews[i]} alt={f.name} />
              <button type="button" aria-label={`Remove ${f.name}`} onClick={() => onChange(files.filter((_, n) => n !== i))}>×</button>
            </li>
          ))}
        </ul>
      )}
      {notice && <span className="bk-err" role="alert">{notice}</span>}
    </div>
  )
}

async function toJpegBlob(file: File): Promise<Blob> {
  const { decode, resize, toJpeg } = await import('../features/gallery/imaging/core')
  const bmp = await decode(file)
  try {
    return await toJpeg(resize(bmp, bmp.width, bmp.height, MAX_LONG_EDGE), 0.82)
  } finally {
    bmp.close()
  }
}

/** Uploads the chosen images. Never throws: the booking goes ahead with whatever arrived. */
export async function uploadInspiration(files: File[]): Promise<{ keys: string[]; failed: number }> {
  const env = import.meta.env as Record<string, string | undefined>
  if (!files.length) return { keys: [], failed: 0 }
  if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY) return { keys: [], failed: files.length }
  const results = await Promise.all(files.map(async (file) => {
    try {
      const res = await fetch(`${env.VITE_SUPABASE_URL!.replace(/\/$/, '')}/functions/v1/gallery-inspiration`, {
        method: 'POST',
        headers: { 'Content-Type': 'image/jpeg', apikey: env.VITE_SUPABASE_ANON_KEY!, Authorization: `Bearer ${env.VITE_SUPABASE_ANON_KEY}` },
        body: await toJpegBlob(file),
        signal: AbortSignal.timeout(60_000),
      })
      const data = (await res.json()) as { ok?: boolean; key?: string }
      return res.ok && data.ok && data.key ? data.key : null
    } catch (err) {
      console.error('inspiration upload failed', err)
      return null
    }
  }))
  const keys = results.filter((k): k is string => !!k)
  return { keys, failed: files.length - keys.length }
}
