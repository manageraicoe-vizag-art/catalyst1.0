import { useCallback, useMemo } from 'react'
import type { Badge } from '../../../components/ui'
import { useOrganiser } from '../../../context/Organiser'
import { useToast } from '../../../context/Toast'
import { ACTION_SHORT } from '../../../lib/constants'
import { store } from '../../../lib/store'
import type { CrmActivityDraft, CrmConnectionDraft, CrmConnectionPatch } from '../../../lib/store/types'
import {
  CRM_STAGES,
  type ActionType,
  type CrmActivity,
  type CrmActivityKind,
  type CrmConnection,
  type CrmPriority,
  type CrmSource,
  type CrmStage,
  type EventSettings,
  type InterestRequest,
  type Investor,
  type RequestHandling,
  type Startup,
  type StartupPrivate,
} from '../../../lib/types'

type Tone = NonNullable<Parameters<typeof Badge>[0]['tone']>

export const STAGE_META: Record<CrmStage, { label: string; tone: Tone; hint: string }> = {
  new: { label: 'New interest', tone: 'slate', hint: 'Interest noted, nobody contacted yet' },
  contacted: { label: 'Intro sent', tone: 'brand', hint: 'Both sides introduced or contacted' },
  meeting: { label: 'Meeting set', tone: 'violet', hint: 'A call or meeting is booked' },
  met: { label: 'Met', tone: 'amber', hint: 'They have met; waiting on next steps' },
  diligence: { label: 'Due diligence', tone: 'amber', hint: 'Investor is evaluating in depth' },
  term_sheet: { label: 'Term sheet', tone: 'go', hint: 'Terms offered or being negotiated' },
  invested: { label: 'Invested', tone: 'green', hint: 'Closed: the fund invested' },
  passed: { label: 'Passed', tone: 'red', hint: 'Closed: not moving ahead for now' },
}
export const OPEN_STAGES = CRM_STAGES.filter((s) => s !== 'invested' && s !== 'passed')
export const isOpen = (c: CrmConnection) => c.stage !== 'invested' && c.stage !== 'passed'

export const PRIORITY_META: Record<CrmPriority, { label: string; dot: string }> = {
  high: { label: 'High', dot: 'bg-red-500' },
  normal: { label: 'Normal', dot: 'bg-slate-400' },
  low: { label: 'Low', dot: 'bg-slate-200' },
}

export const SOURCE_LABEL: Record<CrmSource, string> = {
  meet_today: `Event: ${ACTION_SHORT.meet_today}`,
  meet_later: `Event: ${ACTION_SHORT.meet_later}`,
  deck: `Event: ${ACTION_SHORT.deck}`,
  manual: 'Added by RTIH',
}

/** Kinds an organiser logs by hand (stage changes and follow-ups are recorded separately). */
export const LOG_KINDS = ['note', 'call', 'email', 'meeting', 'whatsapp'] as const
export const KIND_LABEL: Record<CrmActivityKind, string> = {
  note: 'Note',
  call: 'Call',
  email: 'Email',
  meeting: 'Meeting',
  whatsapp: 'WhatsApp',
  stage: 'Stage',
  followup: 'Follow-up',
}

// ---------- dates (follow-ups are due on a local calendar day) ----------
const pad = (n: number) => String(n).padStart(2, '0')
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const todayYmd = () => ymd(new Date())
export function addDays(n: number, from?: string): string {
  const d = from ? new Date(`${from}T12:00:00`) : new Date()
  d.setDate(d.getDate() + n)
  return ymd(d)
}
const dayDiff = (due: string) => Math.round((Date.parse(`${due}T12:00:00`) - Date.parse(`${todayYmd()}T12:00:00`)) / 86400000)

export type DueBucket = 'overdue' | 'today' | 'week' | 'later'
export function dueBucket(due: string): DueBucket {
  const d = dayDiff(due)
  return d < 0 ? 'overdue' : d === 0 ? 'today' : d <= 7 ? 'week' : 'later'
}
export function dueLabel(due: string): string {
  const d = dayDiff(due)
  if (d === 0) return 'Today'
  if (d === 1) return 'Tomorrow'
  if (d === -1) return 'Yesterday'
  const date = new Date(`${due}T12:00:00`).toLocaleDateString('en-IN', { weekday: d > 0 && d < 7 ? 'short' : undefined, day: 'numeric', month: 'short' })
  return d < 0 ? `${-d} days late · ${date}` : date
}
export const DUE_TONE: Record<DueBucket, string> = {
  overdue: 'text-red-700 bg-red-50 ring-red-200',
  today: 'text-amber-900 bg-amber-50 ring-amber-200',
  week: 'text-slate-700 bg-slate-50 ring-slate-200',
  later: 'text-slate-500 bg-white ring-slate-200',
}

// ---------- derived rows ----------
export interface CrmRow {
  c: CrmConnection
  inv?: Investor
  s?: Startup
  priv?: StartupPrivate
  /** open follow-ups, soonest first */
  open: CrmActivity[]
  /** every entry, newest first */
  timeline: CrmActivity[]
  /** latest logged touchpoint (or when it was added) */
  lastTouch: string
}

export function useCrm() {
  const { connections, activities, investors, startups, privates, organiser } = useOrganiser()
  return useMemo(() => {
    const inv = new Map(investors.map((i) => [i.id, i]))
    const st = new Map(startups.map((s) => [s.id, s]))
    const byConn = new Map<string, CrmActivity[]>()
    for (const a of activities) byConn.set(a.connectionId, [...(byConn.get(a.connectionId) ?? []), a])
    const rows: CrmRow[] = connections.map((c) => {
      const list = (byConn.get(c.id) ?? []).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      const open = list
        .filter((a) => a.kind === 'followup' && !a.doneAt)
        .sort((a, b) => (a.dueOn ?? '9999').localeCompare(b.dueOn ?? '9999'))
      const touch = list.find((a) => a.kind !== 'followup' && a.kind !== 'stage')
      return {
        c,
        inv: inv.get(c.investorId),
        s: st.get(c.startupId),
        priv: privates.get(c.startupId),
        open,
        timeline: list,
        lastTouch: touch?.createdAt ?? c.createdAt,
      }
    })
    const byId = new Map(rows.map((r) => [r.c.id, r]))
    const me = organiser?.name || organiser?.email || ''
    const owners = [...new Set([me, ...connections.map((c) => c.owner), ...activities.map((a) => a.owner)].filter(Boolean))].sort()
    return { rows, byId, me, owners }
  }, [connections, activities, investors, startups, privates, organiser])
}

export const rowLabel = (r: Pick<CrmRow, 'inv' | 's'>) => `${r.inv?.fund || r.inv?.name || 'Investor'} → ${r.s?.name ?? 'Startup'}`

// ---------- event interest → CRM ----------
const RANK: Record<ActionType, number> = { meet_today: 0, meet_later: 1, deck: 2 }

export interface Candidate {
  investorId: string
  startupId: string
  type: ActionType
  approved: boolean
  archived: boolean
}

/** Investor + startup pairs the event produced that are not in the CRM yet (strongest request per pair). */
export function eventCandidates(
  requests: InterestRequest[],
  archived: InterestRequest[],
  handling: Map<string, RequestHandling>,
  connections: CrmConnection[],
  investors: Investor[],
  startups: Startup[],
): Candidate[] {
  const have = new Set(connections.map((c) => `${c.investorId}|${c.startupId}`))
  const invIds = new Set(investors.map((i) => i.id))
  const stIds = new Set(startups.map((s) => s.id))
  const best = new Map<string, Candidate>()
  const consider = (r: InterestRequest, isArchived: boolean) => {
    const key = `${r.investorId}|${r.startupId}`
    if (!r.active || have.has(key) || !invIds.has(r.investorId) || !stIds.has(r.startupId)) return
    const cand: Candidate = {
      investorId: r.investorId,
      startupId: r.startupId,
      type: r.type,
      approved: !isArchived && handling.get(r.id)?.status === 'approved',
      archived: isArchived,
    }
    const prev = best.get(key)
    if (!prev || RANK[cand.type] < RANK[prev.type] || (RANK[cand.type] === RANK[prev.type] && prev.archived && !isArchived)) best.set(key, cand)
  }
  requests.forEach((r) => consider(r, false))
  archived.forEach((r) => consider(r, true))
  return [...best.values()]
}

export function candidateDraft(c: Candidate, owner: string, me: string): CrmConnectionDraft {
  return {
    investorId: c.investorId,
    startupId: c.startupId,
    source: c.type,
    stage: c.type === 'meet_today' && c.approved ? 'meeting' : 'new',
    priority: c.type === 'meet_today' ? 'high' : c.type === 'deck' ? 'low' : 'normal',
    owner,
    createdBy: me,
  }
}

/** The first to-do for a connection that came from the event. */
export function firstFollowUp(source: CrmSource, fund: string, startup: string): { body: string; dueOn: string } {
  switch (source) {
    case 'meet_today':
      return { body: `Ask ${fund} and ${startup} how their meeting at the event went; agree next steps`, dueOn: addDays(1) }
    case 'meet_later':
      return { body: `Set up the call between ${fund} and ${startup}`, dueOn: addDays(2) }
    case 'deck':
      return { body: `Check ${fund} has ${startup}'s deck; offer an intro call`, dueOn: addDays(3) }
    default:
      return { body: `Intro ${fund} to ${startup}`, dueOn: addDays(2) }
  }
}

// ---------- outreach ----------
const first = (name: string | undefined) => (name ?? '').trim().split(/\s+/)[0] ?? ''

export function introEmail(r: CrmRow, settings: EventSettings, me: string): string | null {
  const to = r.inv?.email?.trim()
  if (!to?.includes('@')) return null
  const cc = r.priv?.contactEmail?.trim()
  const founder = r.priv?.contactName || r.s?.founders || ''
  const lines = [
    `Hi ${first(r.inv?.name)}${founder ? ` and ${first(founder)}` : ''},`,
    '',
    `Following ${settings.eventName} ${settings.eventTitle}, I'm happy to introduce you.`,
    '',
    `${r.inv?.name}${r.inv?.designation ? `, ${r.inv.designation}` : ''}, ${r.inv?.fund}`,
    `${founder ? `${founder}, ` : ''}${r.s?.name}${r.s?.description ? `: ${r.s.description}` : ''}`,
    '',
    founder ? `${first(founder)}, could you share a few times that work for a call?` : 'Could you share a few times that work for a call?',
    '',
    'Best,',
    me || 'RTIH team',
    settings.organiserName || 'RTIH',
  ]
  const q = new URLSearchParams()
  if (cc?.includes('@')) q.set('cc', cc)
  q.set('subject', `Introduction: ${r.inv?.fund || r.inv?.name} <> ${r.s?.name}`)
  q.set('body', lines.join('\n'))
  return `mailto:${encodeURIComponent(to)}?${q.toString().replace(/\+/g, '%20')}`
}

// ---------- actions ----------
export function useCrmActions() {
  const { reload } = useOrganiser()
  const { toast } = useToast()
  const { me } = useCrm()

  const run = useCallback(
    async <T,>(fn: () => Promise<T>, ok?: string): Promise<T | undefined> => {
      try {
        const out = await fn()
        if (ok) toast({ kind: 'success', title: ok, ms: 2500 })
        return out
      } catch (e) {
        toast({ kind: 'error', title: 'Could not save', body: (e as Error).message })
        return undefined
      } finally {
        await reload('crm')
      }
    },
    [reload, toast],
  )

  return useMemo(
    () => ({
      me,
      update: (c: CrmConnection, patch: CrmConnectionPatch) => run(() => store.orgUpdateConnection(c.id, patch)),
      setStage: (c: CrmConnection, stage: CrmStage) =>
        c.stage === stage
          ? Promise.resolve(undefined)
          : run(async () => {
              await store.orgUpdateConnection(c.id, { stage })
              await store.orgAddActivities([
                { connectionId: c.id, kind: 'stage', body: `${STAGE_META[c.stage].label} → ${STAGE_META[stage].label}`, createdBy: me },
              ])
            }),
      log: (c: CrmConnection, kind: CrmActivityKind, body: string) =>
        run(() => store.orgAddActivities([{ connectionId: c.id, kind, body: body.trim(), createdBy: me }]), 'Logged'),
      addFollowUp: (c: CrmConnection, body: string, dueOn: string, owner: string) =>
        run(
          () => store.orgAddActivities([{ connectionId: c.id, kind: 'followup', body: body.trim(), dueOn, owner, createdBy: me }]),
          'Follow-up added',
        ),
      setDone: (a: CrmActivity, done: boolean) => run(() => store.orgUpdateActivity(a.id, { doneAt: done ? new Date().toISOString() : null })),
      reschedule: (a: CrmActivity, dueOn: string) => run(() => store.orgUpdateActivity(a.id, { dueOn })),
      removeActivity: (a: CrmActivity) => run(() => store.orgDeleteActivity(a.id)),
      remove: (c: CrmConnection) => run(() => store.orgDeleteConnection(c.id), 'Connection removed'),
      /** New connections plus their first follow-ups. Returns how many were added. */
      addMany: (drafts: CrmConnectionDraft[], followUp: (c: CrmConnection) => Omit<CrmActivityDraft, 'connectionId'> | null) =>
        run(async () => {
          const added = await store.orgAddConnections(drafts)
          const tasks = added.flatMap((c) => {
            const f = followUp(c)
            return f ? [{ ...f, connectionId: c.id }] : []
          })
          await store.orgAddActivities(tasks)
          return added
        }),
    }),
    [me, run],
  )
}
