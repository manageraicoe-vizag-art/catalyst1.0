import { Archive, ArchiveRestore, CheckCircle2, Download, Mail, MessageCircle, Pencil, Phone, Search, Send } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ACTION_ICON } from '../../components/ActionToggles'
import { Badge, Button, EmptyState, Input, LiveDot, PageHeader, Segmented, Select } from '../../components/ui'
import { useOrganiser } from '../../context/Organiser'
import { useToast } from '../../context/Toast'
import { ACTION_SHORT } from '../../lib/constants'
import { store } from '../../lib/store'
import { ACTION_TYPES, type ActionType, type InterestRequest } from '../../lib/types'
import { clockTime, cn, downloadFile, formatMeetingAt, timeAgo, toCsv } from '../../lib/utils'
import { ApproveDialog } from './ApproveDialog'
import { channelLinks, rowStatus, useLookups, type RowStatus } from './shared'

type View = 'action' | 'approved' | 'withdrawn' | 'all'

const STATUS_BADGE: Record<RowStatus, { tone: Parameters<typeof Badge>[0]['tone']; label: string }> = {
  new: { tone: 'brand', label: 'New' },
  approved: { tone: 'amber', label: 'Approved · not sent' },
  notified: { tone: 'green', label: 'Sent to investor' },
  withdrawn: { tone: 'red', label: 'Withdrawn' },
  archived: { tone: 'slate', label: 'Archived' },
}

export function RequestsPage() {
  const { requests, handling, fresh, startups, settings, reload, canEdit } = useOrganiser()
  const { investorById, startupById } = useLookups()
  const { toast } = useToast()
  const [view, setView] = useState<View>('action')
  const [type, setType] = useState<ActionType | ''>('')
  const [startupId, setStartupId] = useState('')
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<InterestRequest | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const counts = useMemo(() => {
    const c = { action: 0, approved: 0, withdrawn: 0, all: requests.length }
    for (const r of requests) {
      const st = rowStatus(r, handling.get(r.id))
      if (st === 'new' || st === 'approved') c.action++
      if (st === 'approved' || st === 'notified') c.approved++
      if (st === 'withdrawn') c.withdrawn++
    }
    return c
  }, [requests, handling])

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return requests
      .filter((r) => {
        const st = rowStatus(r, handling.get(r.id))
        if (view === 'action' && st !== 'new' && st !== 'approved') return false
        if (view === 'approved' && st !== 'approved' && st !== 'notified') return false
        if (view === 'withdrawn' && st !== 'withdrawn') return false
        if (type && r.type !== type) return false
        if (startupId && r.startupId !== startupId) return false
        if (needle) {
          const inv = investorById.get(r.investorId)
          const s = startupById.get(r.startupId)
          if (!`${inv?.name} ${inv?.fund} ${s?.name}`.toLowerCase().includes(needle)) return false
        }
        return true
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }, [requests, handling, view, type, startupId, q, investorById, startupById])

  const notify = async (r: InterestRequest) => {
    setBusyId(r.id)
    try {
      await store.orgNotify(r.id)
      await Promise.all([reload('handling'), reload('notices')])
      toast({ title: `Sent to ${investorById.get(r.investorId)?.name}`, body: 'Visible only to this investor.' })
    } catch (e) {
      toast({ kind: 'error', title: 'Could not notify', body: (e as Error).message })
    } finally {
      setBusyId(null)
    }
  }

  const setArchived = async (r: InterestRequest, archived: boolean) => {
    setBusyId(r.id)
    try {
      const h = handling.get(r.id)
      await store.orgSaveHandling(r.id, { status: archived ? 'archived' : h?.approvedAt ? 'approved' : 'new' })
      await reload('handling')
    } finally {
      setBusyId(null)
    }
  }

  const exportCsv = () => {
    const data = requests.map((r) => {
      const inv = investorById.get(r.investorId)
      const s = startupById.get(r.startupId)
      const h = handling.get(r.id)
      return {
        requested_at: r.createdAt,
        updated_at: r.updatedAt,
        status: rowStatus(r, h),
        action: ACTION_SHORT[r.type],
        startup_position: s?.position,
        startup: s?.name,
        investor: inv?.name,
        fund: inv?.fund,
        designation: inv?.designation,
        email: inv?.email,
        phone: inv?.phone,
        room: h?.room,
        meeting_at: h?.meetingAt,
        deck_link: h?.deckLink,
        message_to_investor: h?.message,
        internal_note: h?.organiserNote,
        approved_at: h?.approvedAt,
        notified_at: h?.notifiedAt,
      }
    })
    downloadFile(`catalyst-requests-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(data))
  }

  return (
    <div>
      <PageHeader
        title="Incoming requests"
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700">
              <LiveDot /> Live
            </span>
            <span>Every investor selection arrives here first. Nothing goes to founders automatically.</span>
          </span>
        }
        actions={
          <Button variant="secondary" size="sm" icon={<Download className="h-4 w-4" />} onClick={exportCsv}>
            Export CSV
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-center">
        <Segmented
          value={view}
          onChange={setView}
          className="scrollbar-none max-w-full overflow-x-auto"
          options={[
            { value: 'action', label: `Needs action (${counts.action})` },
            { value: 'approved', label: `Approved (${counts.approved})` },
            { value: 'withdrawn', label: `Withdrawn (${counts.withdrawn})` },
            { value: 'all', label: `All (${counts.all})` },
          ]}
        />
        <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_1.4fr]">
          <Select value={type} onChange={(e) => setType(e.target.value as ActionType | '')} aria-label="Filter by action">
            <option value="">All actions</option>
            {ACTION_TYPES.map((t) => (
              <option key={t} value={t}>
                {ACTION_SHORT[t]}
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
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Investor, fund or startup" className="pl-9" aria-label="Search" />
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 className="h-8 w-8" />}
          title={view === 'action' ? 'All caught up' : 'No requests here'}
          body={view === 'action' ? 'New requests from investors will appear here instantly.' : 'Try another filter.'}
        />
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => {
            const inv = investorById.get(r.investorId)
            const s = startupById.get(r.startupId)
            const h = handling.get(r.id)
            const st = rowStatus(r, h)
            const Icon = ACTION_ICON[r.type]
            const isFresh = fresh.has(r.id)
            const links = h && st === 'notified' ? channelLinks(r, h, inv, s, settings) : null
            return (
              <li
                key={`${r.id}-${r.updatedAt}`}
                className={cn(
                  'rounded-xl border bg-white p-3.5 sm:p-4',
                  isFresh && 'animate-flash',
                  st === 'new' ? 'border-brand-300' : 'border-slate-200',
                  (st === 'withdrawn' || st === 'archived') && 'opacity-70',
                )}
              >
                <div className="grid gap-3 md:grid-cols-[88px_1.2fr_1fr_auto] md:items-center">
                  <div className="flex items-center gap-2 text-xs text-slate-500 md:block">
                    <p className="tabular font-semibold text-slate-800">{clockTime(r.updatedAt)}</p>
                    <p>{timeAgo(r.updatedAt)}</p>
                  </div>

                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-950">{inv?.fund ?? 'Unknown fund'}</p>
                    <p className="truncate text-sm text-slate-600">
                      {inv?.name}
                      {inv?.designation ? `, ${inv.designation}` : ''}
                    </p>
                    <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-slate-500">
                      {inv?.email && (
                        <a href={`mailto:${inv.email}`} className="inline-flex items-center gap-1 hover:text-brand-700">
                          <Mail className="h-3 w-3" aria-hidden />
                          {inv.email}
                        </a>
                      )}
                      {inv?.phone && (
                        <a href={`tel:${inv.phone}`} className="inline-flex items-center gap-1 hover:text-brand-700">
                          <Phone className="h-3 w-3" aria-hidden />
                          {inv.phone}
                        </a>
                      )}
                    </p>
                  </div>

                  <div className="min-w-0">
                    <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-950">
                      <Icon className="h-4 w-4 text-brand-800" aria-hidden />
                      {ACTION_SHORT[r.type]}
                    </p>
                    <p className="truncate text-sm text-slate-600">
                      <span className="tabular text-slate-400">#{s?.position}</span> {s?.name ?? 'Removed startup'}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Badge tone={STATUS_BADGE[st].tone}>{STATUS_BADGE[st].label}</Badge>
                      {isFresh && st === 'new' && <Badge tone="go">Just in</Badge>}
                      {st === 'withdrawn' && h?.status === 'approved' && <Badge tone="amber">Was approved</Badge>}
                      {h && (st === 'approved' || st === 'notified') && r.type !== 'deck' && (h.room || h.meetingAt) && (
                        <span className="text-xs text-slate-500">
                          {[h.room, formatMeetingAt(h.meetingAt, r.type === 'meet_today' ? settings.date : undefined)].filter(Boolean).join(' · ')}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 md:justify-end">
                    {canEdit && st === 'new' && (
                      <Button size="sm" onClick={() => setEditing(r)}>
                        {r.type === 'deck' ? 'Share deck…' : 'Approve…'}
                      </Button>
                    )}
                    {canEdit && st === 'approved' && (
                      <>
                        <Button size="sm" icon={<Send className="h-3.5 w-3.5" />} loading={busyId === r.id} onClick={() => notify(r)}>
                          Notify investor
                        </Button>
                        <Button size="sm" variant="ghost" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditing(r)} aria-label="Edit approval" />
                      </>
                    )}
                    {st === 'notified' && (
                      <>
                        <span className="mr-1 text-xs text-slate-500">Sent {clockTime(h?.notifiedAt)}</span>
                        {canEdit && links?.email && (
                          <a href={links.email} title="Also send by email" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900">
                            <Mail className="h-4 w-4" />
                          </a>
                        )}
                        {canEdit && links?.whatsapp && (
                          <a href={links.whatsapp} target="_blank" rel="noreferrer" title="Also send on WhatsApp" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900">
                            <MessageCircle className="h-4 w-4" />
                          </a>
                        )}
                        {canEdit && (
                          <Button size="sm" variant="ghost" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditing(r)}>
                            Edit
                          </Button>
                        )}
                      </>
                    )}
                    {canEdit && (st === 'new' || st === 'approved') && (
                      <button
                        onClick={() => setArchived(r, true)}
                        title="Archive (hide from Needs action; the investor is not told)"
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        aria-label="Archive"
                      >
                        <Archive className="h-4 w-4" />
                      </button>
                    )}
                    {canEdit && st === 'archived' && (
                      <Button size="sm" variant="ghost" icon={<ArchiveRestore className="h-3.5 w-3.5" />} onClick={() => setArchived(r, false)}>
                        Restore
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <ApproveDialog request={editing} onClose={() => setEditing(null)} />
    </div>
  )
}
