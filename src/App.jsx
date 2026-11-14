import { useEffect, useState } from 'react'
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Calendar as CalendarIcon, Home, Inbox, LogOut, Menu, PhoneCall, RefreshCw, Settings, Users } from 'lucide-react'
import { useStore } from './lib/store'
import { isDemo } from './lib/db'
import { ROLES } from './lib/constants'
import { cx } from './lib/utils'
import { LeadDrawer } from './components/LeadDrawer'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Calling from './pages/Calling'
import Leads from './pages/Leads'
import CalendarPage from './pages/Calendar'
import { Logo } from './components/ui'
import { Avatar } from './components/updates'
import InboxPage from './pages/Inbox'
import ImportPage from './pages/Import'
import SettingsPage from './pages/Settings'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

export default function App() {
  const { me, data, derived, loading, error, reload, signOut, toasts } = useStore()
  const [navOpen, setNavOpen] = useState(false)

  if (me === undefined) return <div className="center-screen">Loading…</div>
  if (!me) return <Login />
  if (error)
    return (
      <div className="center-screen stack">
        <p className="error">Could not load data: {error}</p>
        <button className="btn" onClick={reload}>Try again</button>
      </div>
    )
  if (!data) return <div className="center-screen">Loading leads…</div>

  const inboxCount = derived.openMentionsForMe.length
  const noLeads = data.leads.length === 0
  const nav = [
    { to: '/', label: 'Home', icon: Home },
    { to: '/calling', label: 'Calling', icon: PhoneCall },
    { to: '/leads', label: 'Leads', icon: Users },
    { to: '/calendar', label: 'Calendar', icon: CalendarIcon },
    { to: '/inbox', label: 'Inbox', icon: Inbox, badge: inboxCount },
  ]

  return (
    <div className="app">
      <aside className={cx('sidebar', navOpen && 'open')}>
        <Logo />
        <div className="logo-sub">Lead calling</div>
        <nav onClick={() => setNavOpen(false)}>
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => cx('nav-item', isActive && 'active')}>
              <n.icon size={18} />
              <span>{n.label}</span>
              {n.badge > 0 && <span className="nav-badge">{n.badge}</span>}
            </NavLink>
          ))}
        </nav>
        <nav className="nav-bottom" onClick={() => setNavOpen(false)}>
          <NavLink to="/settings" className={({ isActive }) => cx('nav-item', isActive && 'active')}><Settings size={18} /><span>Settings</span></NavLink>
        </nav>
        <div className="sidebar-foot">
          {isDemo && <div className="demo-pill" title="Data is stored in this browser only">Demo mode</div>}
          <div className="me">
            <Avatar profile={me} size={32} />
            <div>
              <div>{me.name}</div>
              <div className="muted small">{ROLES.find((r) => r.id === me.role)?.label}</div>
            </div>
          </div>
          <div className="row gap-s">
            <button className="icon-btn" onClick={reload} disabled={loading} title="Refresh data" aria-label="Refresh data"><RefreshCw size={15} /></button>
            <button className="icon-btn" onClick={signOut} title={isDemo ? 'Switch user' : 'Sign out'} aria-label="Sign out"><LogOut size={15} /></button>
          </div>
        </div>
      </aside>
      {navOpen && <div className="drawer-back nav-back" onClick={() => setNavOpen(false)} />}

      <main className="main">
        <ScrollToTop />
        <div className="topbar">
          <button className="icon-btn" onClick={() => setNavOpen(true)} aria-label="Menu"><Menu size={20} /></button>
          <Logo />
        </div>
        {noLeads ? (
          <Routes>
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<ImportPage firstRun />} />
          </Routes>
        ) : (
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/calling" element={<Calling />} />
            <Route path="/leads" element={<Leads />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/meetings" element={<Navigate to="/calendar?view=list" />} />
            <Route path="/inbox" element={<InboxPage />} />
            <Route path="/import" element={<ImportPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        )}
      </main>
      <LeadDrawer />
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => <div key={t.id} className={cx('toast', t.kind)}>{t.msg}</div>)}
      </div>
    </div>
  )
}
