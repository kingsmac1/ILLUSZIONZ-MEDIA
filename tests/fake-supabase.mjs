/**
 * Tiny in-memory stand-in for Supabase (PostgREST subset + password auth) so the dashboard, the
 * API functions and the automations can be tested end-to-end without a real project.
 *   node tests/fake-supabase.mjs   → http://127.0.0.1:54321   (admin: info@illuszionzmedia.com / test1234)
 */
import http from 'node:http'
import { randomUUID, randomBytes } from 'node:crypto'
import fs from 'node:fs'

const PORT = Number(process.env.FAKE_SUPABASE_PORT || 54321)
const now = () => new Date().toISOString()
const db = {}
const T = (n) => (db[n] ??= [])

// seed from the real schema.sql: default templates + stages + settings
const sql = fs.readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8')
const stages = [['new', 'New enquiry', 1, 10, 'open', '#64748b'], ['contacted', 'Contacted', 2, 25, 'open', '#0ea5e9'], ['quoted', 'Quote / proposal', 3, 45, 'open', '#8b5cf6'], ['negotiation', 'Negotiation', 4, 65, 'open', '#f59e0b'], ['booked', 'Booked', 5, 90, 'open', '#10b981'], ['delivered', 'Delivered (won)', 6, 100, 'won', '#16a34a'], ['lost', 'Lost', 7, 0, 'lost', '#ef4444']]
for (const [key, name, sort_order, probability, kind, color] of stages) T('pipeline_stages').push({ key, name, sort_order, probability, kind, color })
for (const name of ['Equipment', 'Studio & rent', 'Software & subscriptions', 'Marketing & ads', 'Travel', 'Other']) T('expense_categories').push({ name, sort_order: T('expense_categories').length + 1 })
T('admin_users').push({ email: 'info@illuszionzmedia.com', name: 'Illuszionz Media', created_at: now() })
const tplBlock = sql.slice(sql.indexOf('insert into public.email_templates'), sql.indexOf('-- ---------- Default settings'))
for (const m of tplBlock.matchAll(/\('([a-z0-9_]+)','([^']*)','(customer|owner)','((?:[^']|'')*)','((?:[^']|'')*)','((?:[^']|'')*)',\s*(?:E)?'((?:[^']|'')*)','((?:[^']|'')*)','((?:[^']|'')*)'\)/g)) {
  const un = (s) => s.replace(/''/g, "'").replace(/\\n/g, '\n')
  T('email_templates').push({ key: m[1], name: m[2], audience: m[3], enabled: true, subject: un(m[4]), eyebrow: un(m[5]), title: un(m[6]), body: un(m[7]), button_label: un(m[8]), button_url: un(m[9]) })
}
T('settings').push({ key: 'automations', value: {} }, { key: 'email', value: { owner_emails: ['info@illuszionzmedia.com'], reengagement_days: 90, review_request_days: 14, thank_you_hours: 24, lead_followup_days: 3, digest_hour: 0 } })

const DEFAULTS = {
  contacts: () => ({ id: randomUUID(), created_at: now(), updated_at: now(), phone: '', lifecycle: 'lead', source: 'website', tags: [], city: '', instagram: '', job_title: '', marketing_opt_in: true, do_not_contact: false, lead_score: 0, last_activity_at: now(), notes: '', company_id: null, birthday: null, last_contacted_at: null }),
  companies: () => ({ id: randomUUID(), created_at: now() }),
  bookings: () => ({ id: randomUUID(), ref: randomBytes(3).toString('hex').toUpperCase(), created_at: now(), status: 'new', payment_status: 'Not Paid', amount_paid: 0, total: 0, discount: 0, source: 'website', notes: '', phone: '', packages: '', details: [], items: [], selection: {}, confirmed_at: null, completed_at: null }),
  submissions: () => ({ id: randomUUID(), created_at: now(), status: 'new', featured: false, fields: [], attachments: [], phone: '', rating: null, notes: '' }),
  deals: () => ({ id: randomUUID(), created_at: now(), updated_at: now(), value: 0, stage: 'new', position: 0, service: '', source: 'website', notes: '', lost_reason: '', closed_at: null }),
  activities: () => ({ id: randomUUID(), created_at: now(), auto: false, body: '', subject: '', created_by: '' }),
  tasks: () => ({ id: randomUUID(), created_at: now(), done: false, done_at: null, priority: 'normal', type: 'follow-up', auto: false, notes: '' }),
  segments: () => ({ id: randomUUID(), created_at: now() }),
  payments: () => ({ id: randomUUID(), created_at: now(), note: '' }),
  expenses: () => ({ id: randomUUID(), created_at: now(), note: '', vendor: '' }),
  other_income: () => ({ id: randomUUID(), created_at: now(), note: '' }),
  promo_codes: () => ({ created_at: now(), used: 0, flows: [], active: true }),
  email_log: () => ({ id: randomUUID(), created_at: now(), status: 'pending', error: null, sent_at: null }),
  email_campaigns: () => ({ id: randomUUID(), created_at: now(), status: 'draft', recipients: 0, sent_count: 0, failed_count: 0, audience: {}, sent_at: null }),
}
const PK = { pipeline_stages: ['key'], settings: ['key'], promo_codes: ['code'], price_overrides: ['flow_id', 'kind', 'item_id'], expense_categories: ['name'], admin_users: ['email'], email_templates: ['key'] }
const UNIQUE = { email_log: ['dedupe_key'], contacts: ['email'] }

function cmp(a, b) { return a == null ? (b == null ? 0 : -1) : b == null ? 1 : a < b ? -1 : a > b ? 1 : 0 }
function matcher(col, expr) {
  let neg = false
  if (expr.startsWith('not.')) { neg = true; expr = expr.slice(4) }
  const i = expr.indexOf('.')
  const op = expr.slice(0, i)
  const val = expr.slice(i + 1)
  const num = (v) => (v !== '' && !Number.isNaN(Number(val)) && typeof v === 'number' ? Number(val) : val)
  const f = (r) => {
    const v = r[col]
    switch (op) {
      case 'eq': return String(v) === val
      case 'neq': return String(v) !== val
      case 'gt': return v != null && cmp(typeof v === 'number' ? v : String(v), num(v)) > 0
      case 'gte': return v != null && cmp(typeof v === 'number' ? v : String(v), num(v)) >= 0
      case 'lt': return v != null && cmp(typeof v === 'number' ? v : String(v), num(v)) < 0
      case 'lte': return v != null && cmp(typeof v === 'number' ? v : String(v), num(v)) <= 0
      case 'ilike': return v != null && new RegExp('^' + val.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$', 'i').test(String(v))
      case 'in': return val.slice(1, -1).split(',').map((s) => s.replace(/^"|"$/g, '')).includes(String(v))
      case 'is': return val === 'null' ? v == null : String(v) === val
      default: return true
    }
  }
  return neg ? (r) => !f(r) : f
}
function filters(params) {
  const fs_ = []
  for (const [k, v] of params) if (!['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(k)) fs_.push(matcher(k, v))
  return (r) => fs_.every((f) => f(r))
}
const send = (res, status, body, headers = {}) => {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*', 'Access-Control-Expose-Headers': 'Content-Range', ...headers })
  res.end(body === undefined ? '' : JSON.stringify(body))
}
const user = { id: 'u1', aud: 'authenticated', role: 'authenticated', email: 'info@illuszionzmedia.com', app_metadata: {}, user_metadata: {}, created_at: now() }
const session = () => ({ access_token: 'fake-token', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'fake-refresh', user })

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x')
  if (req.method === 'OPTIONS') return send(res, 204)
  const chunks = []
  for await (const c of req) chunks.push(c)
  const raw = Buffer.concat(chunks).toString()
  const body = raw ? JSON.parse(raw) : undefined
  const path = url.pathname

  if (path === '/__reset') { for (const k of Object.keys(db)) if (['contacts', 'companies', 'bookings', 'submissions', 'deals', 'activities', 'tasks', 'segments', 'payments', 'expenses', 'other_income', 'promo_codes', 'price_overrides', 'email_log', 'email_campaigns'].includes(k)) db[k] = []; return send(res, 200, { ok: true }) }
  if (path === '/__dump') return send(res, 200, db)
  if (path.startsWith('/auth/v1/token')) return body?.password === 'test1234' && body?.email === user.email ? send(res, 200, session()) : send(res, 400, { error: 'invalid_grant', error_description: 'Invalid login credentials', msg: 'Invalid login credentials' })
  if (path === '/auth/v1/user') return (req.headers.authorization ?? '').includes('fake-token') || (req.headers.authorization ?? '').includes('service') ? send(res, 200, user) : send(res, 401, { msg: 'bad token' })
  if (path === '/auth/v1/logout') return send(res, 204)

  const rpc = /^\/rest\/v1\/rpc\/(\w+)/.exec(path)
  if (rpc) {
    if (rpc[1] === 'rescore_contact') { const c = T('contacts').find((x) => x.id === body.cid); if (c) c.lead_score = Math.min(100, 10 + T('bookings').filter((b) => b.contact_id === c.id).length * 20) ; return send(res, 200, c?.lead_score ?? 0) }
    return send(res, 200, null)
  }
  const m = /^\/rest\/v1\/(\w+)/.exec(path)
  if (!m) return send(res, 404, { message: 'not found' })
  const table = m[1]
  const rows = T(table)
  const prefer = req.headers.prefer ?? ''
  const wantObject = (req.headers.accept ?? '').includes('vnd.pgrst.object')
  const out = (data, status = 200, extra = {}) => send(res, status, wantObject ? data[0] ?? null : data, extra)

  if (req.method === 'GET' || req.method === 'HEAD') {
    let list = rows.filter(filters(url.searchParams))
    const order = url.searchParams.get('order')
    if (order) for (const part of order.split(',').reverse()) { const [col, dir] = part.split('.'); list = [...list].sort((a, b) => cmp(a[col], b[col]) * (dir === 'desc' ? -1 : 1)) }
    const total = list.length
    const off = Number(url.searchParams.get('offset') || 0)
    if (url.searchParams.get('limit')) list = list.slice(off, off + Number(url.searchParams.get('limit')))
    const hdr = { 'Content-Range': `0-${Math.max(0, list.length - 1)}/${total}` }
    if (req.method === 'HEAD') return send(res, 200, undefined, hdr)
    return out(list, 200, hdr)
  }
  if (req.method === 'POST') {
    const items = Array.isArray(body) ? body : [body]
    const onConflict = (url.searchParams.get('on_conflict') ?? '').split(',').filter(Boolean)
    const keys = onConflict.length ? onConflict : PK[table] ?? []
    const merge = prefer.includes('merge-duplicates')
    const ignore = prefer.includes('ignore-duplicates')
    const result = []
    for (const it of items) {
      const dup = rows.find((r) => (keys.length && keys.every((k) => r[k] === it[k])) || (UNIQUE[table] ?? []).some((k) => it[k] != null && it[k] !== '' && String(r[k]).toLowerCase() === String(it[k]).toLowerCase()))
      if (dup) {
        if (ignore) continue
        if (merge) { Object.assign(dup, it); result.push(dup); continue }
        return send(res, 409, { code: '23505', message: `duplicate key value violates unique constraint on ${table}` })
      }
      const row = { ...(DEFAULTS[table]?.() ?? {}), ...it }
      rows.push(row)
      result.push(row)
    }
    return prefer.includes('return=representation') ? out(result, 201) : send(res, 201)
  }
  if (req.method === 'PATCH') {
    const list = rows.filter(filters(url.searchParams))
    for (const r of list) Object.assign(r, body)
    return prefer.includes('return=representation') ? out(list) : send(res, 204)
  }
  if (req.method === 'DELETE') {
    const f = filters(url.searchParams)
    const gone = rows.filter(f)
    db[table] = rows.filter((r) => !f(r))
    if (table === 'contacts') for (const t of ['deals', 'activities', 'tasks']) db[t] = T(t).filter((r) => !gone.some((g) => g.id === r.contact_id))
    return send(res, 204)
  }
  send(res, 405, { message: 'method' })
}).listen(PORT, '127.0.0.1', () => console.log(`fake supabase on http://127.0.0.1:${PORT}`))
