import { AlertTriangle, CalendarClock, Download, MapPin } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button, EmptyState, PageHeader, Segmented } from '../../components/ui'
import { useOrganiser } from '../../context/Organiser'
import { ACTION_SHORT } from '../../lib/constants'
import type { InterestRequest, RequestHandling } from '../../lib/types'
import { downloadFile, formatMeetingAt, toCsv } from '../../lib/utils'
import { useLookups } from './shared'

type Tab = 'meet_today' | 'meet_later' | 'deck'
interface Item {
  r: InterestRequest
  h: RequestHandling
}

export function MeetingsPage() {
  const { requests, handling, settings } = useOrganiser()
  const { investorById, startupById } = useLookups()
  const [tab, setTab] = useState<Tab>('meet_today')

  const approved = useMemo(() => {
    const out: Record<Tab, Item[]> = { meet_today: [], meet_later: [], deck: [] }
    for (const r of requests) {
      const h = handling.get(r.id)
      if (r.active && h?.status === 'approved') out[r.type].push({ r, h })
    }
    for (const k of Object.keys(out) as Tab[]) out[k].sort((a, b) => (a.h.meetingAt || '~').localeCompare(b.h.meetingAt || '~'))
    return out
  }, [requests, handling])

  const awaiting = requests.filter((r) => r.active && r.type !== 'deck' && (handling.get(r.id)?.status ?? 'new') === 'new').length

  const byRoom = useMemo(() => {
    const m = new Map<string, Item[]>()
    for (const it of approved.meet_today) {
      const room = it.h.room || 'No room set'
      m.set(room, [...(m.get(room) ?? []), it])
    }
    const order = [...settings.rooms, ...[...m.keys()].filter((k) => !settings.rooms.includes(k))]
    return order.filter((r) => m.has(r)).map((room) => ({ room, items: m.get(room)! }))
  }, [approved.meet_today, settings.rooms])

  const clash = (items: Item[], it: Item) => !!it.h.meetingAt && items.some((o) => o !== it && o.h.meetingAt === it.h.meetingAt)

  const exportCsv = () => {
    const rows = [...approved.meet_today, ...approved.meet_later, ...approved.deck].map(({ r, h }) => {
      const inv = investorById.get(r.investorId)
      const s = startupById.get(r.startupId)
      return {
        type: ACTION_SHORT[r.type],
        room: h.room,
        time: h.meetingAt,
        startup: s?.name,
        investor: inv?.name,
        fund: inv?.fund,
        email: inv?.email,
        phone: inv?.phone,
        deck_link: h.deckLink,
        sent_to_investor: h.notifiedAt ? 'yes' : 'no',
      }
    })
    downloadFile(`catalyst-schedule-${settings.date}.csv`, toCsv(rows))
  }

  const Row = ({ it, items }: { it: Item; items: Item[] }) => {
    const inv = investorById.get(it.r.investorId)
    const s = startupById.get(it.r.startupId)
    return (
      <li className="flex items-start gap-3 py-2.5">
        <span className="tabular w-[72px] shrink-0 text-sm font-semibold text-slate-950">
          {it.r.type === 'meet_today' ? formatMeetingAt(it.h.meetingAt).replace(/,.*$/, '') || '—' : ''}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-950">{s?.name}</p>
          <p className="truncate text-sm text-slate-600">
            {inv?.fund} · {inv?.name}
          </p>
          {it.r.type === 'meet_later' && (
            <p className="text-xs text-slate-500">
              {[formatMeetingAt(it.h.meetingAt), it.h.room].filter(Boolean).join(' · ') || 'Time to be arranged'}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {it.h.notifiedAt ? <Badge tone="green">Sent</Badge> : <Badge tone="amber">Not sent</Badge>}
          {clash(items, it) && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700">
              <AlertTriangle className="h-3 w-3" aria-hidden /> Clash
            </span>
          )}
        </div>
      </li>
    )
  }

  return (
    <div>
      <PageHeader
        title="Meetings"
        subtitle={
          awaiting ? (
            <span>
              {awaiting} meeting request{awaiting > 1 ? 's' : ''} awaiting approval ·{' '}
              <Link to="/organiser" className="font-medium text-brand-700 hover:underline">
                review
              </Link>
            </span>
          ) : (
            'Approved meetings and shared decks.'
          )
        }
        actions={
          <Button variant="secondary" size="sm" icon={<Download className="h-4 w-4" />} onClick={exportCsv}>
            Export schedule
          </Button>
        }
      />

      <Segmented
        value={tab}
        onChange={setTab}
        className="mb-4"
        options={[
          { value: 'meet_today', label: `Today (${approved.meet_today.length})` },
          { value: 'meet_later', label: `After event (${approved.meet_later.length})` },
          { value: 'deck', label: `Decks (${approved.deck.length})` },
        ]}
      />

      {tab === 'meet_today' &&
        (byRoom.length === 0 ? (
          <EmptyState icon={<CalendarClock className="h-8 w-8" />} title="No meetings approved yet" body="Approve “Meet today” requests from the Requests page and assign a room and time." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {byRoom.map(({ room, items }) => (
              <section key={room} className="rounded-2xl border border-slate-200 bg-white p-4">
                <h2 className="flex items-center gap-2 font-semibold text-slate-950">
                  <MapPin className="h-4 w-4 text-brand-800" aria-hidden />
                  {room}
                  <span className="tabular ml-auto text-xs font-normal text-slate-500">{items.length}</span>
                </h2>
                <ol className="mt-2 divide-y divide-slate-200">
                  {items.map((it) => (
                    <Row key={it.r.id} it={it} items={items} />
                  ))}
                </ol>
              </section>
            ))}
          </div>
        ))}

      {tab === 'meet_later' &&
        (approved.meet_later.length === 0 ? (
          <EmptyState title="No follow-up meetings approved yet" />
        ) : (
          <ol className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white px-4">
            {approved.meet_later.map((it) => (
              <Row key={it.r.id} it={it} items={[]} />
            ))}
          </ol>
        ))}

      {tab === 'deck' &&
        (approved.deck.length === 0 ? (
          <EmptyState title="No decks shared yet" />
        ) : (
          <ol className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white px-4">
            {approved.deck.map(({ r, h }) => {
              const inv = investorById.get(r.investorId)
              const s = startupById.get(r.startupId)
              return (
                <li key={r.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-950">{s?.name}</p>
                    <p className="truncate text-sm text-slate-600">
                      {inv?.fund} · {inv?.name}
                    </p>
                  </div>
                  {h.deckLink ? (
                    <a href={h.deckLink} target="_blank" rel="noreferrer" className="text-sm font-medium text-brand-700 hover:underline">
                      Link
                    </a>
                  ) : (
                    <span className="text-xs text-slate-500">No link</span>
                  )}
                  {h.notifiedAt ? <Badge tone="green">Sent</Badge> : <Badge tone="amber">Not sent</Badge>}
                </li>
              )
            })}
          </ol>
        ))}
    </div>
  )
}
