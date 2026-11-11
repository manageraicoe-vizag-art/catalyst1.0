import { ArrowLeft, ChevronLeft, ChevronRight, ExternalLink, FileText, Globe, Info } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ActionToggles } from '../components/ActionToggles'
import { NoticeCard, latestNotices } from '../components/NoticeCard'
import { Badge, EmptyState, Notice } from '../components/ui'
import { useInvestor } from '../context/Investor'
import { LIVE_DISCLAIMER, ROUTING_NOTE } from '../lib/constants'

const SECTIONS: Array<[key: 'problem' | 'solution' | 'market' | 'traction' | 'businessModel' | 'team' | 'ask', label: string]> = [
  ['problem', 'Problem'],
  ['solution', 'Solution'],
  ['market', 'Market'],
  ['traction', 'Traction'],
  ['businessModel', 'Business model'],
  ['team', 'Team'],
  ['ask', 'The ask'],
]

export function StartupDetailPage() {
  const { id } = useParams()
  const { startups, live, notices, settings } = useInvestor()
  const idx = startups.findIndex((s) => s.id === id)
  const s = startups[idx]

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [id])

  const funds = useMemo(() => {
    const set = new Map<string, string>()
    live.filter((l) => l.startupId === id).forEach((l) => set.set(l.fund.toLowerCase(), l.fund))
    return [...set.values()].sort((a, b) => a.localeCompare(b))
  }, [live, id])

  const myNotices = latestNotices(notices.filter((n) => n.startupId === id))

  if (!s)
    return (
      <EmptyState
        title="Startup not found"
        body="It may have been removed from the line-up."
        action={
          <Link to="/startups" className="text-sm font-semibold text-brand-700">
            Back to all startups
          </Link>
        }
      />
    )

  const prev = startups[idx - 1]
  const next = startups[idx + 1]

  return (
    <article className="mx-auto max-w-2xl">
      <Link to="/startups" className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" aria-hidden /> All startups
      </Link>

      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
          <span className="tabular rounded-md bg-slate-100 px-1.5 py-0.5 font-bold text-slate-700">Pitch #{s.position}</span>
          {s.status === 'pitching' && <Badge tone="go">Now pitching</Badge>}
          {s.status === 'done' && <span>Pitched</span>}
        </div>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">{s.name}</h1>
        <p className="mt-1 text-sm font-medium text-slate-500">
          {[s.sector, s.stage, s.city].filter(Boolean).join(' · ')}
        </p>
        <p className="mt-3 text-[15px] leading-relaxed text-slate-800">{s.description}</p>
        {(s.founders || s.website || s.onePagerUrl) && (
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
            {s.founders && <span className="text-slate-600">Founders: {s.founders}</span>}
            {s.website && (
              <a href={withProto(s.website)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-brand-700">
                <Globe className="h-4 w-4" aria-hidden /> Website
              </a>
            )}
            {s.onePagerUrl && (
              <a href={withProto(s.onePagerUrl)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-brand-700">
                <FileText className="h-4 w-4" aria-hidden /> One-pager (PDF) <ExternalLink className="h-3 w-3" aria-hidden />
              </a>
            )}
          </div>
        )}
      </header>

      <section className="mt-4" aria-labelledby="respond">
        <h2 id="respond" className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Your response
        </h2>
        <ActionToggles startup={s} layout="full" />
        <p className="mt-2 flex items-start gap-1.5 text-xs text-slate-500">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          {ROUTING_NOTE} Each tap saves instantly. You can select more than one and withdraw any time.
        </p>
        {myNotices.length > 0 && (
          <div className="mt-3 space-y-2">
            {myNotices.map((n) => (
              <NoticeCard key={n.id} notice={n} startup={s} eventDate={settings.date} />
            ))}
          </div>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="onepager">
        <h2 id="onepager" className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          One-page summary
        </h2>
        <dl className="mt-3 divide-y divide-slate-100">
          {SECTIONS.filter(([k]) => s[k]?.trim()).map(([k, label]) => (
            <div key={k} className="py-3 first:pt-0 last:pb-0">
              <dt className="text-sm font-semibold text-slate-950">{label}</dt>
              <dd className="mt-1 whitespace-pre-line text-[15px] leading-relaxed text-slate-700">{s[k]}</dd>
            </div>
          ))}
        </dl>
        {SECTIONS.every(([k]) => !s[k]?.trim()) && (
          <p className="mt-2 text-sm text-slate-500">The one-page summary will be added by the RTIH team.</p>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="interest">
        <h2 id="interest" className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Funds that expressed interest
        </h2>
        {funds.length ? (
          <ul className="mt-3 flex flex-wrap gap-2">
            {funds.map((f) => (
              <li key={f} className="rounded-full bg-brand-50 px-3 py-1 text-sm font-medium text-brand-900 ring-1 ring-inset ring-brand-200">
                {f}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-slate-500">No expressions of interest yet.</p>
        )}
        <Notice tone="slate" className="mt-3 text-xs">
          {LIVE_DISCLAIMER}
        </Notice>
      </section>

      <nav className="mt-6 grid grid-cols-2 gap-3" aria-label="Pitch order">
        {prev ? (
          <Link to={`/startups/${prev.id}`} className="rounded-xl border border-slate-200 bg-white p-3 text-sm hover:border-brand-300">
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden /> #{prev.position}
            </span>
            <span className="mt-0.5 block truncate font-semibold text-slate-900">{prev.name}</span>
          </Link>
        ) : (
          <span />
        )}
        {next && (
          <Link to={`/startups/${next.id}`} className="rounded-xl border border-slate-200 bg-white p-3 text-right text-sm hover:border-brand-300">
            <span className="flex items-center justify-end gap-1 text-xs text-slate-500">
              #{next.position} <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </span>
            <span className="mt-0.5 block truncate font-semibold text-slate-900">{next.name}</span>
          </Link>
        )}
      </nav>
    </article>
  )
}

function withProto(url: string) {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`
}
