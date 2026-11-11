/**
 * Website photos uploaded in the dashboard live in Supabase Storage (bucket site-media). Served straight from Supabase,
 * every visit counted against the Supabase plan's egress. Public responses rewrite those links to /site-media/… on our
 * own domain, where functions/site-media caches each file at Cloudflare's edge (free): Supabase is asked once per file
 * per data centre, not once per visitor.
 */
import type { DbEnv } from './db'

export const MEDIA_PREFIX = '/site-media/'
const storageBase = (env: DbEnv) => `${(env.SUPABASE_URL ?? '').replace(/\/$/, '')}/storage/v1/object/public/site-media/`

/** Replaces Supabase site-media links in a response body. `origin` makes them absolute (share images need that). */
export function edgeMedia(text: string, env: DbEnv, origin = ''): string {
  if (!env.SUPABASE_URL) return text
  return text.split(storageBase(env)).join(origin + MEDIA_PREFIX)
}

/** The Supabase address of a /site-media/ path (only plain file paths, no tricks). */
export function originFor(env: DbEnv, path: string): string | null {
  if (!env.SUPABASE_URL || !/^[\w\-./%]+$/.test(path) || path.includes('..')) return null
  return storageBase(env) + path
}
