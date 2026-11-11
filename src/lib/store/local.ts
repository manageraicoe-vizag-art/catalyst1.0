import { DEFAULT_SETTINGS, STORAGE_PREFIX } from '../constants'
import type {
  ActionType,
  EventSettings,
  InterestRequest,
  Investor,
  InvestorInput,
  LiveInterest,
  Notice,
  Organiser,
  RequestHandling,
  Startup,
  StartupPrivate,
  StartupStatus,
  Topic,
} from '../types'
import { nowIso, token, uid } from '../utils'
import { buildSeed } from './seed'
import type { Audience, PrivateDraft, Store, StartupDraft } from './types'

/** Demo passcode for the organiser dashboard in DEMO mode only. */
export const DEMO_ORGANISER_PASSCODE = 'catalyst'

interface DB {
  version: 1
  sample: boolean
  settings: EventSettings
  startups: Startup[]
  privates: StartupPrivate[]
  investors: Investor[]
  requests: InterestRequest[]
  handling: RequestHandling[]
  notices: Notice[]
}

const DB_KEY = `${STORAGE_PREFIX}:demo-db`
const ME_KEY = `${STORAGE_PREFIX}:demo-me`
const ORG_KEY = `${STORAGE_PREFIX}:demo-org`
const ALL_TOPICS: Topic[] = ['settings', 'startups', 'requests', 'handling', 'live', 'notices', 'investors', 'private']

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
function safeSet(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    /* storage unavailable (private mode) — app keeps working in memory */
  }
}

function freshDb(): DB {
  const seed = buildSeed()
  return { version: 1, sample: true, settings: { ...DEFAULT_SETTINGS }, ...seed }
}

export class LocalStore implements Store {
  readonly mode = 'demo' as const
  private memory: DB | null = null
  private bus = new EventTarget()

  private read(): DB {
    const raw = safeGet(DB_KEY)
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as DB
        if (parsed.version === 1) {
          this.memory = parsed
          return parsed
        }
      } catch {
        /* fall through */
      }
    }
    if (this.memory) return this.memory
    const db = freshDb()
    this.write(db, false)
    return db
  }

  private write(db: DB, emit = true) {
    this.memory = db
    safeSet(DB_KEY, JSON.stringify(db))
    if (emit) this.bus.dispatchEvent(new Event('change'))
  }

  private mutate<T>(fn: (db: DB) => T): T {
    const db = this.read()
    const out = fn(db)
    this.write(db)
    return out
  }

  private meId(): string | null {
    return safeGet(ME_KEY)
  }

  private requireMe(db: DB): Investor {
    const id = this.meId()
    const me = id ? db.investors.find((i) => i.id === id) : undefined
    if (!me) throw new Error('Please enter your details first.')
    return me
  }

  private requireOrg() {
    if (!safeGet(ORG_KEY)) throw new Error('Organiser sign-in required.')
  }

  // ---------- shared ----------
  async getSettings() {
    return this.read().settings
  }

  async listStartups() {
    return this.read()
      .startups.filter((s) => !s.hidden)
      .sort((a, b) => a.position - b.position)
  }

  // ---------- investor ----------
  async getMe() {
    const id = this.meId()
    if (!id) return null
    return this.read().investors.find((i) => i.id === id) ?? null
  }

  async register(input: InvestorInput) {
    const existing = await this.getMe()
    if (existing) return this.updateMe(input)
    const inv: Investor = {
      ...clean(input),
      id: uid(),
      inviteToken: token(),
      createdAt: nowIso(),
      createdBy: 'self',
    }
    this.mutate((db) => db.investors.push(inv))
    safeSet(ME_KEY, inv.id)
    return inv
  }

  async claimInvite(tok: string) {
    const inv = this.read().investors.find((i) => i.inviteToken === tok)
    if (!inv) throw new Error('This personal link is not valid. Please enter your details instead.')
    safeSet(ME_KEY, inv.id)
    this.bus.dispatchEvent(new Event('change'))
    return inv
  }

  async updateMe(input: InvestorInput) {
    return this.mutate((db) => {
      const me = this.requireMe(db)
      Object.assign(me, clean(input))
      return { ...me }
    })
  }

  async forgetDevice() {
    safeSet(ME_KEY, null)
    this.bus.dispatchEvent(new Event('change'))
  }

  async listMyRequests() {
    const id = this.meId()
    return this.read().requests.filter((r) => r.investorId === id)
  }

  async setRequest(startupId: string, type: ActionType, active: boolean) {
    return this.mutate((db) => {
      const me = this.requireMe(db)
      let req = db.requests.find((r) => r.investorId === me.id && r.startupId === startupId && r.type === type)
      const t = nowIso()
      if (!req) {
        req = { id: uid(), investorId: me.id, startupId, type, active, createdAt: t, updatedAt: t, withdrawnAt: active ? null : t }
        db.requests.push(req)
      } else {
        req.active = active
        req.updatedAt = t
        req.withdrawnAt = active ? null : t
        if (active) req.createdAt = req.createdAt || t
      }
      return { ...req }
    })
  }

  async listMyNotices() {
    const id = this.meId()
    return this.read()
      .notices.filter((n) => n.investorId === id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  async markNoticesRead(ids: string[]) {
    if (!ids.length) return
    this.mutate((db) => {
      const t = nowIso()
      db.notices.forEach((n) => {
        if (ids.includes(n.id) && !n.readAt) n.readAt = t
      })
    })
  }

  async listLiveInterest() {
    if (!this.meId() && !safeGet(ORG_KEY)) return []
    return computeLive(this.read())
  }

  // ---------- organiser ----------
  async getOrganiser() {
    const raw = safeGet(ORG_KEY)
    return raw ? (JSON.parse(raw) as Organiser) : null
  }

  async organiserSignIn(email: string, secret: string) {
    if (secret.trim().toLowerCase() !== DEMO_ORGANISER_PASSCODE)
      throw new Error(`Incorrect passcode. In demo mode the passcode is “${DEMO_ORGANISER_PASSCODE}”.`)
    const org: Organiser = { email: email.trim() || 'organiser@demo', name: email.split('@')[0] || 'Organiser' }
    safeSet(ORG_KEY, JSON.stringify(org))
    return org
  }

  async organiserSignOut() {
    safeSet(ORG_KEY, null)
  }

  async orgListStartups() {
    this.requireOrg()
    return [...this.read().startups].sort((a, b) => a.position - b.position)
  }

  async orgListStartupPrivate() {
    this.requireOrg()
    return this.read().privates
  }

  async orgSaveStartup(draft: StartupDraft, priv?: PrivateDraft) {
    this.requireOrg()
    return this.mutate((db) => {
      const t = nowIso()
      let s = draft.id ? db.startups.find((x) => x.id === draft.id) : undefined
      if (s) {
        Object.assign(s, draft, { updatedAt: t })
      } else {
        const maxPos = db.startups.reduce((m, x) => Math.max(m, x.position), 0)
        s = {
          ...draft,
          id: draft.id || uid(),
          position: draft.position ?? maxPos + 1,
          status: draft.status ?? 'queued',
          hidden: draft.hidden ?? false,
          updatedAt: t,
        } as Startup
        db.startups.push(s)
      }
      if (priv) {
        const existing = db.privates.find((p) => p.startupId === s!.id)
        if (existing) Object.assign(existing, priv)
        else db.privates.push({ startupId: s.id, ...priv })
      }
      return { ...s }
    })
  }

  async orgDeleteStartup(id: string) {
    this.requireOrg()
    this.mutate((db) => {
      db.startups = db.startups.filter((s) => s.id !== id)
      db.privates = db.privates.filter((p) => p.startupId !== id)
      const reqIds = new Set(db.requests.filter((r) => r.startupId === id).map((r) => r.id))
      db.requests = db.requests.filter((r) => !reqIds.has(r.id))
      db.handling = db.handling.filter((h) => !reqIds.has(h.requestId))
      db.notices = db.notices.filter((n) => n.startupId !== id)
    })
  }

  async orgReorder(ids: string[]) {
    this.requireOrg()
    this.mutate((db) => {
      ids.forEach((id, i) => {
        const s = db.startups.find((x) => x.id === id)
        if (s) s.position = i + 1
      })
    })
  }

  async orgSetStatus(id: string, status: StartupStatus) {
    this.requireOrg()
    this.mutate((db) => {
      if (status === 'pitching') db.startups.forEach((s) => s.status === 'pitching' && (s.status = 'done'))
      const s = db.startups.find((x) => x.id === id)
      if (s) s.status = status
    })
  }

  async orgSetPitching(id: string | null) {
    this.requireOrg()
    this.mutate((db) => {
      db.startups.forEach((s) => {
        if (s.status === 'pitching' && s.id !== id) s.status = 'done'
      })
      const s = id ? db.startups.find((x) => x.id === id) : undefined
      if (s) s.status = 'pitching'
    })
  }

  async orgListInvestors() {
    this.requireOrg()
    return this.read().investors
  }

  async orgCreateInvestor(input: InvestorInput) {
    this.requireOrg()
    const inv: Investor = { ...clean(input), id: uid(), inviteToken: token(), createdAt: nowIso(), createdBy: 'organiser' }
    this.mutate((db) => db.investors.push(inv))
    return inv
  }

  async orgUpdateInvestor(id: string, input: InvestorInput) {
    this.requireOrg()
    return this.mutate((db) => {
      const inv = db.investors.find((i) => i.id === id)
      if (!inv) throw new Error('Investor not found')
      Object.assign(inv, clean(input))
      return { ...inv }
    })
  }

  async orgDeleteInvestor(id: string) {
    this.requireOrg()
    this.mutate((db) => {
      const reqIds = new Set(db.requests.filter((r) => r.investorId === id).map((r) => r.id))
      db.investors = db.investors.filter((i) => i.id !== id)
      db.requests = db.requests.filter((r) => r.investorId !== id)
      db.handling = db.handling.filter((h) => !reqIds.has(h.requestId))
      db.notices = db.notices.filter((n) => n.investorId !== id)
    })
    if (this.meId() === id) safeSet(ME_KEY, null)
  }

  async orgListRequests() {
    this.requireOrg()
    return this.read().requests
  }

  async orgListHandling() {
    this.requireOrg()
    return this.read().handling
  }

  async orgSaveHandling(requestId: string, patch: Partial<Omit<RequestHandling, 'requestId'>>) {
    this.requireOrg()
    return this.mutate((db) => {
      let h = db.handling.find((x) => x.requestId === requestId)
      if (!h) {
        h = {
          requestId,
          status: 'new',
          room: '',
          meetingAt: '',
          deckLink: '',
          message: '',
          organiserNote: '',
          approvedAt: null,
          notifiedAt: null,
        }
        db.handling.push(h)
      }
      if (patch.status === 'approved' && h.status !== 'approved') h.approvedAt = nowIso()
      Object.assign(h, patch)
      return { ...h }
    })
  }

  async orgNotify(requestId: string) {
    this.requireOrg()
    return this.mutate((db) => {
      const r = db.requests.find((x) => x.id === requestId)
      const h = db.handling.find((x) => x.requestId === requestId)
      if (!r || !h || h.status !== 'approved') throw new Error('Approve the request before notifying the investor.')
      const t = nowIso()
      const n: Notice = {
        id: uid(),
        investorId: r.investorId,
        requestId,
        startupId: r.startupId,
        type: r.type,
        room: h.room,
        meetingAt: h.meetingAt,
        deckLink: h.deckLink,
        message: h.message,
        createdAt: t,
        readAt: null,
      }
      db.notices.push(n)
      h.notifiedAt = t
      return n
    })
  }

  async orgListNotices() {
    this.requireOrg()
    return this.read().notices
  }

  async orgSaveSettings(settings: EventSettings) {
    this.requireOrg()
    return this.mutate((db) => {
      db.settings = { ...settings }
      return db.settings
    })
  }

  async orgLiveInterest() {
    this.requireOrg()
    return computeLive(this.read())
  }

  // ---------- demo-only helpers ----------
  isSample() {
    return this.read().sample
  }

  /** Removes the fictional sample startups/investors/requests, keeping settings. */
  clearSample() {
    this.mutate((db) => {
      const keepStartups = db.startups.filter((s) => !s.id.startsWith('sample-'))
      const keepInvestors = db.investors.filter((i) => !i.id.startsWith('sample-'))
      const startupIds = new Set(keepStartups.map((s) => s.id))
      const investorIds = new Set(keepInvestors.map((i) => i.id))
      db.startups = keepStartups
      db.privates = db.privates.filter((p) => startupIds.has(p.startupId))
      db.investors = keepInvestors
      db.requests = db.requests.filter((r) => startupIds.has(r.startupId) && investorIds.has(r.investorId))
      const reqIds = new Set(db.requests.map((r) => r.id))
      db.handling = db.handling.filter((h) => reqIds.has(h.requestId))
      db.notices = db.notices.filter((n) => reqIds.has(n.requestId))
      db.sample = false
    })
  }

  resetAll() {
    safeSet(ME_KEY, null)
    this.write(freshDb())
  }

  exportJson(): string {
    return JSON.stringify(this.read(), null, 2)
  }

  subscribe(_audience: Audience, cb: (topic: Topic) => void) {
    const fire = () => ALL_TOPICS.forEach(cb)
    const onStorage = (e: StorageEvent) => {
      if (e.key === DB_KEY || e.key === ME_KEY || e.key === null) {
        this.memory = null
        fire()
      }
    }
    window.addEventListener('storage', onStorage)
    this.bus.addEventListener('change', fire)
    return () => {
      window.removeEventListener('storage', onStorage)
      this.bus.removeEventListener('change', fire)
    }
  }
}

function clean(input: InvestorInput): InvestorInput {
  return {
    name: input.name.trim(),
    fund: input.fund.trim(),
    email: input.email.trim(),
    phone: input.phone.trim(),
    designation: input.designation.trim(),
  }
}

function computeLive(db: DB): LiveInterest[] {
  const byKey = new Map<string, LiveInterest>()
  for (const r of db.requests) {
    if (!r.active) continue
    const inv = db.investors.find((i) => i.id === r.investorId)
    if (!inv) continue
    const key = `${r.startupId}|${inv.id}`
    const prev = byKey.get(key)
    if (!prev || prev.updatedAt < r.updatedAt)
      byKey.set(key, { startupId: r.startupId, investorId: inv.id, fund: inv.fund, updatedAt: r.updatedAt })
  }
  return [...byKey.values()]
}
