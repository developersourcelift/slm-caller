import { MEETING_STATUS_BY_ID, STATUS_BY_ID } from '../lib/constants'
import { cx } from '../lib/utils'

export function Logo() {
  return (
    <span className="logo" aria-label="Sourcelift">
      <img src="./logo.png" alt="Sourcelift" />
    </span>
  )
}

export function StatusBadge({ status }) {
  const s = STATUS_BY_ID[status] || { label: status, tone: 'neutral' }
  return <span className="pill" style={{ background: s.color }}>{s.label}</span>
}
export function MeetingBadge({ status }) {
  const s = MEETING_STATUS_BY_ID[status] || { label: status, tone: 'neutral' }
  return <span className="pill" style={{ background: s.color }}>{s.label}</span>
}

export function Stat({ label, value, sub, onClick }) {
  return (
    <button type="button" className={cx('stat', onClick && 'clickable')} onClick={onClick} disabled={!onClick}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {sub && <span className="stat-sub">{sub}</span>}
    </button>
  )
}

export function Card({ title, actions, children, className }) {
  return (
    <section className={cx('card', className)}>
      {(title || actions) && (
        <header className="card-head">
          <h2>{title}</h2>
          {actions && <div className="row gap-s">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  )
}

export function Empty({ children }) {
  return <p className="empty">{children}</p>
}

export function Seg({ value, onChange, options }) {
  return (
    <div className="seg" role="tablist">
      {options.map((o) => (
        <button key={o.value} type="button" role="tab" aria-selected={value === o.value} className={cx(value === o.value && 'on')} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Modal({ title, onClose, children, wide }) {
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={cx('modal', wide && 'wide')} role="dialog" aria-label={title}>
        <header className="card-head">
          <h2>{title}</h2>
          <button className="btn ghost" onClick={onClose} aria-label="Close">✕</button>
        </header>
        {children}
      </div>
    </div>
  )
}
