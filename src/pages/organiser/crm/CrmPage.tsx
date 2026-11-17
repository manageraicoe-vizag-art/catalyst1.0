import { CalendarCheck, Download, Handshake, Plus, Search, Sparkles, UserPlus } from 'lucide-react'
import { useEffect, useMemo, useState, type DragEvent, type ReactNode } from 'react'
import { Badge, Button, EmptyState, Input, Notice, PageHeader, Segmented, Select } from '../../../components/ui'
import { useOrganiser } from '../../../context/Organiser'
import { CRM_STAGES, type CrmStage } from '../../../lib/types'
import { cn, downloadFile, normFund, timeAgo, toCsv } from '../../../lib/utils'
import { ConnectionDialog, DueChip, FollowUpItem } from './ConnectionDialog'
import { ImportEventDialog, NewConnectionDialog } from './dialogs'
import {
  PRIORITY_META,
  SOURCE_LABEL,
  STAGE_META,
  dueBucket,
  eventCandidates,
  isOpen,
  todayYmd,
  useCrm,
  useCrmActions,
  type CrmRow,
  type DueBucket,
} from './model'

type Tab = 'pipeline' | 'followups' | 'list' | 'startups' | 'funds'
const TAB_KEY = 'rtih-crm-tab'
const readTab = (): Tab => {
  try {
    const t = localStorage.getItem(TAB_KEY) as Tab | null
    return t && ['pipeline', 'followups', 'list', 'startups', 'funds'].includes(t) ? t : 'pipeline'
  } catch {
    return 'pipeline'
  }
}

export function CrmPage() {
  const { canEdit, crmError, requests, handling, connections, investors, startups } = useOrganiser()
  const { rows, me, owners } = useCrm()
  const [tab, setTabState] = useState<Tab>(readTab)
  const setTab = (t: Tab) => {
    setTabState(t)
    try {
      localStorage.setItem(TAB_KEY, t)
    } catch {
      /* ignore */
    }
  }
  const [q, setQ] = useState('')
  const [owner, setOwner] = useState('')
  const [startupId, setStartupId] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [adding, setAdding] = useState<{ investorId?: string; startupId?: string } | null>(null)
  const [importing, setImporting] = useState(false)

  const pending = useMemo(
    () => eventCandidates(requests, [], handling, connections, investors, startups).length,
    [requests, handling, connections, investors, startups],
  )

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return rows.filter((r) => {
      if (startupId && r.c.startupId !== startupId) return false
      if (owner === '__me' && r.c.owner !== me) return false
      if (owner === '__none' && r.c.owner) return false
      if (owner && !owner.startsWith('__') && r.c.owner !== owner) return false
      if (needle) {
        const hay = `${r.inv?.name} ${r.inv?.fund} ${r.s?.name} ${r.c.owner} ${r.c.summary} ${r.c.ticket}`.toLowerCase()
        if (!hay.includes(needle)) return false
      }
      return true
    })
  }, [rows, q, owner, startupId, me])

  const today = todayYmd()
  const openFollowUps = filtered.flatMap((r) => r.open.map((a) => ({ a, r })))
  const overdue = openFollowUps.filter(({ a }) => a.dueOn && a.dueOn < today).length
  const dueToday = openFollowUps.filter(({ a }) => a.dueOn === today).length

  const exportCsv = () => {
    const data = filtered.map((r) => ({
      fund: r.inv?.fund,
      investor: r.inv?.name,
      designation: r.inv?.designation,
      investor_email: r.inv?.email,
      investor_phone: r.inv?.phone,
      startup: r.s?.name,
      founder: r.priv?.contactName || r.s?.founders,
      founder_email: r.priv?.contactEmail,
      founder_phone: r.priv?.contactPhone,
      stage: STAGE_META[r.c.stage].label,
      priority: r.c.priority,
      owner: r.c.owner,
      ticket: r.c.ticket,
      summary: r.c.summary,
      next_follow_up: r.open[0]?.body,
      next_follow_up_due: r.open[0]?.dueOn,
      open_follow_ups: r.open.length,
      last_touch: r.lastTouch,
      source: SOURCE_LABEL[r.c.source],
      added_at: r.c.createdAt,
      log: r.timeline
        .filter((a) => a.kind !== 'followup')
        .map((a) => `[${a.createdAt.slice(0, 10)} ${a.kind}] ${a.body}`)
        .join(' | '),
    }))
    downloadFile(`catalyst-crm-${today}.csv`, toCsv(data))
  }

  if (crmError)
    return (
      <div>
        <PageHeader title="CRM" />
        <Notice tone="amber">
          <p className="font-semibold">The CRM is not set up in the database yet.</p>
          <p className="mt-1">{crmError}</p>
          <p className="mt-1">An admin runs it once; nothing else changes and no existing data is touched.</p>
        </Notice>
      </div>
    )

  return (
    <div>
      <PageHeader
        title="CRM"
        subtitle="Every investor ↔ startup connection after the event: stage, owner, follow-ups and history. Only organisers see this."
        actions={
          <>
            {canEdit && pending > 0 && (
              <Button size="sm" icon={<Sparkles className="h-4 w-4" />} onClick={() => setImporting(true)}>
                Add {pending} from event interest
              </Button>
            )}
            {canEdit && (
              <Button size="sm" variant="secondary" icon={<Plus className="h-4 w-4" />} onClick={() => setAdding({})}>
                New connection
              </Button>
            )}
            <Button size="sm" variant="secondary" icon={<Download className="h-4 w-4" />} onClick={exportCsv} disabled={!filtered.length}>
              Export CSV
            </Button>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Kpi label="Open connections" value={filtered.filter((r) => isOpen(r.c)).length} />
        <Kpi label="Follow-ups overdue" value={overdue} tone={overdue ? 'red' : undefined} onClick={() => setTab('followups')} />
        <Kpi label="Due today" value={dueToday} tone={dueToday ? 'amber' : undefined} onClick={() => setTab('followups')} />
        <Kpi label="Meetings set / met" value={filtered.filter((r) => r.c.stage === 'meeting' || r.c.stage === 'met').length} />
        <Kpi label="Invested" value={filtered.filter((r) => r.c.stage === 'invested').length} tone="green" className="col-span-2 sm:col-span-1" />
      </div>

      <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-center">
        <Segmented
          value={tab}
          onChange={setTab}
          className="scrollbar-none max-w-full overflow-x-auto"
          options={[
            { value: 'pipeline', label: 'Pipeline' },
            { value: 'followups', label: `Follow-ups${overdue + dueToday ? ` (${overdue + dueToday})` : ''}` },
            { value: 'list', label: 'All' },
            { value: 'startups', label: 'By startup' },
            { value: 'funds', label: 'By fund' },
          ]}
        />
        <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_1.4fr]">
          <Select value={owner} onChange={(e) => setOwner(e.target.value)} aria-label="Filter by owner">
            <option value="">All owners</option>
            {me && <option value="__me">Mine ({me})</option>}
            <option value="__none">Unassigned</option>
            {owners
              .filter((o) => o !== me)
              .map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
          </Select>
          <Select value={startupId} onChange={(e) => setStartupId(e.target.value)} aria-label="Filter by startup">
            <option value="">All startups</option>
            {startups.map((s) => (
              <option key={s.id} value={s.id}>
                #{s.position} {s.name}
              </option>
            ))}
          </Select>
          <div className="relative col-span-2 sm:col-span-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Fund, investor, startup, note" className="pl-9" aria-label="Search" />
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Handshake className="h-8 w-8" />}
          title="No connections yet"
          body={
            pending
              ? `Investors made ${pending} investor ↔ startup request${pending === 1 ? '' : 's'} at the event. Add them to start following up.`
              : 'Add a connection whenever an investor and a startup should talk.'
          }
          action={
            canEdit &&
            (pending ? (
              <Button icon={<Sparkles className="h-4 w-4" />} onClick={() => setImporting(true)}>
                Add {pending} from event interest
              </Button>
            ) : (
              <Button icon={<Plus className="h-4 w-4" />} onClick={() => setAdding({})}>
                New connection
              </Button>
            ))
          }
        />
      ) : tab === 'pipeline' ? (
        <Pipeline rows={filtered} onOpen={setOpenId} />
      ) : tab === 'followups' ? (
        <FollowUps rows={filtered} onOpen={setOpenId} />
      ) : tab === 'list' ? (
        <ListView rows={filtered} onOpen={setOpenId} />
      ) : tab === 'startups' ? (
        <ByStartup rows={filtered} onOpen={setOpenId} onAdd={(sid) => setAdding({ startupId: sid })} />
      ) : (
        <ByFund rows={filtered} onOpen={setOpenId} onAdd={(iid) => setAdding({ investorId: iid })} />
      )}

      <ConnectionDialog id={openId} onClose={() => setOpenId(null)} />
      <NewConnectionDialog open={!!adding} preset={adding ?? undefined} onClose={() => setAdding(null)} onOpenExisting={setOpenId} />
      <ImportEventDialog open={importing} onClose={() => setImporting(false)} />
    </div>
  )
}

function Kpi({ label, value, tone, onClick, className }: { label: string; value: number; tone?: 'red' | 'amber' | 'green'; onClick?: () => void; className?: string }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      onClick={onClick}
      className={cn('rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left', onClick && 'hover:border-slate-300', className)}
    >
      <p
        className={cn(
          'tabular text-2xl font-bold',
          tone === 'red' ? 'text-red-700' : tone === 'amber' ? 'text-amber-700' : tone === 'green' ? 'text-emerald-700' : 'text-slate-950',
        )}
      >
        {value}
      </p>
      <p className="text-xs text-slate-600">{label}</p>
    </Tag>
  )
}

function StageBadge({ stage }: { stage: CrmStage }) {
  return <Badge tone={STAGE_META[stage].tone}>{STAGE_META[stage].label}</Badge>
}

function PriorityDot({ p }: { p: CrmRow['c']['priority'] }) {
  return <span className={cn('inline-block h-2 w-2 shrink-0 rounded-full', PRIORITY_META[p].dot)} title={`${PRIORITY_META[p].label} priority`} />
}

// ---------- pipeline board ----------
function Pipeline({ rows, onOpen }: { rows: CrmRow[]; onOpen: (id: string) => void }) {
  const { canEdit } = useOrganiser()
  const act = useCrmActions()
  // optimistic stage while a drop is saving
  const [moved, setMoved] = useState<Map<string, CrmStage>>(new Map())
  const [over, setOver] = useState<CrmStage | null>(null)
  useEffect(() => setMoved(new Map()), [rows])
  const stageOf = (r: CrmRow) => moved.get(r.c.id) ?? r.c.stage

  const drop = (e: DragEvent, stage: CrmStage) => {
    e.preventDefault()
    setOver(null)
    const id = e.dataTransfer.getData('text/crm')
    const r = rows.find((x) => x.c.id === id)
    if (!r || stageOf(r) === stage) return
    setMoved((m) => new Map(m).set(id, stage))
    void act.setStage(r.c, stage)
  }

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-3">
      <div className="flex min-w-max gap-3">
        {CRM_STAGES.map((stage) => {
          const list = rows
            .filter((r) => stageOf(r) === stage)
            .sort((a, b) => (a.open[0]?.dueOn ?? '9999').localeCompare(b.open[0]?.dueOn ?? '9999') || b.lastTouch.localeCompare(a.lastTouch))
          return (
            <div
              key={stage}
              onDragOver={(e) => {
                if (!canEdit) return
                e.preventDefault()
                setOver(stage)
              }}
              onDragLeave={() => setOver((o) => (o === stage ? null : o))}
              onDrop={(e) => drop(e, stage)}
              className={cn(
                'flex w-64 shrink-0 flex-col rounded-2xl border bg-slate-50/80 p-2',
                over === stage ? 'border-brand-400 bg-brand-50/50' : 'border-slate-200',
              )}
            >
              <div className="mb-2 flex items-center justify-between px-1.5 pt-1" title={STAGE_META[stage].hint}>
                <StageBadge stage={stage} />
                <span className="tabular text-xs font-semibold text-slate-500">{list.length}</span>
              </div>
              <div className="-mr-1 flex max-h-[calc(100dvh-250px)] min-h-[80px] flex-col gap-2 overflow-y-auto pr-1">
                {list.map((r) => (
                  <button
                    key={r.c.id}
                    draggable={canEdit}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/crm', r.c.id)
                      e.dataTransfer.effectAllowed = 'move'
                    }}
                    onClick={() => onOpen(r.c.id)}
                    className="rounded-xl border border-slate-200 bg-white p-2.5 text-left shadow-sm transition hover:border-slate-300 hover:shadow"
                  >
                    <p className="flex items-center gap-1.5">
                      <PriorityDot p={r.c.priority} />
                      <span className="truncate text-sm font-semibold text-slate-950">{r.inv?.fund || r.inv?.name}</span>
                    </p>
                    <p className="truncate text-xs text-slate-500">{r.inv?.name}</p>
                    <p className="mt-1 truncate text-sm text-slate-800">
                      <span className="text-slate-400">→</span> {r.s?.name}
                    </p>
                    {r.c.summary && <p className="mt-1 line-clamp-2 text-xs text-slate-600">{r.c.summary}</p>}
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {r.open[0]?.dueOn ? <DueChip due={r.open[0].dueOn} /> : isOpen(r.c) && <span className="text-xs text-amber-700">No follow-up</span>}
                      {r.c.owner && <span className="truncate text-xs text-slate-500">{r.c.owner}</span>}
                    </div>
                  </button>
                ))}
                {list.length === 0 && <p className="px-1.5 py-3 text-center text-xs text-slate-400">{canEdit ? 'Drag a card here' : 'None'}</p>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------- follow-ups ----------
const BUCKETS: Array<{ key: DueBucket; title: string }> = [
  { key: 'overdue', title: 'Overdue' },
  { key: 'today', title: 'Today' },
  { key: 'week', title: 'Next 7 days' },
  { key: 'later', title: 'Later' },
]

function FollowUps({ rows, onOpen }: { rows: CrmRow[]; onOpen: (id: string) => void }) {
  const [showDone, setShowDone] = useState(false)
  const items = rows.flatMap((r) => r.open.map((a) => ({ a, r })))
  const grouped = BUCKETS.map((b) => ({
    ...b,
    items: items.filter(({ a }) => (a.dueOn ? dueBucket(a.dueOn) : 'later') === b.key).sort((x, y) => (x.a.dueOn ?? '9').localeCompare(y.a.dueOn ?? '9')),
  }))
  const unplanned = rows.filter((r) => isOpen(r.c) && r.open.length === 0)
  const done = rows
    .flatMap((r) => r.timeline.filter((a) => a.kind === 'followup' && a.doneAt).map((a) => ({ a, r })))
    .sort((x, y) => (y.a.doneAt ?? '').localeCompare(x.a.doneAt ?? ''))
    .slice(0, 30)

  return (
    <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
      <div className="space-y-4">
        {grouped.every((g) => !g.items.length) && (
          <EmptyState icon={<CalendarCheck className="h-8 w-8" />} title="No follow-ups planned" body="Add one from any connection." />
        )}
        {grouped
          .filter((g) => g.items.length)
          .map((g) => (
            <Group key={g.key} title={g.title} count={g.items.length} tone={g.key === 'overdue' ? 'text-red-700' : g.key === 'today' ? 'text-amber-800' : undefined}>
              {g.items.map(({ a, r }) => (
                <FollowUpItem key={a.id} a={a} row={r} onOpen={() => onOpen(r.c.id)} />
              ))}
            </Group>
          ))}
        {done.length > 0 && (
          <div>
            <button onClick={() => setShowDone((v) => !v)} className="text-sm font-medium text-slate-500 hover:text-slate-900">
              {showDone ? 'Hide' : 'Show'} recently done ({done.length})
            </button>
            {showDone && (
              <Group title="Done" count={done.length}>
                {done.map(({ a, r }) => (
                  <FollowUpItem key={a.id} a={a} row={r} onOpen={() => onOpen(r.c.id)} />
                ))}
              </Group>
            )}
          </div>
        )}
      </div>
      <div>
        <Group title="No next step planned" count={unplanned.length} tone={unplanned.length ? 'text-amber-800' : undefined}>
          {unplanned.length === 0 && <p className="py-2 text-sm text-slate-500">Every open connection has a follow-up.</p>}
          {unplanned.map((r) => (
            <button key={r.c.id} onClick={() => onOpen(r.c.id)} className="flex w-full items-center gap-2 py-2 text-left hover:text-brand-800">
              <PriorityDot p={r.c.priority} />
              <span className="min-w-0 flex-1 truncate text-sm">
                <b className="font-semibold">{r.inv?.fund || r.inv?.name}</b> → {r.s?.name}
              </span>
              <StageBadge stage={r.c.stage} />
            </button>
          ))}
        </Group>
      </div>
    </div>
  )
}

function Group({ title, count, tone, children }: { title: string; count: number; tone?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <h3 className={cn('text-sm font-semibold text-slate-950', tone)}>
        {title} <span className="tabular font-normal text-slate-500">({count})</span>
      </h3>
      <div className="mt-1 divide-y divide-slate-100">{children}</div>
    </section>
  )
}

// ---------- table ----------
type Sort = 'due' | 'touch' | 'fund' | 'startup' | 'stage'
function ListView({ rows, onOpen }: { rows: CrmRow[]; onOpen: (id: string) => void }) {
  const { canEdit } = useOrganiser()
  const act = useCrmActions()
  const [sort, setSort] = useState<Sort>('due')
  const [stage, setStage] = useState<CrmStage | 'open' | ''>('open')
  const sorted = useMemo(() => {
    const list = rows.filter((r) => (stage === 'open' ? isOpen(r.c) : stage ? r.c.stage === stage : true))
    const cmp: Record<Sort, (a: CrmRow, b: CrmRow) => number> = {
      due: (a, b) => (a.open[0]?.dueOn ?? '9999').localeCompare(b.open[0]?.dueOn ?? '9999'),
      touch: (a, b) => b.lastTouch.localeCompare(a.lastTouch),
      fund: (a, b) => (a.inv?.fund ?? '').localeCompare(b.inv?.fund ?? ''),
      startup: (a, b) => (a.s?.position ?? 0) - (b.s?.position ?? 0),
      stage: (a, b) => CRM_STAGES.indexOf(a.c.stage) - CRM_STAGES.indexOf(b.c.stage),
    }
    return [...list].sort(cmp[sort])
  }, [rows, sort, stage])

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
        <Select value={stage} onChange={(e) => setStage(e.target.value as CrmStage | 'open' | '')} className="w-auto py-1.5" aria-label="Stage">
          <option value="open">Open ({rows.filter((r) => isOpen(r.c)).length})</option>
          <option value="">All stages ({rows.length})</option>
          {CRM_STAGES.map((s) => (
            <option key={s} value={s}>
              {STAGE_META[s].label} ({rows.filter((r) => r.c.stage === s).length})
            </option>
          ))}
        </Select>
        <Select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="w-auto py-1.5" aria-label="Sort">
          <option value="due">Sort: next follow-up</option>
          <option value="touch">Sort: last touch</option>
          <option value="fund">Sort: fund</option>
          <option value="startup">Sort: pitch order</option>
          <option value="stage">Sort: stage</option>
        </Select>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">Investor</th>
              <th className="px-3 py-2">Startup</th>
              <th className="px-3 py-2">Stage</th>
              <th className="px-3 py-2">Owner</th>
              <th className="px-3 py-2">Next follow-up</th>
              <th className="px-3 py-2">Last touch</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.map((r) => (
              <tr key={r.c.id} className="cursor-pointer hover:bg-slate-50" onClick={() => onOpen(r.c.id)}>
                <td className="px-3 py-2">
                  <p className="flex items-center gap-1.5 font-semibold text-slate-950">
                    <PriorityDot p={r.c.priority} />
                    {r.inv?.fund || '—'}
                  </p>
                  <p className="text-xs text-slate-500">{r.inv?.name}</p>
                </td>
                <td className="px-3 py-2">
                  <p className="text-slate-950">{r.s?.name}</p>
                  {r.c.ticket && <p className="text-xs text-slate-500">{r.c.ticket}</p>}
                </td>
                <td className="px-3 py-2" onClick={(e) => canEdit && e.stopPropagation()}>
                  {canEdit ? (
                    <Select value={r.c.stage} onChange={(e) => act.setStage(r.c, e.target.value as CrmStage)} className="w-40 py-1.5 text-sm" aria-label="Stage">
                      {CRM_STAGES.map((s) => (
                        <option key={s} value={s}>
                          {STAGE_META[s].label}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <StageBadge stage={r.c.stage} />
                  )}
                </td>
                <td className="px-3 py-2 text-slate-700">{r.c.owner || <span className="text-slate-400">—</span>}</td>
                <td className="max-w-[260px] px-3 py-2">
                  {r.open[0] ? (
                    <div className="flex items-center gap-2">
                      {r.open[0].dueOn && <DueChip due={r.open[0].dueOn} />}
                      <span className="truncate text-slate-700">{r.open[0].body}</span>
                    </div>
                  ) : isOpen(r.c) ? (
                    <span className="text-xs text-amber-700">None planned</span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-slate-500">{timeAgo(r.lastTouch)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {sorted.length === 0 && <p className="px-3 py-6 text-center text-sm text-slate-500">No connections match.</p>}
      </div>
    </div>
  )
}

// ---------- by startup / by fund ----------
function StageBar({ rows }: { rows: CrmRow[] }) {
  const counts = CRM_STAGES.map((s) => ({ s, n: rows.filter((r) => r.c.stage === s).length })).filter((x) => x.n)
  return (
    <div className="flex flex-wrap gap-1">
      {counts.map(({ s, n }) => (
        <Badge key={s} tone={STAGE_META[s].tone}>
          {STAGE_META[s].label} {n}
        </Badge>
      ))}
    </div>
  )
}

function ByStartup({ rows, onOpen, onAdd }: { rows: CrmRow[]; onOpen: (id: string) => void; onAdd: (startupId: string) => void }) {
  const { startups, privates, canEdit } = useOrganiser()
  const all = startups.map((s) => ({ s, rs: rows.filter((r) => r.c.startupId === s.id) })).sort((a, b) => a.s.position - b.s.position)
  const list = all.filter((x) => x.rs.length)
  const none = all.filter((x) => !x.rs.length && !x.s.hidden)
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {none.length > 0 && (
        <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50/40 p-4 md:col-span-2 xl:col-span-3">
          <p className="text-sm font-semibold text-amber-900">No investor connections ({none.length})</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {none.map(({ s }) =>
              canEdit ? (
                <button key={s.id} onClick={() => onAdd(s.id)} className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs text-slate-800 ring-1 ring-inset ring-amber-200 hover:ring-amber-400" title={`Add an investor for ${s.name}`}>
                  <Plus className="h-3 w-3" aria-hidden /> {s.name}
                </button>
              ) : (
                <Badge key={s.id}>{s.name}</Badge>
              ),
            )}
          </div>
        </div>
      )}
      {list.map(({ s, rs }) => {
        const p = privates.get(s.id)
        const open = rs.filter((r) => isOpen(r.c)).length
        return (
          <div key={s.id} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-950">
                  <span className="tabular text-slate-400">#{s.position}</span> {s.name}
                </p>
                <p className="truncate text-xs text-slate-500">{[p?.contactName || s.founders, p?.contactEmail, p?.contactPhone].filter(Boolean).join(' · ') || 'No founder contact saved'}</p>
              </div>
              {canEdit && (
                <button onClick={() => onAdd(s.id)} className="shrink-0 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900" title="Add an investor for this startup" aria-label={`Add an investor for ${s.name}`}>
                  <UserPlus className="h-4 w-4" />
                </button>
              )}
            </div>
            <p className="mt-2 text-xs text-slate-600">
              {rs.length} investor{rs.length === 1 ? '' : 's'} · {open} open
            </p>
            <div className="mt-1">
              <StageBar rows={rs} />
            </div>
            <ul className="mt-2 divide-y divide-slate-100">
              {rs
                .sort((a, b) => CRM_STAGES.indexOf(b.c.stage === 'passed' ? 'new' : b.c.stage) - CRM_STAGES.indexOf(a.c.stage === 'passed' ? 'new' : a.c.stage))
                .map((r) => (
                  <li key={r.c.id}>
                    <button onClick={() => onOpen(r.c.id)} className="flex w-full items-center gap-2 py-1.5 text-left text-sm hover:text-brand-800">
                      <PriorityDot p={r.c.priority} />
                      <span className="min-w-0 flex-1 truncate">
                        {r.inv?.fund || r.inv?.name} <span className="text-slate-400">· {r.inv?.name}</span>
                      </span>
                      <StageBadge stage={r.c.stage} />
                    </button>
                  </li>
                ))}
            </ul>
          </div>
        )
      })}
    </div>
  )
}

function ByFund({ rows, onOpen, onAdd }: { rows: CrmRow[]; onOpen: (id: string) => void; onAdd: (investorId: string) => void }) {
  const { investors, canEdit } = useOrganiser()
  const funds = useMemo(() => {
    const m = new Map<string, { fund: string; ids: Set<string> }>()
    for (const i of investors) {
      const key = normFund(i.fund || i.name)
      const g = m.get(key) ?? { fund: i.fund || i.name, ids: new Set<string>() }
      g.ids.add(i.id)
      m.set(key, g)
    }
    return [...m.values()]
      .map((g) => ({ ...g, rs: rows.filter((r) => g.ids.has(r.c.investorId)) }))
      .filter((g) => g.rs.length)
      .sort((a, b) => b.rs.length - a.rs.length || a.fund.localeCompare(b.fund))
  }, [investors, rows])
  if (!funds.length) return <EmptyState title="No connections match" />
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {funds.map((g) => (
        <div key={g.fund} className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="font-semibold text-slate-950">{g.fund}</p>
          <div className="mt-1 space-y-0.5">
            {investors
              .filter((i) => g.ids.has(i.id))
              .map((i) => (
                <p key={i.id} className="flex items-center gap-2 text-xs text-slate-600">
                  <span className="min-w-0 flex-1 truncate">
                    {i.name}
                    {i.designation ? `, ${i.designation}` : ''}
                    {i.email ? ` · ${i.email}` : ''}
                  </span>
                  {canEdit && (
                    <button onClick={() => onAdd(i.id)} className="shrink-0 rounded p-0.5 text-slate-400 hover:text-slate-900" title={`Connect ${i.name} with another startup`} aria-label={`Connect ${i.name} with another startup`}>
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  )}
                </p>
              ))}
          </div>
          <div className="mt-2">
            <StageBar rows={g.rs} />
          </div>
          <ul className="mt-2 divide-y divide-slate-100">
            {g.rs.map((r) => (
              <li key={r.c.id}>
                <button onClick={() => onOpen(r.c.id)} className="flex w-full items-center gap-2 py-1.5 text-left text-sm hover:text-brand-800">
                  <PriorityDot p={r.c.priority} />
                  <span className="min-w-0 flex-1 truncate">{r.s?.name}</span>
                  {r.open[0]?.dueOn && <DueChip due={r.open[0].dueOn} />}
                  <StageBadge stage={r.c.stage} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
