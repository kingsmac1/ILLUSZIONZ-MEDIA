import { useEffect, useMemo, useState } from 'react'
import type { AudienceFilter } from '../../server/audience'
import { adminApi, supabase } from '../supabase'
import { useData, useDb, type R } from '../data'
import { Badge, Empty, Field, Modal, PageHead, Tabs, ago, fmtDate } from '../ui'
import { LIFECYCLES, SOURCES } from '../crm/shared'
import { flows } from '../../booking/catalog'
import { EmailBuilder } from '../builder/EmailBuilder'
import { blocksEmail } from '../../server/mail'
import { blocksToHtml, blocksToText, defaultBlocks, type EmailBlock } from '../../server/emailBlocks'

const AUTOMATIONS: { key: string; name: string; when: string; who: 'client' | 'you' }[] = [
  { key: 'booking_confirmed', name: 'Booking confirmed', when: 'Within ~10 minutes of you marking a booking “confirmed”', who: 'client' },
  { key: 'reminder_24h', name: 'Session reminder · 1 day before', when: 'Once, about 24 hours before a confirmed session', who: 'client' },
  { key: 'reminder_2h', name: 'Session reminder · 2 hours before', when: 'Once, about 2 hours before a confirmed session', who: 'client' },
  { key: 'payment_reminder', name: 'Balance reminder', when: 'Up to 3 days before a session that still has a balance', who: 'client' },
  { key: 'thank_you', name: 'Thank-you', when: 'The day after the session', who: 'client' },
  { key: 'review_request', name: 'Review request', when: 'A set number of days after the session', who: 'client' },
  { key: 'reengagement', name: 'Re-engagement', when: 'A set number of days after a past client’s last session, if they have not rebooked', who: 'client' },
  { key: 'birthday', name: 'Birthday greeting', when: 'On a contact’s birthday (from the CRM)', who: 'client' },
  { key: 'lead_followup', name: 'Lead follow-up nudge', when: 'When an enquiry has had no progress for a few days (also creates a task for you)', who: 'client' },
  { key: 'owner_birthdays', name: 'Birthdays today digest', when: 'Each morning someone in your CRM has a birthday', who: 'you' },
  { key: 'owner_daily', name: 'Morning digest', when: 'Each morning: today’s sessions, due tasks, unconfirmed bookings, unread messages', who: 'you' },
]
const PLACEHOLDERS = ['{{first_name}}', '{{name}}', '{{service}}', '{{date}}', '{{time}}', '{{time_suffix}}', '{{total}}', '{{balance}}', '{{amount}}', '{{ref}}', '{{site}}', '{{whatsapp}}', '{{review_link}}', '{{list}}']

function Automations({ mail, onEdit }: { mail: { mail: boolean; dryRun?: boolean } | null; onEdit: (key: string) => void }) {
  const { d, setting } = useData()
  const db = useDb()
  const auto = setting<R>('automations', {})
  const cfg = setting<R>('email', { owner_emails: ['info@illuszionzmedia.com'], reengagement_days: 90, review_request_days: 14, thank_you_hours: 24, lead_followup_days: 3, digest_hour: 8 })
  const [c, setC] = useState<R>(cfg)
  const [owners, setOwners] = useState<string>((cfg.owner_emails ?? []).join(', '))
  const toggle = (key: string) => db.upsert('settings', { key: 'automations', value: { ...auto, [key]: auto[key] === false }, updated_at: new Date().toISOString() }, 'key')
  const save = () => db.upsert('settings', { key: 'email', value: { ...c, owner_emails: owners.split(',').map((x) => x.trim()).filter(Boolean) }, updated_at: new Date().toISOString() }, 'key', 'Timing saved')
  const sent7 = useLogCount()
  return (
    <>
      {mail && !mail.mail && <div className="ad-note" style={{ marginBottom: 16 }}><b>Email sending is not configured.</b> Set RESEND_API_KEY and EMAIL_FROM on Cloudflare Pages, then redeploy. Until then no automation can send.</div>}
      {mail?.dryRun && <div className="ad-note" style={{ marginBottom: 16 }}>MAIL_DRY_RUN is on — nothing is actually being sent.</div>}
      <div className="ad-grid c21">
        <div className="ad-card"><h3>Automatic emails <small>{sent7} sent in the last 7 days · runs every 10 minutes</small></h3>
          {AUTOMATIONS.map((a) => {
            const t = d.email_templates.find((x) => x.key === a.key)
            return (
              <div className="ad-auto" key={a.key}>
                <label className="ad-switch"><input type="checkbox" checked={auto[a.key] !== false} onChange={() => toggle(a.key)} aria-label={a.name} /><i /></label>
                <div><b>{a.name} <Badge tone={a.who === 'you' ? 'violet' : 'blue'}>{a.who === 'you' ? 'to you' : 'to client'}</Badge></b><small>{a.when}</small></div>
                <button className="ad-btn sm" disabled={!t} onClick={() => onEdit(a.key)}>{t ? 'Edit email' : 'Missing'}</button>
              </div>
            )
          })}
          <p className="ad-muted" style={{ marginTop: 14 }}>Booking confirmations and the owner alert for every new booking or message are sent instantly by the website and are always on. Bookings you add by hand are never announced.</p>
        </div>
        <div className="ad-card"><h3>Timing</h3>
          <div className="ad-form" style={{ gridTemplateColumns: '1fr' }}>
            <Field label="Thank-you after (hours)"><input type="number" value={c.thank_you_hours ?? 24} onChange={(e) => setC({ ...c, thank_you_hours: Number(e.target.value) })} /></Field>
            <Field label="Review request after (days)"><input type="number" value={c.review_request_days ?? 14} onChange={(e) => setC({ ...c, review_request_days: Number(e.target.value) })} /></Field>
            <Field label="Re-engage past clients after (days)"><input type="number" value={c.reengagement_days ?? 90} onChange={(e) => setC({ ...c, reengagement_days: Number(e.target.value) })} /></Field>
            <Field label="Nudge quiet leads after (days)"><input type="number" value={c.lead_followup_days ?? 3} onChange={(e) => setC({ ...c, lead_followup_days: Number(e.target.value) })} /></Field>
            <Field label="Morning digest hour (UK time)"><input type="number" min={0} max={23} value={c.digest_hour ?? 8} onChange={(e) => setC({ ...c, digest_hour: Number(e.target.value) })} /></Field>
            <Field label="Your alert emails" hint="Comma separated — digests go here"><input type="text" value={owners} onChange={(e) => setOwners(e.target.value)} /></Field>
            <button className="ad-btn primary" onClick={save}>Save timing</button>
          </div>
        </div>
      </div>
    </>
  )
}

function useLogCount() {
  const [n, setN] = useState(0)
  useEffect(() => {
    supabase!.from('email_log').select('id', { count: 'exact', head: true }).eq('status', 'sent').gte('created_at', new Date(Date.now() - 7 * 86_400_000).toISOString()).then(({ count }) => setN(count ?? 0))
  }, [])
  return n
}

function Templates({ initialKey }: { initialKey?: string }) {
  const { d, toast } = useData()
  const db = useDb()
  const [key, setKey] = useState<string>(initialKey || d.email_templates[0]?.key || '')
  const t = d.email_templates.find((x) => x.key === key)
  const [f, setF] = useState<R>(t ?? {})
  const [to, setTo] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { setF(d.email_templates.find((x) => x.key === key) ?? {}) }, [key, d.email_templates])
  if (!t) return <Empty title="No templates" hint="Run supabase/schema.sql to create the default templates." />
  const set = (k: string, v: string) => setF((c) => ({ ...c, [k]: v }))
  const dirty = ['subject', 'eyebrow', 'title', 'body', 'button_label', 'button_url'].some((k) => f[k] !== t[k])
  async function test() {
    setBusy(true)
    const r = await adminApi({ action: 'test_template', key, to: to || undefined })
    setBusy(false)
    toast(r.ok ? 'Test email sent' : r.error ?? 'Failed', r.ok ? 'ok' : 'err')
  }
  return (
    <div className="ad-grid" style={{ gridTemplateColumns: 'minmax(0,260px) minmax(0,1fr)' }}>
      <div className="ad-card" style={{ padding: 8, alignSelf: 'start' }}>
        {d.email_templates.map((x) => <button key={x.key} onClick={() => setKey(x.key)} className={'ad-btn'} style={{ display: 'flex', width: '100%', justifyContent: 'space-between', border: 0, background: x.key === key ? '#0b0b0c' : 'transparent', color: x.key === key ? '#fff' : undefined, marginBottom: 2 }}>{x.name}<span style={{ opacity: .6, fontSize: 11 }}>{x.audience === 'owner' ? 'you' : ''}</span></button>)}
      </div>
      <div className="ad-card">
        <h3>{t.name}<small>{t.audience === 'owner' ? 'Sent to you' : 'Sent to the client'}</small></h3>
        <div className="ad-form">
          <Field label="Subject" full><input type="text" value={f.subject ?? ''} onChange={(e) => set('subject', e.target.value)} /></Field>
          <Field label="Small label above the title"><input type="text" value={f.eyebrow ?? ''} onChange={(e) => set('eyebrow', e.target.value)} /></Field>
          <Field label="Headline"><input type="text" value={f.title ?? ''} onChange={(e) => set('title', e.target.value)} /></Field>
          <Field label="Message" full hint="Blank line = new paragraph."><textarea style={{ minHeight: 190 }} value={f.body ?? ''} onChange={(e) => set('body', e.target.value)} /></Field>
          <Field label="Button text"><input type="text" value={f.button_label ?? ''} onChange={(e) => set('button_label', e.target.value)} /></Field>
          <Field label="Button link"><input type="text" value={f.button_url ?? ''} onChange={(e) => set('button_url', e.target.value)} /></Field>
        </div>
        <p className="ad-muted" style={{ margin: '12px 0' }}>Placeholders: {PLACEHOLDERS.map((p) => <code key={p} style={{ marginRight: 6, background: '#f0efea', padding: '1px 5px', borderRadius: 4 }}>{p}</code>)}</p>
        <div className="ad-actions" style={{ justifyContent: 'space-between' }}>
          <div className="ad-actions"><input type="email" placeholder="Send test to… (default: you)" value={to} onChange={(e) => setTo(e.target.value)} style={{ width: 250 }} /><button className="ad-btn" disabled={busy || dirty} onClick={test} title={dirty ? 'Save first' : ''}>{busy ? 'Sending…' : 'Send test'}</button></div>
          <div className="ad-actions">{dirty && <button className="ad-btn" onClick={() => setF(t)}>Revert</button>}<button className="ad-btn primary" disabled={!dirty} onClick={() => db.update('email_templates', { key }, { subject: f.subject, eyebrow: f.eyebrow, title: f.title, body: f.body, button_label: f.button_label, button_url: f.button_url, updated_at: new Date().toISOString() }, 'Template saved')}>Save template</button></div>
        </div>
      </div>
    </div>
  )
}

function CampaignEditor({ campaign, onClose }: { campaign?: R; onClose: () => void }) {
  const { d, toast } = useData()
  const [f, setF] = useState<R>({ name: '', subject: '', eyebrow: 'News from the studio', title: '', body: 'Hi {{first_name}},\n\n', button_label: '', button_url: '', image_url: '', audience: {} as AudienceFilter, ...campaign })
  const [mode, setMode] = useState<'simple' | 'builder'>(campaign?.blocks?.length ? 'builder' : 'simple')
  const [blocks, setBlocks] = useState<EmailBlock[]>(campaign?.blocks?.length ? campaign.blocks : defaultBlocks())
  const [preview, setPreview] = useState(false)
  const [count, setCount] = useState<number | null>(null)
  const [busy, setBusy] = useState('')
  const [progress, setProgress] = useState('')
  const [to, setTo] = useState('')
  const [savedId, setSavedId] = useState<string | null>(campaign?.id ?? null)
  const [segId, setSegId] = useState('')
  const set = (k: string, v: unknown) => setF((c) => ({ ...c, [k]: v }))
  const aud: AudienceFilter = f.audience
  const setAud = (p: Partial<AudienceFilter>) => { setSegId(''); set('audience', { ...aud, ...p }) }
  const loadSegment = (id: string) => { setSegId(id); const sg = d.segments.find((x) => x.id === id); set('audience', sg ? { ...(sg.filter as AudienceFilter) } : {}) }
  const locked = campaign && campaign.status !== 'draft'
  const tags = [...new Set(d.contacts.flatMap((c) => c.tags ?? []))]
  const builder = mode === 'builder'

  useEffect(() => {
    const t = setTimeout(async () => { const r = await adminApi({ action: 'audience_count', filter: aud }); setCount(r.ok ? (r as any).count : null) }, 350)
    return () => clearTimeout(t)
  }, [JSON.stringify(aud)])

  const previewHtml = useMemo(() => {
    if (!preview) return ''
    const fill = (t: string) => t.replace(/\{\{\s*first_name\s*\}\}/g, 'Ada')
    return blocksEmail({ siteUrl: window.location.origin, subject: f.subject, html: fill(blocksToHtml(blocks)), text: '', footerNote: 'Not interested in these emails? Just reply with “unsubscribe” and we will stop.' }).html
  }, [preview, blocks, f.subject])

  async function persist(): Promise<string | null> {
    const hasBody = builder ? blocks.length > 0 : f.title.trim() && f.body.trim()
    if (!f.name.trim() || !f.subject.trim() || !hasBody) { toast(builder ? 'Name, subject and at least one block are required' : 'Name, subject, headline and message are required', 'err'); return null }
    const row = { name: f.name, subject: f.subject, eyebrow: f.eyebrow, title: builder ? f.title || f.subject : f.title, body: builder ? blocksToText(blocks) : f.body, button_label: f.button_label, button_url: f.button_url, image_url: f.image_url, audience: aud, blocks: builder ? blocks : [] }
    if (savedId) {
      const { error } = await supabase!.from('email_campaigns').update(row).eq('id', savedId)
      if (error) { toast(error.message, 'err'); return null }
      return savedId
    }
    const { data, error } = await supabase!.from('email_campaigns').insert(row).select().single()
    if (error) { toast(error.message, 'err'); return null }
    setSavedId(data.id as string)
    return data.id as string
  }
  async function draft() { const id = await persist(); if (id) { toast('Draft saved'); onClose() } }
  async function test() {
    const id = await persist(); if (!id) return
    setBusy('test'); const r = await adminApi({ action: 'campaign_test', id, to: to || undefined }); setBusy('')
    toast(r.ok ? 'Test sent' : r.error ?? 'Failed', r.ok ? 'ok' : 'err')
  }
  async function sendNow() {
    if (!count) return toast('No recipients match this audience', 'err')
    if (!window.confirm(`Send this campaign to ${count} people now?`)) return
    const id = await persist(); if (!id) return
    setBusy('send')
    let sent = 0
    for (let i = 0; i < 400; i++) {
      const r = await adminApi({ action: 'campaign_batch', id })
      if (!r.ok) { toast(r.error ?? 'Sending stopped', 'err'); break }
      sent += (r as any).sent
      setProgress(`Sent ${sent} of ${(r as any).total}…`)
      if (!(r as any).remaining) { toast(`Campaign sent to ${sent} people`); break }
    }
    setBusy(''); setProgress(''); onClose()
  }

  const audience = (
    <div className="ad-card" style={{ marginBottom: 14 }}>
      <h3>Audience <small>only people who allow marketing</small></h3>
      <div className="ad-form" style={{ gridTemplateColumns: builder ? 'repeat(3, minmax(0,1fr))' : '1fr' }}>
        <Field label="Saved segment" hint={segId ? 'Loaded — the filters below show what it selects. Change any of them to customise.' : 'Pick one to fill the filters below.'}><select disabled={locked} value={segId} onChange={(e) => loadSegment(e.target.value)}><option value="">— none (set filters manually) —</option>{d.segments.map((sg) => <option key={sg.id} value={sg.id}>{sg.name}</option>)}</select></Field>
        <Field label="Source"><select disabled={locked} value={aud.source?.[0] ?? ''} onChange={(e) => setAud({ source: e.target.value ? [e.target.value] : undefined })}><option value="">Any</option>{SOURCES.map((x) => <option key={x}>{x}</option>)}</select></Field>
        <Field label="Tag"><select disabled={locked} value={aud.tag ?? ''} onChange={(e) => setAud({ tag: e.target.value || undefined })}><option value="">Any</option>{tags.map((x) => <option key={x}>{x}</option>)}</select></Field>
        <Field label="Lifecycle" full={builder}><div className="ad-seg" style={{ marginBottom: 0 }}>{LIFECYCLES.map((l) => <button type="button" key={l} disabled={locked} className={aud.lifecycle?.includes(l) ? 'on' : ''} onClick={() => setAud({ lifecycle: aud.lifecycle?.includes(l) ? aud.lifecycle.filter((x) => x !== l) : [...(aud.lifecycle ?? []), l] })}>{l}</button>)}</div></Field>
        <Field label="Booked service"><select disabled={locked} value={aud.service ?? ''} onChange={(e) => setAud({ service: e.target.value || undefined })}><option value="">Any</option>{Object.values(flows).map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}</select></Field>
        <Field label="Booked?"><select disabled={locked} value={aud.booked ?? ''} onChange={(e) => setAud({ booked: (e.target.value || '') as any })}><option value="">Either</option><option value="yes">Has booked</option><option value="no">Never booked</option></select></Field>
        <Field label="Quiet for"><select disabled={locked} value={aud.inactiveDays ?? ''} onChange={(e) => setAud({ inactiveDays: Number(e.target.value) || undefined })}><option value="">Any</option><option value="30">30+ days</option><option value="90">90+ days</option><option value="180">180+ days</option></select></Field>
      </div>
      <p style={{ marginTop: 12 }}><b style={{ fontSize: 22 }}>{count ?? '…'}</b> <span className="ad-muted">recipient{count === 1 ? '' : 's'}</span></p>
    </div>
  )

  return (
    <Modal xl={builder} wide={!builder} title={campaign ? campaign.name : 'New campaign'} onClose={onClose}>
      <div className="ad-form" style={{ marginBottom: 14 }}>
        <Field label="Campaign name (internal)"><input type="text" value={f.name} onChange={(e) => set('name', e.target.value)} disabled={locked} /></Field>
        <Field label="Subject line"><input type="text" value={f.subject} onChange={(e) => set('subject', e.target.value)} disabled={locked} /></Field>
      </div>
      <div className="ab-modes">
        <div className="ad-seg" style={{ marginBottom: 0 }}>
          <button type="button" className={!builder ? 'on' : ''} disabled={locked} onClick={() => setMode('simple')}>Simple message</button>
          <button type="button" className={builder ? 'on' : ''} disabled={locked} onClick={() => setMode('builder')}>✦ Email builder</button>
        </div>
        {builder && <button type="button" className="ad-btn sm" onClick={() => setPreview(!preview)}>{preview ? '← Back to editing' : '👁 Preview email'}</button>}
      </div>

      {builder ? (
        <>
          {preview ? <iframe className="ab-preview" title="Email preview" srcDoc={previewHtml} /> : <EmailBuilder blocks={blocks} onChange={setBlocks} />}
          <div style={{ marginTop: 16 }}>{audience}</div>
        </>
      ) : (
        <div className="ad-grid c2">
          <div className="ad-form" style={{ gridTemplateColumns: '1fr' }}>
            <Field label="Small label"><input type="text" value={f.eyebrow} onChange={(e) => set('eyebrow', e.target.value)} disabled={locked} /></Field>
            <Field label="Headline"><input type="text" value={f.title} onChange={(e) => set('title', e.target.value)} disabled={locked} /></Field>
            <Field label="Message" hint="Use {{first_name}} to personalise."><textarea style={{ minHeight: 160 }} value={f.body} onChange={(e) => set('body', e.target.value)} disabled={locked} /></Field>
            <Field label="Image URL (optional)"><input type="text" value={f.image_url} onChange={(e) => set('image_url', e.target.value)} placeholder="https://illuszionzmedia.com/images/…" disabled={locked} /></Field>
            <div className="ad-form"><Field label="Button text"><input type="text" value={f.button_label} onChange={(e) => set('button_label', e.target.value)} disabled={locked} /></Field><Field label="Button link"><input type="text" value={f.button_url} onChange={(e) => set('button_url', e.target.value)} disabled={locked} /></Field></div>
          </div>
          <div>{audience}</div>
        </div>
      )}
      {campaign && <p className="ad-muted" style={{ marginBottom: 10 }}>Status: <Badge>{campaign.status}</Badge> · {campaign.sent_count} sent · {campaign.failed_count} failed</p>}
      <div className="ad-actions" style={{ justifyContent: 'space-between', marginTop: 18 }}>
        <div className="ad-actions"><input type="email" placeholder="Test to… (default: you)" value={to} onChange={(e) => setTo(e.target.value)} style={{ width: 220 }} /><button className="ad-btn" disabled={!!busy} onClick={test}>{busy === 'test' ? 'Sending…' : 'Send test'}</button></div>
        <div className="ad-actions">{progress && <span className="ad-muted">{progress}</span>}{!locked && <button className="ad-btn" disabled={!!busy} onClick={draft}>Save draft</button>}
          <button className="ad-btn primary" disabled={!!busy || campaign?.status === 'sent' || count === null} onClick={sendNow}>{busy === 'send' ? 'Sending…' : campaign?.status === 'sending' ? 'Resume sending' : `Send to ${count ?? '…'}`}</button></div>
      </div>
    </Modal>
  )
}

function Campaigns() {
  const [list, setList] = useState<R[]>([])
  const [edit, setEdit] = useState<R | 'new' | null>(null)
  const { refresh } = useData()
  const load = () => supabase!.from('email_campaigns').select('*').order('created_at', { ascending: false }).then(({ data }) => setList(data ?? []))
  useEffect(() => { load() }, [])
  return (
    <>
      <div className="ad-actions" style={{ marginBottom: 14, justifyContent: 'space-between' }}><p className="ad-muted">Send news, offers and mini-session announcements to a segment of your CRM.</p><button className="ad-btn primary" onClick={() => setEdit('new')}>+ New campaign</button></div>
      <div className="ad-tablewrap"><table><thead><tr><th>Campaign</th><th>Status</th><th className="num">Recipients</th><th className="num">Sent</th><th className="num">Failed</th><th>Created</th></tr></thead><tbody>
        {list.map((c) => <tr key={c.id} className="click" onClick={() => setEdit(c)}><td><b>{c.name}</b><span className="sub">{c.subject}</span></td><td><Badge>{c.status}</Badge></td><td className="num">{c.recipients}</td><td className="num">{c.sent_count}</td><td className="num">{c.failed_count}</td><td className="ad-muted">{fmtDate(c.created_at)}</td></tr>)}
      </tbody></table>{!list.length && <Empty title="No campaigns yet" />}</div>
      {edit && <CampaignEditor campaign={edit === 'new' ? undefined : edit} onClose={() => { setEdit(null); load(); refresh() }} />}
    </>
  )
}

function Log() {
  const [rows, setRows] = useState<R[]>([])
  const [status, setStatus] = useState('')
  useEffect(() => {
    let q = supabase!.from('email_log').select('*').neq('template_key', 'maintenance').neq('template_key', 'lead_task').order('created_at', { ascending: false }).limit(200)
    if (status) q = q.eq('status', status)
    q.then(({ data }) => setRows(data ?? []))
  }, [status])
  return (
    <>
      <div className="ad-toolbar"><select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All</option>{['sent', 'failed', 'pending'].map((s) => <option key={s}>{s}</option>)}</select></div>
      <div className="ad-tablewrap"><table><thead><tr><th>When</th><th>To</th><th>Email</th><th>Status</th></tr></thead><tbody>
        {rows.map((r) => <tr key={r.id}><td className="ad-muted">{ago(r.created_at)}</td><td>{r.to_email}</td><td><b>{r.template_key || 'email'}</b><span className="sub">{r.subject}</span>{r.error && <span className="sub ad-err">{r.error}</span>}</td><td><Badge>{r.status}</Badge></td></tr>)}
      </tbody></table>{!rows.length && <Empty title="Nothing sent yet" hint="Every automatic and manual email is logged here." />}</div>
    </>
  )
}

export function Emails({ mail }: { mail: { mail: boolean; dryRun?: boolean } | null }) {
  const [tab, setTab] = useState<'auto' | 'templates' | 'campaigns' | 'log'>('auto')
  const [tplKey, setTplKey] = useState<string | undefined>()
  return (
    <>
      <PageHead title="Emails" sub="Automations, editable templates, campaigns and a full send log" />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'auto', label: 'Automations' }, { id: 'templates', label: 'Templates' }, { id: 'campaigns', label: 'Campaigns' }, { id: 'log', label: 'Send log' }]} />
      {tab === 'auto' && <Automations mail={mail} onEdit={(k) => { setTplKey(k); setTab('templates') }} />}
      {tab === 'templates' && <Templates key={tplKey ?? 'default'} initialKey={tplKey} />}
      {tab === 'campaigns' && <Campaigns />}
      {tab === 'log' && <Log />}
    </>
  )
}
