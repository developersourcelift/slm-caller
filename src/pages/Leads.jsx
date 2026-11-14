import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Download, Search, Star, X } from 'lucide-react'
import { useStore } from '../lib/store'
import { CLOSED_STATUSES, STATUSES, STATUS_BY_ID } from '../lib/constants'
import { cx, downloadText, fmtDate, fmtDateTime, isToday, relative, startOfDay, toCsv } from '../lib/utils'
import { useOpenLead } from '../components/LeadDrawer'
import { Empty, StatusBadge } from '../components/ui'

const PAGE = 50
const SORTS = {
  name: { label: 'Company A–Z', fn: (a, b) => a.company.localeCompare(b.company) },
  recent: { label: 'Recently contacted', fn: (a, b) => new Date(b.last_contacted_at || 0) - new Date(a.last_contacted_at || 0) },
  followup: { label: 'Next follow-up', fn: (a, b) => new Date(a.next_follow_up || 8.64e15) - new Date(b.next_follow_up || 8.64e15) },
  calls: { label: 'Most calls', fn: (a, b) => (b.call_count || 0) - (a.call_count || 0) },
  added: { label: 'Original list order', fn: (a, b) => (a.id > b.id ? 1 : -1) },
}
const SHOW = {
  any: 'Any details',
  mobile: 'Has mobile',
  email: 'Has email',
  contact: 'Has contact person',
  starred: 'Starred',
  due: 'Follow-up due',
}
const CONTACTED = {
  any: 'Contacted: any time',
  today: 'Contacted today',
  week: 'Contacted this week',
  older: 'Not contacted in 7+ days',
  never: 'Never contacted',
}

export default function Leads() {
  const { data, derived } = useStore()
  const openLead = useOpenLead()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState('')
  const [emirate, setEmirate] = useState('all')
  const [has, setHas] = useState('any')
  const [contacted, setContacted] = useState('any')
  const [sort, setSort] = useState('name')
  const [page, setPage] = useState(0)
  const cat = params.get('cat') || 'all'
  // status can hold several values: ?status=interested,callback  (or "open")
  const statusSel = useMemo(() => new Set((params.get('status') || '').split(',').filter(Boolean)), [params])

  const setParam = (k, v) => {
    if (!v || v === 'all') params.delete(k)
    else params.set(k, v)
    setParams(params)
    setPage(0)
  }
  const toggleStatus = (id) => {
    const next = new Set([...statusSel].filter((s) => s !== 'open'))
    next.has(id) ? next.delete(id) : next.add(id)
    setParam('status', [...next].join(','))
  }

  const emirates = useMemo(() => [...new Set(data.leads.map((l) => l.emirate).filter(Boolean))].sort(), [data.leads])

  // every filter except status — used for the status chip counts
  const baseFiltered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const digits = needle.replace(/\D/g, '')
    const endToday = new Date(startOfDay().getTime() + 864e5)
    const weekAgo = Date.now() - 7 * 864e5
    return data.leads.filter((l) => {
      if (cat !== 'all' && l.category !== cat) return false
      if (emirate !== 'all' && l.emirate !== emirate) return false
      if (has === 'mobile' && !l.mobile) return false
      if (has === 'email' && !l.email) return false
      if (has === 'starred' && !l.starred) return false
      if (has === 'due' && !(l.next_follow_up && new Date(l.next_follow_up) < endToday)) return false
      if (has === 'contact' && !l.contact_person) return false
      const lc = l.last_contacted_at ? new Date(l.last_contacted_at).getTime() : null
      if (contacted === 'today' && !(lc && isToday(lc))) return false
      if (contacted === 'week' && !(lc && lc >= weekAgo)) return false
      if (contacted === 'older' && !(lc && lc < weekAgo)) return false
      if (contacted === 'never' && lc) return false
      if (needle) {
        const hay = `${l.company} ${l.email} ${l.contact_person} ${l.segment} ${l.address}`.toLowerCase()
        const phoneHit = digits.length >= 4 && `${l.phone} ${l.mobile}`.replace(/\D/g, '').includes(digits)
        if (!hay.includes(needle) && !phoneHit) return false
      }
      return true
    })
  }, [data.leads, q, cat, emirate, has, contacted])

  const statusCounts = useMemo(() => {
    const c = {}
    baseFiltered.forEach((l) => (c[l.status] = (c[l.status] || 0) + 1))
    return c
  }, [baseFiltered])
  const openCount = baseFiltered.filter((l) => !CLOSED_STATUSES.has(l.status)).length

  const filtered = useMemo(() => {
    let list = baseFiltered
    if (statusSel.has('open')) list = list.filter((l) => !CLOSED_STATUSES.has(l.status))
    else if (statusSel.size) list = list.filter((l) => statusSel.has(l.status))
    return list.slice().sort(SORTS[sort].fn)
  }, [baseFiltered, statusSel, sort])

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE))
  const rows = filtered.slice(page * PAGE, page * PAGE + PAGE)
  const anyFilter = q || emirate !== 'all' || has !== 'any' || contacted !== 'any' || statusSel.size > 0
  const clearAll = () => {
    setQ('')
    setEmirate('all')
    setHas('any')
    setContacted('any')
    setParam('status', '')
  }
  const reset = (fn) => (e) => {
    fn(e.target.value)
    setPage(0)
  }

  const exportCsv = () => {
    const cols = [
      ['Category', (l) => l.category], ['Company', (l) => l.company], ['Emirate', (l) => l.emirate], ['Segment', (l) => l.segment],
      ['Phone', (l) => l.phone], ['Mobile', (l) => l.mobile], ['Email', (l) => l.email], ['Website', (l) => l.website],
      ['Contact person', (l) => l.contact_person], ['Status', (l) => STATUS_BY_ID[l.status]?.label], ['Calls', (l) => l.call_count],
      ['Last contacted', (l) => fmtDateTime(l.last_contacted_at)], ['Next follow-up', (l) => fmtDateTime(l.next_follow_up)],
      ['Starred', (l) => (l.starred ? 'Yes' : '')], ['Notes', (l) => l.notes],
    ].map(([label, get]) => ({ label, get }))
    downloadText(`leads-${new Date().toISOString().slice(0, 10)}.csv`, '﻿' + toCsv(filtered, cols), 'text/csv')
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Leads</h1>
          <p className="muted">{filtered.length.toLocaleString()} of {data.leads.length.toLocaleString()} leads</p>
        </div>
        <button className="btn ghost small" onClick={exportCsv} title="Exports the leads currently shown"><Download size={15} /> Export CSV</button>
      </header>

      <div className="cat-tabs">
        {['all', ...derived.categories].map((c) => (
          <button key={c} className={cat === c ? 'on' : ''} onClick={() => setParam('cat', c)}>
            {c === 'all' ? 'All' : c} <span className="muted">{(c === 'all' ? data.leads.length : data.leads.filter((l) => l.category === c).length).toLocaleString()}</span>
          </button>
        ))}
      </div>

      <div className="filters">
        <label className="search">
          <Search size={16} />
          <input value={q} onChange={reset(setQ)} placeholder="Search company, phone, email, contact…" />
        </label>
        <select value={emirate} onChange={reset(setEmirate)} aria-label="Emirate" className={cx(emirate !== 'all' && 'active-filter')}>
          <option value="all">All emirates</option>
          {emirates.map((x) => <option key={x}>{x}</option>)}
        </select>
        <select value={contacted} onChange={reset(setContacted)} aria-label="Last contacted" className={cx(contacted !== 'any' && 'active-filter')}>
          {Object.entries(CONTACTED).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={has} onChange={reset(setHas)} aria-label="Details" className={cx(has !== 'any' && 'active-filter')}>
          {Object.entries(SHOW).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">
          {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>Sort: {v.label}</option>)}
        </select>
        {anyFilter && <button className="btn ghost" onClick={clearAll}><X size={15} /> Clear</button>}
      </div>

      <div className="status-chips" role="group" aria-label="Filter by status">
        <button className={cx('status-chip', statusSel.size === 0 && 'on')} onClick={() => setParam('status', '')}>
          All <span className="count">{baseFiltered.length.toLocaleString()}</span>
        </button>
        <button className={cx('status-chip', statusSel.has('open') && 'on')} onClick={() => setParam('status', statusSel.has('open') ? '' : 'open')} title="Everything except Won, Not interested and Wrong number">
          Open <span className="count">{openCount.toLocaleString()}</span>
        </button>
        <span className="chip-sep" />
        {STATUSES.map((s) => (
          <button key={s.id} className={cx('status-chip', statusSel.has(s.id) && 'on')} onClick={() => toggleStatus(s.id)} disabled={!statusCounts[s.id] && !statusSel.has(s.id)}>
            <i style={{ background: s.color }} /> {s.label} <span className="count">{(statusCounts[s.id] || 0).toLocaleString()}</span>
          </button>
        ))}
      </div>

      {rows.length === 0 ? <div className="card"><Empty>No leads match these filters. {anyFilter && <button className="link" onClick={clearAll}>Clear filters</button>}</Empty></div> : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Status</th>
                <th>Phone</th>
                <th>Follow-up</th>
                <th>Last contact</th>
                <th className="num">Calls</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => {
                const overdue = l.next_follow_up && new Date(l.next_follow_up) < new Date()
                return (
                  <tr key={l.id} onClick={() => openLead(l.id)}>
                    <td>
                      <div className="cell-main">{l.starred && <Star size={13} className="star" fill="currentColor" />} {l.company}</div>
                      <div className="muted small clamp">{l.emirate}{cat === 'all' ? ` · ${l.category}` : ''}{l.contact_person ? ` · ${l.contact_person}` : ''}</div>
                    </td>
                    <td><StatusBadge status={l.status} /></td>
                    <td className="nowrap small">{(l.mobile || l.phone || '—').split('/')[0]}</td>
                    <td className={`nowrap small ${overdue ? 'overdue' : ''}`}>{l.next_follow_up ? fmtDate(l.next_follow_up) : ''}</td>
                    <td className="nowrap small muted">{l.last_contacted_at ? relative(l.last_contacted_at) : ''}</td>
                    <td className="num small muted">{l.call_count || ''}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <div className="pager">
          <button className="btn small" disabled={page === 0} onClick={() => setPage(page - 1)}>← Prev</button>
          <span className="muted small">Page {page + 1} of {pages}</span>
          <button className="btn small" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Next →</button>
        </div>
      )}
    </div>
  )
}
