import { Lock, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button, Field, Input, Modal, Select, Textarea } from '../../components/ui'
import { useOrganiser } from '../../context/Organiser'
import { useToast } from '../../context/Toast'
import { store } from '../../lib/store'
import type { PrivateDraft, StartupDraft } from '../../lib/store/types'
import type { Startup, StartupStatus } from '../../lib/types'

const BLANK: StartupDraft = {
  name: '',
  sector: '',
  description: '',
  city: '',
  stage: '',
  founders: '',
  website: '',
  problem: '',
  solution: '',
  market: '',
  traction: '',
  businessModel: '',
  team: '',
  ask: '',
  onePagerUrl: '',
}
const BLANK_PRIV: PrivateDraft = { deckUrl: '', contactName: '', contactEmail: '', contactPhone: '', notes: '' }

export function StartupEditor({
  startup,
  open,
  onClose,
}: {
  startup: Startup | null
  open: boolean
  onClose: () => void
}) {
  const { privates, reload } = useOrganiser()
  const { toast } = useToast()
  const [d, setD] = useState<StartupDraft>(BLANK)
  const [p, setP] = useState<PrivateDraft>(BLANK_PRIV)
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (!open) return
    setConfirmDelete(false)
    if (startup) {
      const { updatedAt: _u, ...rest } = startup
      void _u
      setD(rest)
      const pv = privates.get(startup.id)
      setP(pv ? { deckUrl: pv.deckUrl, contactName: pv.contactName, contactEmail: pv.contactEmail, contactPhone: pv.contactPhone, notes: pv.notes } : BLANK_PRIV)
    } else {
      setD(BLANK)
      setP(BLANK_PRIV)
    }
  }, [open, startup?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const f = (k: keyof StartupDraft) => (e: { target: { value: string } }) => setD((x) => ({ ...x, [k]: e.target.value }))
  const fp = (k: keyof PrivateDraft) => (e: { target: { value: string } }) => setP((x) => ({ ...x, [k]: e.target.value }))

  const save = async () => {
    if (!d.name.trim()) {
      toast({ kind: 'error', title: 'Startup name is required' })
      return
    }
    setBusy(true)
    try {
      if (d.status === 'pitching' && startup?.status !== 'pitching') {
        await store.orgSaveStartup({ ...d, status: startup?.status ?? 'queued' }, p)
        if (startup) await store.orgSetPitching(startup.id)
      } else {
        await store.orgSaveStartup(d, p)
      }
      await Promise.all([reload('startups'), reload('private')])
      toast({ title: startup ? 'Startup updated' : 'Startup added', body: 'Investors see the change immediately.' })
      onClose()
    } catch (e) {
      toast({ kind: 'error', title: 'Could not save', body: (e as Error).message })
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!startup) return
    setBusy(true)
    try {
      await store.orgDeleteStartup(startup.id)
      await reload()
      toast({ title: `${startup.name} removed` })
      onClose()
    } catch (e) {
      toast({ kind: 'error', title: 'Could not delete', body: (e as Error).message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={startup ? `Edit ${startup.name}` : 'Add startup'}
      footer={
        <>
          {startup &&
            (confirmDelete ? (
              <Button variant="danger" loading={busy} onClick={remove} className="mr-auto">
                Delete startup and its requests
              </Button>
            ) : (
              <Button variant="ghost" onClick={() => setConfirmDelete(true)} className="mr-auto" icon={<Trash2 className="h-4 w-4" />}>
                Delete
              </Button>
            ))}
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} onClick={save}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Startup name" required htmlFor="se-name">
          <Input id="se-name" value={d.name} onChange={f('name')} />
        </Field>
        <Field label="Sector" htmlFor="se-sector">
          <Input id="se-sector" value={d.sector} onChange={f('sector')} placeholder="e.g. AgriTech" />
        </Field>
        <Field label="Short description" className="sm:col-span-2" hint="One line, shown on the startup list." htmlFor="se-desc">
          <Input id="se-desc" value={d.description} onChange={f('description')} maxLength={180} />
        </Field>
        <Field label="Stage" htmlFor="se-stage">
          <Input id="se-stage" value={d.stage} onChange={f('stage')} placeholder="Pre-seed, Seed, Series A…" />
        </Field>
        <Field label="City" htmlFor="se-city">
          <Input id="se-city" value={d.city} onChange={f('city')} />
        </Field>
        <Field label="Founders" htmlFor="se-founders">
          <Input id="se-founders" value={d.founders} onChange={f('founders')} />
        </Field>
        <Field label="Website" htmlFor="se-web">
          <Input id="se-web" value={d.website} onChange={f('website')} />
        </Field>
        {startup && (
          <Field label="Pitch status" htmlFor="se-status">
            <Select id="se-status" value={d.status} onChange={(e) => setD((x) => ({ ...x, status: e.target.value as StartupStatus }))}>
              <option value="queued">Queued</option>
              <option value="pitching">Now pitching</option>
              <option value="done">Pitched</option>
            </Select>
          </Field>
        )}
        {startup && (
          <Field label="Visible to investors" htmlFor="se-hidden">
            <Select id="se-hidden" value={d.hidden ? 'hidden' : 'visible'} onChange={(e) => setD((x) => ({ ...x, hidden: e.target.value === 'hidden' }))}>
              <option value="visible">Visible</option>
              <option value="hidden">Hidden</option>
            </Select>
          </Field>
        )}
      </div>

      <h3 className="eyebrow mb-3 mt-6">One-page summary (shown to investors)</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        {(
          [
            ['problem', 'Problem'],
            ['solution', 'Solution'],
            ['market', 'Market'],
            ['traction', 'Traction'],
            ['businessModel', 'Business model'],
            ['team', 'Team'],
            ['ask', 'The ask'],
          ] as const
        ).map(([k, label]) => (
          <Field key={k} label={label} htmlFor={`se-${k}`} className={k === 'ask' ? 'sm:col-span-2' : undefined}>
            <Textarea id={`se-${k}`} value={d[k]} onChange={f(k)} rows={3} />
          </Field>
        ))}
        <Field label="One-pager PDF link (optional)" className="sm:col-span-2" hint="Public link investors can open on their phone." htmlFor="se-op">
          <Input id="se-op" value={d.onePagerUrl} onChange={f('onePagerUrl')} placeholder="https://…" />
        </Field>
      </div>

      <h3 className="eyebrow mb-3 mt-6 flex items-center gap-1.5">
        <Lock className="h-3.5 w-3.5" aria-hidden /> Organisers only
      </h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Pitch deck link" className="sm:col-span-2" hint="Never shown to investors. Shared per request when you approve a deck request." htmlFor="se-deck">
          <Input id="se-deck" value={p.deckUrl} onChange={fp('deckUrl')} placeholder="https://drive.google.com/…" />
        </Field>
        <Field label="Founder contact name" htmlFor="se-cn">
          <Input id="se-cn" value={p.contactName} onChange={fp('contactName')} />
        </Field>
        <Field label="Founder email" htmlFor="se-ce">
          <Input id="se-ce" value={p.contactEmail} onChange={fp('contactEmail')} />
        </Field>
        <Field label="Founder phone" htmlFor="se-cp">
          <Input id="se-cp" value={p.contactPhone} onChange={fp('contactPhone')} />
        </Field>
        <Field label="Notes" htmlFor="se-notes">
          <Input id="se-notes" value={p.notes} onChange={fp('notes')} />
        </Field>
      </div>
    </Modal>
  )
}
