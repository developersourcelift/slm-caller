// DEMO backend: everything is kept in this browser's IndexedDB. No server, no login.
// Good for trying the app; use Supabase (team mode) for real shared work.
import { DEFAULT_SETTINGS } from '../constants'

const DB_NAME = 'lead-desk-demo'
const STORE = 'kv'

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}
async function get(key) {
  const db = await open()
  return new Promise((resolve, reject) => {
    const r = db.transaction(STORE).objectStore(STORE).get(key)
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
}
async function set(key, value) {
  const db = await open()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(value, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

const DEMO_PROFILES = [
  { id: 'u-admin', name: 'Manager', email: 'manager@example.com', role: 'admin' },
  { id: 'u-caller', name: 'Caller', email: 'caller@example.com', role: 'caller' },
  { id: 'u-dev', name: 'Developer', email: 'dev@example.com', role: 'dev' },
]

// In-memory cache so we don't hit IndexedDB for every read.
const cache = {}
async function table(name) {
  if (!cache[name]) cache[name] = (await get(name)) || []
  return cache[name]
}
async function save(name) {
  await set(name, cache[name])
}
async function nextId(name) {
  const key = `seq_${name}`
  const n = ((await get(key)) || 0) + 1
  await set(key, n)
  return n
}
const now = () => new Date().toISOString()

export const localDb = {
  mode: 'demo',

  async getSession() {
    const uid = await get('session')
    const profiles = await this.profiles()
    return profiles.find((p) => p.id === uid) || null
  },
  async signIn({ userId }) {
    await set('session', userId)
    return this.getSession()
  },
  async signOut() {
    await set('session', null)
  },
  onAuthChange() {
    return () => {}
  },

  async profiles() {
    let p = await get('profiles')
    if (!p) {
      p = DEMO_PROFILES
      await set('profiles', p)
    }
    cache.profiles = p
    return p
  },

  async loadAll() {
    const [leads, activities, meetings, mentions, profiles, settings] = await Promise.all([
      table('leads'),
      table('activities'),
      table('meetings'),
      table('mentions'),
      this.profiles(),
      get('settings'),
    ])
    return { leads, activities, meetings, mentions, profiles, settings: { ...DEFAULT_SETTINGS, ...(settings || {}) } }
  },

  async leadActivities(leadId) {
    return (await table('activities')).filter((a) => a.lead_id === leadId)
  },

  async updateLead(id, patch) {
    const leads = await table('leads')
    const i = leads.findIndex((l) => l.id === id)
    leads[i] = { ...leads[i], ...patch, updated_at: now() }
    await save('leads')
    return leads[i]
  },

  async insertLeads(rows, onProgress) {
    const leads = await table('leads')
    let seq = (await get('seq_leads')) || 0
    const ts = now()
    for (const r of rows) {
      seq += 1
      leads.push({
        status: 'new', starred: false, assigned_to: null, contact_person: '', notes: '',
        call_count: 0, last_contacted_at: null, next_follow_up: null,
        ...r, id: seq, created_at: ts, updated_at: ts,
      })
    }
    await set('seq_leads', seq)
    await save('leads')
    onProgress?.(rows.length, rows.length)
    return rows.length
  },

  async addActivity(a) {
    const row = { note: '', ...a, id: await nextId('activities'), created_at: now() }
    ;(await table('activities')).push(row)
    await save('activities')
    return row
  },

  async addMeeting(m) {
    const row = { ...m, id: await nextId('meetings'), created_at: now(), updated_at: now() }
    ;(await table('meetings')).push(row)
    await save('meetings')
    return row
  },
  async updateMeeting(id, patch) {
    const list = await table('meetings')
    const i = list.findIndex((x) => x.id === id)
    list[i] = { ...list[i], ...patch, updated_at: now() }
    await save('meetings')
    return list[i]
  },

  async addMention(m) {
    const row = { reply: '', resolved: false, ...m, id: await nextId('mentions'), created_at: now() }
    ;(await table('mentions')).push(row)
    await save('mentions')
    return row
  },
  async updateMention(id, patch) {
    const list = await table('mentions')
    const i = list.findIndex((x) => x.id === id)
    list[i] = { ...list[i], ...patch }
    await save('mentions')
    return list[i]
  },

  async updateProfile(id, patch) {
    const list = await this.profiles()
    const i = list.findIndex((x) => x.id === id)
    list[i] = { ...list[i], ...patch }
    await set('profiles', list)
    return list[i]
  },

  async saveSettings(data) {
    await set('settings', data)
    return data
  },

  subscribe() {
    return () => {}
  },

  async resetDemo() {
    for (const k of ['leads', 'activities', 'meetings', 'mentions', 'settings', 'seq_leads', 'seq_activities', 'seq_meetings', 'seq_mentions']) {
      await set(k, undefined)
      delete cache[k]
    }
  },
}
