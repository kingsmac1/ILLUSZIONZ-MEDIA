/**
 * The client's hearts + notes. Optimistic: the heart fills instantly, the row is written to gallery_selections in the
 * background (RLS checks it is their gallery, still open, and within the limit) and rolled back with a message if refused.
 */
import { useCallback, useRef, useState } from 'react'
import { supabase } from '../../../admin/supabase'

export type Picks = Map<string, string | null>

export function usePicks(galleryId: string, email: string, initial: { image_id: string; note: string | null }[], opts: { limit: number | null; extras: boolean; locked: boolean; onMessage: (m: string) => void }) {
  const [picks, setPicks] = useState<Picks>(() => new Map(initial.map((s) => [s.image_id, s.note])))
  const ref = useRef(picks)
  ref.current = picks
  const o = useRef(opts)
  o.current = opts

  const update = (fn: (m: Picks) => void) => setPicks((cur) => { const n = new Map(cur); fn(n); ref.current = n; return n })

  const toggle = useCallback(async (imageId: string) => {
    const { limit, extras, locked, onMessage } = o.current
    if (locked) return onMessage('Your selection is submitted. Message us if you’d like to change it.')
    const had = ref.current.has(imageId)
    const prevNote = ref.current.get(imageId) ?? null
    if (!had && limit && !extras && ref.current.size >= limit) return onMessage(`You’ve picked all ${limit} photos. Remove one to choose another.`)
    update((m) => (had ? m.delete(imageId) : m.set(imageId, null)))
    const { error } = had
      ? await supabase!.from('gallery_selections').delete().eq('image_id', imageId).eq('client_email', email)
      : await supabase!.from('gallery_selections').insert({ gallery_id: galleryId, image_id: imageId, client_email: email })
    if (error) {
      update((m) => (had ? m.set(imageId, prevNote) : m.delete(imageId)))
      onMessage(/up to \d+/i.test(error.message) ? error.message : 'That didn’t save — check your connection and try again.')
      return
    }
    if (!had && limit && ref.current.size === limit) onMessage(extras ? `That’s your ${limit} included photos — any more are extras.` : `That’s all ${limit}! Review your picks, then submit.`)
  }, [galleryId, email])

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
    const { error } = await supabase!.from('gallery_selections').update({ note: clean }).eq('image_id', imageId).eq('client_email', email)
    if (error) { update((m) => m.set(imageId, before)); onMessage('Your note didn’t save — try again.'); return false }
    return true
  }, [email, toggle])

  return { picks, toggle, setNote }
}
