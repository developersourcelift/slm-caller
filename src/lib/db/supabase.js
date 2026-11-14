// TEAM backend: Supabase (free tier) — shared Postgres database + logins + live updates.
import { createClient } from '@supabase/supabase-js'
import { DEFAULT_SETTINGS } from '../constants'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY
export const supabase = url && key ? createClient(url, key) : null

const ACTIVITY_DAYS = 120 // dashboard history kept in memory; full history is fetched per lead

function check({ data, error }) {
  if (error) throw new Error(error.message)
  return data
}

async function fetchAll(tableName, build = (q) => q) {
  const page = 1000
  let from = 0
  const out = []
  for (;;) {
    const rows = check(await build(supabase.from(tableName).select('*')).range(from, from + page - 1))
    out.push(...rows)
    if (rows.length < page) break
    from += page
  }
  return out
}

export const supabaseDb = {
  mode: 'team',

  async getSession() {
    const { data } = await supabase.auth.getSession()
    if (!data.session) return null
    return this.myProfile(data.session.user)
  },
  async myProfile(user) {
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
    return data || { id: user.id, email: user.email, name: user.email, role: 'caller' }
  },
  async signIn({ email, password }) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error(error.message)
    return this.myProfile(data.user)
  },
  async signOut() {
    await supabase.auth.signOut()
  },
  onAuthChange(cb) {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') cb(null)
    })
    return () => data.subscription.unsubscribe()
  },

  async loadAll() {
    const since = new Date(Date.now() - ACTIVITY_DAYS * 864e5).toISOString()
    const [leads, activities, meetings, mentions, profiles, settingsRow] = await Promise.all([
      fetchAll('leads', (q) => q.order('id')),
      fetchAll('activities', (q) => q.gte('created_at', since).order('id')),
      fetchAll('meetings', (q) => q.order('scheduled_at')),
      fetchAll('mentions', (q) => q.order('id')),
      fetchAll('profiles'),
      supabase.from('settings').select('data').eq('id', 1).maybeSingle(),
    ])
    return {
      leads, activities, meetings, mentions, profiles,
      settings: { ...DEFAULT_SETTINGS, ...(settingsRow.data?.data || {}) },
    }
  },

  async leadActivities(leadId) {
    return check(await supabase.from('activities').select('*').eq('lead_id', leadId).order('created_at'))
  },

  async updateLead(id, patch) {
    return check(await supabase.from('leads').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id).select().single())
  },

  async insertLeads(rows, onProgress) {
    const size = 500
    for (let i = 0; i < rows.length; i += size) {
      check(await supabase.from('leads').insert(rows.slice(i, i + size)))
      onProgress?.(Math.min(i + size, rows.length), rows.length)
    }
    return rows.length
  },

  async addActivity(a) {
    return check(await supabase.from('activities').insert(a).select().single())
  },
  async addMeeting(m) {
    return check(await supabase.from('meetings').insert(m).select().single())
  },
  async updateMeeting(id, patch) {
    return check(await supabase.from('meetings').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id).select().single())
  },
  async addMention(m) {
    return check(await supabase.from('mentions').insert(m).select().single())
  },
  async updateMention(id, patch) {
    return check(await supabase.from('mentions').update(patch).eq('id', id).select().single())
  },
  async updateProfile(id, patch) {
    return check(await supabase.from('profiles').update(patch).eq('id', id).select().single())
  },
  async saveSettings(data) {
    check(await supabase.from('settings').upsert({ id: 1, data }))
    return data
  },

  // Live updates: calls back with (table, eventType, row) whenever a teammate changes something.
  subscribe(cb) {
    const ch = supabase.channel('lead-desk')
    for (const t of ['leads', 'activities', 'meetings', 'mentions']) {
      ch.on('postgres_changes', { event: '*', schema: 'public', table: t }, (p) =>
        cb(t, p.eventType, p.eventType === 'DELETE' ? p.old : p.new),
      )
    }
    ch.subscribe()
    return () => supabase.removeChannel(ch)
  },
}
