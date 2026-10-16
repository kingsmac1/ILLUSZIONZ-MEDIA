import { createContext, useCallback, useContext, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import './forms.css'

/** Which email template/copy each WPForms-era form uses on the server (functions/api/form.ts). */
const FORM_KEYS: Record<string, string> = { '231': 'contact', '751': 'enquiry', '1053': 'review' }

type Logic = { field: string; operator: string; value: string; type?: string }
export type Conditions = Record<string, { logic: Logic[][]; action: 'show' | 'hide' }>

type FormCtx = { values: Record<string, string>; setValue: (field: string, value: string) => void; conditions: Conditions }
const Ctx = createContext<FormCtx>({ values: {}, setValue() {}, conditions: {} })

function fieldIdFromName(name: string) {
  const m = /^wpforms\[fields\]\[(\d+)\]/.exec(name)
  return m ? m[1] : null
}

function test(l: Logic, values: Record<string, string>) {
  const v = values[l.field] ?? ''
  switch (l.operator) {
    case '==': return v === l.value
    case '!=': return v !== l.value
    case 'c': return v.includes(l.value)
    case '!c': return !v.includes(l.value)
    case 'e': return v === ''
    case '!e': return v !== ''
    default: return false
  }
}

/** Renders its children only while the field's conditional-logic rule is satisfied. */
export function ConditionalField({ fieldId, children }: { fieldId: string; children: ReactNode }) {
  const { values, conditions } = useContext(Ctx)
  const rule = conditions[fieldId]
  if (!rule) return <>{children}</>
  const match = rule.logic.some((group) => group.every((l) => test(l, values)))
  const visible = rule.action === 'show' ? match : !match
  return visible ? <>{children}</> : null
}

export function FormShell({
  formId, conditions = {}, formClassName, children, success,
}: {
  formId: string; formName?: string; conditions?: Conditions; formClassName?: string
  children: ReactNode; success?: string
}) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [errorText, setErrorText] = useState('')
  const ref = useRef<HTMLFormElement>(null)

  const setValue = useCallback((field: string, value: string) => setValues((v) => (v[field] === value ? v : { ...v, [field]: value })), [])
  const ctx = useMemo(() => ({ values, setValue, conditions }), [values, setValue, conditions])

  function onChange(e: FormEvent<HTMLFormElement>) {
    const t = e.target as HTMLInputElement
    if (!t.name) return
    const id = fieldIdFromName(t.name)
    if (!id) return
    if (t.type === 'checkbox') {
      const checked = [...(ref.current?.querySelectorAll<HTMLInputElement>(`input[name="${CSS.escape(t.name)}"]:checked`) ?? [])].map((i) => i.value)
      setValue(id, checked.join(','))
    } else setValue(id, t.value)
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = ref.current
    if (!form) return
    const fd = new FormData()
    const fields: { label: string; value: string }[] = []
    let fileIndex = 0
    form.querySelectorAll<HTMLElement>('[data-field]').forEach((box) => {
      const label = box.getAttribute('data-label') || ''
      const vals: string[] = []
      box.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea').forEach((el) => {
        if (el.name === 'website') return
        if (el instanceof HTMLInputElement && el.type === 'file') {
          for (const file of Array.from(el.files ?? [])) {
            fd.append(`file${fileIndex++}`, file)
            vals.push(file.name)
          }
        } else if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) {
          if (el.checked) vals.push(el.value)
        } else if (el.value.trim()) vals.push(el.value.trim())
      })
      fields.push({ label, value: vals.join(', ') })
    })
    const website = (form.elements.namedItem('website') as HTMLInputElement | null)?.value ?? ''
    fd.set('payload', JSON.stringify({ formName: FORM_KEYS[formId] ?? 'enquiry', fields, website }))
    setState('sending')
    try {
      const res = await fetch('/api/form', { method: 'POST', body: fd })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) throw new Error(data.error)
      setState('done')
    } catch (err) {
      setErrorText(err instanceof Error && err.message ? err.message : '')
      setState('error')
    }
  }

  if (state === 'done') {
    return <div className="form-confirmation" role="status">{success ?? 'Thanks for contacting us! We will be in touch with you shortly.'}</div>
  }
  return (
    <Ctx.Provider value={ctx}>
      <form ref={ref} className={formClassName} method="post" onChange={onChange} onSubmit={onSubmit} aria-busy={state === 'sending'}>
        {children}
        <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="form-hp" />
        {state === 'error' && <p className="form-error" role="alert">We couldn’t send that just now. {errorText} Please try again or contact us on WhatsApp.</p>}
      </form>
    </Ctx.Provider>
  )
}

export type ChoiceOption = { value: string; label: string; placeholder?: boolean }
type ChoicesClasses = { root?: string; inner?: string; list?: string; item?: string; dropdown?: string; dropdownList?: string; option?: string }

/** Styled single select (replaces the Choices.js widget). Keeps a real <select> for form data. */
export function ChoicesSelect({
  name, id, required, options, cls = {}, fieldId,
}: { name: string; id: string; required?: boolean; options: ChoiceOption[]; cls?: ChoicesClasses; fieldId?: string }) {
  const placeholder = options.find((o) => o.placeholder)
  const real = options.filter((o) => !o.placeholder)
  const [value, setValueState] = useState('')
  const [open, setOpen] = useState(false)
  const [flipped, setFlipped] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const { setValue } = useContext(Ctx)
  const toggle = () => {
    if (!open && rootRef.current) {
      const r = rootRef.current.getBoundingClientRect()
      const need = Math.min(280, real.length * 39 + 2)
      setFlipped(window.innerHeight - r.bottom < need && r.top > need)
    }
    setOpen((o) => !o)
  }
  const current = real.find((o) => o.value === value)
  const pick = (v: string) => { setValueState(v); setOpen(false); if (fieldId) setValue(fieldId, v) }
  return (
    <div
      ref={rootRef}
      className={`${cls.root ?? ''} choices-root${open ? ' is-open' : ''}${flipped ? ' is-flipped' : ''}`}
      role="listbox"
      tabIndex={0}
      aria-expanded={open}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false) }}
      onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle() } }}
    >
      <div className={cls.inner} onClick={toggle}>
        <select id={id} name={name} required={required} value={value} onChange={(e) => pick(e.target.value)} tabIndex={-1} className="choices-native" aria-hidden="true">
          <option value="">{placeholder?.label ?? ''}</option>
          {real.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <div className={cls.list}>
          <div className={cls.item + (current ? '' : ' is-placeholder')}>{current ? current.label : (placeholder?.label ?? '')}</div>
        </div>
      </div>
      <div className={`${cls.dropdown ?? ''} choices-dropdown`} style={{ display: open ? 'block' : 'none' }}>
        <div className={cls.dropdownList} role="listbox">
          {real.map((o) => (
            <div key={o.value} role="option" aria-selected={o.value === value} className={`${cls.option ?? ''} choices-option${o.value === value ? ' is-selected' : ''}`} onMouseDown={(e) => { e.preventDefault(); pick(o.value) }}>
              {o.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
