import { createClient, type SupabaseClient } from '@supabase/supabase-js'
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
import type { Audience, PrivateDraft, Store, StartupDraft } from './types'

type Row = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

// ---------- row mappers (snake_case DB ⇄ camelCase app) ----------
const toStartup = (r: Row): Startup => ({
  id: r.id,
  position: r.position,
  name: r.name,
  sector: r.sector,
  description: r.description,
  city: r.city,
  stage: r.stage,
  founders: r.founders,
  website: r.website,
  problem: r.problem,
  solution: r.solution,
  market: r.market,
  traction: r.traction,
  businessModel: r.business_model,
  team: r.team,
  ask: r.ask,
  onePagerUrl: r.one_pager_url,
  status: r.status,
  hidden: r.hidden,
  updatedAt: r.updated_at,
})

const fromStartup = (s: StartupDraft): Row => {
  const row: Row = {
    name: s.name,
    sector: s.sector,
    description: s.description,
    city: s.city,
    stage: s.stage,
    founders: s.founders,
    website: s.website,
    problem: s.problem,
    solution: s.solution,
    market: s.market,
    traction: s.traction,
    business_model: s.businessModel,
    team: s.team,
    ask: s.ask,
    one_pager_url: s.onePagerUrl,
  }
  if (s.id) row.id = s.id
  if (s.position !== undefined) row.position = s.position
  if (s.status) row.status = s.status
  if (s.hidden !== undefined) row.hidden = s.hidden
  return row
}

const toPrivate = (r: Row): StartupPrivate => ({
  startupId: r.startup_id,
  deckUrl: r.deck_url,
  contactName: r.contact_name,
  contactEmail: r.contact_email,
  contactPhone: r.contact_phone,
  notes: r.notes,
})

const toInvestor = (r: Row): Investor => ({
  id: r.id,
  name: r.name,
  fund: r.fund,
  email: r.email,
  phone: r.phone,
  designation: r.designation,
  inviteToken: r.invite_token,
  createdAt: r.created_at,
  createdBy: r.created_by,
})

const toRequest = (r: Row): InterestRequest => ({
  id: r.id,
  investorId: r.investor_id,
  startupId: r.startup_id,
  type: r.type,
  active: r.active,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  withdrawnAt: r.withdrawn_at,
})

const toHandling = (r: Row): RequestHandling => ({
  requestId: r.request_id,
  status: r.status,
  room: r.room,
  meetingAt: r.meeting_at,
  deckLink: r.deck_link,
  message: r.message,
  organiserNote: r.organiser_note,
  approvedAt: r.approved_at,
  notifiedAt: r.notified_at,
})

const toNotice = (r: Row): Notice => ({
  id: r.id,
  investorId: r.investor_id,
  requestId: r.request_id,
  startupId: r.startup_id,
  type: r.type,
  room: r.room,
  meetingAt: r.meeting_at,
  deckLink: r.deck_link,
  message: r.message,
  createdAt: r.created_at,
  readAt: r.read_at,
})

const toLive = (r: Row): LiveInterest => ({
  startupId: r.startup_id,
  investorId: r.investor_id,
  fund: r.fund,
  updatedAt: r.updated_at,
})

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(friendly(res.error.message))
  return res.data
}

function friendly(msg: string): string {
  if (/anonymous sign-ins are disabled/i.test(msg))
    return 'Investor sign-in is not enabled yet. Organisers: enable Anonymous sign-ins in Supabase → Authentication → Providers.'
  if (/rate limit/i.test(msg))
    return 'Too many sign-ins from this network right now. Please try again in a minute (organisers: raise the anonymous sign-in rate limit in Supabase → Authentication → Rate Limits).'
  if (/invalid login credentials/i.test(msg)) return 'Email or password is incorrect.'
  if (/row-level security|permission denied/i.test(msg)) return 'You do not have access to do that.'
  return msg
}

const TABLE_TOPIC: Record<string, Topic> = {
  startups: 'startups',
  requests: 'requests',
  request_handling: 'handling',
  notices: 'notices',
  live_interest: 'live',
  event_settings: 'settings',
  investors: 'investors',
}

export class SupabaseStore implements Store {
  readonly mode = 'live' as const
  /** Separate auth sessions so an organiser and an investor can share a browser. */
  private inv: SupabaseClient
  private org: SupabaseClient

  constructor(url: string, anonKey: string) {
    this.inv = createClient(url, anonKey, {
      auth: { storageKey: `${STORAGE_PREFIX}:investor-auth`, persistSession: true, autoRefreshToken: true },
    })
    this.org = createClient(url, anonKey, {
      auth: { storageKey: `${STORAGE_PREFIX}:organiser-auth`, persistSession: true, autoRefreshToken: true },
    })
  }

  private async ensureInvestorSession() {
    const { data } = await this.inv.auth.getSession()
    if (data.session) return
    const res = await this.inv.auth.signInAnonymously()
    if (res.error) throw new Error(friendly(res.error.message))
  }

  // ---------- shared ----------
  async getSettings(): Promise<EventSettings> {
    const res = await this.inv.from('event_settings').select('data').eq('id', 1).maybeSingle()
    const data = check(res)
    return { ...DEFAULT_SETTINGS, ...((data?.data as Partial<EventSettings>) ?? {}) }
  }

  async listStartups() {
    const rows = check(await this.inv.from('startups').select('*').eq('hidden', false).order('position'))
    return (rows ?? []).map(toStartup)
  }

  // ---------- investor ----------
  async getMe() {
    const { data } = await this.inv.auth.getSession()
    if (!data.session) return null
    const rows = check(await this.inv.rpc('current_investor_id'))
    if (!rows) return null
    const inv = check(await this.inv.from('investors').select('*').eq('id', rows as string).maybeSingle())
    return inv ? toInvestor(inv) : null
  }

  async register(input: InvestorInput) {
    await this.ensureInvestorSession()
    const row = check(
      await this.inv.rpc('register_investor', {
        p_name: input.name,
        p_fund: input.fund,
        p_email: input.email,
        p_phone: input.phone,
        p_designation: input.designation,
      }),
    )
    return toInvestor(row as Row)
  }

  async claimInvite(tok: string) {
    await this.ensureInvestorSession()
    return toInvestor(check(await this.inv.rpc('claim_invite', { p_token: tok })) as Row)
  }

  async updateMe(input: InvestorInput) {
    return this.register(input)
  }

  async forgetDevice() {
    await this.inv.rpc('forget_device')
    await this.inv.auth.signOut()
  }

  async listMyRequests() {
    const me = check(await this.inv.rpc('current_investor_id'))
    if (!me) return []
    const rows = check(await this.inv.from('requests').select('*').eq('investor_id', me as string))
    return (rows ?? []).map(toRequest)
  }

  async setRequest(startupId: string, type: ActionType, active: boolean) {
    const me = check(await this.inv.rpc('current_investor_id'))
    if (!me) throw new Error('Please enter your details first.')
    const row = check(
      await this.inv
        .from('requests')
        .upsert({ investor_id: me, startup_id: startupId, type, active }, { onConflict: 'investor_id,startup_id,type' })
        .select('*')
        .single(),
    )
    return toRequest(row)
  }

  async listMyNotices() {
    const me = check(await this.inv.rpc('current_investor_id'))
    if (!me) return []
    const rows = check(
      await this.inv.from('notices').select('*').eq('investor_id', me as string).order('created_at', { ascending: false }),
    )
    return (rows ?? []).map(toNotice)
  }

  async markNoticesRead(ids: string[]) {
    if (!ids.length) return
    check(await this.inv.from('notices').update({ read_at: new Date().toISOString() }).in('id', ids))
  }

  async listLiveInterest() {
    const { data } = await this.inv.auth.getSession()
    if (!data.session) return []
    const rows = check(await this.inv.from('live_interest').select('*'))
    return (rows ?? []).map(toLive)
  }

  async listFundSuggestions() {
    // Falls back to the curated list if the database function is not installed yet.
    const res = await this.inv.rpc('fund_suggestions')
    if (res.error || !Array.isArray(res.data)) return []
    return (res.data as unknown[]).map((x) => (typeof x === 'string' ? x : String((x as Record<string, unknown>).fund_suggestions ?? '')))
  }

  // ---------- organiser ----------
  async getOrganiser(): Promise<Organiser | null> {
    const { data } = await this.org.auth.getSession()
    if (!data.session) return null
    const who = check(await this.org.rpc('whoami_organiser')) as (Omit<Organiser, 'role'> & { role?: string }) | null
    if (!who) return null
    return { email: who.email, name: who.name, role: who.role === 'editor' ? 'editor' : 'viewer' }
  }

  async organiserSignIn(email: string, password: string) {
    const res = await this.org.auth.signInWithPassword({ email: email.trim(), password })
    if (res.error) throw new Error(friendly(res.error.message))
    const who = await this.getOrganiser()
    if (!who) {
      await this.org.auth.signOut()
      throw new Error('This account is not on the organiser list. Ask an admin to add your email to the organisers table.')
    }
    return who
  }

  async organiserSignOut() {
    await this.org.auth.signOut()
  }

  async orgChangePassword(newPassword: string) {
    const res = await this.org.auth.updateUser({ password: newPassword })
    if (res.error) throw new Error(friendly(res.error.message))
  }

  async orgListStartups() {
    return (check(await this.org.from('startups').select('*').order('position')) ?? []).map(toStartup)
  }

  async orgListStartupPrivate() {
    return (check(await this.org.from('startup_private').select('*')) ?? []).map(toPrivate)
  }

  async orgSaveStartup(draft: StartupDraft, priv?: PrivateDraft) {
    const row = fromStartup(draft)
    if (!draft.id && draft.position === undefined) {
      const last = check(await this.org.from('startups').select('position').order('position', { ascending: false }).limit(1))
      row.position = ((last?.[0]?.position as number) ?? 0) + 1
    }
    const saved = check(await this.org.from('startups').upsert(row).select('*').single())
    if (priv) {
      check(
        await this.org.from('startup_private').upsert({
          startup_id: saved.id,
          deck_url: priv.deckUrl,
          contact_name: priv.contactName,
          contact_email: priv.contactEmail,
          contact_phone: priv.contactPhone,
          notes: priv.notes,
        }),
      )
    }
    return toStartup(saved)
  }

  async orgDeleteStartup(id: string) {
    check(await this.org.from('startups').delete().eq('id', id))
  }

  async orgReorder(ids: string[]) {
    check(await this.org.rpc('reorder_startups', { p_ids: ids }))
  }

  async orgSetStatus(id: string, status: StartupStatus) {
    if (status === 'pitching') return this.orgSetPitching(id)
    check(await this.org.from('startups').update({ status }).eq('id', id))
  }

  async orgSetPitching(id: string | null) {
    check(await this.org.rpc('set_pitching', { p_id: id }))
  }

  async orgListInvestors() {
    return (check(await this.org.from('investors').select('*').order('created_at')) ?? []).map(toInvestor)
  }

  async orgCreateInvestor(input: InvestorInput) {
    const row = check(
      await this.org
        .from('investors')
        .insert({ ...trimInput(input), created_by: 'organiser' })
        .select('*')
        .single(),
    )
    return toInvestor(row)
  }

  async orgUpdateInvestor(id: string, input: InvestorInput) {
    const row = check(await this.org.from('investors').update(trimInput(input)).eq('id', id).select('*').single())
    return toInvestor(row)
  }

  async orgDeleteInvestor(id: string) {
    check(await this.org.from('investors').delete().eq('id', id))
  }

  async orgListRequests() {
    return (check(await this.org.from('requests').select('*')) ?? []).map(toRequest)
  }

  async orgListHandling() {
    return (check(await this.org.from('request_handling').select('*')) ?? []).map(toHandling)
  }

  async orgSaveHandling(requestId: string, patch: Partial<Omit<RequestHandling, 'requestId'>>) {
    const row: Row = { request_id: requestId }
    if (patch.status !== undefined) row.status = patch.status
    if (patch.room !== undefined) row.room = patch.room
    if (patch.meetingAt !== undefined) row.meeting_at = patch.meetingAt
    if (patch.deckLink !== undefined) row.deck_link = patch.deckLink
    if (patch.message !== undefined) row.message = patch.message
    if (patch.organiserNote !== undefined) row.organiser_note = patch.organiserNote
    if (patch.status === 'approved') {
      const prev = check(
        await this.org.from('request_handling').select('status, approved_at').eq('request_id', requestId).maybeSingle(),
      )
      if (!prev || prev.status !== 'approved') row.approved_at = new Date().toISOString()
    }
    const saved = check(await this.org.from('request_handling').upsert(row).select('*').single())
    return toHandling(saved)
  }

  async orgNotify(requestId: string) {
    return toNotice(check(await this.org.rpc('notify_request', { p_request_id: requestId })) as Row)
  }

  async orgListNotices() {
    return (check(await this.org.from('notices').select('*')) ?? []).map(toNotice)
  }

  async orgSaveSettings(settings: EventSettings) {
    check(await this.org.from('event_settings').update({ data: settings, updated_at: new Date().toISOString() }).eq('id', 1))
    return settings
  }

  async orgLiveInterest() {
    return (check(await this.org.from('live_interest').select('*')) ?? []).map(toLive)
  }

  subscribe(audience: Audience, cb: (topic: Topic) => void) {
    const client = audience === 'organiser' ? this.org : this.inv
    const tables =
      audience === 'organiser'
        ? Object.keys(TABLE_TOPIC)
        : ['startups', 'notices', 'live_interest', 'event_settings', 'requests']
    let channel = client.channel(`rtih-${audience}-${Math.random().toString(36).slice(2, 8)}`)
    for (const table of tables) {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => cb(TABLE_TOPIC[table]!))
    }
    channel.subscribe()
    // Realtime needs the latest access token (anonymous/organiser JWT) to apply RLS.
    const { data: sub } = client.auth.onAuthStateChange((_e, session) => {
      if (session?.access_token) client.realtime.setAuth(session.access_token)
    })
    return () => {
      sub.subscription.unsubscribe()
      void client.removeChannel(channel)
    }
  }
}

function trimInput(i: InvestorInput) {
  return {
    name: i.name.trim(),
    fund: i.fund.trim(),
    email: i.email.trim(),
    phone: i.phone.trim(),
    designation: i.designation.trim(),
  }
}
