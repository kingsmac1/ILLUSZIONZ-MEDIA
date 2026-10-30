/**
 * Cloudflare R2 (S3 API) — presigned URLs and deletes, signed with aws4fetch. The bucket is private: nothing in it can be
 * read without a URL signed here, and those URLs expire.
 */
import { AwsClient } from 'npm:aws4fetch@1.0.20'

export const VIEW_TTL = 6 * 3600 // thumbs / previews / web versions
export const ORIGINAL_TTL = 15 * 60 // full-resolution downloads
export const UPLOAD_TTL = 2 * 3600 // presigned PUTs

let aws: AwsClient | null = null
function client() {
  const accessKeyId = Deno.env.get('R2_ACCESS_KEY_ID')
  const secretAccessKey = Deno.env.get('R2_SECRET_ACCESS_KEY')
  if (!accessKeyId || !secretAccessKey || !Deno.env.get('R2_ACCOUNT_ID') || !Deno.env.get('R2_BUCKET')) throw new Error('R2 is not configured (missing R2_* secrets).')
  aws ??= new AwsClient({ accessKeyId, secretAccessKey, service: 's3', region: 'auto' })
  return aws
}

const objectUrl = (key: string) =>
  `https://${Deno.env.get('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com/${Deno.env.get('R2_BUCKET')}/${key.split('/').map(encodeURIComponent).join('/')}`

/** YYYYMMDDTHHMMSSZ */
const amzDate = (d: Date) => d.toISOString().replace(/[:-]|\.\d{3}/g, '')

/**
 * Signed GET. View URLs are signed from the start of the current hour, so the same image gets the same URL for an hour
 * and the browser can cache it (each URL then stays valid for 6–7 hours).
 */
export async function signGet(key: string, o: { ttl?: number; download?: string } = {}) {
  const url = new URL(objectUrl(key))
  let datetime: string | undefined
  let ttl = o.ttl ?? VIEW_TTL
  if (!o.download) {
    const hour = new Date()
    hour.setUTCMinutes(0, 0, 0)
    datetime = amzDate(hour)
    ttl += 3600
  }
  url.searchParams.set('X-Amz-Expires', String(ttl))
  if (o.download) url.searchParams.set('response-content-disposition', contentDisposition(o.download))
  const signed = await client().sign(url.toString(), { method: 'GET', aws: { signQuery: true, ...(datetime ? { datetime } : {}) } })
  return signed.url
}

/** Signed PUT: the browser must send exactly this Content-Type. */
export async function signPut(key: string, contentType: string) {
  const url = new URL(objectUrl(key))
  url.searchParams.set('X-Amz-Expires', String(UPLOAD_TTL))
  const signed = await client().sign(url.toString(), { method: 'PUT', headers: { 'Content-Type': contentType }, aws: { signQuery: true } })
  return signed.url
}

/** Size in bytes, or null when the object is missing. */
export async function head(key: string): Promise<number | null> {
  const res = await client().fetch(objectUrl(key), { method: 'HEAD' })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`R2 HEAD ${res.status}`)
  return Number(res.headers.get('content-length') ?? 0)
}

export async function remove(key: string) {
  const res = await client().fetch(objectUrl(key), { method: 'DELETE' })
  if (!res.ok && res.status !== 404) throw new Error(`R2 DELETE ${res.status}`)
}

/** attachment; filename="…" with a UTF-8 fallback for non-ASCII names */
export function contentDisposition(filename: string) {
  const safe = filename.replace(/["\\\r\n]/g, '').replace(/[^\x20-\x7e]/g, '_') || 'photo.jpg'
  return `attachment; filename="${safe}"; filename*=UTF-8''${encodeURIComponent(filename)}`
}

export const keys = {
  proofThumb: (g: string, i: string) => `galleries/${g}/proof/thumb/${i}.jpg`,
  proofPreview: (g: string, i: string) => `galleries/${g}/proof/preview/${i}.jpg`,
  finalThumb: (g: string, i: string) => `galleries/${g}/final/thumb/${i}.jpg`,
  finalWeb: (g: string, i: string) => `galleries/${g}/final/web/${i}.jpg`,
  finalOriginal: (g: string, i: string, ext: string) => `galleries/${g}/final/original/${i}.${ext}`,
}
