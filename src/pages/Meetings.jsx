import { useMemo, useState } from 'react'
import { CalendarPlus } from 'lucide-react'
import { useStore } from '../lib/store'
import { MEETING_MODES, MEETING_STATUSES } from '../lib/constants'
import { fmtDateTime, googleCalendarLink, isToday, relative } from '../lib/utils'
import { useOpenLead } from '../components/LeadDrawer'
import { MeetingForm } from '../components/forms'
import { Card, Empty, MeetingBadge, Modal, Seg, Stat } from '../components/ui'

function OutcomeForm({ meeting, lead, onDone }) {
  const { updateMeeting } = useStore()
  const [status, setStatus] = useState(meeting.status === 'scheduled' ? 'done' : meeting.status)
  const [outcome, setOutcome] = useState(meeting.outcome || '')
  return (
    <form className="stack" onSubmit={async (e) => { e.preventDefault(); await updateMeeting(meeting, { status, outcome }, lead); onDone() }}>
      <div className="row wrap gap-s">
        {MEETING_STATUSES.map((s) => (
          <button type="button" key={s.id} className={`chip ${status === s.id ? 'on' : ''}`} onClick={() => setStatus(s.id)}>{s.label}</button>
        ))}
      </div>
      <label className="field"><span>Outcome / next steps</span>
        <textarea rows={4} value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder="What was discussed? What happens next?" />
      </label>
      <button className="btn primary">Save</button>
      {status === 'rescheduled' && <p className="hint small">After saving, use “Edit / resend invite” to set the new time.</p>}
    </form>
  )
}

export default function Meetings({ embedded }) {
  const { data, derived, me } = useStore()
  const openLead = useOpenLead()
  const [view, setView] = useState('upcoming')
  const [modal, setModal] = useState(null)

  const { upcoming, needsUpdate, past, stats } = useMemo(() => {
    const cutoff = Date.now() - 3600e3
    const all = data.meetings.slice().sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at))
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    const thisMonth = all.filter((m) => new Date(m.scheduled_at) >= monthStart)
    return {
      upcoming: all.filter((m) => ['scheduled', 'rescheduled'].includes(m.status) && new Date(m.scheduled_at) >= cutoff),
      needsUpdate: all.filter((m) => ['scheduled', 'rescheduled'].includes(m.status) && new Date(m.scheduled_at) < cutoff),
      past: all.filter((m) => !['scheduled', 'rescheduled'].includes(m.status)).reverse(),
      stats: {
        today: all.filter((m) => isToday(m.scheduled_at) && m.status === 'scheduled').length,
        month: thisMonth.length,
        done: thisMonth.filter((m) => m.status === 'done').length,
        noShow: thisMonth.filter((m) => ['no_show', 'cancelled'].includes(m.status)).length,
      },
    }
  }, [data.meetings])

  const list = view === 'upcoming' ? upcoming : view === 'update' ? needsUpdate : past

  return (
    <div className={embedded ? 'stack' : 'page'}>
      {!embedded && (
        <header className="page-head">
          <div><h1>Meetings</h1></div>
        </header>
      )}
      <div className="stats four">
        <Stat label="Today" value={stats.today} />
        <Stat label="This month" value={stats.month} />
        <Stat label="Done this month" value={stats.done} />
        <Stat label="No-show / cancelled" value={stats.noShow} />
      </div>
      <Seg value={view} onChange={setView} options={[
        { value: 'upcoming', label: `Upcoming (${upcoming.length})` },
        { value: 'update', label: `Needs outcome (${needsUpdate.length})` },
        { value: 'past', label: `Past (${past.length})` },
      ]} />
      <Card>
        {list.length === 0 ? <Empty>{view === 'update' ? 'All past meetings have an outcome. 👍' : 'Nothing here yet.'}</Empty> : (
          <ul className="list meetings">
            {list.map((m) => {
              const lead = derived.leadsById.get(m.lead_id)
              const guests = String(m.attendees || '').split(',').map((x) => x.trim()).filter(Boolean)
              return (
                <li key={m.id}>
                  <div className="meeting-row">
                    <div className="meeting-when">
                      <b>{new Date(m.scheduled_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</b>
                      <span>{new Date(m.scheduled_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div className="grow">
                      <div className="row between gap-s wrap">
                        <button className="link" onClick={() => lead && openLead(lead.id)}><b>{lead?.company || m.title}</b></button>
                        <MeetingBadge status={m.status} />
                      </div>
                      <div className="muted small">
                        {m.title} · {m.duration_min} min · {MEETING_MODES.find((x) => x.id === m.mode)?.label.split(' (')[0]} · {relative(m.scheduled_at)}
                        {' · booked by '}{derived.profilesById.get(m.created_by)?.name || '—'}
                      </div>
                      {guests.length > 0 && <div className="muted small">Guests: {guests.join(', ')}</div>}
                      {m.outcome && <div className="note">{m.outcome}</div>}
                      <div className="row wrap gap-s mt-s">
                        {view !== 'past' && <button className="btn small primary" onClick={() => setModal({ type: 'outcome', m, lead })}>Update outcome</button>}
                        {view === 'past' && <button className="btn small" onClick={() => setModal({ type: 'outcome', m, lead })}>Edit outcome</button>}
                        {lead && <button className="btn small ghost" onClick={() => setModal({ type: 'edit', m, lead })}>Edit / resend invite</button>}
                        {view === 'upcoming' && (
                          <a className="btn small ghost" target="_blank" rel="noreferrer" href={googleCalendarLink({ title: m.title, start: m.scheduled_at, durationMin: m.duration_min, location: m.location, guests, details: `${lead?.company || ''}\n${m.notes || ''}\nBooked by ${me.name}` })}>
                            <CalendarPlus size={14} /> Calendar
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Card>
      {modal?.type === 'outcome' && (
        <Modal title={`Meeting outcome — ${modal.lead?.company || modal.m.title}`} onClose={() => setModal(null)}>
          <OutcomeForm meeting={modal.m} lead={modal.lead} onDone={() => setModal(null)} />
        </Modal>
      )}
      {modal?.type === 'edit' && (
        <Modal title="Edit meeting" onClose={() => setModal(null)}>
          <MeetingForm lead={modal.lead} meeting={modal.m} onDone={() => setModal(null)} />
        </Modal>
      )}
      <p className="hint small">Times are shown in your local time ({fmtDateTime(new Date())} now). Book meetings from a lead: Log call → Meeting booked.</p>
    </div>
  )
}
