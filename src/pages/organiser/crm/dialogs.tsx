import { useEffect, useMemo, useState } from 'react'
import { Button, Field, Input, Modal, Notice, Select } from '../../../components/ui'
import { useOrganiser } from '../../../context/Organiser'
import { useToast } from '../../../context/Toast'
import { ACTION_SHORT } from '../../../lib/constants'
import { store } from '../../../lib/store'
import { CRM_STAGES, type ActionType, type CrmPriority, type CrmStage, type InterestRequest } from '../../../lib/types'
import { PRIORITY_META, STAGE_META, addDays, candidateDraft, eventCandidates, firstFollowUp, useCrm, useCrmActions } from './model'

/** Add one investor ↔ startup connection by hand (optionally creating the investor too). */
export function NewConnectionDialog({
  open,
  preset,
  onClose,
  onOpenExisting,
}: {
  open: boolean
  preset?: { investorId?: string; startupId?: string }
  onClose: () => void
  onOpenExisting: (id: string) => void
}) {
  const { investors, startups, connections, reload } = useOrganiser()
  const { owners } = useCrm()
  const act = useCrmActions()
  const { toast } = useToast()
  const [investorId, setInvestorId] = useState('')
  const [startupId, setStartupId] = useState('')
  const [newInv, setNewInv] = useState({ name: '', fund: '', email: '', phone: '', designation: '' })
  const [stage, setStage] = useState<CrmStage>('new')
  const [priority, setPriority] = useState<CrmPriority>('normal')
  const [owner, setOwner] = useState('')
  const [fuBody, setFuBody] = useState('')
  const [fuDue, setFuDue] = useState(addDays(2))
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setInvestorId(preset?.investorId ?? '')
    setStartupId(preset?.startupId ?? '')
    setNewInv({ name: '', fund: '', email: '', phone: '', designation: '' })
    setStage('new')
    setPriority('normal')
    setOwner(act.me)
    setFuBody('')
    setFuDue(addDays(2))
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const sortedInvestors = useMemo(
    () => [...investors].sort((a, b) => (a.fund || a.name).localeCompare(b.fund || b.name) || a.name.localeCompare(b.name)),
    [investors],
  )
  const creating = investorId === '__new'
  const existing = connections.find((c) => c.investorId === investorId && c.startupId === startupId)
  const valid = !!startupId && (creating ? !!newInv.name.trim() && !!newInv.fund.trim() : !!investorId) && !existing

  const save = async () => {
    setBusy(true)
    try {
      let invId = investorId
      if (creating) {
        invId = (await store.orgCreateInvestor(newInv)).id
        await reload('investors')
      }
      const s = startups.find((x) => x.id === startupId)
      const fund = creating ? newInv.fund : investors.find((i) => i.id === invId)?.fund
      const added = await act.addMany(
        [{ investorId: invId, startupId, stage, priority, owner, source: 'manual', createdBy: act.me }],
        () => {
          const body = fuBody.trim() || firstFollowUp('manual', fund || 'the investor', s?.name || 'the startup').body
          return { kind: 'followup', body, dueOn: fuDue, owner, createdBy: act.me }
        },
      )
      if (added?.[0]) {
        toast({ kind: 'success', title: 'Connection added', ms: 2500 })
        onClose()
        onOpenExisting(added[0].id)
      }
    } catch (e) {
      toast({ kind: 'error', title: 'Could not add', body: (e as Error).message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => !busy && onClose()}
      title="New connection"
      footer={
        <>
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} disabled={!valid} onClick={save}>
            Add to CRM
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        <Field label="Investor" required>
          <Select value={investorId} onChange={(e) => setInvestorId(e.target.value)}>
            <option value="">Choose an investor…</option>
            <option value="__new">+ Someone not in the app yet…</option>
            {sortedInvestors.map((i) => (
              <option key={i.id} value={i.id}>
                {i.fund ? `${i.fund} · ` : ''}
                {i.name}
              </option>
            ))}
          </Select>
        </Field>
        {creating && (
          <div className="grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-2">
            <Input placeholder="Name *" value={newInv.name} onChange={(e) => setNewInv({ ...newInv, name: e.target.value })} aria-label="Name" />
            <Input placeholder="Fund / company *" value={newInv.fund} onChange={(e) => setNewInv({ ...newInv, fund: e.target.value })} aria-label="Fund" />
            <Input type="email" placeholder="Email" value={newInv.email} onChange={(e) => setNewInv({ ...newInv, email: e.target.value })} aria-label="Email" />
            <Input type="tel" placeholder="Phone" value={newInv.phone} onChange={(e) => setNewInv({ ...newInv, phone: e.target.value })} aria-label="Phone" />
            <Input
              placeholder="Designation"
              value={newInv.designation}
              onChange={(e) => setNewInv({ ...newInv, designation: e.target.value })}
              aria-label="Designation"
              className="sm:col-span-2"
            />
            <p className="text-xs text-slate-500 sm:col-span-2">They are added to the Investors list too.</p>
          </div>
        )}
        <Field label="Startup" required>
          <Select value={startupId} onChange={(e) => setStartupId(e.target.value)}>
            <option value="">Choose a startup…</option>
            {startups.map((s) => (
              <option key={s.id} value={s.id}>
                #{s.position} {s.name}
              </option>
            ))}
          </Select>
        </Field>
        {existing && (
          <Notice tone="amber">
            This pair is already in the CRM.{' '}
            <button
              className="font-semibold underline"
              onClick={() => {
                onClose()
                onOpenExisting(existing.id)
              }}
            >
              Open it
            </button>
          </Notice>
        )}
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Stage">
            <Select value={stage} onChange={(e) => setStage(e.target.value as CrmStage)}>
              {CRM_STAGES.map((s) => (
                <option key={s} value={s}>
                  {STAGE_META[s].label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Priority">
            <Select value={priority} onChange={(e) => setPriority(e.target.value as CrmPriority)}>
              {(Object.keys(PRIORITY_META) as CrmPriority[]).map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_META[p].label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Owner (RTIH)">
            <Input list="crm-owners-new" value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Who follows up" />
          </Field>
        </div>
        <Field label="First follow-up" hint="Leave the text empty for a standard intro to-do.">
          <div className="grid gap-2 sm:grid-cols-[1fr_150px]">
            <Input value={fuBody} onChange={(e) => setFuBody(e.target.value)} placeholder="e.g. Intro call with the founder" aria-label="First follow-up" />
            <Input type="date" value={fuDue} onChange={(e) => setFuDue(e.target.value)} aria-label="Due date" />
          </div>
        </Field>
        <datalist id="crm-owners-new">
          {owners.map((o) => (
            <option key={o} value={o} />
          ))}
        </datalist>
      </div>
    </Modal>
  )
}

/** Turns the event's investor requests into CRM connections, each with a first follow-up. */
export function ImportEventDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { requests, handling, connections, investors, startups } = useOrganiser()
  const { owners } = useCrm()
  const act = useCrmActions()
  const { toast } = useToast()
  const [archived, setArchived] = useState<InterestRequest[]>([])
  const [useArchived, setUseArchived] = useState(false)
  const [types, setTypes] = useState<Record<ActionType, boolean>>({ meet_today: true, meet_later: true, deck: true })
  const [owner, setOwner] = useState('')
  const [withFollowUps, setWithFollowUps] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setOwner(act.me)
    store.orgListArchivedRequests().then(setArchived, () => setArchived([]))
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const all = useMemo(
    () => eventCandidates(requests, useArchived ? archived : [], handling, connections, investors, startups),
    [requests, archived, useArchived, handling, connections, investors, startups],
  )
  const fromArchiveOnly = useMemo(
    () => eventCandidates([], archived, handling, connections, investors, startups).filter(
      (a) => !eventCandidates(requests, [], handling, connections, investors, startups).some((l) => l.investorId === a.investorId && l.startupId === a.startupId),
    ).length,
    [requests, archived, handling, connections, investors, startups],
  )
  const picked = all.filter((c) => types[c.type])
  const count = (t: ActionType) => all.filter((c) => c.type === t).length
  const invById = new Map(investors.map((i) => [i.id, i]))
  const stById = new Map(startups.map((s) => [s.id, s]))

  const run = async () => {
    setBusy(true)
    const added = await act.addMany(
      picked.map((c) => candidateDraft(c, owner.trim(), act.me)),
      (c) => {
        if (!withFollowUps) return null
        const f = firstFollowUp(c.source, invById.get(c.investorId)?.fund || 'the investor', stById.get(c.startupId)?.name || 'the startup')
        return { kind: 'followup', body: f.body, dueOn: f.dueOn, owner: owner.trim(), createdBy: act.me }
      },
    )
    setBusy(false)
    if (added) {
      toast({ kind: 'success', title: `${added.length} connection${added.length === 1 ? '' : 's'} added to the CRM` })
      onClose()
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => !busy && onClose()}
      wide
      title="Add event interest to the CRM"
      footer={
        <>
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} disabled={!picked.length} onClick={run}>
            Add {picked.length} connection{picked.length === 1 ? '' : 's'}
          </Button>
        </>
      }
    >
      <p className="text-sm text-slate-700">
        One connection per investor and startup, from what investors tapped in the app. Pairs already in the CRM are skipped. A
        Meet today that RTIH approved starts at <b>Meeting set</b>; everything else starts at <b>New interest</b>.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {(['meet_today', 'meet_later', 'deck'] as ActionType[]).map((t) => (
          <label key={t} className="inline-flex cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 text-sm ring-1 ring-inset ring-slate-200">
            <input type="checkbox" checked={types[t]} onChange={(e) => setTypes({ ...types, [t]: e.target.checked })} />
            {ACTION_SHORT[t]} <span className="tabular text-slate-500">({count(t)})</span>
          </label>
        ))}
      </div>
      {fromArchiveOnly > 0 && (
        <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm text-slate-700">
          <input type="checkbox" className="mt-1" checked={useArchived} onChange={(e) => setUseArchived(e.target.checked)} />
          <span>
            Also include {fromArchiveOnly} pair{fromArchiveOnly === 1 ? '' : 's'} from interest cleared by <b>Restart queue</b> (leave off if
            that was a test run).
          </span>
        </label>
      )}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Owner for all of them" hint="Change any one later.">
          <Input list="crm-owners-import" value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Leave empty for unassigned" />
        </Field>
        <label className="flex cursor-pointer items-start gap-2 self-center text-sm text-slate-700">
          <input type="checkbox" className="mt-1" checked={withFollowUps} onChange={(e) => setWithFollowUps(e.target.checked)} />
          <span>Create a first follow-up for each (due in 1–3 days)</span>
        </label>
      </div>
      <datalist id="crm-owners-import">
        {owners.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
      {picked.length > 0 ? (
        <ul className="mt-3 max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200 text-sm">
          {picked.map((c) => {
            const i = invById.get(c.investorId)
            const s = stById.get(c.startupId)
            return (
              <li key={`${c.investorId}|${c.startupId}`} className="flex items-center gap-2 px-3 py-1.5">
                <span className="min-w-0 flex-1 truncate">
                  <b className="font-semibold text-slate-950">{i?.fund || i?.name}</b> <span className="text-slate-500">({i?.name})</span>{' '}
                  <span className="text-slate-400">→</span> {s?.name}
                </span>
                <span className="shrink-0 text-xs text-slate-500">
                  {ACTION_SHORT[c.type]}
                  {c.archived ? ' · archived' : ''}
                </span>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-slate-500">Nothing new to add: every request is already in the CRM.</p>
      )}
    </Modal>
  )
}
