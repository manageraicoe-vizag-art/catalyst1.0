import { Maximize2, Table2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, LiveDot, PageHeader, Segmented } from '../../components/ui'
import { useOrganiser } from '../../context/Organiser'
import { ACTION_SHORT } from '../../lib/constants'
import { ACTION_TYPES, type ActionType } from '../../lib/types'
import { cn } from '../../lib/utils'
import { rowStatus } from './shared'

/** Validated categorical slots (dataviz reference palette, dark steps; checked vs #0f0f10). */
const SERIES: Record<ActionType, string> = {
  deck: '#3987e5',
  meet_today: '#d95926',
  meet_later: '#199e70',
}

function StatTile({ label, value, hint, to }: { label: string; value: number; hint?: string; to?: string }) {
  const body = (
    <>
      <p className="text-sm text-slate-600">{label}</p>
      <p className="mt-1 text-3xl font-semibold text-slate-950">{value.toLocaleString()}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </>
  )
  const cls = 'block rounded-2xl border border-slate-200 bg-white p-4'
  return to ? (
    <Link to={to} className={cn(cls, 'hover:border-brand-400')}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  )
}

function Legend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600" aria-label="Legend">
      {ACTION_TYPES.map((t) => (
        <li key={t} className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: SERIES[t] }} aria-hidden />
          {ACTION_SHORT[t]}
        </li>
      ))}
    </ul>
  )
}

export function OverviewPage() {
  const { startups, investors, requests, handling, live, deckViews } = useOrganiser()
  const [view, setView] = useState<'chart' | 'table'>('chart')
  const [hover, setHover] = useState<string | null>(null)

  const active = requests.filter((r) => r.active)
  const awaiting = active.filter((r) => rowStatus(r, handling.get(r.id)) === 'new').length
  const approvedMeetings = active.filter((r) => r.type !== 'deck' && handling.get(r.id)?.status === 'approved').length
  const decksShared = active.filter((r) => r.type === 'deck' && handling.get(r.id)?.notifiedAt).length
  const fundCount = new Set(investors.map((i) => i.fund.trim().toLowerCase())).size

  const perStartup = useMemo(() => {
    const funds = new Map<string, Set<string>>()
    for (const l of live) {
      const s = funds.get(l.startupId) ?? new Set()
      s.add(l.fund.toLowerCase())
      funds.set(l.startupId, s)
    }
    return startups
      .filter((s) => !s.hidden)
      .map((s) => {
        const counts: Record<ActionType, number> = { deck: 0, meet_today: 0, meet_later: 0 }
        for (const r of active) if (r.startupId === s.id) counts[r.type]++
        const total = counts.deck + counts.meet_today + counts.meet_later
        return { s, counts, total, funds: funds.get(s.id)?.size ?? 0 }
      })
  }, [startups, active, live])

  const max = Math.max(1, ...perStartup.map((p) => p.total))

  const topFunds = useMemo(() => {
    const m = new Map<string, { fund: string; startups: Set<string> }>()
    for (const l of live) {
      const k = l.fund.trim().toLowerCase()
      const e = m.get(k) ?? { fund: l.fund.trim(), startups: new Set<string>() }
      e.startups.add(l.startupId)
      m.set(k, e)
    }
    return [...m.values()].map((e) => ({ fund: e.fund, n: e.startups.size })).sort((a, b) => b.n - a.n || a.fund.localeCompare(b.fund))
  }, [live])
  const fundMax = Math.max(1, ...topFunds.map((f) => f.n))

  return (
    <div>
      <PageHeader
        title="Overview"
        subtitle={
          <span className="inline-flex items-center gap-2">
            <LiveDot /> Expressions of interest so far, updating live
          </span>
        }
        actions={
          <Link to="/organiser/board">
            <Button variant="secondary" size="sm" icon={<Maximize2 className="h-4 w-4" />}>
              Live board (projector)
            </Button>
          </Link>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        <StatTile label="Investors" value={investors.length} to="/organiser/investors" />
        <StatTile label="Funds" value={fundCount} />
        <StatTile label="Active requests" value={active.length} />
        <StatTile label="Awaiting action" value={awaiting} to="/organiser" />
        <StatTile label="Meetings approved" value={approvedMeetings} to="/organiser/meetings" />
        <StatTile label="Decks shared" value={decksShared} />
        <StatTile label="Deck views" value={deckViews.reduce((n, v) => n + v.views, 0)} hint={`${new Set(deckViews.map((v) => v.investorId)).size} investors`} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5" aria-labelledby="by-startup">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 id="by-startup" className="font-semibold text-slate-950">
                Requests by startup
              </h2>
              <p className="text-xs text-slate-500">Active requests in pitch order, split by action</p>
            </div>
            <Segmented
              value={view}
              onChange={setView}
              options={[
                { value: 'chart', label: 'Chart' },
                { value: 'table', label: <Table2 className="h-4 w-4" aria-label="Table" /> },
              ]}
            />
          </div>

          {view === 'chart' ? (
            <>
              <Legend />
              <ol className="mt-3 space-y-1">
                {perStartup.map(({ s, counts, total, funds }) => {
                  const segs = ACTION_TYPES.filter((t) => counts[t] > 0)
                  return (
                    <li
                      key={s.id}
                      className="relative grid grid-cols-[minmax(0,9rem)_1fr] items-center gap-3 rounded-md px-1 py-1 outline-none focus-visible:ring-2 focus-visible:ring-brand-500 sm:grid-cols-[minmax(0,13rem)_1fr]"
                      tabIndex={0}
                      onMouseEnter={() => setHover(s.id)}
                      onMouseLeave={() => setHover(null)}
                      onFocus={() => setHover(s.id)}
                      onBlur={() => setHover(null)}
                      aria-label={`${s.name}: ${total} requests. ${ACTION_TYPES.map((t) => `${ACTION_SHORT[t]} ${counts[t]}`).join(', ')}. ${funds} funds.`}
                    >
                      <span className="truncate text-sm text-slate-700">
                        <span className="tabular text-slate-500">{s.position}.</span> {s.name}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="flex h-4 gap-[2px]" style={{ width: `${(total / max) * 85}%` }}>
                          {segs.map((t, i) => (
                            <span
                              key={t}
                              className={cn('h-full', i === segs.length - 1 && 'rounded-r')}
                              style={{ background: SERIES[t], flexGrow: counts[t], flexBasis: 0, minWidth: 3 }}
                            />
                          ))}
                        </span>
                        <span className="tabular text-xs font-medium text-slate-700">{total || ''}</span>
                      </span>
                      {hover === s.id && total > 0 && (
                        <div className="pointer-events-none absolute right-2 top-full z-10 mt-1 w-52 rounded-lg border border-slate-200 bg-slate-100 p-2.5 text-xs shadow-xl">
                          <p className="mb-1 font-semibold text-slate-950">{s.name}</p>
                          {ACTION_TYPES.map((t) => (
                            <p key={t} className="flex items-center justify-between gap-2 text-slate-700">
                              <span className="inline-flex items-center gap-1.5">
                                <span className="h-2 w-2 rounded-sm" style={{ background: SERIES[t] }} />
                                {ACTION_SHORT[t]}
                              </span>
                              <span className="tabular font-medium text-slate-950">{counts[t]}</span>
                            </p>
                          ))}
                          <p className="mt-1 border-t border-slate-300 pt-1 text-slate-600">{funds} funds interested</p>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ol>
            </>
          ) : (
            <div className="overflow-x-auto">
              <table className="tabular w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                    <th className="py-2 pr-2 font-medium">#</th>
                    <th className="py-2 pr-2 font-medium">Startup</th>
                    {ACTION_TYPES.map((t) => (
                      <th key={t} className="py-2 pr-2 text-right font-medium">
                        {ACTION_SHORT[t]}
                      </th>
                    ))}
                    <th className="py-2 pr-2 text-right font-medium">Funds</th>
                    <th className="py-2 pr-2 text-right font-medium">Opened deck</th>
                  </tr>
                </thead>
                <tbody>
                  {perStartup.map(({ s, counts, funds }) => (
                    <tr key={s.id} className="border-b border-slate-200 last:border-0">
                      <td className="py-1.5 pr-2 text-slate-500">{s.position}</td>
                      <td className="py-1.5 pr-2 text-slate-900">{s.name}</td>
                      {ACTION_TYPES.map((t) => (
                        <td key={t} className="py-1.5 pr-2 text-right text-slate-800">
                          {counts[t]}
                        </td>
                      ))}
                      <td className="py-1.5 pr-2 text-right font-medium text-slate-950">{funds}</td>
                      <td className="py-1.5 pr-2 text-right text-slate-800">
                        {s.deckAvailable ? deckViews.filter((v) => v.startupId === s.id).length : '–'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5" aria-labelledby="by-fund">
          <h2 id="by-fund" className="font-semibold text-slate-950">
            Most engaged funds
          </h2>
          <p className="mb-3 text-xs text-slate-500">Number of startups each fund has expressed interest in</p>
          {topFunds.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">No interest yet.</p>
          ) : (
            <ol className="space-y-1.5">
              {topFunds.slice(0, 15).map((f) => (
                <li key={f.fund} className="grid grid-cols-[minmax(0,10rem)_1fr] items-center gap-3" title={`${f.fund}: ${f.n} startups`}>
                  <span className="truncate text-sm text-slate-700">{f.fund}</span>
                  <span className="flex items-center gap-2">
                    <span className="h-3.5 rounded-r" style={{ width: `${(f.n / fundMax) * 85}%`, background: SERIES.deck, minWidth: 3 }} />
                    <span className="tabular text-xs font-medium text-slate-700">{f.n}</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  )
}
