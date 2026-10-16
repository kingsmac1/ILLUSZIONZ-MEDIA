import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { computeQuote, formatGBP, validateField, type Field, type Flow, type Selection } from './catalog'
import { applyOverrides, type PriceOverride } from './overrides'
import { site, whatsappLink } from '../site'
import { smoothScrollTo } from '../motion/scroll'
import './booking.css'

const STORE_KEY = 'illuszionz:contact'

type Remembered = { name?: string; phone?: string; email?: string }
const loadRemembered = (): Remembered => {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}') as Remembered
  } catch {
    return {}
  }
}

type StepDef = { id: string; title: string; kind: 'options' | 'fields' | 'extras' | 'review'; fields?: Field[]; blurb?: string }

function stepsFor(flow: Flow): StepDef[] {
  const out: StepDef[] = [{ id: 'options', title: flow.optionTitle.replace(/^Choose your /i, '').replace(/^Your /i, '') || 'Package', kind: 'options', blurb: flow.optionBlurb }]
  for (const s of flow.steps) out.push({ id: s.id, title: s.title, kind: 'fields', fields: s.fields, blurb: s.blurb })
  if (flow.extras.length) out.push({ id: 'extras', title: flow.extrasTitle ?? 'Extras', kind: 'extras', blurb: flow.extrasBlurb })
  out.push({ id: 'review', title: 'Review', kind: 'review' })
  return out
}

let overrideCache: PriceOverride[] | null = null
const loadOverrides = async (): Promise<PriceOverride[]> => {
  if (overrideCache) return overrideCache
  try {
    const res = await fetch('/api/prices')
    const data = (await res.json()) as { overrides?: PriceOverride[] }
    overrideCache = data.overrides ?? []
  } catch {
    overrideCache = []
  }
  return overrideCache
}

const todayIso = () => new Date().toISOString().slice(0, 10)

function Stepper({ value, min, max, onChange, label }: { value: number; min: number; max: number; onChange: (n: number) => void; label: string }) {
  return (
    <div className="bk-stepper" role="group" aria-label={label}>
      <button type="button" aria-label={`Decrease ${label}`} onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min}>−</button>
      <span aria-live="polite">{value}</span>
      <button type="button" aria-label={`Increase ${label}`} onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max}>+</button>
    </div>
  )
}

function FieldInput({ f, value, error, onChange }: { f: Field; value: string; error?: string; onChange: (v: string) => void }) {
  const id = `bk-${f.id}`
  const common = { id, name: f.id, value, required: f.required, 'aria-invalid': !!error, 'aria-describedby': error ? `${id}-err` : undefined } as const
  let control
  switch (f.type) {
    case 'textarea':
      control = <textarea {...common} rows={4} placeholder={f.placeholder} onChange={(e) => onChange(e.target.value)} />
      break
    case 'select':
      control = (
        <select {...common} onChange={(e) => onChange(e.target.value)}>
          <option value="">Select…</option>
          {f.options?.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      )
      break
    case 'chips': {
      const picked = f.multi ? (value ? value.split(', ') : []) : [value]
      control = (
        <div className="bk-chips" role={f.multi ? 'group' : 'radiogroup'} aria-label={f.label}>
          {f.options?.map((o) => {
            const on = picked.includes(o)
            return (
              <button
                type="button"
                key={o}
                className={on ? 'is-on' : ''}
                aria-pressed={on}
                onClick={() => onChange(f.multi ? (on ? picked.filter((p) => p !== o) : [...picked, o]).join(', ') : on ? '' : o)}
              >
                {o}
              </button>
            )
          })}
        </div>
      )
      break
    }
    default:
      control = (
        <input
          {...common}
          type={f.type === 'number' ? 'text' : f.type}
          inputMode={f.type === 'number' ? 'numeric' : undefined}
          min={f.type === 'date' ? todayIso() : undefined}
          placeholder={f.placeholder}
          autoComplete={f.autoComplete}
          onChange={(e) => onChange(e.target.value)}
        />
      )
  }
  return (
    <div className={'bk-field' + (f.half ? ' is-half' : '') + (error ? ' has-error' : '')}>
      <label htmlFor={id}>
        {f.label}
        {f.required && <i aria-hidden="true"> *</i>}
      </label>
      {control}
      {error && (
        <span className="bk-err" id={`${id}-err`} role="alert">
          {error}
        </span>
      )}
    </div>
  )
}

export function BookingPanel({ flow: baseFlow, initialOptionId, onClose }: { flow: Flow; initialOptionId?: string; onClose: () => void }) {
  const [overrides, setOverrides] = useState<PriceOverride[]>(overrideCache ?? [])
  useEffect(() => {
    let live = true
    loadOverrides().then((o) => live && setOverrides(o))
    return () => {
      live = false
    }
  }, [])
  const flow = useMemo(() => applyOverrides(baseFlow, overrides), [baseFlow, overrides])
  const [promoInput, setPromoInput] = useState('')
  const [promo, setPromo] = useState<null | { code: string; discount: number; label: string }>(null)
  const [promoMsg, setPromoMsg] = useState('')
  const steps = useMemo(() => stepsFor(flow), [flow])
  const [i, setI] = useState(0)
  const [dir, setDir] = useState(1)
  const [optionIds, setOptionIds] = useState<string[]>(initialOptionId ? [initialOptionId] : flow.optionsMulti ? [] : [])
  const [units, setUnits] = useState<Record<string, number>>({})
  const [extras, setExtras] = useState<Record<string, number>>({})
  const [fields, setFields] = useState<Record<string, string>>(() => {
    const r = typeof window === 'undefined' ? {} : loadRemembered()
    return { name: r.name ?? '', phone: r.phone ?? '', email: r.email ?? '' }
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [optionError, setOptionError] = useState('')
  const [agree, setAgree] = useState(false)
  const [website, setWebsite] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<null | { total: string }>(null)
  const bodyRef = useRef<HTMLDivElement>(null)

  const baseQuote = computeQuote(flow, { optionIds, units, extras })
  const discount = promo ? Math.min(promo.discount, baseQuote.total) : 0
  const quote = discount
    ? { ...baseQuote, lines: [...baseQuote.lines, { label: `Promo ${promo!.code}`, amount: `−${formatGBP(discount)}`, value: -discount }], totalText: formatGBP(baseQuote.total - discount) + (baseQuote.quoted ? '+' : '') }
    : baseQuote

  async function applyPromo() {
    const code = promoInput.trim()
    if (!code) return
    setPromoMsg('Checking…')
    try {
      const res = await fetch(`/api/promo?code=${encodeURIComponent(code)}&flow=${flow.id}&subtotal=${baseQuote.total}`)
      const d = (await res.json()) as { ok: boolean; error?: string; code?: string; discount?: number; label?: string }
      if (d.ok) {
        setPromo({ code: d.code!, discount: d.discount!, label: d.label! })
        setPromoMsg(`Applied: ${d.label}`)
      } else {
        setPromo(null)
        setPromoMsg(d.error ?? 'That code is not valid.')
      }
    } catch {
      setPromoMsg('Could not check the code. Try again.')
    }
  }
  const step = steps[i]
  const last = i === steps.length - 1

  useEffect(() => {
    smoothScrollTo(bodyRef.current, -120)
  }, [i])

  const unitFor = (id: string) => {
    const o = flow.options.find((x) => x.id === id)
    return o?.unit ? units[id] ?? o.unit.def : 1
  }

  function pickOption(id: string) {
    setOptionError('')
    setOptionIds((cur) => (flow.optionsMulti ? (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]) : [id]))
  }

  function validateStep(): boolean {
    if (step.kind === 'options') {
      if (!optionIds.length) {
        setOptionError('Please choose an option to continue.')
        return false
      }
      return true
    }
    if (step.kind === 'fields') {
      const next: Record<string, string> = {}
      for (const f of step.fields ?? []) {
        const e = validateField(f, fields[f.id] ?? '')
        if (e) next[f.id] = e
      }
      setErrors(next)
      if (Object.keys(next).length) {
        const firstId = Object.keys(next)[0]
        document.getElementById(`bk-${firstId}`)?.focus()
        return false
      }
    }
    return true
  }

  const go = (n: number) => {
    setDir(n > i ? 1 : -1)
    setI(n)
  }
  const next = () => {
    if (validateStep()) go(Math.min(steps.length - 1, i + 1))
  }

  const summaryText = () => {
    const picked = optionIds.map((id) => flow.options.find((o) => o.id === id)?.label).filter(Boolean)
    const lines = [
      `*${flow.kind} — ${site.shortName}*`,
      `Name: ${fields.name}`,
      `Phone: ${fields.phone}`,
      `Email: ${fields.email}`,
      `${flow.optionsMulti ? 'Interested in' : 'Package'}: ${picked.join(', ')}`,
      ...flow.steps.flatMap((s) => s.fields.filter((f) => !['name', 'phone', 'email'].includes(f.id) && fields[f.id]).map((f) => `${f.label}: ${fields[f.id]}`)),
      ...quote.lines.map((l) => `• ${l.label} — ${l.amount}`),
      `*${quote.totalText.startsWith('£') ? 'TOTAL' : 'PRICING'}: ${quote.totalText}*`,
    ]
    return lines.join('\n')
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!agree) {
      setError('Please tick the box to confirm you have read the terms.')
      return
    }
    setSending(true)
    setError('')
    // open the WhatsApp tab inside the click so popup blockers allow it (same pattern as the other studio sites)
    let tab: Window | null = null
    try {
      tab = window.open('', '_blank')
      if (tab) tab.opener = null
    } catch {
      /* ignore */
    }
    try {
      const sel: Selection & { website: string; promo?: string } = { flowId: flow.id, optionIds, units, extras, fields, website, promo: promo?.code }
      const res = await fetch('/api/booking', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sel) })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; total?: string }
      if (!res.ok || !data.ok) throw new Error(data.error || 'Something went wrong.')
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify({ name: fields.name, phone: fields.phone, email: fields.email }))
      } catch {
        /* ignore */
      }
      setDone({ total: data.total ?? quote.totalText })
      const url = whatsappLink(summaryText())
      if (tab) tab.location.href = url
    } catch (err) {
      tab?.close()
      setError(`We couldn't send that just now. ${err instanceof Error ? err.message : ''} Please try again, or reach us on WhatsApp.`)
    } finally {
      setSending(false)
    }
  }

  const header = (
    <div className="bk-head">
      <div>
        <p className="bk-eyebrow">{flow.kind}</p>
        <h3>{flow.title}</h3>
      </div>
      <button type="button" className="bk-close" onClick={onClose} aria-label="Close booking form">
        <span aria-hidden="true">×</span>
      </button>
    </div>
  )

  if (done) {
    return (
      <div className="bk-panel" role="status">
        {header}
        <div className="bk-done">
          <div className="bk-tick" aria-hidden="true">✓</div>
          <h4>{flow.headline}</h4>
          <p>
            Thank you{fields.name ? `, ${fields.name.split(' ')[0]}` : ''}. {fields.email ? `A confirmation is on its way to ${fields.email}. ` : ''}
            To finish, send us your details on WhatsApp{flow.payLink ? ' and complete payment below' : ''}.
          </p>
          <p className="bk-done-total">{done.total}</p>
          <ol>
            {flow.nextSteps.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ol>
          <div className="bk-actions">
            <a className="bk-btn is-light" href={whatsappLink(summaryText())} target="_blank" rel="noreferrer">
              Continue on WhatsApp
            </a>
            {flow.payLink && (
              <a className="bk-btn is-ghost" href={flow.payLink} target="_blank" rel="noreferrer">
                Pay now
              </a>
            )}
            <button type="button" className="bk-btn is-ghost" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <form className="bk-panel" onSubmit={submit} noValidate>
      {header}
      <ol className="bk-steps" aria-label="Progress">
        {steps.map((s, n) => (
          <li key={s.id} className={n === i ? 'is-current' : n < i ? 'is-done' : ''}>
            <button type="button" disabled={n > i} onClick={() => go(n)} aria-current={n === i ? 'step' : undefined}>
              <b>{String(n + 1).padStart(2, '0')}</b>
              <span>{s.title}</span>
            </button>
          </li>
        ))}
      </ol>
      <div className="bk-bar" aria-hidden="true">
        <i style={{ width: `${((i + 1) / steps.length) * 100}%` }} />
      </div>

      <div className="bk-grid" ref={bodyRef}>
        <div className="bk-main">
          <AnimatePresence mode="wait" initial={false} custom={dir}>
            <motion.div
              key={step.id}
              custom={dir}
              initial={{ opacity: 0, x: dir * 36 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: dir * -36 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
            >
              <h4 className="bk-step-title">{step.kind === 'options' ? flow.optionTitle : step.title}</h4>
              {step.blurb && <p className="bk-blurb">{step.blurb}</p>}
              {step.id === 'options' && !step.blurb && i === 0 && <p className="bk-blurb">{flow.intro}</p>}

              {step.kind === 'options' && (
                <div className="bk-options" role={flow.optionsMulti ? 'group' : 'radiogroup'}>
                  {flow.options.map((o) => {
                    const on = optionIds.includes(o.id)
                    return (
                      <div key={o.id} className={'bk-option' + (on ? ' is-on' : '')}>
                        <button type="button" className="bk-option-main" aria-pressed={on} onClick={() => pickOption(o.id)}>
                          <span className="bk-radio" aria-hidden="true" data-multi={flow.optionsMulti ? '1' : undefined} />
                          <span className="bk-option-text">
                            <strong>{o.label}</strong>
                            {o.note && <small>{o.note}</small>}
                            {o.includes && (
                              <ul>
                                {o.includes.map((x) => (
                                  <li key={x}>{x}</li>
                                ))}
                              </ul>
                            )}
                          </span>
                          {o.price > 0 && <span className="bk-price">{formatGBP(o.price)}{o.unit ? <em>/{o.unit.label}</em> : null}</span>}
                        </button>
                        {on && o.unit && (
                          <div className="bk-unit">
                            <span>
                              How many {o.unit.plural}?
                            </span>
                            <Stepper
                              value={unitFor(o.id)}
                              min={o.unit.min}
                              max={o.unit.max}
                              label={o.unit.plural}
                              onChange={(n) => setUnits((u) => ({ ...u, [o.id]: n }))}
                            />
                          </div>
                        )}
                      </div>
                    )
                  })}
                  {optionError && <p className="bk-err" role="alert">{optionError}</p>}
                </div>
              )}

              {step.kind === 'fields' && (
                <div className="bk-fields">
                  {step.fields?.map((f) => (
                    <FieldInput
                      key={f.id}
                      f={f}
                      value={fields[f.id] ?? ''}
                      error={errors[f.id]}
                      onChange={(v) => {
                        setFields((cur) => ({ ...cur, [f.id]: v }))
                        if (errors[f.id]) setErrors((e) => ({ ...e, [f.id]: '' }))
                      }}
                    />
                  ))}
                </div>
              )}

              {step.kind === 'extras' && (
                <div className="bk-extras">
                  {flow.extras.map((x) => {
                    const qty = extras[x.id] ?? 0
                    const on = qty > 0
                    return (
                      <div key={x.id} className={'bk-extra' + (on ? ' is-on' : '')}>
                        <button
                          type="button"
                          className="bk-extra-main"
                          aria-pressed={on}
                          onClick={() => setExtras((c) => ({ ...c, [x.id]: on ? 0 : 1 }))}
                        >
                          <span className="bk-check" aria-hidden="true" />
                          <span className="bk-option-text">
                            <strong>{x.label}</strong>
                            {x.note && <small>{x.note}</small>}
                          </span>
                          <span className="bk-price">
                            {x.price > 0 ? (x.from ? 'from ' : '') + formatGBP(x.price) : x.priceNote ?? 'Included'}
                            {x.unit && x.price > 0 ? <em>/{x.unit}</em> : null}
                          </span>
                        </button>
                        {on && x.max && x.max > 1 && (
                          <div className="bk-unit">
                            <span>Quantity</span>
                            <Stepper value={qty} min={1} max={x.max} label={x.unit ?? 'quantity'} onChange={(n) => setExtras((c) => ({ ...c, [x.id]: n }))} />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {step.kind === 'review' && (
                <div className="bk-review">
                  <dl>
                    <div><dt>Name</dt><dd>{fields.name}</dd></div>
                    <div><dt>Contact</dt><dd>{fields.phone}<br />{fields.email}</dd></div>
                    {flow.steps.flatMap((s) => s.fields).filter((f) => !['name', 'phone', 'email'].includes(f.id) && fields[f.id]).map((f) => (
                      <div key={f.id}><dt>{f.label}</dt><dd>{fields[f.id]}</dd></div>
                    ))}
                  </dl>
                  <div className="bk-terms">
                    <p>Good to know</p>
                    <ul>
                      {flow.terms.map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                    </ul>
                  </div>
                  {baseQuote.total > 0 && (
                    <div className="bk-promo">
                      <label htmlFor="bk-promo">Promo code</label>
                      <div>
                        <input id="bk-promo" value={promoInput} onChange={(e) => setPromoInput(e.target.value)} placeholder="Enter code" autoComplete="off" />
                        <button type="button" className="bk-btn is-ghost" onClick={applyPromo}>Apply</button>
                      </div>
                      {promoMsg && <small>{promoMsg}</small>}
                    </div>
                  )}
                  <label className="bk-agree">
                    <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
                    <span>I have read and agree to the terms above.</span>
                  </label>
                  <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" value={website} onChange={(e) => setWebsite(e.target.value)} className="bk-hp" />
                  {error && <p className="bk-err bk-err-lg" role="alert">{error}</p>}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <aside className="bk-summary" aria-label="Your selection">
          <p className="bk-eyebrow">Your selection</p>
          {quote.lines.length ? (
            <ul>
              {quote.lines.map((l) => (
                <li key={l.label}>
                  <span>{l.label}</span>
                  <b>{l.amount}</b>
                </li>
              ))}
            </ul>
          ) : (
            <p className="bk-muted">Nothing selected yet.</p>
          )}
          <div className="bk-total">
            <span>{flow.options.some((o) => o.price > 0) ? 'Estimated total' : 'Pricing'}</span>
            <strong>{optionIds.length ? quote.totalText : '—'}</strong>
          </div>
        </aside>
      </div>

      <div className="bk-foot">
        <button type="button" className="bk-btn is-ghost" onClick={() => (i === 0 ? onClose() : go(i - 1))}>
          {i === 0 ? 'Cancel' : 'Back'}
        </button>
        <div className="bk-foot-total" aria-hidden="true">{optionIds.length ? quote.totalText : ''}</div>
        {last ? (
          <button key="submit" type="submit" className="bk-btn is-light" disabled={sending}>
            {sending ? 'Sending…' : flow.submitLabel ?? 'Submit booking'}
          </button>
        ) : (
          <button key="next" type="button" className="bk-btn is-light" onClick={next}>
            Continue
          </button>
        )}
      </div>
    </form>
  )
}
