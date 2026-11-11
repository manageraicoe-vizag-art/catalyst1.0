import { ArrowDown, ArrowUp, EyeOff, GripVertical, Mic, Pencil, Plus, SkipForward, Square, Upload } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Badge, Button, EmptyState, PageHeader } from '../../components/ui'
import { useOrganiser } from '../../context/Organiser'
import { useToast } from '../../context/Toast'
import { store } from '../../lib/store'
import type { Startup } from '../../lib/types'
import { cn } from '../../lib/utils'
import { ImportDialog } from './ImportDialog'
import { StartupEditor } from './StartupEditor'

export function QueuePage() {
  const { startups, setStartups, requests, live, reload } = useOrganiser()
  const { toast } = useToast()
  const [editing, setEditing] = useState<Startup | null>(null)
  const [adding, setAdding] = useState(false)
  const [importing, setImporting] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

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

  const pitching = startups.find((s) => s.status === 'pitching')
  const nextUp = (() => {
    const after = pitching ? startups.filter((s) => s.position > pitching.position) : startups
    return after.find((s) => s.status === 'queued' && !s.hidden) ?? startups.find((s) => s.status === 'queued' && !s.hidden)
  })()

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

  const setPitching = async (id: string | null) => {
    setBusy(true)
    try {
      await store.orgSetPitching(id)
      await reload('startups')
    } catch (e) {
      toast({ kind: 'error', title: 'Could not update', body: (e as Error).message })
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
        subtitle="Reorder at any time. Investors’ list updates live and their selections are kept."
        actions={
          <>
            <Button variant="secondary" size="sm" icon={<Upload className="h-4 w-4" />} onClick={() => setImporting(true)}>
              Import list
            </Button>
            <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setAdding(true)}>
              Add startup
            </Button>
          </>
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
              {pitching ? `#${pitching.position} ${pitching.name}` : 'No one pitching'}
            </p>
            {nextUp && <p className="truncate text-sm text-slate-500">Next: #{nextUp.position} {nextUp.name}</p>}
          </div>
        </div>
        <div className="flex gap-2">
          {pitching && (
            <Button variant="secondary" icon={<Square className="h-4 w-4" />} disabled={busy} onClick={() => setPitching(null)}>
              End pitch
            </Button>
          )}
          <Button variant="accent" icon={<SkipForward className="h-4 w-4" />} disabled={busy || !nextUp} onClick={() => nextUp && setPitching(nextUp.id)}>
            {pitching ? 'Next startup' : 'Start first pitch'}
          </Button>
        </div>
      </div>

      {startups.length === 0 ? (
        <EmptyState
          title="No startups yet"
          body="Import the shared startup list (paste from Google Sheets) or add startups one by one."
          action={<Button onClick={() => setImporting(true)}>Import list</Button>}
        />
      ) : (
        <ol className="space-y-2" aria-label="Pitch order">
          {startups.map((s, idx) => {
            const st = stats.get(s.id)
            return (
              <li
                key={s.id}
                draggable
                onDragStart={(e) => {
                  setDragId(s.id)
                  e.dataTransfer.effectAllowed = 'move'
                }}
                onDragOver={(e) => {
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
                <GripVertical className="hidden h-5 w-5 shrink-0 cursor-grab text-slate-400 md:block" aria-hidden />
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
                    {s.hidden && (
                      <Badge tone="amber">
                        <EyeOff className="h-3 w-3" aria-hidden /> Hidden
                      </Badge>
                    )}
                  </div>
                  <p className="truncate text-xs text-slate-500">
                    {s.sector}
                    {st && (st.reqs > 0 || st.funds > 0) && ` · ${st.funds} funds · ${st.reqs} requests`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  {s.status !== 'pitching' && !s.hidden && (
                    <Button size="sm" variant="ghost" className="hidden sm:inline-flex" disabled={busy} onClick={() => setPitching(s.id)}>
                      Pitch now
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
              </li>
            )
          })}
        </ol>
      )}

      <StartupEditor open={adding || !!editing} startup={editing} onClose={() => (setAdding(false), setEditing(null))} />
      <ImportDialog open={importing} onClose={() => setImporting(false)} />
    </div>
  )
}
