/** A gallery's address; with its private key it opens without signing in. */
export const galleryHref = (id: string, key?: string | null) => `/gallery/${id}/${key ? `?k=${encodeURIComponent(key)}` : ''}`
