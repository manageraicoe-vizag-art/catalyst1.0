import { LocalStore } from './local'
import { SupabaseStore } from './supabase'
import type { Store } from './types'

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim()
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim()

export const store: Store = url && key ? new SupabaseStore(url, key) : new LocalStore()

export const isDemo = store.mode === 'demo'

export function demoStore(): LocalStore | null {
  return store instanceof LocalStore ? store : null
}

export type { Store } from './types'
