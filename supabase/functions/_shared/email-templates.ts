/**
 * Gallery emails. Same look as the booking emails (src/server/mail.ts): table-based, inline styles, black header with the
 * logo, Playfair headline, one big pill button, plain-text twin. Brand values live at the top of this file.
 */
import { LOGO_CID } from './logo.ts'
import type { RenderedEmail } from './email.ts'

export const BRAND = {
  name: 'Illuszionz Media',
  tagline: 'Transforming moments, brands, and ideas into powerful visual experiences.',
  email: 'info@illuszionzmedia.com',
  phone: '+447864748937',
  instagram: 'https://www.instagram.com/illuszionzphotostudio/',
  facebook: 'https://web.facebook.com/Illuszionzweddings',
}

const INK = '#0a0a0a'
const PAPER = '#f4f3ef'
const LINE = '#dcdad2'
const MUTED = '#85847e'
const SERIF = "'Playfair Display', Georgia, 'Times New Roman', serif"
const SANS = "-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif"

export const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
const nl2br = (v: string) => esc(v).replace(/\r?\n/g, '<br>')
const first = (name: string) => name.trim().split(/\s+/)[0] || 'there'
export const fmtDay = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '')

const label = (t: string, color = MUTED) =>
  `<span style="font-family:${SANS};font-size:11px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:${color};">${esc(t)}</span>`
const p = (html: string, mt = 0) => `<p style="margin:${mt}px 0 0;font-family:${SANS};font-size:15.5px;line-height:1.75;color:${INK};">${html}</p>`
const small = (html: string, mt = 22) => `<p style="margin:${mt}px 0 0;font-family:${SANS};font-size:12.5px;line-height:1.7;color:${MUTED};">${html}</p>`
const button = (href: string, text: string, dark = true) =>
  `<a href="${esc(href)}" style="display:inline-block;margin:0 10px 10px 0;padding:16px 32px;background:${dark ? INK : '#ffffff'};color:${dark ? '#ffffff' : INK};border:1px solid ${INK};font-family:${SANS};font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;text-decoration:none;border-radius:999px;">${esc(text)}</a>`
const rows = (list: [string, string][]) =>
  `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:12px;border-top:1px solid ${LINE};">${list
    .map(([k, v]) => `<tr><td style="padding:12px 0;border-bottom:1px solid ${LINE};width:40%;vertical-align:top;">${label(k)}</td><td style="padding:12px 0;border-bottom:1px solid ${LINE};font-family:${SANS};font-size:14px;line-height:1.55;color:${INK};text-align:right;vertical-align:top;">${nl2br(v)}</td></tr>`)
    .join('')}</table>`
const quote = (t: string) =>
  `<div style="margin-top:26px;padding:20px 22px;background:${PAPER};border-radius:12px;font-family:${SERIF};font-size:16px;font-style:italic;line-height:1.6;color:${INK};">${nl2br(t)}</div>`
const mono = (t: string) =>
  `<div style="margin-top:10px;padding:16px 18px;background:${PAPER};border:1px solid ${LINE};border-radius:10px;font-family:Menlo,Consolas,monospace;font-size:12.5px;line-height:1.7;color:${INK};word-break:break-all;white-space:pre-wrap;">${esc(t)}</div>`

function layout(o: { siteUrl: string; preheader: string; eyebrow: string; title: string; body: string }) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><title>${esc(o.title)}</title></head>
<body style="margin:0;padding:0;background:${PAPER};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(o.preheader)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${PAPER};"><tr><td align="center" style="padding:34px 12px;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid ${LINE};">
    <tr><td style="background:${INK};padding:34px 38px 30px;">
      <a href="${esc(o.siteUrl)}" style="text-decoration:none;"><img src="cid:${LOGO_CID}" width="170" alt="${esc(BRAND.name)}" style="display:block;border:0;height:auto;color:#fff;font-family:${SERIF};font-size:20px;letter-spacing:.16em;"></a>
    </td></tr>
    <tr><td style="background:${INK};padding:0 38px 40px;">
      ${label(o.eyebrow, 'rgba(255,255,255,.55)')}
      <h1 style="margin:14px 0 0;font-family:${SERIF};font-weight:700;font-size:34px;line-height:1.14;color:#ffffff;">${esc(o.title)}</h1>
    </td></tr>
    <tr><td style="padding:40px 38px 46px;">${o.body}</td></tr>
    <tr><td style="background:${PAPER};border-top:1px solid ${LINE};padding:28px 38px;">
      <div style="font-family:${SERIF};font-size:15px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${INK};">${esc(BRAND.name)}</div>
      <div style="margin-top:10px;font-family:${SANS};font-size:12px;line-height:1.8;color:${MUTED};">
        ${esc(BRAND.tagline)}<br>
        <a href="tel:${esc(BRAND.phone)}" style="color:${INK};text-decoration:none;font-weight:600;">${esc(BRAND.phone)}</a> ·
        <a href="mailto:${esc(BRAND.email)}" style="color:${INK};text-decoration:none;font-weight:600;">${esc(BRAND.email)}</a><br>
        <a href="${esc(BRAND.instagram)}" style="color:${MUTED};">Instagram</a> · <a href="${esc(BRAND.facebook)}" style="color:${MUTED};">Facebook</a>
      </div>
    </td></tr>
  </table>
  <div style="max-width:620px;margin:16px auto 0;font-family:${SANS};font-size:11px;color:${MUTED};text-align:center;">© ${new Date().getFullYear()} ${esc(BRAND.name)}. This gallery is private — please don't forward this email.</div>
</td></tr></table></body></html>`
}

type Base = { siteUrl: string; clientName: string; title: string; link: string }

/** 1. Previews ready (to the client) */
export function previewsReady(o: Base & { message?: string | null; limit?: number | null; extrasNote?: string | null; reminder?: boolean }): RenderedEmail {
  const pick = o.limit ? `Pick your favourite <b>${o.limit}</b> photos` : 'Pick your favourite photos'
  const steps = [
    'Open the gallery and sign in with this email address — we send you a 6-digit code, no password needed.',
    `${o.limit ? `Tap ♥ on the ${o.limit} photos you love` : 'Tap ♥ on the photos you love'}. Add a note to any photo if you'd like something changed.`,
    'Press “Submit selection”. We edit your picks and email you when your finals are ready.',
  ]
  const intro = o.reminder
    ? `A gentle reminder: your previews from <b>${esc(o.title)}</b> are waiting for you. ${pick} so we can start editing.`
    : `Your previews from <b>${esc(o.title)}</b> are ready. ${pick} and we'll take it from there.`
  const body = `
    ${p(`Hi ${esc(first(o.clientName))},`)}
    ${p(intro, 16)}
    ${o.message ? quote(o.message) : ''}
    <div style="margin-top:34px;">${button(o.link, 'View your gallery')}</div>
    <div style="margin-top:30px;">${label('How it works')}</div>
    ${steps.map((t, i) => `<table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:12px;"><tr><td style="width:36px;vertical-align:top;"><div style="width:26px;height:26px;border-radius:50%;background:${INK};color:#fff;font-family:${SANS};font-size:12px;font-weight:700;line-height:26px;text-align:center;">${i + 1}</div></td><td style="font-family:${SANS};font-size:14px;line-height:1.6;color:${INK};padding-top:3px;">${esc(t)}</td></tr></table>`).join('')}
    ${o.extrasNote ? small(`Want more than ${o.limit}? ${esc(o.extrasNote)}`) : ''}
    ${small('The previews carry our watermark; your edited photos come without it, in full resolution.')}`
  const subject = o.reminder ? `Reminder: your previews are waiting · ${o.title}` : `Your previews are ready · ${o.title}`
  return {
    subject,
    html: layout({ siteUrl: o.siteUrl, preheader: o.limit ? `Pick ${o.limit} photos for editing.` : 'Pick your favourites for editing.', eyebrow: 'Your previews', title: o.reminder ? 'Your previews are waiting' : 'Your previews are ready', body }),
    text: [`Hi ${first(o.clientName)},`, '', `Your previews from "${o.title}" are ready.${o.limit ? ` Pick your favourite ${o.limit} photos.` : ''}`, ...(o.message ? ['', o.message] : []), '', `Open your gallery: ${o.link}`, '', ...steps.map((t, i) => `${i + 1}. ${t}`), ...(o.extrasNote ? ['', o.extrasNote] : []), '', BRAND.name].join('\n'),
  }
}

/** 2. Selection received (to the photographer) — includes the filename list for Lightroom */
export function selectionReceived(o: Base & { clientEmail: string; adminLink: string; count: number; limit: number | null; filenames: string[]; lightroom: string; notes: { file: string; note: string }[] }): RenderedEmail {
  const body = `
    ${p(`<b>${esc(o.clientName)}</b> (${esc(o.clientEmail)}) picked <b>${o.count}</b>${o.limit ? ` of ${o.limit}` : ''} photos from <b>${esc(o.title)}</b>. The selection is now locked.`)}
    <div style="margin-top:30px;">${button(o.adminLink, 'Open the selection')}</div>
    ${o.notes.length ? `<div style="margin-top:30px;">${label(`Notes from the client (${o.notes.length})`)}</div>${rows(o.notes.map((n) => [n.file, n.note]))}` : ''}
    <div style="margin-top:30px;">${label('Lightroom filter — paste into Library → Text → Filename')}</div>
    ${mono(o.lightroom)}
    <div style="margin-top:26px;">${label(`Filenames (${o.filenames.length})`)}</div>
    ${mono(o.filenames.join('\n'))}`
  return {
    subject: `Selection received: ${o.count} photos · ${o.clientName}`,
    html: layout({ siteUrl: o.siteUrl, preheader: `${o.clientName} picked ${o.count} photos.`, eyebrow: 'Selection received', title: `${o.count} photos picked`, body }),
    text: [`${o.clientName} (${o.clientEmail}) picked ${o.count}${o.limit ? ` of ${o.limit}` : ''} photos from "${o.title}".`, `Open: ${o.adminLink}`, '', ...(o.notes.length ? ['Notes:', ...o.notes.map((n) => `- ${n.file}: ${n.note}`), ''] : []), 'Lightroom filter:', o.lightroom, '', 'Filenames:', ...o.filenames].join('\n'),
  }
}

/** 3. Selection confirmation (to the client) */
export function selectionConfirmation(o: Base & { count: number }): RenderedEmail {
  const body = `
    ${p(`Hi ${esc(first(o.clientName))},`)}
    ${p(`Thank you — we've received your <b>${o.count}</b> picks from <b>${esc(o.title)}</b>. We're editing them now and will email you as soon as your final photos are ready to download.`, 16)}
    <div style="margin-top:34px;">${button(o.link, 'View your selection')}</div>
    ${small('Changed your mind about a photo? Reply to this email or message us on WhatsApp and we can reopen your selection.')}`
  return {
    subject: `We've got your selection · ${o.title}`,
    html: layout({ siteUrl: o.siteUrl, preheader: `${o.count} photos received — editing has started.`, eyebrow: 'Selection received', title: "We're editing your photos", body }),
    text: [`Hi ${first(o.clientName)},`, '', `We've received your ${o.count} picks from "${o.title}". We'll email you when your final photos are ready.`, '', o.link, '', BRAND.name].join('\n'),
  }
}

/** 4. Selection unlocked (to the client) */
export function selectionUnlocked(o: Base & { limit?: number | null }): RenderedEmail {
  const body = `
    ${p(`Hi ${esc(first(o.clientName))},`)}
    ${p(`We've reopened your selection for <b>${esc(o.title)}</b>. Your picks are still there — change whatever you like, then press “Submit selection” again.`, 16)}
    <div style="margin-top:34px;">${button(o.link, 'Edit my selection')}</div>`
  return {
    subject: `You can edit your selection · ${o.title}`,
    html: layout({ siteUrl: o.siteUrl, preheader: 'Your selection is open again.', eyebrow: 'Selection reopened', title: 'You can edit your selection', body }),
    text: [`Hi ${first(o.clientName)},`, '', `We've reopened your selection for "${o.title}". Change your picks, then submit again.`, '', o.link, '', BRAND.name].join('\n'),
  }
}

/** 5. Final photos ready (to the client) */
export function finalsReady(o: Base & { count: number; message?: string | null; previewsExpire?: string | null; resend?: boolean }): RenderedEmail {
  const body = `
    ${p(`Hi ${esc(first(o.clientName))},`)}
    ${p(`Your <b>${o.count}</b> edited photos from <b>${esc(o.title)}</b> are ready. Download them one by one or all at once, in full resolution and without a watermark.`, 16)}
    ${o.message ? quote(o.message) : ''}
    <div style="margin-top:34px;">${button(o.link, 'Download your photos')}</div>
    ${o.previewsExpire ? small(`Your watermarked previews will be removed on ${esc(fmtDay(o.previewsExpire))}. Your final photos stay in your account.`) : ''}
    ${small('We would love to see them shared — tag us on Instagram. Thank you for choosing us!')}`
  return {
    subject: `Your photos are ready · ${o.title}`,
    html: layout({ siteUrl: o.siteUrl, preheader: `${o.count} edited photos ready to download.`, eyebrow: 'Final photos', title: 'Your photos are ready', body }),
    text: [`Hi ${first(o.clientName)},`, '', `Your ${o.count} edited photos from "${o.title}" are ready to download.`, ...(o.message ? ['', o.message] : []), '', o.link, '', BRAND.name].join('\n'),
  }
}
