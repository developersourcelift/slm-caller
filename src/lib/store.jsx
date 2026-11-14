import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { db } from './db'
import { CLOSED_STATUSES, OUTCOME_BY_ID, SOFT_OUTCOMES, STATUS_BY_ID } from './constants'

const Ctx = createContext(null)
export const useStore = () => useContext(Ctx)

const upsert = (list, row) => {
  const i = list.findIndex((x) => x.id === row.id)
  if (i === -1) return [...list, row]
  const copy = list.slice()
  copy[i] = { ...copy[i], ...row }
  return copy
}

export function StoreProvider({ children }) {
  const [me, setMe] = useState(undefined) // undefined = checking, null = signed out
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [toasts, setToasts] = useState([])
  const toastId = useRef(0)

  const toast = useCallback((msg, kind = 'ok') => {
    const id = ++toastId.current
    setToasts((t) => [...t, { id, msg, kind }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500)
  }, [])

  useEffect(() => {
    db.getSession().then(setMe).catch(() => setMe(null))
    return db.onAuthChange((p) => setMe(p))
  }, [])

  const reload = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setData(await db.loadAll())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (me) reload()
  }, [me, reload])

  // Live updates from teammates (team mode only).
  useEffect(() => {
    if (!me) return
    return db.subscribe((table, event, row) => {
      setData((d) => {
        if (!d) return d
        const list = d[table]
        return { ...d, [table]: event === 'DELETE' ? list.filter((x) => x.id !== row.id) : upsert(list, row) }
      })
    })
  }, [me])

  const put = (table, row) => setData((d) => ({ ...d, [table]: upsert(d[table], row) }))

  const wrap = (fn) => async (...args) => {
    try {
      return await fn(...args)
    } catch (e) {
      toast(e.message || 'Something went wrong', 'error')
      throw e
    }
  }

  const actions = useMemo(() => {
    const activity = async (lead_id, type, outcome, note = '') => {
      const row = await db.addActivity({ lead_id, user_id: me?.id, type, outcome, note })
      put('activities', row)
      return row
    }
    /** Sends an Inbox notification to everyone written as @Name in `scanText`. */
    const notifyMentions = async (lead, message, scanText = message) => {
      const tagged = (data?.profiles || []).filter((p) => p.id !== me?.id && p.name && String(scanText || '').includes('@' + p.name))
      for (const p of tagged) {
        const row = await db.addMention({ lead_id: lead.id, from_user: me?.id, to_user: p.id, message })
        put('mentions', row)
      }
      return tagged
    }
    const patchLead = async (id, patch) => {
      const row = await db.updateLead(id, patch)
      put('leads', row)
      return row
    }

    return {
      signIn: wrap(async (creds) => setMe(await db.signIn(creds))),
      signOut: async () => {
        await db.signOut()
        setMe(null)
        setData(null)
      },
      reload,

      /** The core caller action: one call, one outcome. */
      logCall: wrap(async (lead, outcomeId, { note = '', followUp = null, contactPerson } = {}) => {
        const o = OUTCOME_BY_ID[outcomeId]
        let status = lead.status
        const advanced = !['new', 'no_answer'].includes(lead.status)
        if (o.status && !(SOFT_OUTCOMES.has(outcomeId) && advanced)) status = o.status
        const patch = {
          status,
          call_count: (lead.call_count || 0) + 1,
          last_contacted_at: new Date().toISOString(),
        }
        if (followUp) patch.next_follow_up = followUp
        else if (CLOSED_STATUSES.has(status)) patch.next_follow_up = null
        else if (o.connected && !o.needsFollowUp && !o.opensMeeting) patch.next_follow_up = null
        if (contactPerson !== undefined) patch.contact_person = contactPerson
        await activity(lead.id, 'call', outcomeId, note)
        const row = await patchLead(lead.id, patch)
        const tagged = await notifyMentions(lead, `${o.label}: ${note}`, note)
        toast(`Logged: ${o.label}${tagged.length ? ` — ${tagged.map((p) => p.name).join(', ')} notified` : ''}`)
        return row
      }),

      setStatus: wrap(async (lead, status, note = '') => {
        await activity(lead.id, 'status', status, note)
        const patch = { status }
        if (CLOSED_STATUSES.has(status)) patch.next_follow_up = null
        const row = await patchLead(lead.id, patch)
        toast(`Status → ${STATUS_BY_ID[status].label}`)
        return row
      }),

      updateLead: wrap(patchLead),

      addNote: wrap(async (lead, note, type = 'note') => {
        await activity(lead.id, type, null, note)
        toast('Saved')
      }),

      scheduleMeeting: wrap(async (lead, m) => {
        const row = await db.addMeeting({ ...m, lead_id: lead.id, created_by: me?.id, status: 'scheduled' })
        put('meetings', row)
        await activity(lead.id, 'meeting', 'scheduled', `${m.title} — ${new Date(m.scheduled_at).toLocaleString('en-GB')}`)
        await patchLead(lead.id, { status: 'meeting_scheduled', next_follow_up: m.scheduled_at })
        toast('Meeting saved')
        return row
      }),

      updateMeeting: wrap(async (meeting, patch, lead) => {
        const row = await db.updateMeeting(meeting.id, patch)
        put('meetings', row)
        if (patch.status && patch.status !== meeting.status) {
          await activity(meeting.lead_id, 'meeting', patch.status, patch.outcome || '')
          if (lead && patch.status === 'done') await patchLead(lead.id, { status: 'meeting_done', next_follow_up: null })
          if (lead && patch.status === 'scheduled') await patchLead(lead.id, { next_follow_up: patch.scheduled_at || meeting.scheduled_at })
        }
        toast('Meeting updated')
        return row
      }),

      /** monday-style update on a lead. Anyone written as @Name gets a notification in their Inbox. */
      postUpdate: wrap(async (lead, text) => {
        await activity(lead.id, 'note', null, text)
        const tagged = await notifyMentions(lead, text)
        toast(tagged.length ? `Posted — ${tagged.map((p) => p.name).join(', ')} notified` : 'Update posted')
      }),

      tag: wrap(async (lead, toUser, message) => {
        const row = await db.addMention({ lead_id: lead?.id ?? null, from_user: me?.id, to_user: toUser, message })
        put('mentions', row)
        if (lead) await activity(lead.id, 'tag', toUser, message)
        toast('Tagged')
        return row
      }),

      updateMention: wrap(async (m, patch) => {
        const row = await db.updateMention(m.id, patch)
        put('mentions', row)
        return row
      }),

      importLeads: wrap(async (rows, onProgress) => {
        const n = await db.insertLeads(rows, onProgress)
        await reload()
        toast(`Imported ${n} leads`)
        return n
      }),

      saveSettings: wrap(async (s) => {
        await db.saveSettings(s)
        setData((d) => ({ ...d, settings: s }))
        toast('Settings saved')
      }),

      updateProfile: wrap(async (id, patch) => {
        const row = await db.updateProfile(id, patch)
        setData((d) => ({ ...d, profiles: upsert(d.profiles, row) }))
        if (id === me?.id) setMe((m) => ({ ...m, ...row }))
        toast('Saved')
      }),

      leadActivities: (id) => db.leadActivities(id),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, reload, toast, data?.profiles])

  const derived = useMemo(() => {
    if (!data) return null
    const leadsById = new Map(data.leads.map((l) => [l.id, l]))
    const profilesById = new Map(data.profiles.map((p) => [p.id, p]))
    const categories = [...new Set(data.leads.map((l) => l.category))]
    const openMentionsForMe = data.mentions.filter((m) => m.to_user === me?.id && !m.resolved)
    return { leadsById, profilesById, categories, openMentionsForMe }
  }, [data, me])

  const value = { me, data, derived, loading, error, toast, toasts, ...actions }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
