import { Database, Download, KeyRound, QrCode as QrIcon, RotateCcw, Trash2 } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { QrCode } from '../../components/Qr'
import { Button, Field, Input, Modal, Notice, PageHeader, Textarea } from '../../components/ui'
import { useOrganiser } from '../../context/Organiser'
import { useToast } from '../../context/Toast'
import { demoStore, isDemo, store } from '../../lib/store'
import type { EventSettings } from '../../lib/types'
import { downloadFile, eventLink } from '../../lib/utils'

export function SettingsPage() {
  const { settings, reload, canEdit, organiser } = useOrganiser()
  const { toast } = useToast()
  const [s, setS] = useState<EventSettings>(settings)
  const [roomsText, setRoomsText] = useState(settings.rooms.join('\n'))
  const [fundsText, setFundsText] = useState(settings.participatingFunds.join('\n'))
  const [busy, setBusy] = useState(false)
  const [qr, setQr] = useState(false)
  const [confirm, setConfirm] = useState<null | 'clear' | 'reset'>(null)
  const demo = demoStore()

  useEffect(() => {
    setS(settings)
    setRoomsText(settings.rooms.join('\n'))
    setFundsText(settings.participatingFunds.join('\n'))
  }, [settings])

  const f = (k: keyof EventSettings) => (e: { target: { value: string } }) => setS((x) => ({ ...x, [k]: e.target.value }))
  const lines = (t: string) => t.split('\n').map((x) => x.trim()).filter(Boolean)

  const save = async () => {
    setBusy(true)
    try {
      await store.orgSaveSettings({ ...s, rooms: lines(roomsText), participatingFunds: lines(fundsText) })
      await reload('settings')
      toast({ title: 'Settings saved' })
    } catch (e) {
      toast({ kind: 'error', title: 'Could not save', body: (e as Error).message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Settings"
        subtitle={canEdit ? undefined : 'Your organiser access is view-only. Ask an editor to change event settings.'}
        actions={canEdit ? <Button loading={busy} onClick={save}>Save settings</Button> : undefined}
      />

      <MyAccount email={organiser?.email ?? ''} role={organiser?.role ?? 'viewer'} />

      {/* A disabled fieldset makes every control inside read-only for viewers */}
      <fieldset disabled={!canEdit} className="min-w-0 disabled:opacity-80">
      <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 font-semibold text-slate-950">Event</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Event name" htmlFor="st-name">
            <Input id="st-name" value={s.eventName} onChange={f('eventName')} />
          </Field>
          <Field label="Event title" htmlFor="st-title">
            <Input id="st-title" value={s.eventTitle} onChange={f('eventTitle')} />
          </Field>
          <Field label="Tagline" className="sm:col-span-2" htmlFor="st-tag">
            <Input id="st-tag" value={s.tagline} onChange={f('tagline')} />
          </Field>
          <Field label="Date" htmlFor="st-date">
            <Input id="st-date" type="date" value={s.date} onChange={f('date')} />
          </Field>
          <Field label="Hours" htmlFor="st-hours">
            <Input id="st-hours" value={s.hours} onChange={f('hours')} />
          </Field>
          <Field label="Venue" htmlFor="st-venue">
            <Input id="st-venue" value={s.venue} onChange={f('venue')} />
          </Field>
          <Field label="Organiser" htmlFor="st-org">
            <Input id="st-org" value={s.organiserName} onChange={f('organiserName')} />
          </Field>
        </div>
      </section>

      <section className="mb-6 grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
        <div>
          <h2 className="mb-1 font-semibold text-slate-950">Meeting rooms</h2>
          <p className="mb-3 text-xs text-slate-500">One per line. Organisers pick from this list when approving meetings.</p>
          <Textarea value={roomsText} onChange={(e) => setRoomsText(e.target.value)} rows={7} aria-label="Meeting rooms" />
          <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={s.allowCustomRoom} onChange={(e) => setS((x) => ({ ...x, allowCustomRoom: e.target.checked }))} className="h-4 w-4 accent-[#ffacb7]" />
            Also allow typing a room that is not on the list
          </label>
        </div>
        <div>
          <h2 className="mb-1 font-semibold text-slate-950">Participating funds</h2>
          <p className="mb-3 text-xs text-slate-500">Suggested on the investor form so fund names match on the live board.</p>
          <Textarea value={fundsText} onChange={(e) => setFundsText(e.target.value)} rows={7} aria-label="Participating funds" />
        </div>
      </section>
      </fieldset>

      <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-1 font-semibold text-slate-950">Event link</h2>
        <p className="mb-3 break-all text-sm text-slate-600">{eventLink()}</p>
        <Button variant="secondary" size="sm" icon={<QrIcon className="h-4 w-4" />} onClick={() => setQr(true)}>
          Show / download QR code
        </Button>
      </section>

      <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-1 flex items-center gap-2 font-semibold text-slate-950">
          <Database className="h-4 w-4" aria-hidden /> Data
        </h2>
        {isDemo && demo && canEdit ? (
          <>
            <Notice tone="amber" className="mb-3">
              Demo mode: data lives only in this browser. For the event, connect Supabase (see README) so every phone
              shares one live database.
            </Notice>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" icon={<Download className="h-4 w-4" />} onClick={() => downloadFile('catalyst-demo-data.json', demo.exportJson(), 'application/json')}>
                Export JSON
              </Button>
              <Button variant="secondary" size="sm" icon={<Trash2 className="h-4 w-4" />} onClick={() => setConfirm('clear')}>
                Remove sample data
              </Button>
              <Button variant="danger" size="sm" icon={<RotateCcw className="h-4 w-4" />} onClick={() => setConfirm('reset')}>
                Reset demo
              </Button>
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-600">
            Live mode (Supabase). Organiser access is controlled by the <code className="text-brand-800">organisers</code> table; see the README.
            Use the Export buttons on Requests, Meetings and Investors for CSV backups.
          </p>
        )}
      </section>

      <Modal open={qr} onClose={() => setQr(false)} title="Event QR code">
        <div className="flex flex-col items-center gap-3">
          <QrCode value={eventLink()} size={240} filename="catalyst-event-qr.png" />
          <p className="text-center text-xs text-slate-500">One code for the whole event. Print it at the entrance and on tables.</p>
        </div>
      </Modal>

      <Modal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title={confirm === 'reset' ? 'Reset demo data?' : 'Remove sample data?'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                if (confirm === 'reset') demo?.resetAll()
                else demo?.clearSample()
                setConfirm(null)
                await reload()
                toast({ title: confirm === 'reset' ? 'Demo reset' : 'Sample data removed' })
              }}
            >
              {confirm === 'reset' ? 'Reset everything' : 'Remove sample startups & investors'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-700">
          {confirm === 'reset'
            ? 'Restores the original sample startups, investors and requests in this browser.'
            : 'Deletes the fictional sample startups, investors and requests in this browser, keeping anything you added.'}
        </p>
      </Modal>
    </div>
  )
}

function MyAccount({ email, role }: { email: string; role: 'editor' | 'viewer' }) {
  const { toast } = useToast()
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (pw.length < 10) return setError('Use at least 10 characters.')
    if (pw !== pw2) return setError('The two passwords do not match.')
    setBusy(true)
    try {
      await store.orgChangePassword(pw)
      setPw('')
      setPw2('')
      toast({ title: 'Password changed', body: 'Use the new password next time you sign in.' })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="mb-1 flex items-center gap-2 font-semibold text-slate-950">
        <KeyRound className="h-4 w-4" aria-hidden /> My account
      </h2>
      <p className="mb-4 text-sm text-slate-600">
        Signed in as <strong className="text-slate-900">{email}</strong> ·{' '}
        {role === 'editor' ? 'Editor (full control)' : 'Viewer (read-only overview)'}
      </p>
      {isDemo ? (
        <p className="text-sm text-slate-500">Passwords apply once the live database is connected.</p>
      ) : (
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <Field label="New password" htmlFor="pw1">
            <Input id="pw1" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
          </Field>
          <Field label="Repeat new password" htmlFor="pw2">
            <Input id="pw2" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
          </Field>
          <Button type="submit" loading={busy} variant="secondary">
            Change password
          </Button>
          {error && <Notice tone="amber" className="sm:col-span-3">{error}</Notice>}
        </form>
      )}
    </section>
  )
}
