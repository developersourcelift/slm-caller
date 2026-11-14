import { useEffect, useState } from 'react'
import { Logo } from '../components/ui'
import { useStore } from '../lib/store'
import { db, isDemo } from '../lib/db'
import { ROLES } from '../lib/constants'

export default function Login() {
  const { signIn } = useStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [profiles, setProfiles] = useState([])

  useEffect(() => {
    if (isDemo) db.profiles().then(setProfiles)
  }, [])

  const submit = async (e) => {
    e.preventDefault()
    setErr('')
    setBusy(true)
    try {
      await signIn({ email, password })
    } catch (e2) {
      setErr(e2.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="center-screen">
      <div className="card login">
        <div>
          <Logo />
          <h1>Sign in</h1>
          <p className="muted small">Sourcelift lead calling</p>
        </div>
        {isDemo ? (
          <div className="stack">
            <p className="hint">
              <b>Demo mode</b> — data stays in this browser. Pick who you are to try each view. Connect Supabase (see README) to share data with the team.
            </p>
            {profiles.map((p) => (
              <button key={p.id} className="btn block" onClick={() => signIn({ userId: p.id })}>
                Continue as {p.name} <span className="muted">({ROLES.find((r) => r.id === p.role)?.label})</span>
              </button>
            ))}
          </div>
        ) : (
          <form className="stack" onSubmit={submit}>
            <label className="field"><span>Email</span><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" /></label>
            <label className="field"><span>Password</span><input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></label>
            {err && <p className="error">{err}</p>}
            <button className="btn primary block" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
            <p className="hint small">Accounts are created by the manager in Supabase.</p>
          </form>
        )}
      </div>
    </div>
  )
}
