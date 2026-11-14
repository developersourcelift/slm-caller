// Pipeline stages a lead moves through. `tone` drives the badge colour; the label is always shown.
export const STATUSES = [
  { id: 'new', label: 'New', tone: 'neutral', color: '#9a9cad' },
  { id: 'no_answer', label: 'No answer', tone: 'muted', color: '#7e8aa3' },
  { id: 'callback', label: 'Call back', tone: 'warning', color: '#e08a00' },
  { id: 'interested', label: 'Interested', tone: 'info', color: '#3d7fe0' },
  { id: 'meeting_scheduled', label: 'Meeting scheduled', tone: 'accent', color: '#8e4fd1' },
  { id: 'meeting_done', label: 'Meeting done', tone: 'accent', color: '#202060' },
  { id: 'proposal', label: 'Proposal sent', tone: 'info', color: '#f06030' },
  { id: 'won', label: 'Won', tone: 'good', color: '#00a862' },
  { id: 'not_interested', label: 'Not interested', tone: 'bad', color: '#e2445c' },
  { id: 'invalid', label: 'Wrong / invalid no.', tone: 'bad', color: '#4a4b57' },
]
export const STATUS_BY_ID = Object.fromEntries(STATUSES.map((s) => [s.id, s]))

// Statuses where the lead is finished and shouldn't come back into the call queue.
export const CLOSED_STATUSES = new Set(['won', 'not_interested', 'invalid'])

// What happened on a single call. `status` = status the lead moves to (null = keep current).
// `connected` = the caller actually spoke to someone.
export const CALL_OUTCOMES = [
  { id: 'no_answer', label: 'No answer', status: 'no_answer', connected: false, key: '1' },
  { id: 'busy', label: 'Busy / switched off', status: 'no_answer', connected: false, key: '2' },
  { id: 'callback', label: 'Call back later', status: 'callback', connected: true, needsFollowUp: true, key: '3' },
  { id: 'sent_details', label: 'Sent details (WA/email)', status: 'callback', connected: true, needsFollowUp: true, key: '4' },
  { id: 'interested', label: 'Interested', status: 'interested', connected: true, key: '5' },
  { id: 'meeting_booked', label: 'Meeting booked', status: 'meeting_scheduled', connected: true, opensMeeting: true, key: '6' },
  { id: 'not_interested', label: 'Not interested', status: 'not_interested', connected: true, key: '7' },
  { id: 'wrong_number', label: 'Wrong number', status: 'invalid', connected: false, key: '8' },
]
export const OUTCOME_BY_ID = Object.fromEntries(CALL_OUTCOMES.map((o) => [o.id, o]))

// "No answer" should not overwrite a lead that is already further along.
export const SOFT_OUTCOMES = new Set(['no_answer', 'busy'])

export const MEETING_STATUSES = [
  { id: 'scheduled', label: 'Scheduled', tone: 'accent', color: '#8e4fd1' },
  { id: 'done', label: 'Done', tone: 'good', color: '#00a862' },
  { id: 'rescheduled', label: 'Rescheduled', tone: 'warning', color: '#e08a00' },
  { id: 'no_show', label: 'No-show', tone: 'bad', color: '#e2445c' },
  { id: 'cancelled', label: 'Cancelled', tone: 'muted', color: '#9a9cad' },
]
export const MEETING_STATUS_BY_ID = Object.fromEntries(MEETING_STATUSES.map((s) => [s.id, s]))

export const MEETING_MODES = [
  { id: 'online', label: 'Online (Google Meet / Zoom)' },
  { id: 'in_person', label: 'In person' },
  { id: 'phone', label: 'Phone' },
]

export const ROLES = [
  { id: 'admin', label: 'Manager' },
  { id: 'caller', label: 'Caller' },
  { id: 'dev', label: 'Developer' },
]

export const ACTIVITY_LABELS = {
  call: 'Call',
  note: 'Note',
  status: 'Status change',
  meeting: 'Meeting',
  tag: 'Tagged',
  email: 'Email',
  whatsapp: 'WhatsApp',
}

export const DEFAULT_SETTINGS = {
  daily_call_target: 60,
  always_invite: '', // comma-separated emails added to every meeting invite (e.g. manager)
  meeting_duration: 30,
  wa_template:
    'Hi {company}, this is {me} from our team. Thanks for your time on the call — sharing our details here as discussed.',
  email_subject: 'Following up on our call — {company}',
  email_template:
    'Hi,\n\nThank you for taking the time to speak with me today. As discussed, please find our details below.\n\nLooking forward to hearing from you.\n\nBest regards,\n{me}',
}
