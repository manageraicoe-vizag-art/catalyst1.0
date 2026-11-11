import { ArrowDown, ChevronRight, Mic, Search, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ActionToggles } from '../components/ActionToggles'
import { Badge, EmptyState, Input, Segmented } from '../components/ui'
import { reqKey, useInvestor } from '../context/Investor'
import { ROUTING_NOTE } from '../lib/constants'
import { ACTION_TYPES, type Startup } from '../lib/types'
import { cn } from '../lib/utils'

export function StartupsPage() {
  const { startups, requests, live, me, settings } = useInvestor()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<'all' | 'mine'>('all')

  const fundsBy = useMemo(() => {
    const m = new Map<string, number>()
    const seen = new Set<string>()
    for (const l of live) {
      const k = `${l.startupId}|${l.fund.toLowerCase()}`
      if (seen.has(k)) continue
      seen.add(k)
      m.set(l.startupId, (m.get(l.startupId) ?? 0) + 1)
    }
    return m
  }, [live])

  const mine = (s: Startup) => ACTION_TYPES.some((t) => requests.get(reqKey(s.id, t))?.active)
  const myCount = startups.filter(mine).length

  const shown = startups.filter((s) => {
    if (filter === 'mine' && !mine(s)) return false
    if (!q.trim()) return true
    const hay = `${s.name} ${s.sector} ${s.description} ${s.stage}`.toLowerCase()
    return hay.includes(q.trim().toLowerCase())
  })

  const pitching = startups.find((s) => s.status === 'pitching')

  return (
    <div>
      <div className="mb-4">
        <p className="text-sm text-slate-500">Welcome, {me?.name.split(' ')[0]} · {me?.fund}</p>
        <h1 className="pixel-title mt-1 text-xl text-slate-950 sm:text-2xl">
          {startups.length} startups · {settings.eventTitle}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Tap any option to request it. It saves instantly; tap again to withdraw. {ROUTING_NOTE}
        </p>
      </div>

      {pitching && (
        <a
          href={`#pitch-${pitching.id}`}
          onClick={(e) => {
            e.preventDefault()
            document.getElementById(`pitch-${pitching.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }}
          className="sticky top-[60px] z-20 mb-4 flex items-center gap-3 rounded-xl bg-go px-4 py-3 text-black shadow-lg shadow-black/50 md:top-[68px]"
        >
          <Mic className="h-5 w-5 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block font-pixel text-[11px] font-bold uppercase tracking-wide">Now pitching · #{pitching.position}</span>
            <span className="block truncate font-semibold">{pitching.name}</span>
          </span>
          <ArrowDown className="h-5 w-5 shrink-0" aria-hidden />
        </a>
      )}

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search startups or sectors" className="pl-9" aria-label="Search startups" />
        </div>
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: `All (${startups.length})` },
            { value: 'mine', label: `My requests (${myCount})` },
          ]}
        />
      </div>

      {shown.length === 0 ? (
        <EmptyState
          title={startups.length ? 'No startups match' : 'The startup list will appear here'}
          body={startups.length ? 'Try a different search.' : 'The RTIH team is finalising the line-up.'}
        />
      ) : (
        <ol className="grid gap-3 md:grid-cols-2">
          {shown.map((s) => (
            <li
              key={s.id}
              id={`pitch-${s.id}`}
              className={cn(
                'scroll-mt-36 rounded-2xl border bg-white p-4 shadow-sm',
                s.status === 'pitching' ? 'border-go ring-2 ring-go/40' : 'border-slate-200',
              )}
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    'tabular flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold',
                    s.status === 'pitching' ? 'bg-go text-black' : 'bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200',
                  )}
                  aria-label={`Pitch ${s.position}`}
                >
                  {s.position}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <h2 className="text-base font-bold text-slate-950">{s.name}</h2>
                    {s.status === 'pitching' && <Badge tone="go">Now pitching</Badge>}
                    {s.status === 'done' && <span className="text-xs text-slate-400">Pitched</span>}
                  </div>
                  <p className="mt-0.5 text-xs font-medium text-slate-500">
                    {[s.sector, s.stage].filter(Boolean).join(' · ')}
                  </p>
                  <p className="mt-1.5 text-sm leading-snug text-slate-700">{s.description}</p>
                </div>
              </div>
              <div className="mt-3">
                <ActionToggles startup={s} />
              </div>
              <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                  <Users className="h-3.5 w-3.5" aria-hidden />
                  {fundsBy.get(s.id) ? `${fundsBy.get(s.id)} fund${fundsBy.get(s.id)! > 1 ? 's' : ''} interested` : 'No interest yet'}
                </span>
                <Link
                  to={`/startups/${s.id}`}
                  className="inline-flex items-center gap-0.5 rounded-lg px-2 py-1 text-sm font-semibold text-brand-700 hover:bg-brand-50"
                >
                  One-pager <ChevronRight className="h-4 w-4" aria-hidden />
                </Link>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
