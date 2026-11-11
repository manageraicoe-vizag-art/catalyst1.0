import { AlertTriangle, Send } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { NoticeCard } from '../../components/NoticeCard'
import { Button, Field, Input, Modal, Notice, Select, Textarea } from '../../components/ui'
import { useOrganiser } from '../../context/Organiser'
import { useToast } from '../../context/Toast'
import { ACTION_LABEL } from '../../lib/constants'
import { store } from '../../lib/store'
import type { InterestRequest } from '../../lib/types'
import { formatMeetingAt } from '../../lib/utils'
import { useLookups } from './shared'

const OTHER = '__other__'

export function ApproveDialog({ request, onClose }: { request: InterestRequest | null; onClose: () => void }) {
  const { settings, privates, handling, requests, reload } = useOrganiser()
  const { investorById, startupById } = useLookups()
  const { toast } = useToast()
  const [room, setRoom] = useState('')
  const [customRoom, setCustomRoom] = useState('')
  const [meetingAt, setMeetingAt] = useState('')
  const [deckLink, setDeckLink] = useState('')
  const [message, setMessage] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState<'save' | 'notify' | null>(null)

  const h = request ? handling.get(request.id) : undefined
  const inv = request ? investorById.get(request.investorId) : undefined
  const s = request ? startupById.get(request.startupId) : undefined
  const isDeck = request?.type === 'deck'

  useEffect(() => {
    if (!request) return
    const existingRoom = h?.room ?? ''
    const inList = settings.rooms.includes(existingRoom)
    setRoom(existingRoom ? (inList ? existingRoom : OTHER) : '')
    setCustomRoom(existingRoom && !inList ? existingRoom : '')
    setMeetingAt(h?.meetingAt ?? '')
    setDeckLink(h?.deckLink || privates.get(request.startupId)?.deckUrl || '')
    setMessage(h?.message ?? '')
    setNote(h?.organiserNote ?? '')
  }, [request?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const finalRoom = room === OTHER ? customRoom.trim() : room

  // Same room + same time already approved for another request?
  const conflict = useMemo(() => {
    if (!request || isDeck || !finalRoom || !meetingAt) return null
    const clash = requests.find((r) => {
      if (r.id === request.id || !r.active || r.type === 'deck') return false
      const oh = handling.get(r.id)
      return oh?.status === 'approved' && oh.room === finalRoom && oh.meetingAt === meetingAt
    })
    if (!clash) return null
    return `${startupById.get(clash.startupId)?.name ?? 'Another meeting'} with ${investorById.get(clash.investorId)?.fund ?? 'an investor'}`
  }, [request, isDeck, finalRoom, meetingAt, requests, handling, startupById, investorById])

  if (!request) return null

  const validate = (): string | null => {
    if (isDeck) return deckLink.trim() ? null : 'Add the deck link to share (or save without notifying).'
    if (!finalRoom) return 'Choose a room.'
    if (!meetingAt) return request.type === 'meet_today' ? 'Set the meeting time.' : 'Set a date and time, or note it in the message.'
    return null
  }

  const save = async (notify: boolean) => {
    if (notify) {
      const err = validate()
      if (err) {
        toast({ kind: 'error', title: err })
        return
      }
    }
    setBusy(notify ? 'notify' : 'save')
    try {
      await store.orgSaveHandling(request.id, {
        status: 'approved',
        room: isDeck ? '' : finalRoom,
        meetingAt: isDeck ? '' : meetingAt,
        deckLink: deckLink.trim(),
        message: message.trim(),
        organiserNote: note.trim(),
      })
      if (notify) await store.orgNotify(request.id)
      await Promise.all([reload('handling'), reload('notices')])
      toast({
        title: notify ? `Sent to ${inv?.name ?? 'investor'}` : 'Approval saved',
        body: notify ? 'Only this investor can see these details.' : 'Not yet visible to the investor. Use “Notify” when ready.',
      })
      onClose()
    } catch (e) {
      toast({ kind: 'error', title: 'Could not save', body: (e as Error).message })
    } finally {
      setBusy(null)
    }
  }

  const preview = {
    id: 'preview',
    investorId: request.investorId,
    requestId: request.id,
    startupId: request.startupId,
    type: request.type,
    room: isDeck ? '' : finalRoom,
    meetingAt: isDeck ? '' : meetingAt,
    deckLink: deckLink.trim(),
    message: message.trim(),
    createdAt: new Date().toISOString(),
    readAt: 'x',
  }

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={isDeck ? 'Share pitch deck' : 'Approve meeting'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="secondary" loading={busy === 'save'} disabled={!!busy} onClick={() => save(false)}>
            Save approval only
          </Button>
          <Button loading={busy === 'notify'} disabled={!!busy} icon={<Send className="h-4 w-4" />} onClick={() => save(true)}>
            {h?.notifiedAt ? 'Save & re-send to investor' : 'Approve & notify investor'}
          </Button>
        </>
      }
    >
      <div className="mb-4 rounded-xl bg-slate-100 p-3 text-sm ring-1 ring-inset ring-slate-200">
        <p className="font-semibold text-slate-950">
          {inv?.name} · {inv?.fund}
        </p>
        <p className="text-slate-600">
          {ACTION_LABEL[request.type]} · <span className="font-medium text-slate-900">#{s?.position} {s?.name}</span>
        </p>
        {!request.active && <p className="mt-1 font-medium text-red-700">The investor has withdrawn this request.</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {isDeck ? (
          <Field
            label="Deck link to share"
            className="sm:col-span-2"
            hint="Pre-filled from the startup’s private deck link. Use a view-only link."
            htmlFor="ad-deck"
          >
            <Input id="ad-deck" value={deckLink} onChange={(e) => setDeckLink(e.target.value)} placeholder="https://drive.google.com/…" />
          </Field>
        ) : (
          <>
            <Field label="Meeting room" htmlFor="ad-room">
              <Select id="ad-room" value={room} onChange={(e) => setRoom(e.target.value)}>
                <option value="">Choose a room…</option>
                {settings.rooms.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
                {settings.allowCustomRoom && <option value={OTHER}>Other (type it)…</option>}
              </Select>
              {room === OTHER && (
                <Input className="mt-2" value={customRoom} onChange={(e) => setCustomRoom(e.target.value)} placeholder="e.g. Cafeteria corner" aria-label="Custom room" />
              )}
            </Field>
            <Field
              label={request.type === 'meet_today' ? 'Time today' : 'Date & time'}
              htmlFor="ad-time"
              hint={meetingAt ? formatMeetingAt(meetingAt, request.type === 'meet_today' ? settings.date : undefined) : undefined}
            >
              <Input
                id="ad-time"
                type={request.type === 'meet_today' ? 'time' : 'datetime-local'}
                value={meetingAt}
                onChange={(e) => setMeetingAt(e.target.value)}
                step={300}
              />
            </Field>
            {conflict && (
              <Notice tone="amber" className="sm:col-span-2" icon={<AlertTriangle className="h-4 w-4" />}>
                {finalRoom} is already approved at this time for {conflict}.
              </Notice>
            )}
          </>
        )}
        <Field label="Message to the investor (optional)" className="sm:col-span-2" htmlFor="ad-msg">
          <Textarea
            id="ad-msg"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={isDeck ? 'e.g. Please keep the deck confidential.' : 'e.g. Please arrive 5 minutes early; the founders will meet you at the room.'}
          />
        </Field>
        <Field label="Internal note (organisers only)" className="sm:col-span-2" htmlFor="ad-note">
          <Input id="ad-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Not shown to the investor" />
        </Field>
      </div>

      <div className="mt-5">
        <p className="eyebrow mb-2">What {inv?.name.split(' ')[0] ?? 'the investor'} will see</p>
        <NoticeCard notice={preview} startup={s} eventDate={settings.date} />
        <p className="mt-2 text-xs text-slate-500">
          Nothing is sent to the founders. Only this investor sees these details, and only after you notify them.
        </p>
      </div>
    </Modal>
  )
}
