import {
  ArrowRightLeft,
  CalendarCheck,
  CircleCheck,
  Circle,
  Mail,
  MessageCircle,
  Phone,
  Send,
  StickyNote,
  Trash2,
  Users,
} from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Badge, Button, Field, Input, Modal, Select, Textarea } from '../../../components/ui'
import { useOrganiser } from '../../../context/Organiser'
import { ACTION_SHORT } from '../../../lib/constants'
import { CRM_STAGES, type CrmActivity, type CrmActivityKind, type CrmPriority, type CrmStage } from '../../../lib/types'
import { cn, formatMeetingAt, timeAgo, waLink } from '../../../lib/utils'
import { rowStatus } from '../shared'
import {
  DUE_TONE,
  KIND_LABEL,
  LOG_KINDS,
  PRIORITY_META,
  SOURCE_LABEL,
  STAGE_META,
  addDays,
  dueBucket,
  dueLabel,
  introEmail,
  useCrm,
  useCrmActions,
  type CrmRow,
} from './model'

export const KIND_ICON: Record<CrmActivityKind, typeof Mail> = {
  note: StickyNote,
  call: Phone,
  email: Mail,
  meeting: Users,
  whatsapp: MessageCircle,
  stage: ArrowRightLeft,
  followup: CalendarCheck,
}

export function DueChip({ due, className }: { due: string; className?: string }) {
  return (
    <span className={cn('inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', DUE_TONE[dueBucket(due)], className)}>
      {dueLabel(due)}
    </span>
  )
}

/** One open follow-up: tick it off, push it back a day or a week. */
export function FollowUpItem({ a, row, onOpen }: { a: CrmActivity; row?: CrmRow; onOpen?: () => void }) {
  const { canEdit } = useOrganiser()
  const act = useCrmActions()
  const done = !!a.doneAt
  return (
    <div className="flex items-start gap-2.5 py-2">
      <button
        disabled={!canEdit}
        onClick={() => act.setDone(a, !done)}
        className={cn('mt-0.5 shrink-0 rounded-full', canEdit ? 'text-slate-400 hover:text-emerald-600' : 'cursor-default text-slate-300')}
        aria-label={done ? 'Mark as not done' : 'Mark as done'}
        title={done ? 'Mark as not done' : 'Mark as done'}
      >
        {done ? <CircleCheck className="h-5 w-5 text-emerald-600" /> : <Circle className="h-5 w-5" />}
      </button>
      <div className="min-w-0 flex-1">
        <p className={cn('text-sm text-slate-950', done && 'text-slate-500 line-through')}>{a.body || 'Follow up'}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
          {row &&
            (onOpen ? (
              <button onClick={onOpen} className="truncate font-medium text-slate-700 hover:text-brand-800 hover:underline">
                {row.inv?.fund || row.inv?.name} → {row.s?.name}
              </button>
            ) : (
              <span>
                {row.inv?.fund} → {row.s?.name}
              </span>
            ))}
          {[a.owner, done && a.doneAt ? `done ${timeAgo(a.doneAt)}` : ''].filter(Boolean).map((t, i) => (
            <span key={i}>
              {row || i > 0 ? '· ' : ''}
              {t}
            </span>
          ))}
        </p>
      </div>
      {a.dueOn && !done && <DueChip due={a.dueOn} className="mt-0.5" />}
      {canEdit && !done && (
        <div className="flex shrink-0 gap-0.5">
          <button
            onClick={() => act.reschedule(a, addDays(1))}
            className="rounded-md px-1.5 py-0.5 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            title="Move to tomorrow"
          >
            +1d
          </button>
          <button
            onClick={() => act.reschedule(a, addDays(7, a.dueOn && a.dueOn > addDays(0) ? a.dueOn : undefined))}
            className="rounded-md px-1.5 py-0.5 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            title="Push back a week"
          >
            +1w
          </button>
        </div>
      )}
    </div>
  )
}

function Contact({ title, name, sub, email, phone, waText }: { title: string; name?: string; sub?: string; email?: string; phone?: string; waText: string }) {
  const wa = phone ? waLink(phone, waText) : null
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-0.5 truncate font-semibold text-slate-950">{name || '—'}</p>
      {sub && <p className="truncate text-sm text-slate-600">{sub}</p>}
      <div className="mt-1.5 flex flex-col gap-0.5 text-xs text-slate-600">
        {email ? (
          <a href={`mailto:${email}`} className="inline-flex min-w-0 items-center gap-1 hover:text-brand-800">
            <Mail className="h-3 w-3 shrink-0" aria-hidden />
            <span className="truncate">{email}</span>
          </a>
        ) : (
          <span className="text-slate-400">No email</span>
        )}
        {phone ? (
          <span className="inline-flex items-center gap-2">
            <a href={`tel:${phone}`} className="inline-flex items-center gap-1 hover:text-brand-800">
              <Phone className="h-3 w-3" aria-hidden />
              {phone}
            </a>
            {wa && (
              <a href={wa} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-brand-800">
                <MessageCircle className="h-3 w-3" aria-hidden /> WhatsApp
              </a>
            )}
          </span>
        ) : (
          <span className="text-slate-400">No phone</span>
        )}
      </div>
    </div>
  )
}

function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="mt-5">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  )
}

export function ConnectionDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { canEdit, settings, requests, handling, deckViews, notices } = useOrganiser()
  const { byId, owners } = useCrm()
  const act = useCrmActions()
  const r = id ? byId.get(id) : undefined

  const [ticket, setTicket] = useState('')
  const [summary, setSummary] = useState('')
  const [kind, setKind] = useState<(typeof LOG_KINDS)[number]>('call')
  const [note, setNote] = useState('')
  const [fuBody, setFuBody] = useState('')
  const [fuDue, setFuDue] = useState(addDays(2))
  const [fuOwner, setFuOwner] = useState('')
  const [busy, setBusy] = useState(false)
  const [showDone, setShowDone] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (!r) return
    setTicket(r.c.ticket)
    setSummary(r.c.summary)
    setFuOwner(r.c.owner || act.me)
    setConfirmDelete(false)
  }, [id, r?.c.updatedAt]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!r) return null
  const { c, inv, s, priv } = r
  const intro = introEmail(r, settings, act.me)
  const eventReqs = requests.filter((q) => q.investorId === c.investorId && q.startupId === c.startupId)
  const views = deckViews.find((v) => v.investorId === c.investorId && v.startupId === c.startupId)
  const sent = notices.filter((n) => n.investorId === c.investorId && n.startupId === c.startupId)
  const done = r.timeline.filter((a) => a.kind === 'followup' && a.doneAt)
  const log = r.timeline.filter((a) => a.kind !== 'followup')

  const saveField = async (patch: { ticket?: string; summary?: string }) => {
    if ((patch.ticket ?? c.ticket) === c.ticket && (patch.summary ?? c.summary) === c.summary) return
    await act.update(c, patch)
  }
  const addLog = async () => {
    if (!note.trim()) return
    setBusy(true)
    await act.log(c, kind, note)
    setNote('')
    setBusy(false)
  }
  const addFu = async () => {
    if (!fuBody.trim() || !fuDue) return
    setBusy(true)
    await act.addFollowUp(c, fuBody, fuDue, fuOwner)
    setFuBody('')
    setFuDue(addDays(2))
    setBusy(false)
  }

  return (
    <Modal
      open={!!id}
      onClose={onClose}
      wide
      title={
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>{inv?.fund || inv?.name || 'Investor'}</span>
          <span className="text-slate-400">→</span>
          <span>{s?.name ?? 'Startup'}</span>
        </span>
      }
      footer={
        canEdit ? (
          confirmDelete ? (
            <>
              <span className="mr-auto self-center text-sm text-red-700">Remove this connection and its whole history?</span>
              <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
                Keep
              </Button>
              <Button
                variant="danger"
                onClick={async () => {
                  await act.remove(c)
                  onClose()
                }}
              >
                Remove
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" className="mr-auto text-red-700" icon={<Trash2 className="h-4 w-4" />} onClick={() => setConfirmDelete(true)}>
                Remove
              </Button>
              <Button variant="secondary" onClick={onClose}>
                Done
              </Button>
            </>
          )
        ) : (
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        )
      }
    >
      <div className="grid gap-2 sm:grid-cols-2">
        <Contact
          title="Investor"
          name={inv?.name}
          sub={[inv?.designation, inv?.fund].filter(Boolean).join(', ')}
          email={inv?.email}
          phone={inv?.phone}
          waText={`Hi ${inv?.name?.split(' ')[0] ?? ''}, following up from ${settings.eventName} about ${s?.name}.`}
        />
        <Contact
          title="Startup"
          name={priv?.contactName || s?.founders}
          sub={[s?.name, s?.sector].filter(Boolean).join(' · ')}
          email={priv?.contactEmail}
          phone={priv?.contactPhone}
          waText={`Hi ${(priv?.contactName || '').split(' ')[0]}, following up from ${settings.eventName}: ${inv?.name} (${inv?.fund}) is interested in ${s?.name}.`}
        />
      </div>
      {canEdit && (
        <div className="mt-2 flex flex-wrap gap-2">
          {intro ? (
            <a
              href={intro}
              onClick={() => {
                setKind('email')
                setNote(`Sent intro email to ${inv?.name}${priv?.contactEmail ? ` and ${priv.contactName || 'the founder'}` : ''}`)
              }}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-white px-3 text-sm font-semibold text-slate-800 ring-1 ring-inset ring-slate-300 hover:bg-slate-50"
            >
              <Send className="h-3.5 w-3.5" aria-hidden /> Intro email{priv?.contactEmail ? ' (investor + founder)' : ''}
            </a>
          ) : (
            <span className="text-xs text-slate-500">Add the investor's email to send an intro.</span>
          )}
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Field label="Stage">
          <Select value={c.stage} disabled={!canEdit} onChange={(e) => act.setStage(c, e.target.value as CrmStage)}>
            {CRM_STAGES.map((st) => (
              <option key={st} value={st}>
                {STAGE_META[st].label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Priority">
          <Select value={c.priority} disabled={!canEdit} onChange={(e) => act.update(c, { priority: e.target.value as CrmPriority })}>
            {(Object.keys(PRIORITY_META) as CrmPriority[]).map((p) => (
              <option key={p} value={p}>
                {PRIORITY_META[p].label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Owner (RTIH)">
          <Input
            list="crm-owners"
            defaultValue={c.owner}
            key={c.owner}
            disabled={!canEdit}
            placeholder="Who follows up"
            onBlur={(e) => e.target.value.trim() !== c.owner && act.update(c, { owner: e.target.value })}
          />
        </Field>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_2fr]">
        <Field label="Ticket / round">
          <Input value={ticket} disabled={!canEdit} placeholder="e.g. ₹50L of ₹2Cr seed" onChange={(e) => setTicket(e.target.value)} onBlur={() => saveField({ ticket })} />
        </Field>
        <Field label="Summary">
          <Input
            value={summary}
            disabled={!canEdit}
            placeholder="Where things stand, in one line"
            onChange={(e) => setSummary(e.target.value)}
            onBlur={() => saveField({ summary })}
          />
        </Field>
      </div>
      <datalist id="crm-owners">
        {owners.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>

      <Section title="At the event">
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
          <Badge tone="slate">{SOURCE_LABEL[c.source]}</Badge>
          {eventReqs.map((q) => {
            const h = handling.get(q.id)
            const stt = rowStatus(q, h)
            return (
              <Badge key={q.id} tone={stt === 'withdrawn' ? 'red' : stt === 'new' ? 'brand' : 'green'}>
                {ACTION_SHORT[q.type]}
                {stt === 'withdrawn' ? ' · withdrawn' : stt === 'notified' ? ' · confirmed' : stt === 'approved' ? ' · approved' : ''}
                {h?.room || h?.meetingAt ? ` · ${[h.room, formatMeetingAt(h.meetingAt)].filter(Boolean).join(', ')}` : ''}
              </Badge>
            )
          })}
          {views && (
            <Badge tone="violet">
              Opened deck {views.views}× · last {timeAgo(views.lastViewedAt)}
            </Badge>
          )}
          {sent.length > 0 && <Badge tone="slate">{sent.length} notice{sent.length > 1 ? 's' : ''} sent in app</Badge>}
          {!eventReqs.length && !views && <span>No requests in the app for this pair.</span>}
        </div>
      </Section>

      <Section title={`Follow-ups${r.open.length ? ` (${r.open.length})` : ''}`}>
        {r.open.length === 0 && <p className="text-sm text-slate-500">Nothing planned.</p>}
        <div className="divide-y divide-slate-100">
          {r.open.map((a) => (
            <FollowUpItem key={a.id} a={a} />
          ))}
        </div>
        {canEdit && (
          <div className="mt-2 grid gap-2 rounded-xl bg-slate-50 p-2.5 sm:grid-cols-[1fr_140px_140px_auto]">
            <Input value={fuBody} onChange={(e) => setFuBody(e.target.value)} placeholder="Next step, e.g. Book call with partner" aria-label="Follow-up" onKeyDown={(e) => e.key === 'Enter' && addFu()} />
            <Input type="date" value={fuDue} onChange={(e) => setFuDue(e.target.value)} aria-label="Due date" />
            <Input list="crm-owners" value={fuOwner} onChange={(e) => setFuOwner(e.target.value)} placeholder="Owner" aria-label="Owner" />
            <Button onClick={addFu} loading={busy} disabled={!fuBody.trim() || !fuDue}>
              Add
            </Button>
          </div>
        )}
        {done.length > 0 && (
          <button onClick={() => setShowDone((v) => !v)} className="mt-1 text-xs font-medium text-slate-500 hover:text-slate-900">
            {showDone ? 'Hide' : 'Show'} {done.length} done
          </button>
        )}
        {showDone && (
          <div className="divide-y divide-slate-100">
            {done.map((a) => (
              <FollowUpItem key={a.id} a={a} />
            ))}
          </div>
        )}
      </Section>

      <Section title="Activity">
        {canEdit && (
          <div className="mb-3 rounded-xl bg-slate-50 p-2.5">
            <div className="mb-2 flex flex-wrap gap-1">
              {LOG_KINDS.map((k) => {
                const Icon = KIND_ICON[k]
                return (
                  <button
                    key={k}
                    onClick={() => setKind(k)}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset',
                      kind === k ? 'bg-brand-50 text-brand-900 ring-brand-300' : 'bg-white text-slate-600 ring-slate-200 hover:text-slate-900',
                    )}
                  >
                    <Icon className="h-3 w-3" aria-hidden /> {KIND_LABEL[k]}
                  </button>
                )
              })}
            </div>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={kind === 'call' ? 'What was discussed on the call?' : kind === 'meeting' ? 'Who met, what came out of it?' : 'What happened?'}
              className="min-h-[64px] bg-white"
              onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === 'Enter' && addLog()}
            />
            <div className="mt-2 flex justify-end">
              <Button size="sm" onClick={addLog} loading={busy} disabled={!note.trim()}>
                Log {KIND_LABEL[kind].toLowerCase()}
              </Button>
            </div>
          </div>
        )}
        {log.length === 0 ? (
          <p className="text-sm text-slate-500">Nothing logged yet.</p>
        ) : (
          <ol className="space-y-3">
            {log.map((a) => {
              const Icon = KIND_ICON[a.kind]
              return (
                <li key={a.id} className="group flex gap-2.5">
                  <span className={cn('mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full', a.kind === 'stage' ? 'bg-slate-100 text-slate-500' : 'bg-brand-50 text-brand-800')}>
                    <Icon className="h-3.5 w-3.5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={cn('whitespace-pre-wrap text-sm', a.kind === 'stage' ? 'text-slate-600' : 'text-slate-950')}>{a.body}</p>
                    <p className="text-xs text-slate-500">
                      {KIND_LABEL[a.kind]} · {timeAgo(a.createdAt)}
                      {a.createdBy ? ` · ${a.createdBy}` : ''}
                    </p>
                  </div>
                  {canEdit && a.kind !== 'stage' && (
                    <button
                      onClick={() => act.removeActivity(a)}
                      className="h-7 rounded-md p-1 text-slate-300 opacity-0 hover:bg-slate-100 hover:text-red-700 focus:opacity-100 group-hover:opacity-100"
                      aria-label="Delete entry"
                      title="Delete entry"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </li>
              )
            })}
          </ol>
        )}
        <p className="mt-3 text-xs text-slate-400">
          Added {timeAgo(c.createdAt)}
          {c.createdBy ? ` by ${c.createdBy}` : ''}. Only organisers see the CRM.
        </p>
      </Section>
    </Modal>
  )
}
