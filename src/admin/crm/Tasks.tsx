import { useMemo, useState } from 'react'
import { useData, useDb } from '../data'
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
      <div className="ad-card" style={{ padding: '4px 20px' }}>
        <div className="ad-list">
          {list.map((t) => {
            const c = d.contacts.find((x) => x.id === t.contact_id)
            return (
              <div key={t.id}>
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
