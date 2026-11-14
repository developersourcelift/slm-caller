import { localDb } from './local'
import { supabaseDb, supabase } from './supabase'

// Supabase keys present → shared TEAM mode. Otherwise → DEMO mode in this browser.
export const db = supabase ? supabaseDb : localDb
export const isDemo = db.mode === 'demo'
