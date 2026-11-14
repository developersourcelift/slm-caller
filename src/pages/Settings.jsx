import { useState } from 'react'
import { useStore } from '../lib/store'
import { db, isDemo } from '../lib/db'
import { ROLES } from '../lib/constants'
import { Card } from '../components/ui'
import { Link } from 'react-router-dom'
import { Upload } from 'lucide-react'

function ProfileRow({ p, canEdit }) {
  const { updateProfile } = useStore()
  const [name, setName] = useState(p.name)
  const [email, setEmail] = useState(p.email)
  return (
    <tr>
      <td><input value={name} disabled={!canEdit} onChange={(e) => setName(e.target.value)} onBlur={() => name !== p.name && updateProfile(p.id, { name })} /></td>
      <td><input value={email} disabled={!canEdit || !isDemo} onChange={(e) => setEmail(e.target.value)} onBlur={() => email !== p.email && updateProfile(p.id, { email })} /></td>
      <td>
        <select value={p.role} disabled={!canEdit} onChange={(e) => updateProfile(p.id, { role: e.target.value })}>
          {ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
        </select>
      </td>
    </tr>
  )
}

export default function SettingsPage() {
  const { data, me, saveSettings, reload } = useStore()
  const [s, setS] = useState(data.settings)
  const isAdmin = me.role === 'admin' || isDemo
  const set = (k) => (e) => setS((x) => ({ ...x, [k]: e.target.value }))

  return (
    <div className="page narrow">
      <header className="page-head"><div><h1>Settings</h1></div></header>

      {isAdmin && (
        <Card title="Lead lists">
          <div className="row between wrap gap-s">
            <p className="hint">{data.leads.length.toLocaleString()} leads in {new Set(data.leads.map((l) => l.category)).size} categories. Upload a new Excel file to add more.</p>
            <Link className="btn" to="/import"><Upload size={15} /> Import leads</Link>
          </div>
        </Card>
      )}

      <Card title="Team">
        <div className="table-wrap">
          <table className="table plain-table">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th></tr></thead>
            <tbody>
              {data.profiles.map((p) => <ProfileRow key={p.id} p={p} canEdit={isAdmin || p.id === me.id} />)}
            </tbody>
          </table>
        </div>
        {!isDemo && (
          <p className="hint small">To add someone: Supabase → Authentication → Users → <b>Add user</b> (email + password, tick “Auto confirm”). They appear here after refreshing; then set their name and role.</p>
        )}
      </Card>

      <Card title="Calling & meetings">
        <form className="stack" onSubmit={(e) => { e.preventDefault(); saveSettings({ ...s, daily_call_target: Number(s.daily_call_target) || 0 }) }}>
          <div className="grid-2">
            <label className="field"><span>Daily call target</span><input type="number" min={0} value={s.daily_call_target} onChange={set('daily_call_target')} disabled={!isAdmin} /></label>
            <label className="field"><span>Default meeting length (min)</span><input type="number" min={10} step={5} value={s.meeting_duration} onChange={set('meeting_duration')} disabled={!isAdmin} /></label>
          </div>
          <label className="field"><span>Always invite to meetings (comma-separated emails, e.g. the manager)</span>
            <input value={s.always_invite} onChange={set('always_invite')} placeholder="manager@yourcompany.com" disabled={!isAdmin} />
          </label>
          <label className="field"><span>WhatsApp message template</span><textarea rows={3} value={s.wa_template} onChange={set('wa_template')} disabled={!isAdmin} /></label>
          <label className="field"><span>Follow-up email subject</span><input value={s.email_subject} onChange={set('email_subject')} disabled={!isAdmin} /></label>
          <label className="field"><span>Follow-up email body</span><textarea rows={6} value={s.email_template} onChange={set('email_template')} disabled={!isAdmin} /></label>
          <p className="hint small">Placeholders: {'{company}'}, {'{me}'} (your name), {'{contact}'} (contact person).</p>
          {isAdmin && <button className="btn primary">Save settings</button>}
        </form>
      </Card>

      {isDemo && (
        <Card title="Demo data">
          <p className="hint">Everything is stored in this browser only. Connect Supabase (see README) to share it with the team.</p>
          <button className="btn danger" onClick={async () => {
            if (confirm('Delete all demo leads, calls and meetings from this browser?')) {
              await db.resetDemo()
              await reload()
            }
          }}>Reset demo data</button>
        </Card>
      )}
    </div>
  )
}
