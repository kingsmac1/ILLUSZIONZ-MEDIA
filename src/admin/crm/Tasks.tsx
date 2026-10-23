import { useMemo, useState } from 'react'
import { useData, useDb } from '../data'
import { BulkBar, BulkBtn, BulkSelect, RowBox, SelectAllBox, confirmN, useSelection } from '../bulk'
import { Badge, Empty, PageHead, Tabs, fmtDate } from '../ui'
import { ContactDrawer } from './ContactDrawer'
import { ACT_ICON, TaskModal } from './shared'

export function Tasks() {
  const { d } = useData()
  const db = useDb()
  const [tab, setTab] = useState<'today' | 'upcoming' | 'done' | 'all'>('today')
  const [adding, setAdding] = useState(false)
  const [contact, setContact] = useState<string | null>(null)
  const endToday = new Date(); endToday.setHours(23, 59, 59, 999)

  const groups = useMemo(() => {
    const open = d.tasks.filter((t) => !t.done)
    return {
      today: open.filter((t) => t.due_at && new Date(t.due_at) <= endToday),
      upcoming: open.filter((t) => !t.due_at || new Date(t.due_at) > endToday),
      done: d.tasks.filter((t) => t.done).sort((a, b) => (b.done_at ?? '').localeCompare(a.done_at ?? '')).slice(0, 100),
      all: open,
    }
  }, [d.tasks])
  const list = groups[tab]
  const sel = useSelection(list.map((t) => t.id))
  const plusDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); d.setHours(9, 0, 0, 0); return d.toISOString() }
  const resched = (v: string) => db.updateMany('tasks', sel.ids, { due_at: v === 'none' ? null : plusDays(Number(v)) }, 'Due date changed')
  const overdue = (t: any) => !t.done && t.due_at && new Date(t.due_at) < new Date(new Date().setHours(0, 0, 0, 0))

  return (
    <>
      <PageHead title="Tasks & follow-ups" sub="Never let an enquiry go quiet — the website adds tasks automatically" actions={<button className="ad-btn primary" onClick={() => setAdding(true)}>+ New task</button>} />
      <Tabs value={tab} onChange={setTab} tabs={[
        { id: 'today', label: 'Due today & overdue', count: groups.today.length },
        { id: 'upcoming', label: 'Upcoming', count: groups.upcoming.length },
        { id: 'all', label: 'All open', count: groups.all.length },
        { id: 'done', label: 'Completed' },
      ]} />
      <BulkBar s={sel} noun="task">
        <BulkBtn onClick={() => db.updateMany('tasks', sel.ids, { done: true, done_at: new Date().toISOString() }, `${sel.count} marked done`)}>Mark done</BulkBtn>
        <BulkBtn onClick={() => db.updateMany('tasks', sel.ids, { done: false, done_at: null }, `${sel.count} reopened`)}>Reopen</BulkBtn>
        <BulkSelect label="Priority" options={[{ value: 'high', label: 'High' }, { value: 'normal', label: 'Normal' }, { value: 'low', label: 'Low' }]} onPick={(v) => db.updateMany('tasks', sel.ids, { priority: v }, `Priority set to ${v}`)} />
        <BulkSelect label="Reschedule" options={[{ value: '0', label: 'Today' }, { value: '1', label: 'Tomorrow' }, { value: '3', label: 'In 3 days' }, { value: '7', label: 'Next week' }, { value: 'none', label: 'No date' }]} onPick={resched} />
        <BulkBtn danger onClick={async () => { if (confirmN('Delete', sel.count, 'task')) { const r = await db.removeMany('tasks', sel.ids, `${sel.count} task${sel.count === 1 ? '' : 's'} deleted`); if (r.ok) sel.clear() } }}>Delete</BulkBtn>
      </BulkBar>
      <div className="ad-card" style={{ padding: '4px 20px' }}>
        {list.length > 0 && <label className="ad-check" style={{ padding: '12px 0 4px', color: '#7a7a82', fontSize: 12 }}><SelectAllBox s={sel} view={list.map((t) => t.id)} />Select all</label>}
        <div className="ad-list">
          {list.map((t) => {
            const c = d.contacts.find((x) => x.id === t.contact_id)
            return (
              <div key={t.id} style={sel.has(t.id) ? { background: '#f6f5f1' } : undefined}>
                <RowBox s={sel} id={t.id} label={`task ${t.title}`} />
                <label className="ad-check" style={{ flex: 1, minWidth: 0 }}>
                  <input type="checkbox" checked={t.done} onChange={async () => { await db.update('tasks', { id: t.id }, { done: !t.done, done_at: t.done ? null : new Date().toISOString() }); if (!t.done && t.contact_id) db.log({ contact_id: t.contact_id, type: 'task', subject: `Task done: ${t.title}`, auto: true }) }} />
                  <span><b style={{ textDecoration: t.done ? 'line-through' : 'none' }}>{ACT_ICON[t.type] ?? '✓'} {t.title}</b>
                    {c && <span className="sub"><a href="#" onClick={(e) => { e.preventDefault(); setContact(c.id) }}>{c.name}</a>{t.auto ? ' · auto-created' : ''}</span>}</span>
                </label>
                <span style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <span className={overdue(t) ? 'ad-err' : 'ad-muted'}>{t.due_at ? fmtDate(t.due_at) : 'No date'}{overdue(t) ? ' · overdue' : ''}</span>{' '}
                  {t.priority === 'high' && <Badge tone="red">high</Badge>}{' '}
                  <button className="ad-btn sm danger" onClick={() => window.confirm('Delete this task?') && db.remove('tasks', { id: t.id })} aria-label="Delete task">✕</button>
                </span>
              </div>
            )
          })}
        </div>
        {!list.length && <Empty title={tab === 'today' ? 'All clear 🎉' : 'Nothing here'} hint="Tasks created by the website, the automations and by you appear here." />}
      </div>
      {adding && <TaskModal defaults={{}} onClose={() => setAdding(false)} />}
      {contact && <ContactDrawer id={contact} onClose={() => setContact(null)} />}
    </>
  )
}
