import { Info, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Input, LiveDot, Segmented } from '../components/ui'
import { LIVE_DISCLAIMER } from '../lib/constants'
import type { LiveInterest, Startup } from '../lib/types'
import { cn } from '../lib/utils'

/** Shared by the investor live board and the organiser's projector view. */
export function LiveBoard({
  startups,
  live,
  myFund,
  linkBase,
}: {
  startups: Startup[]
  live: LiveInterest[]
  myFund?: string
  linkBase?: string
}) {
  const [q, setQ] = useState('')
  const [only, setOnly] = useState<'all' | 'interest'>('all')

  const fundsBy = useMemo(() => {
    const m = new Map<string, Map<string, { fund: string; at: string }>>()
    for (const l of live) {
      const inner = m.get(l.startupId) ?? new Map()
      const k = l.fund.trim().toLowerCase()
      const prev = inner.get(k)
      if (!prev || prev.at < l.updatedAt) inner.set(k, { fund: l.fund.trim(), at: l.updatedAt })
      m.set(l.startupId, inner)
    }
    return m
  }, [live])

  const allFunds = new Set(live.map((l) => l.fund.trim().toLowerCase())).size
  const recentCutoff = Date.now() - 2 * 60_000

  const rows = startups.filter((s) => {
    const n = fundsBy.get(s.id)?.size ?? 0
    if (only === 'interest' && n === 0) return false
    if (!q.trim()) return true
    const needle = q.trim().toLowerCase()
    return (
      s.name.toLowerCase().includes(needle) ||
      [...(fundsBy.get(s.id)?.values() ?? [])].some((f) => f.fund.toLowerCase().includes(needle))
    )
  })

  return (
    <div>
      <div className="mb-4 flex gap-3 rounded-xl border-2 border-amber-300 bg-amber-50 p-4 text-amber-950" role="note">
        <Info className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
        <p className="text-sm font-medium leading-snug">{LIVE_DISCLAIMER}</p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-slate-600">
        <span className="inline-flex items-center gap-2 font-medium text-emerald-700">
          <LiveDot /> Updating live
        </span>
        <span>
          <strong className="tabular text-slate-950">{allFunds}</strong> funds have expressed interest
        </span>
      </div>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search startup or fund" className="pl-9" aria-label="Search" />
        </div>
        <Segmented
          value={only}
          onChange={setOnly}
          options={[
            { value: 'all', label: 'All startups' },
            { value: 'interest', label: 'With interest' },
          ]}
        />
      </div>

      <ol className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {rows.map((s) => {
          const funds = [...(fundsBy.get(s.id)?.values() ?? [])].sort((a, b) => a.fund.localeCompare(b.fund))
          const name = linkBase ? (
            <Link to={`${linkBase}/${s.id}`} className="font-semibold text-slate-950 hover:text-brand-700">
              {s.name}
            </Link>
          ) : (
            <span className="font-semibold text-slate-950">{s.name}</span>
          )
          return (
            <li key={s.id} className={cn('flex gap-3 p-4', s.status === 'pitching' && 'bg-go/5')}>
              <span className="tabular mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-100 text-xs font-bold text-slate-700">
                {s.position}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {name}
                    {s.status === 'pitching' && <Badge tone="go">Now pitching</Badge>}
                  </div>
                  <span className="tabular text-xs font-medium text-slate-500">
                    {funds.length} {funds.length === 1 ? 'fund' : 'funds'}
                  </span>
                </div>
                <p className="text-xs text-slate-500">{s.sector}</p>
                {funds.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={`Funds interested in ${s.name}`}>
                    {funds.map((f) => {
                      const mine = myFund && f.fund.toLowerCase() === myFund.trim().toLowerCase()
                      const recent = new Date(f.at).getTime() > recentCutoff
                      return (
                        <li
                          key={f.fund}
                          className={cn(
                            'rounded-full px-2.5 py-0.5 text-[13px] font-medium ring-1 ring-inset',
                            mine ? 'bg-brand-800 text-black ring-brand-800' : 'bg-slate-100 text-slate-800 ring-slate-300',
                            recent && !mine && 'animate-flash',
                          )}
                        >
                          {f.fund}
                          {mine && <span className="sr-only"> (your fund)</span>}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            </li>
          )
        })}
        {rows.length === 0 && <li className="p-8 text-center text-sm text-slate-500">Nothing to show yet.</li>}
      </ol>
    </div>
  )
}

export function LivePage({
  startups,
  live,
  myFund,
}: {
  startups: Startup[]
  live: LiveInterest[]
  myFund?: string
}) {
  return (
    <div>
      <h1 className="pixel-title mb-2 text-xl text-slate-950 sm:text-2xl">Live interest board</h1>
      <p className="mb-4 text-sm text-slate-600">Which funds have requested a pitch deck or a meeting, startup by startup.</p>
      <LiveBoard startups={startups} live={live} myFund={myFund} linkBase="/startups" />
    </div>
  )
}
