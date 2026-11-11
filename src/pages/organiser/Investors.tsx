import { ChevronDown, Copy, Download, Link2, Plus, QrCode as QrIcon, Search, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ACTION_ICON } from '../../components/ActionToggles'
import { QrCode } from '../../components/Qr'
import { Badge, Button, EmptyState, Input, Modal, PageHeader } from '../../components/ui'
import { useOrganiser } from '../../context/Organiser'
import { useToast } from '../../context/Toast'
import { ACTION_SHORT } from '../../lib/constants'
import { store } from '../../lib/store'
import type { Investor } from '../../lib/types'
import { cn, copyText, downloadFile, eventLink, personalLink, timeAgo, toCsv } from '../../lib/utils'
import { InvestorForm } from '../Join'
import { rowStatus, useLookups } from './shared'

export function InvestorsPage() {
  const { investors, requests, handling, settings, reload } = useOrganiser()
  const { startupById } = useLookups()
  const { toast } = useToast()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Investor | null>(null)
  const [qrFor, setQrFor] = useState<{ title: string; url: string; file: string } | null>(null)
  const [deleting, setDeleting] = useState<Investor | null>(null)

  const reqsBy = useMemo(() => {
    const m = new Map<string, typeof requests>()
    for (const r of requests) if (r.active) m.set(r.investorId, [...(m.get(r.investorId) ?? []), r])
    return m
  }, [requests])

  const funds = new Set(investors.map((i) => i.fund.trim().toLowerCase())).size
  const shown = investors
    .filter((i) => !q.trim() || `${i.name} ${i.fund} ${i.email} ${i.phone}`.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => a.fund.localeCompare(b.fund) || a.name.localeCompare(b.name))

  const exportCsv = () =>
    downloadFile(
      `catalyst-investors-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv(
        investors.map((i) => ({
          name: i.name,
          fund: i.fund,
          designation: i.designation,
          email: i.email,
          phone: i.phone,
          active_requests: reqsBy.get(i.id)?.length ?? 0,
          registered_at: i.createdAt,
          added_by: i.createdBy,
          personal_link: personalLink(i.inviteToken),
        })),
      ),
    )

  const copy = async (text: string, what: string) => (await copyText(text)) && toast({ title: `${what} copied` })

  return (
    <div>
      <PageHeader
        title="Investors"
        subtitle={`${investors.length} people from ${funds} funds. Contact details are visible only to organisers.`}
        actions={
          <>
            <Button variant="secondary" size="sm" icon={<Download className="h-4 w-4" />} onClick={exportCsv}>
              Export CSV
            </Button>
            <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setAdding(true)}>
              Pre-register investor
            </Button>
          </>
        }
      />

      <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-brand-300 bg-brand-50 p-4 sm:flex-row sm:items-center">
        <Link2 className="hidden h-6 w-6 shrink-0 text-brand-800 sm:block" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-950">One link for the whole event</p>
          <p className="truncate text-sm text-slate-600">{eventLink()}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" icon={<Copy className="h-4 w-4" />} onClick={() => copy(eventLink(), 'Event link')}>
            Copy
          </Button>
          <Button variant="secondary" size="sm" icon={<QrIcon className="h-4 w-4" />} onClick={() => setQrFor({ title: 'Event QR code', url: eventLink(), file: 'catalyst-event-qr.png' })}>
            QR code
          </Button>
        </div>
      </div>

      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, fund, email or phone" className="pl-9" aria-label="Search investors" />
      </div>

      {shown.length === 0 ? (
        <EmptyState title={investors.length ? 'No matches' : 'No investors yet'} body="Investors appear here as soon as they enter their details on the event link." />
      ) : (
        <ul className="space-y-2">
          {shown.map((i) => {
            const rs = reqsBy.get(i.id) ?? []
            const isOpen = open === i.id
            return (
              <li key={i.id} className="rounded-xl border border-slate-200 bg-white">
                <button onClick={() => setOpen(isOpen ? null : i.id)} className="flex w-full items-center gap-3 p-3.5 text-left" aria-expanded={isOpen}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-950">{i.fund}</p>
                    <p className="truncate text-sm text-slate-600">
                      {i.name}
                      {i.designation ? `, ${i.designation}` : ''}
                    </p>
                  </div>
                  <div className="hidden min-w-0 text-right text-xs text-slate-500 sm:block">
                    <p className="truncate">{i.email}</p>
                    <p className="truncate">{i.phone}</p>
                  </div>
                  <Badge tone={rs.length ? 'brand' : 'slate'}>{rs.length} requests</Badge>
                  <ChevronDown className={cn('h-4 w-4 shrink-0 text-slate-400 transition-transform', isOpen && 'rotate-180')} aria-hidden />
                </button>
                {isOpen && (
                  <div className="border-t border-slate-200 p-3.5">
                    <div className="mb-3 grid gap-1 text-sm text-slate-700 sm:hidden">
                      {i.email && <a href={`mailto:${i.email}`}>{i.email}</a>}
                      {i.phone && <a href={`tel:${i.phone}`}>{i.phone}</a>}
                    </div>
                    {rs.length ? (
                      <ul className="mb-3 space-y-1.5">
                        {rs
                          .map((r) => ({ r, s: startupById.get(r.startupId) }))
                          .sort((a, b) => (a.s?.position ?? 0) - (b.s?.position ?? 0))
                          .map(({ r, s }) => {
                            const Icon = ACTION_ICON[r.type]
                            const st = rowStatus(r, handling.get(r.id))
                            return (
                              <li key={r.id} className="flex items-center gap-2 text-sm">
                                <Icon className="h-4 w-4 text-brand-800" aria-hidden />
                                <span className="min-w-0 flex-1 truncate text-slate-800">
                                  <span className="text-slate-400">#{s?.position}</span> {s?.name} · {ACTION_SHORT[r.type]}
                                </span>
                                <span className="text-xs text-slate-500">{st === 'notified' ? 'Sent' : st === 'approved' ? 'Approved' : st === 'archived' ? 'Archived' : 'New'}</span>
                              </li>
                            )
                          })}
                      </ul>
                    ) : (
                      <p className="mb-3 text-sm text-slate-500">No active requests.</p>
                    )}
                    <p className="mb-3 text-xs text-slate-500">
                      Registered {timeAgo(i.createdAt)} {i.createdBy === 'organiser' ? '(pre-registered by RTIH)' : ''}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="secondary" icon={<Copy className="h-3.5 w-3.5" />} onClick={() => copy(personalLink(i.inviteToken), 'Personal link')}>
                        Personal link
                      </Button>
                      <Button size="sm" variant="secondary" icon={<QrIcon className="h-3.5 w-3.5" />} onClick={() => setQrFor({ title: `${i.name}: personal link`, url: personalLink(i.inviteToken), file: `catalyst-${i.name.replace(/\W+/g, '-').toLowerCase()}.png` })}>
                        QR
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(i)}>
                        Edit
                      </Button>
                      <Button size="sm" variant="ghost" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => setDeleting(i)}>
                        Remove
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <Modal open={adding || !!editing} onClose={() => (setAdding(false), setEditing(null))} title={editing ? 'Edit investor' : 'Pre-register an investor'}>
        {!editing && (
          <p className="mb-4 text-sm text-slate-600">
            Creates the investor now and gives you a personal link to send them. Opening it signs them in on any device,
            so they never type their details.
          </p>
        )}
        <InvestorForm
          key={editing?.id ?? 'new'}
          initial={editing ?? undefined}
          fundSuggestions={settings.participatingFunds}
          submitLabel={editing ? 'Save' : 'Create & copy personal link'}
          onSubmit={async (v) => {
            if (editing) {
              await store.orgUpdateInvestor(editing.id, v)
              toast({ title: 'Investor updated' })
            } else {
              const inv = await store.orgCreateInvestor(v)
              await copyText(personalLink(inv.inviteToken))
              toast({ title: 'Investor created', body: 'Personal link copied to clipboard.' })
            }
            await Promise.all([reload('investors'), reload('live')])
            setAdding(false)
            setEditing(null)
          }}
        />
      </Modal>

      <Modal open={!!qrFor} onClose={() => setQrFor(null)} title={qrFor?.title ?? ''}>
        {qrFor && (
          <div className="flex flex-col items-center gap-3">
            <QrCode value={qrFor.url} size={240} filename={qrFor.file} />
            <p className="break-all text-center text-xs text-slate-500">{qrFor.url}</p>
          </div>
        )}
      </Modal>

      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title={`Remove ${deleting?.name}?`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                if (!deleting) return
                await store.orgDeleteInvestor(deleting.id)
                await reload()
                toast({ title: 'Investor removed' })
                setDeleting(null)
              }}
            >
              Remove investor and their requests
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-700">This deletes their details and all their requests, and removes their fund from the live board where applicable.</p>
      </Modal>
    </div>
  )
}
