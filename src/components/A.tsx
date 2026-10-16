import { useRouter } from '@tanstack/react-router'
import type { AnchorHTMLAttributes, MouseEvent } from 'react'

/** Internal links navigate client-side; everything else is a normal anchor. */
export function A({ href = '', onClick, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const router = useRouter()
  const internal = href.startsWith('/') && !href.startsWith('//')
  function handle(e: MouseEvent<HTMLAnchorElement>) {
    onClick?.(e)
    if (e.defaultPrevented || !internal) return
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
    e.preventDefault()
    router.navigate({ to: href as never })
  }
  return <a href={href} onClick={handle} {...rest} />
}
