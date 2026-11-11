import { CalendarClock, ExternalLink, FileText, MapPin } from 'lucide-react'
import { ACTION_SHORT } from '../lib/constants'
import type { Notice, Startup } from '../lib/types'
import { cn, formatMeetingAt, timeAgo } from '../lib/utils'

export function NoticeCard({
  notice,
  startup,
  eventDate,
  superseded,
}: {
  notice: Notice
  startup?: Startup
  eventDate: string
  superseded?: boolean
}) {
  const isDeck = notice.type === 'deck'
  return (
    <div
      className={cn(
        'rounded-xl border p-4',
        superseded ? 'border-slate-200 bg-slate-50 opacity-70' : 'border-emerald-200 bg-emerald-50/60',
        !notice.readAt && !superseded && 'ring-2 ring-emerald-300',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-800">
            {superseded ? 'Earlier update' : isDeck ? 'Deck shared by RTIH' : 'Meeting approved by RTIH'}
          </p>
          <p className="mt-0.5 font-semibold text-slate-950">
            {startup?.name ?? 'Startup'} · {ACTION_SHORT[notice.type]}
          </p>
        </div>
        <span className="shrink-0 text-xs text-slate-500">{timeAgo(notice.createdAt)}</span>
      </div>
      <div className="mt-2 space-y-1.5 text-sm text-slate-800">
        {!isDeck && notice.room && (
          <p className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-emerald-700" aria-hidden />
            <span>
              <span className="text-slate-500">Room:</span> <strong>{notice.room}</strong>
            </span>
          </p>
        )}
        {!isDeck && notice.meetingAt && (
          <p className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-emerald-700" aria-hidden />
            <span>
              <span className="text-slate-500">Time:</span> <strong>{formatMeetingAt(notice.meetingAt, eventDate)}</strong>
            </span>
          </p>
        )}
        {notice.deckLink && (
          <a
            href={notice.deckLink}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 font-semibold text-brand-700 underline-offset-2 hover:underline"
          >
            <FileText className="h-4 w-4" aria-hidden />
            Open pitch deck
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>
        )}
        {notice.message && <p className="whitespace-pre-line text-slate-700">{notice.message}</p>}
      </div>
    </div>
  )
}

/** Latest notice per request (later notices replace earlier ones). */
export function latestNotices(notices: Notice[]): Notice[] {
  const byReq = new Map<string, Notice>()
  for (const n of notices) {
    const prev = byReq.get(n.requestId)
    if (!prev || prev.createdAt < n.createdAt) byReq.set(n.requestId, n)
  }
  return [...byReq.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}
