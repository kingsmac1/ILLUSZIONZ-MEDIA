import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

type MenuCtx = { open: boolean; openMenu: (e?: { preventDefault: () => void }) => void; closeMenu: (e?: { preventDefault: () => void }) => void }
const Ctx = createContext<MenuCtx>({ open: false, openMenu() {}, closeMenu() {} })

export function MenuProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const openMenu = useCallback((e?: { preventDefault: () => void }) => { e?.preventDefault(); setOpen(true) }, [])
  const closeMenu = useCallback((e?: { preventDefault: () => void }) => { e?.preventDefault(); setOpen(false) }, [])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])
  const value = useMemo(() => ({ open, openMenu, closeMenu }), [open, openMenu, closeMenu])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
export const useMenu = () => useContext(Ctx)
