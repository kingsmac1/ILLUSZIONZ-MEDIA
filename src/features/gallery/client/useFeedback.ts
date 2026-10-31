/**
 * The client's 👍 / 👎 and comments on the final photos. Optimistic like the picks: the button changes instantly, the
 * gallery-feedback function saves it, and it rolls back with a message if refused. `send` emails it all to the studio.
 */
import { useCallback, useRef, useState } from 'react'
import { callFn } from '../api'
import type { FeedbackRow } from '../types'

export type Feedback = Map<string, { reaction: 1 | -1 | null; comment: string | null }>

export function useFeedback(galleryId: string, key: string | null, initial: FeedbackRow[], sentAt: string | null, onMessage: (m: string) => void) {
  const [fb, setFb] = useState<Feedback>(() => new Map(initial.map((r) => [r.image_id, { reaction: r.reaction, comment: r.comment }])))
  const ref = useRef(fb)
  ref.current = fb
  const [sent, setSent] = useState(sentAt)
  // something changed since the last "Send feedback" (or it was never sent)
  const [dirty, setDirty] = useState(false)

  const put = (id: string, v: { reaction: 1 | -1 | null; comment: string | null }) =>
    setFb((cur) => { const n = new Map(cur); if (v.reaction == null && !v.comment) n.delete(id); else n.set(id, v); ref.current = n; return n })

  const react = useCallback(async (id: string, reaction: 1 | -1) => {
    const before = ref.current.get(id) ?? { reaction: null, comment: null }
    const next = before.reaction === reaction ? null : reaction // tapping the same thumb again clears it
    put(id, { ...before, reaction: next })
    setDirty(true)
    const r = await callFn('gallery-feedback', { gallery_id: galleryId, key, action: 'react', image_id: id, reaction: next ?? 0 })
    if (!r.ok) { put(id, before); onMessage(r.error) }
  }, [galleryId, key, onMessage])

  const comment = useCallback(async (id: string, text: string) => {
    const before = ref.current.get(id) ?? { reaction: null, comment: null }
    const clean = text.trim().slice(0, 2000) || null
    put(id, { ...before, comment: clean })
    setDirty(true)
    const r = await callFn('gallery-feedback', { gallery_id: galleryId, key, action: 'comment', image_id: id, comment: clean ?? '' })
    if (!r.ok) { put(id, before); onMessage(r.error); return false }
    return true
  }, [galleryId, key, onMessage])

  const send = useCallback(async () => {
    const r = await callFn<{ sent_at: string; whatsapp_text: string }>('gallery-feedback', { gallery_id: galleryId, key, action: 'send' })
    if (!r.ok) { onMessage(r.error); return null }
    setSent(r.sent_at)
    setDirty(false)
    return r
  }, [galleryId, key, onMessage])

  return { fb, react, comment, send, sent, dirty }
}
