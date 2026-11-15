import { ArrowDown, ArrowUp, CalendarClock, Check, ChevronLeft, ChevronRight, Coffee, EyeOff, GripVertical, ListOrdered, MessagesSquare, Mic, Monitor, Pencil, Plus, Presentation, RotateCcw, SkipForward, Square, Undo2, Upload, Users } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { DeckPresenter } from '../../components/DeckPresenter'
import { Badge, Button, EmptyState, Modal, PageHeader } from '../../components/ui'
import { useOrganiser } from '../../context/Organiser'
import { useToast } from '../../context/Toast'
import { listLocalDeckIds } from '../../lib/localDecks'
import {
  EVENT_SCHEDULE,
  fmtClock,
  fmtCountdown,
  matchSchedule,
  PHASE_MINUTES,
  slotIndexById,
  slotTime,
  STAGE_WINDOW,
  stageUrl,
  useCountdown,
} from '../../lib/stage'
import { store } from '../../lib/store'
import type { Startup, StartupStatus } from '../../lib/types'
import { cn } from '../../lib/utils'
import { ImportDialog } from './ImportDialog'
import { StartupEditor } from './StartupEditor'
import { useStageControls } from './useStageControls'

export function QueuePage() {
  const { startups, setStartups, requests, live, privates, deckFiles, reload, canEdit } = useOrganiser()
  const { toast } = useToast()
  const [editing, setEditing] = useState<Startup | null>(null)
  const [adding, setAdding] = useState(false)
  const [importing, setImporting] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [presenting, setPresenting] = useState<Startup | null>(null)
  const [confirmRestart, setConfirmRestart] = useState(false)
  const deckOf = (s: Startup) => privates.get(s.id)?.deckUrl?.trim() || ''
  // decks ready to present: uploaded for the projector, or saved only on this laptop (re-read when the presenter closes)
  const [laptopDecks, setLaptopDecks] = useState<Set<string>>(new Set())
  useEffect(() => {
    if (presenting) return
    void listLocalDeckIds().then(setLaptopDecks)
    void reload('decks')
  }, [presenting, reload])
  const deckReady = (s: Startup) => deckFiles.has(s.id) || laptopDecks.has(s.id)

  const stats = useMemo(() => {
    const m = new Map<string, { reqs: number; funds: number }>()
    for (const s of startups) m.set(s.id, { reqs: 0, funds: 0 })
    for (const r of requests) if (r.active && m.has(r.startupId)) m.get(r.startupId)!.reqs++
    const fundSets = new Map<string, Set<string>>()
    for (const l of live) {
      const set = fundSets.get(l.startupId) ?? new Set()
      set.add(l.fund.toLowerCase())
      fundSets.set(l.startupId, set)
    }
    fundSets.forEach((set, id) => m.has(id) && (m.get(id)!.funds = set.size))
    return m
  }, [startups, requests, live])

  const sc = useStageControls()
  const { pitching, nextUp } = sc
  const working = busy || sc.busy
  const hasPitched = startups.some((s) => s.status === 'done')
  const allDone = !pitching && !nextUp && hasPitched
  const slots = slotIndexById(startups)
  const openStageScreen = () => window.open(stageUrl(), STAGE_WINDOW, 'popup,width=1280,height=720')

  // a clicker pressed while this dashboard has focus flips the slides on the projector
  const livePhase = sc.view.phase === 'pitch' || sc.view.phase === 'qa'
  const slideRef = useRef(sc.slide)
  slideRef.current = sc.slide
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (presenting || t?.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]')) return
      if (!pitching || !livePhase) return
      if (e.key === 'F5') e.preventDefault() // clicker "start slideshow" button: don't reload mid-pitch
      else if (e.key === 'PageDown' || e.key === 'ArrowRight') (e.preventDefault(), slideRef.current(1))
      else if (e.key === 'PageUp' || e.key === 'ArrowLeft') (e.preventDefault(), slideRef.current(-1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [presenting, pitching, livePhase])

  // ---------- match the queue to the 16 Nov schedule ----------
  const [scheduling, setScheduling] = useState(false)
  const [hideOthers, setHideOthers] = useState(true)
  const plan = useMemo(() => matchSchedule(startups), [startups])
  const applySchedule = async () => {
    setBusy(true)
    try {
      const ordered = [...plan.matched.flatMap((m) => (m.startup ? [m.startup] : [])), ...plan.unmatched].map((s, i) => ({ ...s, position: i + 1 }))
      setStartups(ordered)
      await store.orgReorder(ordered.map((s) => s.id))
      const unmatched = new Set(plan.unmatched.map((s) => s.id))
      for (const s of ordered) {
        const hidden = unmatched.has(s.id) ? hideOthers || s.hidden : false
        if (hidden !== s.hidden) await store.orgSaveStartup({ ...s, hidden })
      }
      await reload('startups')
      setScheduling(false)
      toast({ kind: 'success', title: 'Queue matches the schedule', body: 'Pitch order and slot times now follow the 16 Nov schedule.' })
    } catch (e) {
      toast({ kind: 'error', title: 'Could not apply the schedule', body: (e as Error).message })
      await reload('startups')
    } finally {
      setBusy(false)
    }
  }

  const commitOrder = async (ordered: Startup[]) => {
    const renumbered = ordered.map((s, i) => ({ ...s, position: i + 1 }))
    setStartups(renumbered)
    try {
      await store.orgReorder(renumbered.map((s) => s.id))
      await reload('startups')
    } catch (e) {
      toast({ kind: 'error', title: 'Could not reorder', body: (e as Error).message })
      await reload('startups')
    }
  }

  const move = (idx: number, delta: number) => {
    const j = idx + delta
    if (j < 0 || j >= startups.length) return
    const arr = [...startups]
    const [x] = arr.splice(idx, 1)
    arr.splice(j, 0, x!)
    void commitOrder(arr)
  }

  const setStatus = async (id: string, status: StartupStatus) => {
    setBusy(true)
    try {
      await store.orgSetStatus(id, status)
      await reload('startups')
    } catch (e) {
      toast({ kind: 'error', title: 'Could not update', body: (e as Error).message })
    } finally {
      setBusy(false)
    }
  }

  const restartQueue = async () => {
    setBusy(true)
    try {
      for (const s of startups) if (s.status !== 'queued') await store.orgSetStatus(s.id, 'queued')
      await store.orgSetStage('idle', null, 0, 0).catch(() => {}) // projector back to the schedule
      await Promise.all([reload('startups'), reload('stage')])
      setConfirmRestart(false)
      toast({ kind: 'success', title: 'Queue restarted', body: 'Every startup is back in the queue. Start the first pitch when ready.' })
    } catch (e) {
      toast({ kind: 'error', title: 'Could not restart', body: (e as Error).message })
      await reload('startups')
    } finally {
      setBusy(false)
    }
  }

  const onDragOver = (overId: string) => {
    if (!dragId || dragId === overId) return
    const from = startups.findIndex((s) => s.id === dragId)
    const to = startups.findIndex((s) => s.id === overId)
    const arr = [...startups]
    const [x] = arr.splice(from, 1)
    arr.splice(to, 0, x!)
    setStartups(arr.map((s, i) => ({ ...s, position: i + 1 })))
  }

  return (
    <div>
      <PageHeader
        title="Pitch queue"
        subtitle={
          canEdit
            ? 'Reorder at any time. Investors’ list updates live and their selections are kept.'
            : 'Live pitch order. Your access is view-only.'
        }
        actions={
          canEdit && (
          <>
            <Button variant="secondary" size="sm" icon={<CalendarClock className="h-4 w-4" />} onClick={() => setScheduling(true)}>
              Apply 16 Nov schedule
            </Button>
            <Button variant="secondary" size="sm" icon={<Upload className="h-4 w-4" />} onClick={() => setImporting(true)}>
              Import list
            </Button>
            <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setAdding(true)}>
              Add startup
            </Button>
          </>
          )
        }
      />

      {/* Stage control */}
      <div className="mb-5 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-[1fr_auto] sm:items-center">
        <div className="flex items-center gap-3">
          <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', pitching ? 'bg-go text-black' : 'bg-slate-100 text-slate-500')}>
            <Mic className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="eyebrow">On stage now</p>
            <p className="truncate text-lg font-bold text-slate-950">
              {pitching ? `#${pitching.position} ${pitching.name}` : allDone ? 'All pitches done' : 'No one pitching'}
            </p>
            {nextUp ? (
              <p className="truncate text-sm text-slate-500">
                Next: #{nextUp.position} {nextUp.name}
                {slots.has(nextUp.id) && ` · ${fmtClock(slotTime(slots.get(nextUp.id)!).start)}`}
              </p>
            ) : (
              allDone && canEdit && <p className="text-sm text-slate-500">Use Restart queue to run the pitches again.</p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" icon={<Monitor className="h-4 w-4" />} onClick={openStageScreen}>
            Stage screen
          </Button>
          {pitching && (
            <Button variant="ghost" icon={<Presentation className="h-4 w-4" />} onClick={() => setPresenting(pitching)}>
              Present deck
            </Button>
          )}
          {canEdit && (pitching || hasPitched) && (
            <Button variant="ghost" icon={<RotateCcw className="h-4 w-4" />} disabled={working} onClick={() => setConfirmRestart(true)}>
              Restart queue
            </Button>
          )}
          {canEdit && pitching && (
            <Button variant="secondary" icon={<Square className="h-4 w-4" />} disabled={working} onClick={() => void sc.endPitch()}>
              End pitch
            </Button>
          )}
          {canEdit && !allDone && (
            <Button variant="accent" icon={<SkipForward className="h-4 w-4" />} disabled={working || !nextUp} onClick={() => nextUp && void sc.startPitch(nextUp.id)}>
              {pitching ? 'Next startup' : hasPitched ? 'Start next pitch' : 'Start first pitch'}
            </Button>
          )}
        </div>
        <PhaseBar sc={sc} hasDeck={!!pitching && deckFiles.has(pitching.id)} />
      </div>

      {startups.length === 0 ? (
        <EmptyState
          title="No startups yet"
          body="Import the shared startup list (paste from Google Sheets) or add startups one by one."
          action={canEdit ? <Button onClick={() => setImporting(true)}>Import list</Button> : undefined}
        />
      ) : (
        <ol className="space-y-2" aria-label="Pitch order">
          {startups.map((s, idx) => {
            const st = stats.get(s.id)
            return (
              <li
                key={s.id}
                draggable={canEdit}
                onDragStart={(e) => {
                  if (!canEdit) return
                  setDragId(s.id)
                  e.dataTransfer.effectAllowed = 'move'
                }}
                onDragOver={(e) => {
                  if (!canEdit) return
                  e.preventDefault()
                  onDragOver(s.id)
                }}
                onDragEnd={() => {
                  if (dragId) void commitOrder(startups)
                  setDragId(null)
                }}
                className={cn(
                  'flex items-center gap-2 rounded-xl border bg-white p-2.5 sm:gap-3 sm:p-3',
                  s.status === 'pitching' ? 'border-go ring-1 ring-go/40' : 'border-slate-200',
                  dragId === s.id && 'opacity-50',
                  s.hidden && 'opacity-60',
                )}
              >
                {canEdit && <GripVertical className="hidden h-5 w-5 shrink-0 cursor-grab text-slate-400 md:block" aria-hidden />}
                <span
                  className={cn(
                    'tabular flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold',
                    s.status === 'pitching' ? 'bg-go text-black' : 'bg-slate-100 text-slate-700',
                  )}
                >
                  {s.position}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="truncate font-semibold text-slate-950">{s.name}</p>
                    {s.status === 'pitching' && <Badge tone="go">Pitching</Badge>}
                    {s.status === 'done' && <Badge>Pitched</Badge>}
                    {s.deckAvailable && <Badge tone="brand">Deck shown</Badge>}
                    {s.hidden && (
                      <Badge tone="amber">
                        <EyeOff className="h-3 w-3" aria-hidden /> Hidden
                      </Badge>
                    )}
                  </div>
                  <p className="truncate text-xs text-slate-500">
                    {slots.has(s.id) && <span className="tabular">{fmtClock(slotTime(slots.get(s.id)!).start)} · </span>}
                    {s.sector}
                    {st && (st.reqs > 0 || st.funds > 0) && ` · ${st.funds} funds · ${st.reqs} requests`}
                  </p>
                </div>
                <button
                  onClick={() => setPresenting(s)}
                  className={cn(
                    'rounded-lg p-2 hover:bg-slate-100',
                    deckReady(s) ? 'text-brand-800 hover:text-brand-900' : deckOf(s) ? 'text-slate-500 hover:text-slate-900' : 'text-slate-400 hover:text-slate-700',
                  )}
                  aria-label={`Present ${s.name}’s deck`}
                  title={deckFiles.has(s.id) ? 'Present deck (PDF ready for the projector)' : laptopDecks.has(s.id) ? 'Present deck (PDF on this laptop only: open it to upload for the projector)' : deckOf(s) ? 'Present deck (no PDF yet: load one for the projector)' : 'Present deck (no link yet: load a PDF)'}
                >
                  <Presentation className="h-4 w-4" />
                </button>
                {canEdit && (
                <div className="flex shrink-0 items-center gap-0.5">
                  {s.status === 'done' && (
                    <button onClick={() => setStatus(s.id, 'queued')} disabled={working} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30" aria-label={`Put ${s.name} back in the queue`} title="Back to queue">
                      <Undo2 className="h-4 w-4" />
                    </button>
                  )}
                  {s.status !== 'pitching' && !s.hidden && (
                    <Button size="sm" variant="ghost" className="hidden sm:inline-flex" disabled={working} onClick={() => void sc.startPitch(s.id)}>
                      {s.status === 'done' ? 'Pitch again' : 'Pitch now'}
                    </Button>
                  )}
                  <button onClick={() => move(idx, -1)} disabled={idx === 0} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-30" aria-label={`Move ${s.name} up`}>
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button onClick={() => move(idx, 1)} disabled={idx === startups.length - 1} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-30" aria-label={`Move ${s.name} down`}>
                    <ArrowDown className="h-4 w-4" />
                  </button>
                  <button onClick={() => setEditing(s)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label={`Edit ${s.name}`}>
                    <Pencil className="h-4 w-4" />
                  </button>
                </div>
                )}
              </li>
            )
          })}
        </ol>
      )}

      {presenting && <DeckPresenter startup={presenting} deckUrl={deckOf(presenting)} onClose={() => setPresenting(null)} />}
      <Modal
        open={confirmRestart}
        onClose={() => setConfirmRestart(false)}
        title="Restart the pitch queue?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmRestart(false)}>
              Cancel
            </Button>
            <Button icon={<RotateCcw className="h-4 w-4" />} loading={working} onClick={restartQueue}>
              Restart queue
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-700">
          Every startup goes back to <strong className="text-slate-950">queued</strong> and no one is on stage. Investors’ requests,
          meetings and the order of the queue are kept. Use this after a dry run, or to run the pitches again.
        </p>
      </Modal>
      <Modal
        open={scheduling}
        onClose={() => setScheduling(false)}
        wide
        title="Apply the 16 Nov pitch schedule"
        footer={
          <>
            <Button variant="secondary" onClick={() => setScheduling(false)}>
              Cancel
            </Button>
            <Button icon={<CalendarClock className="h-4 w-4" />} loading={working} disabled={!plan.matched.some((m) => m.startup)} onClick={applySchedule}>
              Apply schedule
            </Button>
          </>
        }
      >
        <p className="mb-3 text-sm text-slate-700">
          Puts the queue in the schedule’s order. Slot times are worked out from it: {EVENT_SCHEDULE.slotMinutes}-minute slots from{' '}
          {fmtClock(slotTime(0).start)}, lunch {EVENT_SCHEDULE.breaks.map((b) => `${b.start}–${b.end}`).join(', ')} after slot{' '}
          {EVENT_SCHEDULE.breaks[0]?.afterSlot}. Pitch status and investors’ requests are not changed.
        </p>
        <ol className="divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
          {plan.matched.map((m) => (
            <li key={m.slot} className="flex items-center gap-3 px-3 py-2">
              <span className="tabular w-6 text-right font-semibold text-slate-500">{m.slot}</span>
              <span className="tabular w-16 text-slate-500">{fmtClock(slotTime(m.slot - 1).start)}</span>
              <span className="min-w-0 flex-1 truncate text-slate-950">{m.startup ? m.startup.name : m.label}</span>
              {m.startup ? (
                <Check className="h-4 w-4 shrink-0 text-go" aria-label="Found in the queue" />
              ) : (
                <Badge tone="amber">Not in the queue: add it first</Badge>
              )}
            </li>
          ))}
        </ol>
        {plan.unmatched.length > 0 && (
          <div className="mt-4 rounded-xl border border-slate-200 p-3 text-sm">
            <p className="font-semibold text-slate-950">Not on the schedule (moved to the end)</p>
            <p className="mt-1 text-slate-600">{plan.unmatched.map((s) => s.name).join(' · ')}</p>
            <label className="mt-2 flex items-center gap-2 text-slate-700">
              <input type="checkbox" checked={hideOthers} onChange={(e) => setHideOthers(e.target.checked)} className="h-4 w-4 accent-[#ffacb7]" />
              Hide them from investors and the stage screen (you can unhide them later from Edit)
            </label>
          </div>
        )}
      </Modal>
      <StartupEditor open={adding || !!editing} startup={editing} onClose={() => (setAdding(false), setEditing(null))} />
      <ImportDialog open={importing} onClose={() => setImporting(false)} />
    </div>
  )
}

/** Stage-screen controls (admin1): pitch 5:00 → Q&A 5:00 → investor interest, with the live timer and slide buttons. */
function PhaseBar({ sc, hasDeck }: { sc: ReturnType<typeof useStageControls>; hasDeck: boolean }) {
  const { view } = sc
  const left = useCountdown(view.endsAt)
  const items = [
    { key: 'pitch', label: `Pitch · ${PHASE_MINUTES.pitch} min`, icon: Mic },
    { key: 'qa', label: `Q&A · ${PHASE_MINUTES.qa} min`, icon: MessagesSquare },
    { key: 'interest', label: 'Investor interest', icon: Users },
  ] as const
  const timed = view.phase === 'pitch' || view.phase === 'qa'
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 sm:col-span-2">
      <span className="eyebrow mr-1">Projector</span>
      {sc.pitching ? (
        items.map(({ key, label, icon: Icon }) => (
          <Button key={key} size="sm" variant={view.phase === key ? 'primary' : 'secondary'} icon={<Icon className="h-4 w-4" />} disabled={!sc.canEdit || sc.busy} onClick={() => void sc.setPhase(key)}>
            {label}
          </Button>
        ))
      ) : (
        <>
          <Button size="sm" variant={view.phase === 'idle' ? 'primary' : 'secondary'} icon={<ListOrdered className="h-4 w-4" />} disabled={!sc.canEdit || sc.busy} onClick={() => void sc.showSchedule()}>
            Schedule
          </Button>
          <Button size="sm" variant={view.phase === 'break' ? 'primary' : 'secondary'} icon={<Coffee className="h-4 w-4" />} disabled={!sc.canEdit || sc.busy} onClick={() => void sc.toggleBreak()}>
            {view.phase === 'break' ? 'End break' : EVENT_SCHEDULE.breaks[0]?.label ?? 'Break'}
          </Button>
        </>
      )}
      {left !== null && (
        <span
          className={cn('tabular ml-1 font-pixel text-lg font-bold', view.phase === 'interest' ? 'text-brand-800' : left < 0 ? 'text-red-500' : left <= 60 ? 'text-amber-500' : 'text-go')}
          role="timer"
        >
          {view.phase === 'interest' ? (left > 0 ? fmtCountdown(left) : 'waiting for next pitch') : fmtCountdown(left)}
        </span>
      )}
      {timed && sc.canEdit && (
        <Button size="sm" variant="ghost" icon={<Plus className="h-4 w-4" />} disabled={sc.busy} onClick={() => void sc.addMinute()}>
          1 min
        </Button>
      )}
      {timed && hasDeck && (
        <span className="ml-auto flex items-center gap-1">
          <span className="text-xs text-slate-500">Slide {view.deckPage}</span>
          <Button size="sm" variant="secondary" icon={<ChevronLeft className="h-4 w-4" />} onClick={() => sc.slide(-1)} aria-label="Previous slide on the projector" />
          <Button size="sm" variant="secondary" icon={<ChevronRight className="h-4 w-4" />} onClick={() => sc.slide(1)} aria-label="Next slide on the projector" />
        </span>
      )}
    </div>
  )
}
