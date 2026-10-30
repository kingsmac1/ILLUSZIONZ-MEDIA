/**
 * Filename helpers shared by the dashboard and the Edge Functions (supabase/functions/_shared/filenames.ts is a copy —
 * keep them identical). Pure functions, no imports.
 */

/** "DSC_0012.JPG" -> "DSC_0012" */
export const stem = (filename: string) => filename.replace(/^.*[\\/]/, '').replace(/\.[^.]+$/, '')

/** Matching key for finals <-> proofs: "DSC_0012-edit.jpg", "DSC_0012 copy 2.jpg", "dsc_0012_final.tif" -> "dsc_0012" */
export const matchKey = (filename: string) =>
  stem(filename)
    .toLowerCase()
    .replace(/([-_ ]?(edit(ed)?|final|retouch(ed)?|copy|bw|b&w|web|hi-?res|lr|ps)(\s*\d+)?)+$/g, '')
    .replace(/[-_ ]\d{1,2}$/, (m) => (/^[-_ ]0?\d$/.test(m) ? '' : m))
    .trim()

/** Natural sort ("DSC_2" before "DSC_10") — camera order. */
export const byFilename = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })

/** One filename per line, in camera order. */
export const filenameList = (names: string[]) => [...names].sort(byFilename).join('\n')

/**
 * Lightroom Classic: Library → Filter bar → Text → Filename → "Contains", paste this. "Contains" matches ANY of the
 * comma-separated terms, so this shows exactly the picked photos. Extensions are stripped so RAW + JPEG both match.
 */
export const lightroomFilter = (names: string[]) => [...new Set(names.map(stem))].sort(byFilename).join(', ')
