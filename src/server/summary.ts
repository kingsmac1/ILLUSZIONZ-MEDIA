import { computeQuote, formatGBP, type Flow, type Selection } from '../booking/catalog'
import type { EmailSummary } from './mail'

const prettyDate = (v: string) => {
  const d = new Date(v + 'T12:00:00')
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

export function buildSummary(flow: Flow, sel: Selection, promo?: { code: string; amount: number }): EmailSummary {
  const quote = computeQuote(flow, sel)
  const items = quote.lines.map((l) => ({ label: l.label, amount: l.amount }))
  let totalText = quote.totalText
  if (promo && promo.amount > 0) {
    items.push({ label: `Promo ${promo.code}`, amount: `−${formatGBP(promo.amount)}` })
    totalText = formatGBP(quote.total - promo.amount) + (quote.quoted ? '+' : '')
  }
  const f = sel.fields
  const details: [string, string][] = [['Service', flow.title]]
  const picked = sel.optionIds.map((id) => flow.options.find((o) => o.id === id)!.label)
  details.push([flow.optionsMulti ? 'Interested in' : 'Package', picked.join(', ')])
  const notes: { label: string; value: string }[] = []
  for (const step of flow.steps)
    for (const field of step.fields) {
      if (['name', 'phone', 'email'].includes(field.id)) continue
      const raw = (f[field.id] ?? '').trim()
      if (!raw) continue
      if (field.type === 'textarea') notes.push({ label: field.label, value: raw })
      else details.push([field.label, field.type === 'date' ? prettyDate(raw) : raw])
    }
  const anyPrice = flow.options.some((o) => o.price > 0)
  return {
    kind: flow.kind,
    name: f.name,
    email: f.email,
    phone: f.phone,
    headline: flow.headline,
    intro: `Thank you for choosing ${flow.title.toLowerCase()} with ${'Illuszionz Media'}. Your request is in — here is a summary of what you sent us.`,
    details,
    items,
    totalLabel: anyPrice ? 'Estimated total' : 'Pricing',
    total: anyPrice ? totalText : quote.totalText,
    notes,
    next: flow.nextSteps,
    terms: flow.terms,
    payLink: flow.payLink,
  }
}

