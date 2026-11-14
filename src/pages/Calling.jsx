import { useEffect, useMemo, useState } from 'react'
import { AtSign, ChevronRight, FileText, SlidersHorizontal, SkipForward } from 'lucide-react'
import { useStore } from '../lib/store'
import { CLOSED_STATUSES, OUTCOME_BY_ID } from '../lib/constants'
import { cx, isToday, relative, startOfDay } from '../lib/utils'
import { CallBar, LeadHeader, useOpenLead } from '../components/LeadDrawer'
import { LogCallPanel, MeetingForm } from '../components/forms'
import { UpdateComposer } from '../components/updates'
import { Empty, Modal, StatusBadge } from '../components/ui'

const QUEUES = [
  { value: 'due', label: 'Follow-ups' },
  { value: 'retry', label: 'Retry' },
  { value: 'new', label: 'New' },
]
const hasPhone = (l) => !!(l.mobile || l.phone)

export default function Calling() {
  const { data, derived, me } = useStore()
  const openLead = useOpenLead()
  const [queue, setQueue] = useState(() =>
    data.leads.some((l) => l.next_follow_up && new Date(l.next_follow_up) < new Date(startOfDay().getTime() + 864e5) && !CLOSED_STATUSES.has(l.status)) ? 'due' : 'new',
  )
  const [showFilters, setShowFilters] = useState(false)
  const [cat, setCat] = useState('all')
  const [emirate, setEmirate] = useState('all')
  const [mobileOnly, setMobileOnly] = useState(false)
  const [skipped, setSkipped] = useState(() => new Set())
  const [handled, setHandled] = useState(() => new Set())
  const [currentId, setCurrentId] = useState(null)
  const [panel, setPanel] = useState(null) // 'tag' | 'meeting'

  const emirates = useMemo(() => [...new Set(data.leads.map((l) => l.emirate).filter(Boolean))].sort(), [data.leads])
  const callsToday = data.activities.filter((a) => a.type === 'call' && a.user_id === me.id && isToday(a.created_at)).length
  const target = Number(data.settings.daily_call_target) || 0

  const counts = useMemo(() => {
    const endToday = new Date(startOfDay().getTime() + 864e5)
    const base = data.leads.filter(
      (l) => !CLOSED_STATUSES.has(l.status) && hasPhone(l) && (cat === 'all' || l.category === cat) && (emirate === 'all' || l.emirate === emirate) && (!mobileOnly || l.mobile),
    )
    return {
      due: base
        .filter((l) => l.next_follow_up && new Date(l.next_follow_up) < endToday && l.status !== 'meeting_scheduled')
        .sort((a, b) => new Date(a.next_follow_up) - new Date(b.next_follow_up)),
      // no-answers come back the next day, up to 4 tries
      retry: base
        .filter((l) => l.status === 'no_answer' && !l.next_follow_up && !isToday(l.last_contacted_at) && (l.call_count || 0) < 4)
        .sort((a, b) => new Date(a.last_contacted_at) - new Date(b.last_contacted_at)),
      new: base.filter((l) => l.status === 'new' && !l.next_follow_up),
    }
  }, [data.leads, cat, emirate, mobileOnly])

  const list = counts[queue].filter((l) => !skipped.has(l.id) && !handled.has(l.id))
  // keep the lead on screen while its status changes mid-call
  useEffect(() => {
    if (!currentId && list[0]) setCurrentId(list[0].id)
  }, [currentId, list])
  const current = currentId ? derived.leadsById.get(currentId) : null
  const nextLead = list.find((l) => l.id !== current?.id)
  const remaining = list.filter((l) => l.id !== current?.id).length
  const lastCall = current && data.activities.filter((a) => a.lead_id === current.id && (a.type === 'call' || a.type === 'note')).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]

  const goNext = () => {
    setPanel(null)
    setCurrentId(nextLead?.id ?? null)
    window.scrollTo({ top: 0 })
  }
  const reset = () => setCurrentId(null)
  const activeFilters = (cat !== 'all') + (emirate !== 'all') + mobileOnly

  return (
    <div className="page calling-page">
      <div className="calling-top">
        <div className="queue-tabs" role="tablist">
          {QUEUES.map((q) => (
            <button key={q.value} role="tab" aria-selected={queue === q.value} className={cx(queue === q.value && 'on')} onClick={() => { setQueue(q.value); reset() }}>
              {q.label} <span className="count">{counts[q.value].length.toLocaleString()}</span>
            </button>
          ))}
        </div>
        <div className="row gap-s">
          <span className="today-count" title="Your calls today">{callsToday}{target ? ` / ${target}` : ''} calls today</span>
          <button className={cx('btn small', activeFilters && 'active-filter')} onClick={() => setShowFilters(!showFilters)}>
            <SlidersHorizontal size={14} /> Filters{activeFilters ? ` (${activeFilters})` : ''}
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="filter-bar">
          <select value={cat} onChange={(e) => { setCat(e.target.value); reset() }} aria-label="Category">
            <option value="all">All categories</option>
            {derived.categories.map((c) => <option key={c}>{c}</option>)}
          </select>
          <select value={emirate} onChange={(e) => { setEmirate(e.target.value); reset() }} aria-label="Emirate">
            <option value="all">All emirates</option>
            {emirates.map((c) => <option key={c}>{c}</option>)}
          </select>
          <label className="check"><input type="checkbox" checked={mobileOnly} onChange={(e) => { setMobileOnly(e.target.checked); reset() }} /> Mobile numbers only</label>
        </div>
      )}

      {!current ? (
        <div className="focus-card">
          <Empty>
            {queue === 'due' ? 'No follow-ups due right now. ' : queue === 'retry' ? 'No no-answers to retry today. ' : 'No new leads match these filters. '}
            {queue !== 'new' && <button className="link" onClick={() => { setQueue('new'); reset() }}>Call new leads →</button>}
            {skipped.size > 0 && <> <button className="link" onClick={() => setSkipped(new Set())}>Bring back {skipped.size} skipped</button></>}
          </Empty>
        </div>
      ) : (
        <div className="focus-card">
          <section className="focus-lead">
            <LeadHeader lead={current} />
            <div className="row wrap gap-s">
              <StatusBadge status={current.status} />
              {current.call_count > 0 && <span className="muted small">{current.call_count} previous call{current.call_count > 1 ? 's' : ''}</span>}
              {lastCall && (
                <span className="muted small clamp" style={{ maxWidth: 360 }}>
                  · {relative(lastCall.created_at)}: {lastCall.type === 'call' ? OUTCOME_BY_ID[lastCall.outcome]?.label : 'update'}{lastCall.note ? ` — ${lastCall.note}` : ''}
                </span>
              )}
            </div>
            {current.notes && <div className="pinned-note">📌 {current.notes}</div>}
            <CallBar lead={current} onMeeting={() => setPanel('meeting')} />
          </section>

          <section className="focus-section">
            <h3>How did the call go?</h3>
            <LogCallPanel
              key={current.id}
              lead={current}
              hotkeys={!panel}
              onDone={() => {
                setHandled((s) => new Set(s).add(current.id))
                goNext()
              }}
            />
          </section>

          {panel === 'tag' && (
            <section className="focus-section">
              <h3>Tag a teammate on this lead</h3>
              <UpdateComposer lead={current} autoFocus placeholder="Type @ and pick a teammate, then your question…" onPosted={() => setPanel(null)} />
            </section>
          )}

          <footer className="focus-foot">
            <div className="row wrap gap-s">
              <button className="btn small ghost" onClick={() => { setSkipped((s) => new Set(s).add(current.id)); goNext() }}><SkipForward size={14} /> Skip</button>
              <button className={cx('btn small ghost', panel === 'tag' && 'on')} onClick={() => setPanel(panel === 'tag' ? null : 'tag')}><AtSign size={14} /> Tag</button>
              <button className="btn small ghost" onClick={() => openLead(current.id)}><FileText size={14} /> Details</button>
            </div>
            {nextLead && (
              <button className="next-up" onClick={goNext} title="Skip to next">
                Next: <b className="clamp">{nextLead.company}</b> <span className="muted nowrap">· {remaining.toLocaleString()} left</span> <ChevronRight size={14} />
              </button>
            )}
          </footer>
        </div>
      )}

      <p className="hint small center">Keyboard: 1–8 picks an outcome · Ctrl+Enter saves</p>

      {panel === 'meeting' && current && (
        <Modal title={`Book meeting — ${current.company}`} onClose={() => setPanel(null)}>
          <MeetingForm lead={current} onDone={() => setPanel(null)} />
        </Modal>
      )}
    </div>
  )
}
