import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PhoneCall } from 'lucide-react'
import { useStore } from '../lib/store'
import { CLOSED_STATUSES, MEETING_STATUS_BY_ID, OUTCOME_BY_ID, STATUSES, STATUS_BY_ID } from '../lib/constants'
import { dayKey, fmtTime, isToday, relative, startOfDay } from '../lib/utils'
import { BarList, ColumnChart, Progress } from '../components/charts'
import { Card, Empty, Seg, Stat } from '../components/ui'
import { useOpenLead } from '../components/LeadDrawer'
import { Avatar } from '../components/updates'

const RANGES = [
  { value: 'today', label: 'Today', days: 1 },
  { value: '7', label: '7 days', days: 7 },
  { value: '30', label: '30 days', days: 30 },
]

export default function Dashboard() {
  const { data, derived, me } = useStore()
  const navigate = useNavigate()
  const openLead = useOpenLead()
  const [range, setRange] = useState('today')
  const [person, setPerson] = useState('all')
  const target = Number(data.settings.daily_call_target) || 0
  const now = new Date()

  const m = useMemo(() => {
    const days = RANGES.find((r) => r.value === range).days
    const from = startOfDay(new Date(Date.now() - (days - 1) * 864e5))
    const acts = data.activities.filter((a) => person === 'all' || a.user_id === person)
    const inRange = acts.filter((a) => new Date(a.created_at) >= from)
    const calls = inRange.filter((a) => a.type === 'call')
    const series = []
    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() - i * 864e5)
      series.push({ key: dayKey(d), label: d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }), short: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), value: 0, conn: 0 })
    }
    const byKey = Object.fromEntries(series.map((s) => [s.key, s]))
    for (const a of acts) {
      if (a.type !== 'call') continue
      const s = byKey[dayKey(a.created_at)]
      if (s) {
        s.value++
        if (OUTCOME_BY_ID[a.outcome]?.connected) s.conn++
      }
    }
    series.forEach((s) => (s.tip = `${s.conn} connected`))
    return {
      calls: calls.length,
      connected: calls.filter((a) => OUTCOME_BY_ID[a.outcome]?.connected).length,
      interested: calls.filter((a) => ['interested', 'meeting_booked'].includes(a.outcome)).length,
      meetings: inRange.filter((a) => a.type === 'meeting' && a.outcome === 'scheduled').length,
      callsToday: acts.filter((a) => a.type === 'call' && isToday(a.created_at)).length,
      series,
    }
  }, [data.activities, range, person])

  const pipeline = useMemo(() => {
    const counts = Object.fromEntries(STATUSES.map((s) => [s.id, 0]))
    data.leads.forEach((l) => (counts[l.status] = (counts[l.status] || 0) + 1))
    return STATUSES.filter((s) => s.id !== 'new').map((s) => ({ key: s.id, label: s.label, value: counts[s.id], onClick: () => navigate(`/leads?status=${s.id}`) }))
  }, [data.leads, navigate])
  const contacted = data.leads.filter((l) => l.status !== 'new').length

  // Today's agenda: meetings today + follow-ups due today or overdue
  const endToday = new Date(startOfDay().getTime() + 864e5)
  const agenda = [
    ...data.meetings.filter((x) => x.status === 'scheduled' && isToday(x.scheduled_at)).map((x) => ({ kind: 'meeting', at: x.scheduled_at, lead: derived.leadsById.get(x.lead_id), x })),
    ...data.leads
      .filter((l) => l.next_follow_up && new Date(l.next_follow_up) < endToday && l.status !== 'meeting_scheduled' && !CLOSED_STATUSES.has(l.status))
      .map((l) => ({ kind: 'follow', at: l.next_follow_up, lead: l })),
  ].sort((a, b) => new Date(a.at) - new Date(b.at))

  const feed = data.activities.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 8)
  const pct = (a, b) => (!b ? '' : `${Math.round((a / b) * 100)}%`)

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Hi {me.name.split(' ')[0]} 👋</h1>
          <p className="muted">{now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <button className="btn primary" onClick={() => navigate('/calling')}><PhoneCall size={16} /> Start calling</button>
      </header>

      {target > 0 && (
        <div className="target-strip">
          <span><b>{m.callsToday}</b> of {target} calls today</span>
          <Progress value={m.callsToday} max={target} label="Daily call target" />
        </div>
      )}

      <div className="row between wrap gap-s">
        <Seg value={range} onChange={setRange} options={RANGES} />
        {data.profiles.length > 1 && (
          <select value={person} onChange={(e) => setPerson(e.target.value)} aria-label="Team member">
            <option value="all">Whole team</option>
            {data.profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
      </div>

      <div className="stats four">
        <Stat label="Calls" value={m.calls} />
        <Stat label="Connected" value={m.connected} sub={pct(m.connected, m.calls) && `${pct(m.connected, m.calls)} of calls`} />
        <Stat label="Interested" value={m.interested} />
        <Stat label="Meetings booked" value={m.meetings} onClick={() => navigate('/calendar?view=list')} />
      </div>

      <div className="grid-dash">
        <Card title="Today" actions={<span className="muted small">{agenda.length} to do</span>}>
          {agenda.length === 0 ? <Empty>Nothing scheduled for today.</Empty> : (
            <ul className="list">
              {agenda.slice(0, 8).map((it) => (
                <li key={it.kind + (it.x?.id || it.lead?.id)} className="clickable agenda-row" onClick={() => it.lead && openLead(it.lead.id)}>
                  <span className={`agenda-kind ${it.kind}`}>{it.kind === 'meeting' ? 'Meeting' : 'Call back'}</span>
                  <b className="clamp grow">{it.lead?.company}</b>
                  <span className={new Date(it.at) < now && it.kind === 'follow' ? 'overdue small nowrap' : 'muted small nowrap'}>
                    {isToday(it.at) ? fmtTime(it.at) : relative(it.at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Recent activity">
          {feed.length === 0 ? <Empty>No activity yet.</Empty> : (
            <ul className="list">
              {feed.map((a) => {
                const l = derived.leadsById.get(a.lead_id)
                const who = derived.profilesById.get(a.user_id)
                let what = 'posted an update'
                if (a.type === 'call') what = OUTCOME_BY_ID[a.outcome]?.label.toLowerCase()
                else if (a.type === 'status') what = `→ ${STATUS_BY_ID[a.outcome]?.label}`
                else if (a.type === 'meeting') what = `meeting ${MEETING_STATUS_BY_ID[a.outcome]?.label.toLowerCase()}`
                else if (a.type === 'tag') what = 'tagged someone'
                else if (a.type === 'whatsapp' || a.type === 'email') what = `sent ${a.type}`
                return (
                  <li key={a.id} className="clickable feed-row" onClick={() => l && openLead(l.id)}>
                    <Avatar profile={who} size={24} />
                    <span className="grow clamp"><b>{l?.company}</b> <span className="muted">· {what}</span></span>
                    <span className="muted small nowrap">{relative(a.created_at)}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

        <Card title="Calls per day">
          {m.series.some((s) => s.value) ? <ColumnChart data={m.series} target={target} height={150} /> : <Empty>No calls logged yet.</Empty>}
        </Card>

        <Card title="Pipeline" actions={<span className="muted small">{contacted.toLocaleString()} of {data.leads.length.toLocaleString()} contacted</span>}>
          <BarList rows={pipeline} />
        </Card>
      </div>
    </div>
  )
}
