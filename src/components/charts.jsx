import { useState } from 'react'

/** Vertical bars, one series. data: [{key, label, value, tip}] */
export function ColumnChart({ data, height = 160, target }) {
  const [hover, setHover] = useState(null)
  const max = Math.max(1, target || 0, ...data.map((d) => d.value))
  const h = hover !== null ? data[hover] : null
  return (
    <div className="colchart" style={{ height: height + 28 }}>
      <div className="colchart-plot" style={{ height }}>
        {target > 0 && (
          <div className="target-line" style={{ bottom: `${(target / max) * 100}%` }}>
            <span>target {target}</span>
          </div>
        )}
        {data.map((d, i) => (
          <div key={d.key} className="col-hit" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} tabIndex={0} aria-label={`${d.label}: ${d.value}`}>
            <div className="col" style={{ height: `${(d.value / max) * 100}%` }} />
          </div>
        ))}
        {h && (
          <div className="chart-tip" style={{ left: `${((hover + 0.5) / data.length) * 100}%` }}>
            <b>{h.label}</b>
            <div>{h.value} calls</div>
            {h.tip && <div className="muted">{h.tip}</div>}
          </div>
        )}
      </div>
      <div className="colchart-axis">
        {data.map((d, i) => (
          <span key={d.key}>{(data.length - 1 - i) % Math.ceil(data.length / 7) === 0 ? d.short : ''}</span>
        ))}
      </div>
    </div>
  )
}

/** Horizontal bars with labels and values. rows: [{key, label, value, onClick}] */
export function BarList({ rows, total }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <ul className="barlist">
      {rows.map((r) => (
        <li key={r.key}>
          <button type="button" className="barlist-row" onClick={r.onClick} disabled={!r.onClick} title={`${r.label}: ${r.value}${total ? ` (${Math.round((r.value / total) * 100)}%)` : ''}`}>
            <span className="barlist-label">{r.label}</span>
            <span className="barlist-track">{r.value > 0 && <span className="barlist-bar" style={{ width: `${(r.value / max) * 100}%` }} />}</span>
            <span className="barlist-val">{r.value.toLocaleString()}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

export function Progress({ value, max, label }) {
  const pct = max ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="progress" role="progressbar" aria-valuenow={value} aria-valuemax={max} aria-label={label}>
      <span style={{ width: `${pct}%` }} />
    </div>
  )
}
