import { useEffect, useRef, useState } from 'react'
import { CalendarPlus, Download, Mail } from 'lucide-react'
import { MentionTextarea, TagChips } from './updates'
import { useStore } from '../lib/store'
import { CALL_OUTCOMES, MEETING_MODES, OUTCOME_BY_ID, ROLES } from '../lib/constants'
import { cx, downloadIcs, firstEmail, fromLocalInput, googleCalendarLink, presetDate, toLocalInput } from '../lib/utils'

/** Quick follow-up chooser used in several places. */
export function FollowUpPicker({ value, onChange }) {
  const presets = [
    ['2h', 'In 2 h'],
    ['tomorrow', 'Tomorrow'],
    ['3d', 'In 3 days'],
    ['week', 'Next week'],
  ]
  return (
    <div className="stack-s">
      <div className="row wrap gap-s">
        {presets.map(([k, l]) => (
          <button key={k} type="button" className="chip" onClick={() => onChange(presetDate(k).toISOString())}>
            {l}
          </button>
        ))}
      </div>
      <input type="datetime-local" value={toLocalInput(value)} onChange={(e) => onChange(fromLocalInput(e.target.value))} />
    </div>
  )
}

/** One call → one outcome. Used in the lead drawer and in calling mode. */
export function LogCallPanel({ lead, onDone, compact, hotkeys }) {
  const { logCall } = useStore()
  const [outcome, setOutcome] = useState(null)
  const [note, setNote] = useState('')
  const [followUp, setFollowUp] = useState(null)
  const [contact, setContact] = useState(lead.contact_person || '')
  const [busy, setBusy] = useState(false)
  const [showMeeting, setShowMeeting] = useState(false)
  const noteBox = useRef(null)
  const o = outcome && OUTCOME_BY_ID[outcome]

  const pick = (id) => {
    setOutcome(id)
    const oc = OUTCOME_BY_ID[id]
    if (oc.needsFollowUp && !followUp) setFollowUp(presetDate('tomorrow').toISOString())
    if (!oc.needsFollowUp) setFollowUp(null)
  }

  // Keys 1–8 pick an outcome (when not typing in a field).
  useEffect(() => {
    if (!hotkeys || showMeeting) return
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || document.querySelector('.modal')) return
      const oc = CALL_OUTCOMES.find((x) => x.key === e.key)
      if (oc) {
        e.preventDefault()
        pick(oc.id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const save = async () => {
    if (!o) return
    setBusy(true)
    try {
      const row = await logCall(lead, outcome, {
        note,
        followUp,
        contactPerson: contact !== (lead.contact_person || '') ? contact : undefined,
      })
      if (o.opensMeeting) setShowMeeting(row)
      else {
        setOutcome(null)
        setNote('')
        setFollowUp(null)
        onDone?.(outcome)
      }
    } finally {
      setBusy(false)
    }
  }

  if (showMeeting)
    return (
      <div className="stack">
        <p className="hint">Call logged. Now book the meeting:</p>
        <MeetingForm lead={showMeeting} onDone={() => { setShowMeeting(false); setOutcome(null); setNote(''); onDone?.('meeting_booked') }} />
      </div>
    )

  return (
    <div className="stack">
      <div className={cx('outcomes', compact && 'compact')}>
        {CALL_OUTCOMES.map((oc) => (
          <button key={oc.id} type="button" className={cx('outcome', `oc-${oc.id}`, outcome === oc.id && 'on')} onClick={() => pick(oc.id)}>
            <kbd>{oc.key}</kbd> {oc.label}
          </button>
        ))}
      </div>
      {o && (
        <>
          <div className="field">
            <span>Feedback / notes</span>
            <div className="composer">
              <MentionTextarea
                ref={noteBox}
                rows={3}
                value={note}
                onChange={setNote}
                onSubmit={save}
                autoFocus
                placeholder="What did they say? Type @ to tag someone (Ctrl+Enter to save)"
              />
              <div className="composer-foot">
                <TagChips target={noteBox} />
              </div>
            </div>
          </div>
          {!o.opensMeeting && !['not_interested', 'wrong_number'].includes(o.id) && (
            <div className="field">
              <span>Next follow-up {o.needsFollowUp ? '' : '(optional)'}</span>
              <FollowUpPicker value={followUp} onChange={setFollowUp} />
            </div>
          )}
          <button className="btn primary" disabled={busy} onClick={save}>
            {o.opensMeeting ? 'Log call & book meeting' : 'Save call'}
          </button>
        </>
      )}
    </div>
  )
}

/** Book a meeting, then send the invite from the caller's own Google Calendar (free). */
export function MeetingForm({ lead, meeting, onDone }) {
  const { data, me, scheduleMeeting, updateMeeting } = useStore()
  const s = data.settings
  const defaultGuests = [firstEmail(lead.email), ...String(s.always_invite || '').split(',')].map((x) => x.trim()).filter(Boolean)
  const [f, setF] = useState(() =>
    meeting
      ? { ...meeting }
      : {
          title: `Intro meeting — ${lead.company}`,
          scheduled_at: presetDate('tomorrow').toISOString(),
          duration_min: Number(s.meeting_duration) || 30,
          mode: 'online',
          location: '',
          attendees: [...new Set(defaultGuests)].join(', '),
          notes: lead.contact_person ? `Contact: ${lead.contact_person}` : '',
        },
  )
  const [saved, setSaved] = useState(null)
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e?.target ? e.target.value : e }))

  const inviteData = (m) => ({
    title: m.title,
    start: m.scheduled_at,
    durationMin: Number(m.duration_min),
    location: m.location,
    guests: String(m.attendees || '').split(',').map((x) => x.trim()).filter(Boolean),
    details: [
      `Company: ${lead.company}`,
      lead.contact_person && `Contact: ${lead.contact_person}`,
      lead.mobile && `Mobile: ${lead.mobile}`,
      lead.phone && `Phone: ${lead.phone}`,
      lead.website && `Website: ${lead.website}`,
      m.notes && `\n${m.notes}`,
      `\nBooked by ${me.name}`,
    ].filter(Boolean).join('\n'),
  })

  const save = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const payload = {
        title: f.title,
        scheduled_at: f.scheduled_at,
        duration_min: Number(f.duration_min),
        mode: f.mode,
        location: f.location,
        attendees: f.attendees,
        notes: f.notes,
      }
      const row = meeting
        ? await updateMeeting(meeting, { ...payload, status: meeting.status === 'done' ? 'done' : 'scheduled' }, lead)
        : await scheduleMeeting(lead, payload)
      setSaved(row)
    } finally {
      setBusy(false)
    }
  }

  if (saved) {
    const inv = inviteData(saved)
    return (
      <div className="stack">
        <p className="success">✓ Meeting saved for {new Date(saved.scheduled_at).toLocaleString('en-GB')}.</p>
        <p className="hint">Send the calendar invite to the client{inv.guests.length > 1 ? ' and team' : ''} from your Google account (click <b>Save</b> in Google Calendar, then <b>Send</b>). Add a Google Meet link there with one click.</p>
        <div className="row wrap gap-s">
          <a className="btn primary" href={googleCalendarLink(inv)} target="_blank" rel="noreferrer"><CalendarPlus size={16} /> Send Google Calendar invite</a>
          <button className="btn" onClick={() => downloadIcs(inv)}><Download size={16} /> .ics (Outlook)</button>
          <button className="btn ghost" onClick={() => onDone?.(saved)}>Done</button>
        </div>
      </div>
    )
  }

  return (
    <form className="stack" onSubmit={save}>
      <label className="field"><span>Title</span><input required value={f.title} onChange={set('title')} /></label>
      <div className="grid-2">
        <label className="field"><span>Date & time</span>
          <input type="datetime-local" required value={toLocalInput(f.scheduled_at)} onChange={(e) => set('scheduled_at')(fromLocalInput(e.target.value))} />
        </label>
        <label className="field"><span>Duration (min)</span>
          <input type="number" min={10} step={5} value={f.duration_min} onChange={set('duration_min')} />
        </label>
      </div>
      <div className="grid-2">
        <label className="field"><span>Type</span>
          <select value={f.mode} onChange={set('mode')}>{MEETING_MODES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select>
        </label>
        <label className="field"><span>{f.mode === 'in_person' ? 'Address' : 'Link / number'}</span>
          <input value={f.location} onChange={set('location')} placeholder={f.mode === 'in_person' ? lead.address : 'Added by Google Meet if empty'} />
        </label>
      </div>
      <label className="field"><span>Invite emails (comma separated)</span>
        <input value={f.attendees} onChange={set('attendees')} placeholder="client@company.com, manager@yourco.com" />
      </label>
      <label className="field"><span>Agenda / notes</span><textarea rows={3} value={f.notes} onChange={set('notes')} /></label>
      <button className="btn primary" disabled={busy}>Save meeting</button>
    </form>
  )
}

/** Tag a teammate (manager for sales questions, developer for technical questions). */
export function TagForm({ lead, onDone }) {
  const { data, me, tag } = useStore()
  const others = data.profiles.filter((p) => p.id !== me.id)
  const [to, setTo] = useState(others.find((p) => p.role === 'admin')?.id || others[0]?.id || '')
  const [msg, setMsg] = useState('')
  const [sent, setSent] = useState(null)
  const target = data.profiles.find((p) => p.id === to)

  if (!others.length) return <p className="hint">Add teammates first (Team & settings).</p>

  if (sent) {
    const subject = `[Lead Desk] ${lead ? lead.company + ': ' : ''}question from ${me.name}`
    const body = `${msg}\n\n${lead ? `Lead: ${lead.company} (${lead.category})\nOpen: ${location.href}` : ''}`
    return (
      <div className="stack">
        <p className="success">✓ {target?.name} will see this in their Inbox.</p>
        {target?.email && (
          <a className="btn" href={`mailto:${target.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`}>
            <Mail size={16} /> Also email {target.name}
          </a>
        )}
        <button className="btn ghost" onClick={() => onDone?.()}>Done</button>
      </div>
    )
  }

  return (
    <form className="stack" onSubmit={async (e) => { e.preventDefault(); await tag(lead, to, msg); setSent(true) }}>
      <label className="field"><span>Tag</span>
        <select value={to} onChange={(e) => setTo(e.target.value)}>
          {others.map((p) => <option key={p.id} value={p.id}>{p.name} — {ROLES.find((r) => r.id === p.role)?.label}</option>)}
        </select>
      </label>
      <label className="field"><span>Question / message</span>
        <textarea required rows={3} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="e.g. Client asks if we can integrate with their ERP — can you join the meeting?" />
      </label>
      <button className="btn primary">Send tag</button>
    </form>
  )
}
