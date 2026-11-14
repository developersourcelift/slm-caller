import { useState } from 'react'
import { Upload } from 'lucide-react'
import { useStore } from '../lib/store'
import { isDemo } from '../lib/db'
import { workbookToLeads } from '../lib/mapping'
import { Card } from '../components/ui'

export default function ImportPage({ firstRun }) {
  const { data, me, importLeads } = useStore()
  const [preview, setPreview] = useState(null) // {leads, perSheet, dupes}
  const [skipDupes, setSkipDupes] = useState(true)
  const [progress, setProgress] = useState(null)
  const [err, setErr] = useState('')
  const canImport = isDemo || me.role === 'admin'

  const existing = new Set(data.leads.map((l) => `${l.category}|${l.company.toLowerCase()}`))
  const prepare = (leads, perSheet) => {
    const dupes = leads.filter((l) => existing.has(`${l.category}|${l.company.toLowerCase()}`)).length
    setPreview({ leads, perSheet, dupes })
  }

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setErr('')
    try {
      const XLSX = await import('xlsx') // loaded only on this page
      const { leads, perSheet } = workbookToLeads(XLSX, await file.arrayBuffer())
      if (!leads.length) throw new Error('No rows with a "Company" column found.')
      prepare(leads, perSheet)
    } catch (e2) {
      setErr(e2.message)
    }
  }

  const loadDemo = async () => {
    setErr('')
    try {
      const res = await fetch('./demo/leads.json')
      if (!res.ok) throw new Error('No local demo file. Run: npm run demo-data -- <path-to-xlsx>')
      const leads = await res.json()
      const perSheet = {}
      leads.forEach((l) => (perSheet[l.category] = (perSheet[l.category] || 0) + 1))
      prepare(leads, perSheet)
    } catch (e2) {
      setErr(e2.message)
    }
  }

  const run = async () => {
    const rows = skipDupes ? preview.leads.filter((l) => !existing.has(`${l.category}|${l.company.toLowerCase()}`)) : preview.leads
    setProgress({ done: 0, total: rows.length })
    try {
      await importLeads(rows, (done, total) => setProgress({ done, total }))
      setPreview(null)
    } catch (e2) {
      setErr(e2.message)
    } finally {
      setProgress(null)
    }
  }

  return (
    <div className="page narrow">
      <header className="page-head">
        <div>
          <h1>{firstRun ? 'Welcome — load your leads' : 'Import leads'}</h1>
          <p className="muted">Upload an Excel file. Every tab becomes a category (an “About”/“Notes” tab is skipped). Columns used: Company, Emirate, Segment/Type, Phone, Mobile, Email, Website, Address, Google Maps + extra info. Rank / score columns are ignored.</p>
        </div>
      </header>
      {!canImport ? (
        <Card><p>Only the manager can import leads. Ask them to load the list.</p></Card>
      ) : (
        <Card>
          <div className="stack">
            <label className="dropzone">
              <Upload size={22} />
              <span><b>Choose .xlsx file</b> or drop it here</span>
              <input type="file" accept=".xlsx,.xls,.csv" onChange={onFile} />
            </label>
            {isDemo && <button className="btn ghost small" onClick={loadDemo}>Load local demo data (developer)</button>}
            {err && <p className="error">{err}</p>}
            {preview && (
              <div className="stack">
                <h3>Ready to import {preview.leads.length.toLocaleString()} leads</h3>
                <ul className="plain">
                  {Object.entries(preview.perSheet).map(([k, v]) => <li key={k}><b>{k}</b>: {v.toLocaleString()}</li>)}
                </ul>
                {preview.dupes > 0 && (
                  <label className="check"><input type="checkbox" checked={skipDupes} onChange={(e) => setSkipDupes(e.target.checked)} /> Skip {preview.dupes} companies already in the system</label>
                )}
                <button className="btn primary" disabled={!!progress} onClick={run}>
                  {progress ? `Importing… ${progress.done}/${progress.total}` : 'Import'}
                </button>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  )
}
