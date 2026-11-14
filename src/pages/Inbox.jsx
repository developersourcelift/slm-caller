import { useState } from 'react'
import { Check } from 'lucide-react'
import { useStore } from '../lib/store'
import { relative } from '../lib/utils'
import { useOpenLead } from '../components/LeadDrawer'
import { Avatar, MentionText } from '../components/updates'
import { Empty, Seg, StatusBadge } from '../components/ui'

function MentionCard({ m }) {
  const { derived, me, updateMention, postUpdate } = useStore()
  const openLead = useOpenLead()
  const [reply, setReply] = useState('')
  const [busy, setBusy] = useState(false)
  const lead = derived.leadsById.get(m.lead_id)
  const from = derived.profilesById.get(m.from_user)
  const to = derived.profilesById.get(m.to_user)
  const mine = m.to_user === me.id

  const send = async () => {
    setBusy(true)
    try {
      // reply goes into the lead's thread and tags the sender back
      if (reply.trim() && lead) await postUpdate(lead, `@${from?.name} ${reply.trim()}`)
      await updateMention(m, { reply: reply.trim(), resolved: true })
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className={`inbox-item ${m.resolved ? 'resolved' : ''}`}>
      <Avatar profile={from} size={34} />
      <div className="grow stack-s">
        <div className="row between gap-s wrap">
          <span>
            <b>{from?.name || 'Someone'}</b> {mine ? 'tagged you' : <>tagged <b>{to?.name}</b></>}
            {lead && <> on <button className="link" onClick={() => openLead(lead.id)}><b>{lead.company}</b></button></>}
          </span>
          <span className="muted small">{relative(m.created_at)}</span>
        </div>
        <div className="update-text"><MentionText text={m.message} /></div>
        {m.resolved ? (
          <div className="row gap-s small muted"><Check size={14} /> Done{m.reply ? <> — “{m.reply}”</> : ''}</div>
        ) : mine ? (
          <div className="reply-row">
            <input value={reply} onChange={(e) => setReply(e.target.value)} placeholder={`Reply to ${from?.name || 'them'}…`} onKeyDown={(e) => e.key === 'Enter' && send()} />
            <button className="btn primary small" disabled={busy} onClick={send}>{reply.trim() ? 'Reply' : 'Mark done'}</button>
            {lead && <button className="btn small ghost" onClick={() => openLead(lead.id)}>Open lead</button>}
          </div>
        ) : (
          <div className="row gap-s small muted">Waiting for {to?.name}{lead && <> · <StatusBadge status={lead.status} /></>}</div>
        )}
      </div>
    </li>
  )
}

export default function Inbox() {
  const { data, me } = useStore()
  const [view, setView] = useState('mine')
  const sorted = data.mentions.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  const lists = {
    mine: sorted.filter((m) => m.to_user === me.id && !m.resolved),
    sent: sorted.filter((m) => m.from_user === me.id),
    done: sorted.filter((m) => m.to_user === me.id && m.resolved),
  }
  return (
    <div className="page narrow">
      <header className="page-head">
        <div>
          <h1>Inbox</h1>
          <p className="muted">When someone writes <span className="mention">@{me.name}</span> on a lead, it shows up here.</p>
        </div>
      </header>
      <Seg value={view} onChange={setView} options={[
        { value: 'mine', label: `For me (${lists.mine.length})` },
        { value: 'sent', label: 'I tagged' },
        { value: 'done', label: 'Done' },
      ]} />
      {lists[view].length === 0 ? (
        <div className="card"><Empty>{view === 'mine' ? 'You’re all caught up. 👍' : 'Nothing here yet.'}</Empty></div>
      ) : (
        <ul className="inbox-list">{lists[view].map((m) => <MentionCard key={m.id} m={m} />)}</ul>
      )}
    </div>
  )
}
