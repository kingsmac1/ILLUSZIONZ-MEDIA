/**
 * The client's hearts + notes. Optimistic: the heart fills instantly, the gallery-pick function saves it in the background
 * (it checks the private link or account, that the gallery is still open, and the limit) and it rolls back with a message
 * if refused. Works the same signed in or not.
 */
import { useCallback, useRef, useState } from 'react'
import { callFn } from '../api'

export type Picks = Map<string, string | null>

export function usePicks(galleryId: string, key: string | null, initial: { image_id: string; note: string | null }[], opts: { limit: number | null; extras: boolean; locked: boolean; onMessage: (m: string) => void }) {
  const [picks, setPicks] = useState<Picks>(() => new Map(initial.map((s) => [s.image_id, s.note])))
  const ref = useRef(picks)
  ref.current = picks
  const o = useRef(opts)
  o.current = opts

  const update = (fn: (m: Picks) => void) => setPicks((cur) => { const n = new Map(cur); fn(n); ref.current = n; return n })
  const save = (image_id: string, action: 'add' | 'remove' | 'note', note?: string | null) =>
    callFn<{ count: number }>('gallery-pick', { gallery_id: galleryId, key, image_id, action, note })

  const toggle = useCallback(async (imageId: string) => {
    const { limit, extras, locked, onMessage } = o.current
    if (locked) return onMessage('Your selection is submitted. Message us if you’d like to change it.')
    const had = ref.current.has(imageId)
    const prevNote = ref.current.get(imageId) ?? null
    if (!had && limit && !extras && ref.current.size >= limit) return onMessage(`You’ve picked all ${limit} photos. Remove one to choose another.`)
    update((m) => (had ? m.delete(imageId) : m.set(imageId, null)))
    const r = await save(imageId, had ? 'remove' : 'add')
    if (!r.ok) {
      update((m) => (had ? m.set(imageId, prevNote) : m.delete(imageId)))
      onMessage(/up to \d+|submitted|link in your email/i.test(r.error) ? r.error : 'That didn’t save — check your connection and try again.')
      return
    }
    if (!had && limit && ref.current.size === limit) onMessage(extras ? `That’s your ${limit} included photos — any more are extras.` : `That’s all ${limit}! Review your picks, then submit.`)
  }, [galleryId, key]) // eslint-disable-line react-hooks/exhaustive-deps

  const setNote = useCallback(async (imageId: string, note: string) => {
    const { locked, onMessage } = o.current
    if (locked) return false
    const clean = note.trim().slice(0, 1000) || null
    if (!ref.current.has(imageId)) {
      await toggle(imageId)
      if (!ref.current.has(imageId)) return false
    }
    const before = ref.current.get(imageId) ?? null
    update((m) => m.set(imageId, clean))
    const r = await save(imageId, 'note', clean)
    if (!r.ok) { update((m) => m.set(imageId, before)); onMessage('Your note didn’t save — try again.'); return false }
    return true
  }, [galleryId, key, toggle]) // eslint-disable-line react-hooks/exhaustive-deps

  return { picks, toggle, setNote }
}
