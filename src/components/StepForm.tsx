import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { validateField } from '../booking/catalog'
import { site, whatsappLink } from '../site'
import { smoothScrollTo } from '../motion/scroll'
import type { FormDef, FormField } from './formDefs'
import '../booking/booking.css'
import './stepform.css'

const STORE_KEY = 'illuszionz:contact'
const remembered = (): Record<string, string> => {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}') } catch { return {} }
}

function Input({ f, value, error, onChange, id }: { f: FormField; value: string; error?: string; onChange: (v: string) => void; id: string }) {
  const common = { id, name: f.id, value, required: f.required, 'aria-invalid': !!error, 'aria-describedby': error ? `${id}-err` : undefined } as const
  let control
  if (f.type === 'textarea') control = <textarea {...common} rows={5} placeholder={f.placeholder} onChange={(e) => onChange(e.target.value)} />
  else if (f.type === 'select')
    control = (
      <select {...common} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select…</option>
        {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    )
  else if (f.type === 'chips' && f.rating)
    control = (
      <div className="sf-stars" role="radiogroup" aria-label={f.label}>
        {f.options?.map((o) => (
          <button type="button" key={o} role="radio" aria-checked={Number(value) >= Number(o) && value !== ''} aria-label={`${o} out of 5`} className={Number(value) >= Number(o) && value !== '' ? 'is-on' : ''} onClick={() => onChange(value === o ? '' : o)}>★</button>
        ))}
        {value && <span>{value} / 5</span>}
      </div>
    )
  else if (f.type === 'chips')
    control = (
      <div className="bk-chips" role="radiogroup" aria-label={f.label}>
        {f.options?.map((o) => <button type="button" key={o} className={value === o ? 'is-on' : ''} aria-pressed={value === o} onClick={() => onChange(value === o ? '' : o)}>{o}</button>)}
      </div>
    )
  else control = <input {...common} type={f.type === 'number' ? 'text' : f.type} placeholder={f.placeholder} autoComplete={f.autoComplete} onChange={(e) => onChange(e.target.value)} />
  return (
    <div className={'bk-field' + (f.half ? ' is-half' : '') + (error ? ' has-error' : '')}>
      <label htmlFor={id}>{f.label}{f.required && <i aria-hidden="true"> *</i>}</label>
      {control}
      {f.hint && !error && <small className="sf-hint">{f.hint}</small>}
      {error && <span className="bk-err" id={`${id}-err`} role="alert">{error}</span>}
    </div>
  )
}

/**
 * The site's enquiry / contact / review forms: the same black, stepped panel as the booking forms
 * (progress bar, animated steps, review step, confirmation screen), posting to /api/form.
 */
export function StepForm({ def }: { def: FormDef }) {
  const [i, setI] = useState(0)
  const [dir, setDir] = useState(1)
  const [values, setValues] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [website, setWebsite] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const r = remembered()
    setValues((v) => ({ ...v, ...(def.steps.some((s) => s.fields.some((f) => f.id === 'name')) && r.name ? { name: r.name } : {}), ...(r.email ? { email: r.email } : {}), ...(r.phone && def.steps.some((s) => s.fields.some((f) => f.id === 'phone')) ? { phone: r.phone } : {}) }))
  }, [def])

  const steps = useMemo(() => [...def.steps.map((s) => ({ ...s, kind: 'fields' as const })), { id: 'review', title: 'Review', blurb: undefined, fields: [] as FormField[], kind: 'review' as const }], [def])
  const step = steps[i]
  const last = i === steps.length - 1
  const visible = (f: FormField) => !f.showIf || values[f.showIf.field] === f.showIf.equals
  const allFields = def.steps.flatMap((s) => s.fields).filter(visible)

  useEffect(() => { if (i > 0) smoothScrollTo(root.current, -110) }, [i])

  const set = (id: string, v: string) => {
    setValues((c) => ({ ...c, [id]: v }))
    if (errors[id]) setErrors((e) => ({ ...e, [id]: '' }))
  }
  function check(fields: FormField[]) {
    const next: Record<string, string> = {}
    for (const f of fields.filter(visible)) {
      const e = validateField(f, values[f.id] ?? '')
      if (e) next[f.id] = e
    }
    setErrors(next)
    if (Object.keys(next).length) { document.getElementById(`sf-${def.key}-${Object.keys(next)[0]}`)?.focus(); return false }
    return true
  }
  const go = (n: number) => { setDir(n > i ? 1 : -1); setI(n) }
  const next = () => { if (step.kind !== 'fields' || check(step.fields)) go(Math.min(steps.length - 1, i + 1)) }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!check(allFields)) {
      const bad = def.steps.findIndex((s) => s.fields.some((f) => visible(f) && validateField(f, values[f.id] ?? '')))
      if (bad >= 0) go(bad)
      return
    }
    setSending(true)
    setError('')
    try {
      const fd = new FormData()
      fd.set('payload', JSON.stringify({ formName: def.key, fields: allFields.map((f) => ({ label: f.label.replace(/ \(optional\)$/, ''), value: (values[f.id] ?? '').trim() })), website }))
      const res = await fetch('/api/form', { method: 'POST', body: fd })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) throw new Error(data.error || `The server did not answer properly (HTTP ${res.status}).`)
      try { localStorage.setItem(STORE_KEY, JSON.stringify({ ...remembered(), ...(values.name ? { name: values.name } : {}), ...(values.email ? { email: values.email } : {}), ...(values.phone ? { phone: values.phone } : {}) })) } catch { /* ignore */ }
      setDone(true)
    } catch (err) {
      setError(`We couldn’t send that just now. ${err instanceof Error ? err.message : ''} Please try again, or reach us on WhatsApp.`)
    } finally {
      setSending(false)
    }
  }

  const header = (
    <div className="bk-head">
      <div>
        <p className="bk-eyebrow">{def.eyebrow}</p>
        <h3>{def.title}</h3>
      </div>
    </div>
  )

  if (done)
    return (
      <div className="bk-panel is-form" role="status" ref={root} data-no-motion>
        {header}
        <div className="bk-done">
          <div className="bk-tick" aria-hidden="true">✓</div>
          <h4>{def.successTitle}</h4>
          <p>{def.success}</p>
          <div className="bk-actions">
            <a className="bk-btn is-light" href={whatsappLink(`Hi ${site.shortName}, I just sent a ${def.key === 'review' ? 'review' : 'message'} on the website.`)} target="_blank" rel="noreferrer">Chat on WhatsApp</a>
            <button type="button" className="bk-btn is-ghost" onClick={() => { setDone(false); setI(0); setValues({}) }}>Send another</button>
          </div>
        </div>
      </div>
    )

  return (
    <form className="bk-panel is-form" onSubmit={submit} noValidate ref={root as never} data-no-motion aria-busy={sending}>
      {header}
      <ol className="bk-steps" aria-label="Progress">
        {steps.map((s, n) => (
          <li key={s.id} className={n === i ? 'is-current' : n < i ? 'is-done' : ''}>
            <button type="button" disabled={n > i} onClick={() => go(n)} aria-current={n === i ? 'step' : undefined}><b>{String(n + 1).padStart(2, '0')}</b><span>{s.title}</span></button>
          </li>
        ))}
      </ol>
      <div className="bk-bar" aria-hidden="true"><i style={{ width: `${((i + 1) / steps.length) * 100}%` }} /></div>

      <div className="bk-grid">
        <div className="bk-main">
          <AnimatePresence mode="wait" initial={false} custom={dir}>
            <motion.div key={step.id} custom={dir} initial={{ opacity: 0, x: dir * 32 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: dir * -32 }} transition={{ duration: 0.2, ease: 'easeOut' }}>
              <h4 className="bk-step-title">{step.kind === 'review' ? 'Check and send' : step.title}</h4>
              {step.kind === 'fields' && step.blurb && <p className="bk-blurb">{step.blurb}</p>}
              {step.kind === 'review' && <p className="bk-blurb">Here is what you are about to send.</p>}
              {step.kind === 'fields' && (
                <div className="bk-fields">
                  {step.fields.filter(visible).map((f) => <Input key={f.id} f={f} id={`sf-${def.key}-${f.id}`} value={values[f.id] ?? ''} error={errors[f.id]} onChange={(v) => set(f.id, v)} />)}
                </div>
              )}
              {step.kind === 'review' && (
                <div className="bk-review">
                  <dl>{allFields.filter((f) => (values[f.id] ?? '').trim()).map((f) => <div key={f.id}><dt>{f.label}</dt><dd>{f.rating ? `${'★'.repeat(Number(values[f.id]))} (${values[f.id]}/5)` : values[f.id]}</dd></div>)}</dl>
                  <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" value={website} onChange={(e) => setWebsite(e.target.value)} className="bk-hp" />
                  {error && <p className="bk-err bk-err-lg" role="alert">{error}</p>}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <div className="bk-foot">
        <button type="button" className="bk-btn is-ghost" disabled={i === 0} style={{ visibility: i === 0 ? 'hidden' : 'visible' }} onClick={() => go(i - 1)}>Back</button>
        {last ? <button key="submit" type="submit" className="bk-btn is-light" disabled={sending}>{sending ? 'Sending…' : def.submitLabel}</button> : <button key="next" type="button" className="bk-btn is-light" onClick={next}>Continue</button>}
      </div>
    </form>
  )
}
