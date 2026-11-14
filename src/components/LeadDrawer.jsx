import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CalendarPlus, ChevronDown, ChevronUp, Copy, Globe, Mail, MapPin, MessageCircle, Phone, Star, X } from 'lucide-react'
import { useStore } from '../lib/store'
import { STATUSES } from '../lib/constants'
import { cx, fillTemplate, firstEmail, fmtDateTime, leadPhones, relative, siteUrl, waLink } from '../lib/utils'
import { FollowUpPicker, LogCallPanel, MeetingForm } from './forms'
import { Modal } from './ui'
import { UpdateComposer, UpdatesFeed } from './updates'

/** Opens whenever the URL has ?lead=<id>, from any page. */
export function LeadDrawer() {
  const [params, setParams] = useSearchParams()
  const { derived } = useStore()
  const id = params.get('lead')
  const lead = id && derived?.leadsById.get(isNaN(+id) ? id : +id)
  const close = () => {
    params.delete('lead')
    params.delete('tab')
    setParams(params)
  }
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && !document.querySelector('.modal') && close()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
  if (!lead) return null
  return (
    <>
      <div className="drawer-back" onClick={close} />
      <aside className="drawer" aria-label={lead.company}>
        <LeadDetail lead={lead} onClose={close} initialTab={params.get('tab') || 'updates'} />
      </aside>
    </>
  )
}

export function useOpenLead() {
  const [params, setParams] = useSearchParams()
  return (id, tab) => {
    params.set('lead', id)
    if (tab) params.set('tab', tab)
    else params.delete('tab')
    setParams(params)
  }
}

export function LeadHeader({ lead, onClose }) {
  const { updateLead } = useStore()
  return (
    <header className="lead-head">
      <div className="grow">
        <div className="muted small">{lead.category} · {lead.emirate}</div>
        <h2 className="lead-title">{lead.company}</h2>
      </div>
      <button className={cx('icon-btn', lead.starred && 'starred')} title={lead.starred ? 'Unstar' : 'Star (hot lead)'} onClick={() => updateLead(lead.id, { starred: !lead.starred })}>
        <Star size={18} fill={lead.starred ? 'currentColor' : 'none'} />
      </button>
      {onClose && <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>}
    </header>
  )
}

/** The main number, big, with Call + WhatsApp. Other numbers/email/website hide under "More". */
export function CallBar({ lead, onMeeting }) {
  const { me, data, addNote } = useStore()
  const [more, setMore] = useState(false)
  useEffect(() => setMore(false), [lead.id])
  const phones = leadPhones(lead)
  const main = phones[0]
  // WhatsApp the mobile if there is one, otherwise the main phone number
  const waTarget = phones.find((p) => p.kind === 'Mobile') || main
  const waText = fillTemplate(data.settings.wa_template, { company: lead.company, me: me.name, contact: lead.contact_person || '' })
  const extra = phones.length - 1 + (lead.email ? 1 : 0) + (lead.website ? 1 : 0)

  return (
    <div className="callbar">
      {main ? (
        <div className="callbar-main">
          <div>
            <div className="muted small">{main.kind}{lead.contact_person ? ` · ${lead.contact_person}` : ''}</div>
            <a className="callbar-num" href={`tel:${main.tel}`}>{main.display}</a>
          </div>
          <div className="callbar-actions">
            <a className="btn primary" href={`tel:${main.tel}`}><Phone size={16} /> Call</a>
            {waTarget && (
              <a className="btn wa" href={waLink(waTarget.tel, waText)} target="_blank" rel="noreferrer" onClick={() => addNote(lead, `WhatsApp sent to ${waTarget.display}`, 'whatsapp')}>
                <MessageCircle size={16} /> WhatsApp
              </a>
            )}
            {onMeeting && <button className="btn meeting" onClick={onMeeting}><CalendarPlus size={16} /> Book meeting</button>}
          </div>
        </div>
      ) : (
        <div className="callbar-main">
          <p className="hint">No phone number on file.</p>
          {onMeeting && <button className="btn meeting" onClick={onMeeting}><CalendarPlus size={16} /> Book meeting</button>}
        </div>
      )}
      {extra > 0 && (
        <button className="more-toggle" onClick={() => setMore(!more)}>
          {more ? <ChevronUp size={14} /> : <ChevronDown size={14} />} {more ? 'Less' : `More contact options (${extra})`}
        </button>
      )}
      {more && <ContactList lead={lead} skipFirst />}
    </div>
  )
}

function ContactList({ lead, skipFirst }) {
  const { me, data, toast, addNote } = useStore()
  const phones = leadPhones(lead).slice(skipFirst ? 1 : 0)
  const email = firstEmail(lead.email)
  const vars = { company: lead.company, me: me.name, contact: lead.contact_person || '' }
  const copy = (t) => navigator.clipboard?.writeText(t).then(() => toast('Copied'))
  return (
    <div className="contact-list">
      {phones.map((p) => (
        <div className="contact-row" key={p.tel + p.kind}>
          <span className="contact-kind">{p.kind}</span>
          <a className="contact-val" href={`tel:${p.tel}`}>{p.display}</a>
          <a className="icon-btn" href={`tel:${p.tel}`} title="Call"><Phone size={15} /></a>
          <a className="icon-btn" href={waLink(p.tel)} target="_blank" rel="noreferrer" title="WhatsApp"><MessageCircle size={15} /></a>
          <button className="icon-btn" onClick={() => copy(p.tel)} title="Copy"><Copy size={15} /></button>
        </div>
      ))}
      {email && (
        <div className="contact-row">
          <span className="contact-kind">Email</span>
          <span className="contact-val">{lead.email}</span>
          <a
            className="icon-btn"
            title="Send email"
            href={`mailto:${email}?subject=${encodeURIComponent(fillTemplate(data.settings.email_subject, vars))}&body=${encodeURIComponent(fillTemplate(data.settings.email_template, vars))}`}
            onClick={() => addNote(lead, `Email sent to ${email}`, 'email')}
          >
            <Mail size={15} />
          </a>
          <button className="icon-btn" onClick={() => copy(email)} title="Copy"><Copy size={15} /></button>
        </div>
      )}
      {(lead.website || lead.maps_url) && (
        <div className="row wrap gap-s">
          {lead.website && <a className="link-chip" href={siteUrl(lead.website)} target="_blank" rel="noreferrer"><Globe size={13} /> Website</a>}
          {lead.maps_url && <a className="link-chip" href={lead.maps_url} target="_blank" rel="noreferrer"><MapPin size={13} /> Map</a>}
        </div>
      )}
    </div>
  )
}

export function LeadDetail({ lead, onClose, initialTab = 'updates' }) {
  const { setStatus, updateLead } = useStore()
  const [tab, setTab] = useState(initialTab)
  const [meeting, setMeeting] = useState(false)
  useEffect(() => setTab(initialTab), [lead.id, initialTab])
  const overdue = lead.next_follow_up && new Date(lead.next_follow_up) < new Date()

  return (
    <div className="lead-detail">
      <LeadHeader lead={lead} onClose={onClose} />

      <div className="row wrap gap-s">
        <select className="status-select" value={lead.status} onChange={(e) => setStatus(lead, e.target.value)} aria-label="Status">
          {STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        {lead.next_follow_up && (
          <span className={cx('small', overdue ? 'overdue' : 'muted')} title={fmtDateTime(lead.next_follow_up)}>
            Follow-up {relative(lead.next_follow_up)}
          </span>
        )}
      </div>

      <CallBar lead={lead} onMeeting={() => setMeeting(true)} />

      <div className="tabs">
        {[['updates', 'Updates'], ['call', 'Log call'], ['details', 'Details']].map(([k, l]) => (
          <button key={k} className={cx(tab === k && 'on')} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === 'updates' && (
        <div className="stack">
          <UpdateComposer lead={lead} />
          <UpdatesFeed lead={lead} />
        </div>
      )}
      {tab === 'call' && <LogCallPanel key={lead.id} lead={lead} onDone={() => setTab('updates')} />}
      {tab === 'details' && <LeadInfo lead={lead} updateLead={updateLead} />}

      {meeting && (
        <Modal title={`Book meeting — ${lead.company}`} onClose={() => setMeeting(false)}>
          <MeetingForm lead={lead} onDone={() => setMeeting(false)} />
        </Modal>
      )}
    </div>
  )
}

function LeadInfo({ lead, updateLead }) {
  const [notes, setNotes] = useState(lead.notes || '')
  useEffect(() => setNotes(lead.notes || ''), [lead.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const d = lead.details || {}
  return (
    <div className="stack">
      <ContactList lead={lead} />
      <label className="field"><span>Contact person</span>
        <input defaultValue={lead.contact_person || ''} key={'cp' + lead.id} placeholder="Name – role" onBlur={(e) => e.target.value !== (lead.contact_person || '') && updateLead(lead.id, { contact_person: e.target.value })} />
      </label>
      <label className="field"><span>Email</span>
        <input defaultValue={lead.email || ''} key={'em' + lead.id} onBlur={(e) => e.target.value !== (lead.email || '') && updateLead(lead.id, { email: e.target.value })} />
      </label>
      <div className="field"><span>Follow-up</span>
        <FollowUpPicker value={lead.next_follow_up} onChange={(v) => updateLead(lead.id, { next_follow_up: v })} />
        {lead.next_follow_up && <button className="btn ghost small" style={{ alignSelf: 'flex-start' }} onClick={() => updateLead(lead.id, { next_follow_up: null })}>Clear follow-up</button>}
      </div>
      <label className="field"><span>Pinned notes</span>
        <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== (lead.notes || '') && updateLead(lead.id, { notes })} placeholder="Always shown on the calling screen" />
      </label>
      <dl className="details">
        {lead.segment && <><dt>Type</dt><dd>{lead.segment}</dd></>}
        {lead.address && <><dt>Address</dt><dd>{lead.address}</dd></>}
        {d.description && <><dt>About</dt><dd>{d.description}</dd></>}
        {d.venues && <><dt>Venues / events</dt><dd>{d.venues}</dd></>}
        {d.categories && <><dt>Categories</dt><dd>{d.categories}</dd></>}
        {d.google_rating && <><dt>Google</dt><dd>{d.google_rating} ★ ({d.google_reviews || 0} reviews)</dd></>}
        {d.established && <><dt>Established</dt><dd>{d.established}</dd></>}
        {d.source && <><dt>Source</dt><dd>{d.source_link ? <a href={d.source_link} target="_blank" rel="noreferrer">{d.source}</a> : d.source}</dd></>}
      </dl>
    </div>
  )
}
