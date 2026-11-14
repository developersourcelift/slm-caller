import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Meetings from './Meetings'
import { Seg } from '../components/ui'
import { CalendarPlus, ChevronLeft, ChevronRight } from 'lucide-react'
import { useStore } from '../lib/store'
import { CLOSED_STATUSES, MEETING_STATUS_BY_ID } from '../lib/constants'
import { cx, dayKey, fmtTime, googleCalendarLink, isToday } from '../lib/utils'
import { useOpenLead } from '../components/LeadDrawer'
import { Card, Empty, MeetingBadge, StatusBadge } from '../components/ui'

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MAX_IN_CELL = 3

export default function CalendarPage() {
  const { data, derived, me } = useStore()
  const openLead = useOpenLead()
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const [selected, setSelected] = useState(() => dayKey(new Date()))
  const [show, setShow] = useState({ meetings: true, follow: true })
  const [person, setPerson] = useState('all')
  const [params, setParams] = useSearchParams()
  const view = params.get('view') === 'list' ? 'list' : 'month'
  const setView = (v) => {
    if (v === 'list') params.set('view', 'list')
    else params.delete('view')
    setParams(params)
  }

  // Everything that happens on a day, keyed by yyyy-mm-dd.
  const byDay = useMemo(() => {
    const map = {}
    const get = (k) => (map[k] ||= { meetings: [], follow: [], calls: 0 })
    for (const m of data.meetings) {
      if (person !== 'all' && m.created_by !== person) continue
      get(dayKey(m.scheduled_at)).meetings.push(m)
    }
    for (const l of data.leads) {
      if (!l.next_follow_up || l.status === 'meeting_scheduled' || CLOSED_STATUSES.has(l.status)) continue
      get(dayKey(l.next_follow_up)).follow.push(l)
    }
    for (const a of data.activities) {
      if (a.type !== 'call' || (person !== 'all' && a.user_id !== person)) continue
      get(dayKey(a.created_at)).calls++
    }
    for (const d of Object.values(map)) {
      d.meetings.sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at))
      d.follow.sort((a, b) => new Date(a.next_follow_up) - new Date(b.next_follow_up))
    }
    return map
  }, [data.meetings, data.leads, data.activities, person])

  // 6-week grid starting on Monday
  const days = useMemo(() => {
    const first = new Date(month)
    const offset = (first.getDay() + 6) % 7
    const start = new Date(first.getFullYear(), first.getMonth(), 1 - offset)
    return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i))
  }, [month])

  const shift = (n) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + n, 1))
  const goToday = () => {
    const d = new Date()
    setMonth(new Date(d.getFullYear(), d.getMonth(), 1))
    setSelected(dayKey(d))
  }

  const monthMeetings = days
    .filter((d) => d.getMonth() === month.getMonth())
    .reduce((n, d) => n + (byDay[dayKey(d)]?.meetings.length || 0), 0)

  const sel = byDay[selected] || { meetings: [], follow: [], calls: 0 }
  const selDate = new Date(selected + 'T00:00:00')
  const now = new Date()

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Calendar</h1>
          <p className="muted">{monthMeetings} meeting{monthMeetings === 1 ? '' : 's'} this month</p>
        </div>
        <Seg value={view} onChange={setView} options={[{ value: 'month', label: 'Month' }, { value: 'list', label: 'Meetings list' }]} />
      </header>

      {view === 'list' ? <Meetings embedded /> : <>
      <div className="row between wrap gap-s">
        <div className="cal-toolbar">
          <button className="btn small" onClick={() => shift(-1)} aria-label="Previous month"><ChevronLeft size={16} /></button>
          <button className="btn small" onClick={goToday}>Today</button>
          <button className="btn small" onClick={() => shift(1)} aria-label="Next month"><ChevronRight size={16} /></button>
          <span className="cal-title">{month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</span>
        </div>
        <div className="legend">
          <label className="check"><input type="checkbox" checked={show.meetings} onChange={(e) => setShow((s) => ({ ...s, meetings: e.target.checked }))} /><i style={{ background: '#8e4fd1' }} /> Meetings</label>
          <label className="check"><input type="checkbox" checked={show.follow} onChange={(e) => setShow((s) => ({ ...s, follow: e.target.checked }))} /><i style={{ background: '#f5b041' }} /> Follow-ups</label>
          {data.profiles.length > 1 && (
            <select value={person} onChange={(e) => setPerson(e.target.value)} aria-label="Team member">
              <option value="all">Whole team</option>
              {data.profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
        </div>
      </div>

      <div className="cal-layout">
        <div className="cal-grid" role="grid" aria-label="Month">
          {DOW.map((d) => <div key={d} className="cal-dow">{d}</div>)}
          {days.map((d) => {
            const k = dayKey(d)
            const info = byDay[k] || { meetings: [], follow: [], calls: 0 }
            const items = [
              ...(show.meetings ? info.meetings.map((m) => ({ kind: 'meeting', m })) : []),
              ...(show.follow ? info.follow.map((l) => ({ kind: 'follow', l })) : []),
            ]
            return (
              <button
                key={k}
                type="button"
                className={cx('cal-day', d.getMonth() !== month.getMonth() && 'other', isToday(d) && 'today', selected === k && 'selected')}
                onClick={() => setSelected(k)}
                aria-label={`${d.toDateString()}: ${info.meetings.length} meetings, ${info.follow.length} follow-ups, ${info.calls} calls`}
              >
                <span className="cal-num">
                  <b>{d.getDate()}</b>
                  {info.calls > 0 && <span className="cal-calls">{info.calls} call{info.calls > 1 ? 's' : ''}</span>}
                </span>
                {items.slice(0, MAX_IN_CELL).map((it) =>
                  it.kind === 'meeting' ? (
                    <span key={'m' + it.m.id} className={cx('cal-ev meeting', it.m.status === 'done' && 'done', ['cancelled', 'no_show'].includes(it.m.status) && 'off')}>
                      {fmtTime(it.m.scheduled_at)} {derived.leadsById.get(it.m.lead_id)?.company || it.m.title}
                    </span>
                  ) : (
                    <span key={'f' + it.l.id} className={cx('cal-ev follow', new Date(it.l.next_follow_up) < now && 'overdue')}>↻ {it.l.company}</span>
                  ),
                )}
                {items.length > MAX_IN_CELL && <span className="cal-more">+{items.length - MAX_IN_CELL} more</span>}
                <span className="cal-dots" aria-hidden>
                  {show.meetings && info.meetings.slice(0, 4).map((m) => <i key={m.id} style={{ background: '#8e4fd1' }} />)}
                  {show.follow && info.follow.slice(0, 4).map((l) => <i key={l.id} style={{ background: '#f5b041' }} />)}
                </span>
              </button>
            )
          })}
        </div>

        <Card title={selDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} actions={sel.calls > 0 && <span className="muted small">{sel.calls} calls logged</span>}>
          {sel.meetings.length === 0 && sel.follow.length === 0 ? (
            <Empty>Nothing scheduled.</Empty>
          ) : (
            <div className="stack-s">
              {sel.meetings.length > 0 && <div className="small muted">Meetings</div>}
              {sel.meetings.map((m) => {
                const lead = derived.leadsById.get(m.lead_id)
                const guests = String(m.attendees || '').split(',').map((x) => x.trim()).filter(Boolean)
                return (
                  <div key={m.id} className="agenda-item" onClick={() => lead && openLead(lead.id)}>
                    <span className="agenda-time">{fmtTime(m.scheduled_at)}</span>
                    <span className="agenda-bar" style={{ background: MEETING_STATUS_BY_ID[m.status]?.color || '#8e4fd1' }} />
                    <div className="grow stack-s">
                      <div className="row between gap-s"><b className="clamp">{lead?.company || m.title}</b><MeetingBadge status={m.status} /></div>
                      <span className="muted small">{m.duration_min} min · {m.mode.replace('_', ' ')} · by {derived.profilesById.get(m.created_by)?.name || '—'}</span>
                      {m.status === 'scheduled' && (
                        <a
                          className="small"
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          href={googleCalendarLink({ title: m.title, start: m.scheduled_at, durationMin: m.duration_min, location: m.location, guests, details: `${lead?.company || ''}\n${m.notes || ''}\nBooked by ${me.name}` })}
                        >
                          <CalendarPlus size={12} /> Add to Google Calendar
                        </a>
                      )}
                    </div>
                  </div>
                )
              })}
              {sel.follow.length > 0 && <div className="small muted mt-s">Follow-up calls</div>}
              {sel.follow.map((l) => (
                <div key={l.id} className="agenda-item" onClick={() => openLead(l.id)}>
                  <span className="agenda-time">{fmtTime(l.next_follow_up)}</span>
                  <span className="agenda-bar" style={{ background: new Date(l.next_follow_up) < now ? 'var(--bad)' : '#f5b041' }} />
                  <div className="grow stack-s">
                    <div className="row between gap-s"><b className="clamp">{l.company}</b><StatusBadge status={l.status} /></div>
                    <span className="muted small">{l.contact_person || l.emirate} · {(l.mobile || l.phone).split('/')[0]}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
      </>}
    </div>
  )
}
