/**
 * Shrinks a photo in the browser before it is uploaded: camera files (5–20 MB) become a web-sized JPEG of at most
 * 2400 px on the long side (about 0.3–0.8 MB). Every visitor downloads the uploaded file, so this keeps pages fast and
 * Supabase's bandwidth low. Small files, GIFs and SVGs are uploaded as they are.
 */
const MAX_SIDE = 2400
const KEEP_UNDER = 500_000

export async function shrinkImage(file: File, { maxSide = MAX_SIDE, quality = 0.82 } = {}): Promise<File> {
  if (!/^image\/(jpeg|png|webp|heic|heif|avif)$/i.test(file.type)) return file
  let bmp: ImageBitmap
  try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }) } catch { return file }
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height))
  if (scale === 1 && file.size <= KEEP_UNDER) { bmp.close(); return file }
  const w = Math.max(1, Math.round(bmp.width * scale)), h = Math.max(1, Math.round(bmp.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) { bmp.close(); return file }
  ctx.fillStyle = '#fff' // a transparent PNG gets a white background as a JPEG
  ctx.fillRect(0, 0, w, h)
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bmp, 0, 0, w, h)
  bmp.close()
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', quality))
  if (!blob || blob.size >= file.size) return file
  return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg', lastModified: Date.now() })
}
