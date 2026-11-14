import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react'
import { AtSign, Phone, CalendarDays, ArrowRightLeft, MessageSquare } from 'lucide-react'
import { useStore } from '../lib/store'
import { MEETING_STATUS_BY_ID, OUTCOME_BY_ID, STATUS_BY_ID } from '../lib/constants'
import { cx, fmtDateTime, relative } from '../lib/utils'

const AVATAR_COLORS = ['#202060', '#f06030', '#00a862', '#8e4fd1', '#3d7fe0', '#e2445c', '#e08a00']
export function avatarColor(id = '') {
  let h = 0
  for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

export function Avatar({ profile, size = 28 }) {
  const name = profile?.name || '?'
  return (
    <span className="avatar" title={name} style={{ width: size, height: size, fontSize: size * 0.42, background: avatarColor(profile?.id) }}>
      {name.trim()[0]?.toUpperCase()}
    </span>
  )
}

/** Highlights @Name for known teammates. */
export function MentionText({ text }) {
  const { data } = useStore()
  const names = data.profiles.map((p) => p.name).filter(Boolean).sort((a, b) => b.length - a.length)
  if (!names.length || !text) return <>{text}</>
  const esc = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const parts = text.split(new RegExp(`(@(?:${esc.join('|')}))`, 'g'))
  return <>{parts.map((p, i) => (p.startsWith('@') && names.includes(p.slice(1)) ? <span key={i} className="mention">{p}</span> : p))}</>
}

/** Teammates written as @Name in a piece of text (excluding me). */
export function mentionedIn(text, profiles, meId) {
  return profiles.filter((p) => p.id !== meId && p.name && String(text || '').includes('@' + p.name))
}

/**
 * Textarea where typing @ opens a teammate picker. Used for updates and call feedback.
 * The parent can call ref.current.insert(profile) (e.g. from a name chip).
 */
export const MentionTextarea = forwardRef(function MentionTextarea({ value, onChange, onSubmit, placeholder, rows = 2, autoFocus, className }, outerRef) {
  const { data, me } = useStore()
  const [query, setQuery] = useState(null) // text after "@" while choosing a person
  const ref = useRef(null)
  const pendingCaret = useRef(null)
  const others = data.profiles.filter((p) => p.id !== me.id)
  const matches = query === null ? [] : others.filter((p) => p.name.toLowerCase().startsWith(query.toLowerCase()))

  useEffect(() => {
    if (autoFocus) ref.current?.focus()
  }, [autoFocus])

  const handleChange = (e) => {
    const v = e.target.value
    onChange(v)
    const upto = v.slice(0, e.target.selectionStart)
    const m = upto.match(/(?:^|\s)@([\w ]{0,20})$/)
    setQuery(m && !m[1].includes('  ') ? m[1] : null)
  }

  const insert = (p) => {
    const el = ref.current
    const caret = el && document.activeElement === el ? el.selectionStart : value.length
    const before = value.slice(0, caret)
    const at = before.lastIndexOf('@')
    const start = at >= 0 && query !== null ? at : caret
    const prefix = value.slice(0, start)
    const next = `${prefix}${prefix && !/\s$/.test(prefix) ? ' ' : ''}@${p.name} ${value.slice(caret)}`
    pendingCaret.current = next.length - value.slice(caret).length
    onChange(next)
    setQuery(null)
  }
  useImperativeHandle(outerRef, () => ({ insert, focus: () => ref.current?.focus() }))

  // place the cursor right after an inserted @Name once the new text has rendered
  useLayoutEffect(() => {
    if (pendingCaret.current === null || !ref.current) return
    ref.current.focus()
    ref.current.setSelectionRange(pendingCaret.current, pendingCaret.current)
    pendingCaret.current = null
  }, [value])

  return (
    <div className="mention-box">
      <textarea
        ref={ref}
        rows={rows}
        value={value}
        className={className}
        onChange={handleChange}
        placeholder={placeholder}
        onBlur={() => setTimeout(() => setQuery(null), 150)}
        onKeyDown={(e) => {
          if (matches.length && (e.key === 'Enter' || e.key === 'Tab')) {
            e.preventDefault()
            insert(matches[0])
          } else if (e.key === 'Escape') setQuery(null)
          else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) onSubmit?.()
        }}
      />
      {matches.length > 0 && (
        <ul className="mention-menu" role="listbox">
          {matches.map((p) => (
            <li key={p.id}>
              <button type="button" onMouseDown={(e) => { e.preventDefault(); insert(p) }}>
                <Avatar profile={p} size={22} /> {p.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
})

/** Small "@Name" buttons that insert a mention into a MentionTextarea. */
export function TagChips({ target }) {
  const { data, me } = useStore()
  return (
    <div className="row wrap gap-s">
      {data.profiles.filter((p) => p.id !== me.id).map((p) => (
        <button key={p.id} type="button" className="tag-chip" onClick={() => target.current?.insert(p)} title={`Tag ${p.name}`}>
          <AtSign size={12} /> {p.name}
        </button>
      ))}
    </div>
  )
}

/** Update box on a lead: write, @tag, post. */
export function UpdateComposer({ lead, autoFocus, onPosted, placeholder }) {
  const { postUpdate } = useStore()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const box = useRef(null)

  const post = async () => {
    if (!text.trim()) return
    setBusy(true)
    try {
      await postUpdate(lead, text.trim())
      setText('')
      onPosted?.()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="composer">
      <MentionTextarea ref={box} value={text} onChange={setText} onSubmit={post} autoFocus={autoFocus} placeholder={placeholder || 'Write an update… type @ to tag someone'} />
      <div className="composer-foot">
        <TagChips target={box} />
        <button className="btn primary small" disabled={busy || !text.trim()} onClick={post}>Post</button>
      </div>
    </div>
  )
}

const ICONS = { call: Phone, meeting: CalendarDays, status: ArrowRightLeft, note: MessageSquare }

/** One thread per lead: updates, calls, status changes and meetings, newest first. */
export function UpdatesFeed({ lead }) {
  const { data, derived, leadActivities } = useStore()
  const [history, setHistory] = useState(null)
  const inMemory = data.activities.filter((a) => a.lead_id === lead.id)
  useEffect(() => {
    leadActivities(lead.id).then(setHistory).catch(() => setHistory(null))
  }, [lead.id, inMemory.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // merge (full history may lag a moment behind new in-memory rows)
  const byId = new Map([...(history || []), ...inMemory].map((a) => [a.id, a]))
  const items = [...byId.values()].filter((a) => a.type !== 'tag').sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  if (!items.length) return <p className="empty">No updates yet.</p>

  return (
    <ol className="feed-list">
      {items.map((a) => {
        const who = derived.profilesById.get(a.user_id)
        if (a.type === 'note') {
          return (
            <li key={a.id} className="update">
              <Avatar profile={who} />
              <div className="update-body">
                <div className="update-head"><b>{who?.name || 'Someone'}</b><span className="muted small" title={fmtDateTime(a.created_at)}>{relative(a.created_at)}</span></div>
                <div className="update-text"><MentionText text={a.note} /></div>
              </div>
            </li>
          )
        }
        const Icon = ICONS[a.type] || MessageSquare
        let what = a.type
        if (a.type === 'call') what = <>Called — <b>{OUTCOME_BY_ID[a.outcome]?.label || a.outcome}</b></>
        else if (a.type === 'status') what = <>Status → <b>{STATUS_BY_ID[a.outcome]?.label || a.outcome}</b></>
        else if (a.type === 'meeting') what = <>Meeting <b>{MEETING_STATUS_BY_ID[a.outcome]?.label.toLowerCase() || a.outcome}</b></>
        else if (a.type === 'whatsapp') what = 'Sent WhatsApp'
        else if (a.type === 'email') what = 'Sent email'
        return (
          <li key={a.id} className={cx('event', a.note && 'has-note')}>
            <span className="event-icon"><Icon size={13} /></span>
            <div className="update-body">
              <div className="event-line">
                <span>{what}</span>
                <span className="muted small" title={fmtDateTime(a.created_at)}>{who?.name} · {relative(a.created_at)}</span>
              </div>
              {a.note && <div className="event-note"><MentionText text={a.note} /></div>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
