/**
 * Email templates + Resend delivery. Table-based, inline-styled HTML (renders in Gmail, Outlook and
 * Apple Mail) with a plain-text twin. Every submission is normalised into an `EmailSummary`, then
 * rendered twice: `customerEmail` (confirmation) and `ownerEmail` (internal notification).
 */
import { site } from '../site'

export type EmailSummary = {
  /** e.g. "Portrait booking" */
  kind: string
  name: string
  email?: string
  phone?: string
  headline: string
  intro: string
  /** short key facts (hairline table) */
  details: [string, string][]
  /** priced lines */
  items: { label: string; amount: string }[]
  totalLabel?: string
  total?: string
  /** long answers: messages, inspiration … */
  notes?: { label: string; value: string }[]
  /** "What happens next" steps (customer) */
  next: string[]
  /** policy lines (customer) */
  terms?: string[]
  payLink?: string
  /** extra buttons for the customer (label, href) */
  buttons?: [string, string][]
  /** attached file names, listed in the owner mail */
  attachments?: string[]
}

export type RenderedEmail = { subject: string; html: string; text: string }

export type MailEnv = {
  RESEND_API_KEY?: string
  EMAIL_FROM?: string
  RESEND_FROM?: string
  OWNER_EMAIL?: string
  SITE_URL?: string
  MAIL_DRY_RUN?: string
}

const INK = '#0a0a0a'
const PAPER = '#f4f3ef'
const LINE = '#dcdad2'
const MUTED = '#85847e'
const SERIF = "'Playfair Display', Georgia, 'Times New Roman', serif"
const SANS = "-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif"

export const esc = (v: string) =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
const nl2br = (v: string) => esc(v).replace(/\r?\n/g, '<br>')

const label = (t: string, color = MUTED) =>
  `<span style="font-family:${SANS};font-size:11px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:${color};">${esc(t)}</span>`

function rows(list: [string, string][]) {
  return list
    .map(
      ([k, v]) => `<tr>
        <td style="padding:13px 0;border-bottom:1px solid ${LINE};width:38%;vertical-align:top;">${label(k)}</td>
        <td style="padding:13px 0;border-bottom:1px solid ${LINE};font-family:${SANS};font-size:14px;line-height:1.55;color:${INK};text-align:right;vertical-align:top;">${nl2br(v)}</td>
      </tr>`,
    )
    .join('')
}

function totalBlock(s: EmailSummary) {
  if (!s.total) return ''
  const items = s.items
    .map(
      (i) => `<tr>
        <td style="padding:7px 0;font-family:${SANS};font-size:13px;line-height:1.5;color:rgba(255,255,255,.72);">${esc(i.label)}</td>
        <td style="padding:7px 0;font-family:${SANS};font-size:13px;font-weight:700;color:#ffffff;text-align:right;white-space:nowrap;">${esc(i.amount)}</td>
      </tr>`,
    )
    .join('')
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${INK};margin-top:30px;border-radius:14px;">
    <tr><td style="padding:28px 28px 22px;">
      ${label(s.totalLabel ?? 'Total', 'rgba(255,255,255,.55)')}
      <div style="font-family:${SERIF};font-size:42px;font-weight:700;line-height:1.1;color:#ffffff;margin-top:10px;">${esc(s.total)}</div>
      ${s.items.length ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:20px;border-top:1px solid rgba(255,255,255,.16);">${items}</table>` : ''}
    </td></tr>
  </table>`
}

const button = (href: string, text: string, dark = true) =>
  `<a href="${esc(href)}" style="display:inline-block;margin:0 10px 10px 0;padding:15px 30px;background:${dark ? INK : '#ffffff'};color:${dark ? '#ffffff' : INK};border:1px solid ${INK};font-family:${SANS};font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;text-decoration:none;border-radius:999px;">${esc(text)}</a>`

function steps(list: string[]) {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:12px;">${list
    .map(
      (t, i) => `<tr>
      <td style="width:38px;vertical-align:top;padding:9px 0;"><div style="width:26px;height:26px;border-radius:50%;background:${INK};color:#fff;font-family:${SANS};font-size:12px;font-weight:700;line-height:26px;text-align:center;">${i + 1}</div></td>
      <td style="vertical-align:top;padding:11px 0;font-family:${SANS};font-size:14px;line-height:1.55;color:${INK};">${esc(t)}</td></tr>`,
    )
    .join('')}</table>`
}

function layout(o: { siteUrl: string; preheader: string; eyebrow?: string; title?: string; body: string }) {
  const logo = `${o.siteUrl}/images/illuszionz-logo-white.png`
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><title>${esc(o.title ?? site.name)}</title></head>
<body style="margin:0;padding:0;background:${PAPER};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(o.preheader)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${PAPER};"><tr><td align="center" style="padding:34px 12px;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid ${LINE};">
    <tr><td style="background:${INK};padding:34px 38px ${o.title ? '30px' : '34px'};">
      <a href="${esc(o.siteUrl)}" style="text-decoration:none;"><img src="${esc(logo)}" width="170" alt="${esc(site.name)}" style="display:block;border:0;height:auto;color:#fff;font-family:${SERIF};font-size:20px;letter-spacing:.16em;"></a>
    </td></tr>
    ${o.title ? `<tr><td style="background:${INK};padding:0 38px 40px;">
      ${label(o.eyebrow ?? '', 'rgba(255,255,255,.55)')}
      <h1 style="margin:14px 0 0;font-family:${SERIF};font-weight:700;font-size:36px;line-height:1.12;color:#ffffff;">${esc(o.title)}</h1>
    </td></tr>` : ''}
    <tr><td style="padding:40px 38px 46px;">${o.body}</td></tr>
    <tr><td style="background:${PAPER};border-top:1px solid ${LINE};padding:28px 38px;">
      <div style="font-family:${SERIF};font-size:15px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${INK};">${esc(site.name)}</div>
      <div style="margin-top:10px;font-family:${SANS};font-size:12px;line-height:1.8;color:${MUTED};">
        ${esc(site.tagline)}<br>
        <a href="tel:${esc(site.phone)}" style="color:${INK};text-decoration:none;font-weight:600;">${esc(site.phoneDisplay)}</a> ·
        <a href="mailto:${esc(site.email)}" style="color:${INK};text-decoration:none;font-weight:600;">${esc(site.email)}</a><br>
        <a href="${esc(site.instagram)}" style="color:${MUTED};">Instagram</a> · <a href="${esc(site.facebook)}" style="color:${MUTED};">Facebook</a> · <a href="${esc(site.x)}" style="color:${MUTED};">X</a>
      </div>
    </td></tr>
  </table>
  <div style="max-width:620px;margin:16px auto 0;font-family:${SANS};font-size:11px;color:${MUTED};text-align:center;">© ${new Date().getFullYear()} ${esc(site.name)}. You are receiving this because of a request made on ${esc(o.siteUrl.replace(/^https?:\/\//, ''))}.</div>
</td></tr></table></body></html>`
}

const plain = (s: EmailSummary) =>
  [
    ...s.details.map(([k, v]) => `${k}: ${v}`),
    ...(s.items.length ? ['', ...s.items.map((i) => `• ${i.label} — ${i.amount}`)] : []),
    ...(s.total ? [`${s.totalLabel ?? 'Total'}: ${s.total}`] : []),
    ...(s.notes ?? []).flatMap((n) => ['', `${n.label}: ${n.value}`]),
  ].join('\n')

const waLink = (phone?: string) => {
  const d = (phone ?? '').replace(/[^\d]/g, '')
  return d ? `https://wa.me/${d}` : ''
}

/** Confirmation to the person who submitted. */
export function customerEmail(s: EmailSummary, siteUrl: string): RenderedEmail {
  const first = s.name.trim().split(/\s+/)[0] || s.name
  const body = `
    <p style="margin:0 0 30px;font-family:${SANS};font-size:15.5px;line-height:1.75;color:${INK};">Hi ${esc(first)},<br><br>${esc(s.intro)}</p>
    <div>${label('Your request')}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:10px;border-top:1px solid ${LINE};">${rows(s.details)}</table>
    ${totalBlock(s)}
    ${s.notes?.length ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:26px;">${rows(s.notes.map((n) => [n.label, n.value] as [string, string]))}</table>` : ''}
    ${s.next.length ? `<div style="margin-top:38px;">${label('What happens next')}${steps(s.next)}</div>` : ''}
    ${s.terms?.length ? `<div style="margin-top:30px;padding:20px 22px;background:${PAPER};border-radius:12px;">${label('Good to know')}<ul style="margin:12px 0 0;padding-left:18px;font-family:${SANS};font-size:13px;line-height:1.8;color:${INK};">${s.terms.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>` : ''}
    <div style="margin-top:40px;">
      ${s.payLink ? button(s.payLink, 'Pay now') : ''}
      ${button(`https://wa.me/${site.whatsapp}`, 'Chat on WhatsApp', !s.payLink)}
      ${(s.buttons ?? []).map(([t, h]) => button(h, t, false)).join('')}
    </div>
    <p style="margin:26px 0 0;font-family:${SANS};font-size:12px;line-height:1.7;color:${MUTED};">Need to change something? Simply reply to this email.</p>`
  return {
    subject: `${s.headline} · ${site.name}`,
    html: layout({ siteUrl, preheader: s.intro, eyebrow: s.kind, title: s.headline, body }),
    text: [
      `${s.headline} — ${site.name}`,
      '',
      `Hi ${first},`,
      s.intro,
      '',
      plain(s),
      '',
      ...(s.next.length ? ['What happens next:', ...s.next.map((t, i) => `${i + 1}. ${t}`), ''] : []),
      s.payLink ? `Pay now: ${s.payLink}` : '',
      `WhatsApp: https://wa.me/${site.whatsapp}`,
      site.email,
    ].join('\n'),
  }
}

/** Internal notification to the owner. */
export function ownerEmail(s: EmailSummary, siteUrl: string): RenderedEmail {
  const wa = waLink(s.phone)
  const body = `
    <p style="margin:0 0 28px;font-family:${SANS};font-size:15.5px;line-height:1.7;color:${INK};"><strong>${esc(s.name)}</strong> just submitted <strong>${esc(s.kind.toLowerCase())}</strong> on the website.${s.email ? '' : ' No email was left — reach them by phone or WhatsApp.'}</p>
    <div>${label('Contact')}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:10px;border-top:1px solid ${LINE};">${rows([['Name', s.name], ['Phone', s.phone || '—'], ['Email', s.email || '—']])}</table>
    <div style="margin-top:28px;">${label('Details')}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:10px;border-top:1px solid ${LINE};">${rows(s.details.length ? s.details : [['—', '—']])}</table>
    ${totalBlock(s)}
    ${s.notes?.length ? `<div style="margin-top:28px;">${label('Notes')}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:10px;border-top:1px solid ${LINE};">${rows(s.notes.map((n) => [n.label, n.value] as [string, string]))}</table>` : ''}
    ${s.attachments?.length ? `<p style="margin:24px 0 0;font-family:${SANS};font-size:13px;color:${INK};"><strong>Attachments:</strong> ${esc(s.attachments.join(', '))}</p>` : ''}
    <div style="margin-top:38px;">
      ${wa ? button(wa, 'Reply on WhatsApp') : ''}
      ${s.email ? button(`mailto:${s.email}`, 'Reply by email', false) : ''}
    </div>`
  return {
    subject: `New ${s.kind.toLowerCase()} — ${s.name}${s.total ? ` (${s.total})` : ''}`,
    html: layout({ siteUrl, preheader: `${s.name}${s.total ? ' · ' + s.total : ''}`, eyebrow: 'New submission', title: `New ${s.kind.toLowerCase()}`, body }),
    text: [`NEW ${s.kind.toUpperCase()} — ${s.name}`, '', `Name: ${s.name}`, `Phone: ${s.phone || '—'}`, `Email: ${s.email || '—'}`, '', plain(s), wa ? `\nWhatsApp: ${wa}` : ''].join('\n'),
  }
}

/** Free-form branded email (automations + campaigns): eyebrow, title, paragraphs, optional image + button. */
export function genericEmail(o: {
  siteUrl: string
  subject: string
  eyebrow: string
  title: string
  body: string
  buttonLabel?: string
  buttonUrl?: string
  imageUrl?: string
  footerNote?: string
}): RenderedEmail {
  const paras = o.body
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 20px;font-family:${SANS};font-size:15.5px;line-height:1.75;color:${INK};">${nl2br(p.trim())}</p>`)
    .join('')
  const body = `${o.imageUrl ? `<img src="${esc(o.imageUrl)}" alt="" width="544" style="display:block;width:100%;height:auto;border-radius:12px;margin:0 0 26px;border:0;">` : ''}${paras}
    ${o.buttonLabel && o.buttonUrl ? `<div style="margin-top:30px;">${button(o.buttonUrl, o.buttonLabel)}</div>` : ''}
    ${o.footerNote ? `<p style="margin:26px 0 0;font-family:${SANS};font-size:12px;line-height:1.7;color:${MUTED};">${esc(o.footerNote)}</p>` : ''}`
  return {
    subject: o.subject,
    html: layout({ siteUrl: o.siteUrl, preheader: o.body.slice(0, 110).replace(/\s+/g, ' '), eyebrow: o.eyebrow, title: o.title, body }),
    text: `${o.title}\n\n${o.body}${o.buttonLabel && o.buttonUrl ? `\n\n${o.buttonLabel}: ${o.buttonUrl}` : ''}\n\n— ${site.name} · ${site.email}`,
  }
}

/** A campaign composed in the block builder: branded header + the blocks + the standard footer. */
export function blocksEmail(o: { siteUrl: string; subject: string; preheader?: string; html: string; text: string; footerNote?: string }): RenderedEmail {
  const body = `${o.html}${o.footerNote ? `<p style="margin:26px 0 0;font-family:${SANS};font-size:12px;line-height:1.7;color:${MUTED};">${esc(o.footerNote)}</p>` : ''}`
  return {
    subject: o.subject,
    html: layout({ siteUrl: o.siteUrl, preheader: o.preheader ?? o.text.slice(0, 110).replace(/\s+/g, ' '), body }),
    text: `${o.text}\n\n— ${site.name} · ${site.email}`,
  }
}

/* --------------------------------- delivery --------------------------------- */

export function mailConfig(env: MailEnv) {
  return {
    apiKey: env.RESEND_API_KEY,
    from: env.EMAIL_FROM ?? env.RESEND_FROM,
    owner: env.OWNER_EMAIL || site.email,
    siteUrl: (env.SITE_URL || site.url).replace(/\/$/, ''),
    dryRun: env.MAIL_DRY_RUN === '1',
  }
}

export type Attachment = { filename: string; content: string }

export async function send(env: MailEnv, o: { to: string; replyTo?: string; message: RenderedEmail; attachments?: Attachment[] }) {
  const { apiKey, from, dryRun } = mailConfig(env)
  if (dryRun) return // MAIL_DRY_RUN: render + log only
  const missing = [!apiKey && 'RESEND_API_KEY', !from && 'EMAIL_FROM'].filter(Boolean)
  if (missing.length) throw new Error(`Email is not configured on the server (missing ${missing.join(', ')}).`)
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [o.to],
      reply_to: o.replyTo,
      subject: o.message.subject,
      html: o.message.html,
      text: o.message.text,
      attachments: o.attachments?.length ? o.attachments : undefined,
    }),
  })
  if (!res.ok) {
    const raw = await res.text().catch(() => '')
    let detail = raw
    try {
      detail = (JSON.parse(raw) as { message?: string }).message ?? raw
    } catch {
      /* keep raw */
    }
    throw new Error(`Resend rejected the email (${res.status}): ${detail}`)
  }
}

/** Sends the owner notification (must succeed) and the customer confirmation (best effort). */
export async function deliver(env: MailEnv, s: EmailSummary, attachments: Attachment[] = []) {
  const cfg = mailConfig(env)
  const customer = customerEmail(s, cfg.siteUrl)
  const owner = ownerEmail(s, cfg.siteUrl)
  if (cfg.dryRun) return { dryRun: true as const, customer, owner }
  await send(env, { to: cfg.owner, replyTo: s.email, message: owner, attachments })
  if (s.email) {
    try {
      await send(env, { to: s.email, replyTo: cfg.owner, message: customer })
    } catch (err) {
      console.error('Customer confirmation failed', err)
    }
  }
  return { dryRun: false as const }
}
