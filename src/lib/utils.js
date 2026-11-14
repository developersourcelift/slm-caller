// ---------- Dates (shown in the browser's local time, e.g. Dubai) ----------
const DAY = 864e5

export function startOfDay(d = new Date()) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}
export function dayKey(d) {
  const x = new Date(d)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}
export function isToday(d) {
  return d && dayKey(d) === dayKey(new Date())
}
export function fmtDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
export function fmtDateTime(d) {
  if (!d) return ''
  return new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}
export function fmtTime(d) {
  return new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}
export function relative(d) {
  if (!d) return ''
  const diff = new Date(d).getTime() - Date.now()
  const abs = Math.abs(diff)
  const past = diff < 0
  let txt
  if (abs < 60e3) return 'just now'
  if (abs < 3600e3) txt = `${Math.round(abs / 60e3)} min`
  else if (abs < DAY) txt = `${Math.round(abs / 3600e3)} h`
  else txt = `${Math.round(abs / DAY)} d`
  return past ? `${txt} ago` : `in ${txt}`
}
/** value for <input type="datetime-local"> */
export function toLocalInput(d) {
  if (!d) return ''
  const x = new Date(d)
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset())
  return x.toISOString().slice(0, 16)
}
export function fromLocalInput(v) {
  return v ? new Date(v).toISOString() : null
}
/** quick follow-up presets, all at 10:00 local */
export function presetDate(kind) {
  const d = new Date()
  if (kind === '2h') return new Date(Date.now() + 2 * 3600e3)
  if (kind === 'tomorrow') d.setDate(d.getDate() + 1)
  if (kind === '3d') d.setDate(d.getDate() + 3)
  if (kind === 'week') d.setDate(d.getDate() + 7)
  d.setHours(10, 0, 0, 0)
  return d
}

// ---------- Phones ----------
/** "+971 56 777 7588 / +971 52 ..." → ["+971567777588", ...] */
export function splitPhones(str) {
  if (!str) return []
  return String(str)
    .split(/[\/;,]| or /i)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      let digits = p.replace(/[^\d+]/g, '')
      if (digits.startsWith('00')) digits = '+' + digits.slice(2)
      if (digits.startsWith('0')) digits = '+971' + digits.slice(1)
      if (!digits.startsWith('+')) digits = '+' + digits
      return { display: p, tel: digits }
    })
    .filter((p) => p.tel.length >= 8)
}
export function leadPhones(lead) {
  return [
    ...splitPhones(lead.mobile).map((p) => ({ ...p, kind: 'Mobile' })),
    ...splitPhones(lead.phone).map((p) => ({ ...p, kind: 'Phone' })),
  ]
}
export function waLink(tel, text = '') {
  return `https://wa.me/${tel.replace(/\D/g, '')}${text ? `?text=${encodeURIComponent(text)}` : ''}`
}
export function firstEmail(str) {
  return (String(str || '').match(/[^\s;,/]+@[^\s;,/]+/) || [''])[0]
}
export function siteUrl(w) {
  if (!w) return ''
  return /^https?:\/\//i.test(w) ? w : `https://${w}`
}

// ---------- Templates ----------
export function fillTemplate(tpl, vars) {
  return String(tpl || '').replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '')
}

// ---------- Meeting invites (free: uses the caller's own Google account) ----------
const gcalStamp = (d) => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

/** Opens Google Calendar pre-filled; caller clicks Save and Google emails the invite to every guest. */
export function googleCalendarLink({ title, start, durationMin, details, location, guests }) {
  const end = new Date(new Date(start).getTime() + durationMin * 60e3)
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${gcalStamp(start)}/${gcalStamp(end)}`,
    details: details || '',
    location: location || '',
  })
  if (guests?.length) p.set('add', guests.join(','))
  return `https://calendar.google.com/calendar/render?${p.toString()}`
}

/** .ics file for Outlook / Apple Calendar users */
export function downloadIcs({ title, start, durationMin, details, location, guests }) {
  const end = new Date(new Date(start).getTime() + durationMin * 60e3)
  const esc = (s) => String(s || '').replace(/[\\;,]/g, (m) => '\\' + m).replace(/\n/g, '\\n')
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//LeadDesk//EN', 'METHOD:REQUEST', 'BEGIN:VEVENT',
    `UID:${Date.now()}@leaddesk`, `DTSTAMP:${gcalStamp(new Date())}`,
    `DTSTART:${gcalStamp(start)}`, `DTEND:${gcalStamp(end)}`,
    `SUMMARY:${esc(title)}`, `DESCRIPTION:${esc(details)}`, `LOCATION:${esc(location)}`,
    ...(guests || []).map((g) => `ATTENDEE;RSVP=TRUE:mailto:${g}`),
    'END:VEVENT', 'END:VCALENDAR',
  ]
  downloadText(`${title.replace(/[^\w]+/g, '_')}.ics`, lines.join('\r\n'), 'text/calendar')
}

// ---------- Export ----------
export function downloadText(filename, text, type = 'text/plain') {
  const blob = new Blob([text], { type })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
export function toCsv(rows, columns) {
  const esc = (v) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [columns.map((c) => esc(c.label)).join(','), ...rows.map((r) => columns.map((c) => esc(c.get(r))).join(','))].join('\n')
}

export const cx = (...a) => a.filter(Boolean).join(' ')
