import { Check, FileUp, Loader2, TriangleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Badge, Button, Modal, Select } from '../../components/ui'
import { useOrganiser } from '../../context/Organiser'
import { useToast } from '../../context/Toast'
import { putLocalDeck } from '../../lib/localDecks'
import { EVENT_SCHEDULE } from '../../lib/stage'
import { store } from '../../lib/store'
import type { Startup } from '../../lib/types'

const squash = (s: string) => s.toLowerCase().replace(/\.pdf$/i, '').replace(/[^a-z0-9]/g, '')

/** Name fragments that identify a startup: its name, the parts in brackets, and the schedule's aliases. */
function keysFor(s: Startup): string[] {
  const keys = new Set<string>([squash(s.name), ...s.name.split(/[()]/).map(squash)])
  for (const slot of EVENT_SCHEDULE.slots) if (slot.match.some((m) => squash(s.name).includes(m))) slot.match.forEach((m) => keys.add(m))
  return [...keys].filter((k) => k.length >= 4)
}

/** Best startup for a file name (longest matching name fragment wins), or '' if none. */
function guess(fileName: string, startups: Startup[]): string {
  const f = squash(fileName)
  let best = ''
  let len = 0
  for (const s of startups)
    for (const k of keysFor(s))
      if ((f.includes(k) || k.includes(f)) && k.length > len) {
        best = s.id
        len = k.length
      }
  return best
}

type Row = { file: File; startupId: string; state: 'ready' | 'uploading' | 'done' | 'error'; error?: string }

/** Upload many deck PDFs at once (e.g. a folder of downloaded decks); each is matched to a startup by file name. */
export function DeckUploadDialog({ files, onClose }: { files: File[]; onClose: () => void }) {
  const { startups, deckFiles, reload } = useOrganiser()
  const { toast } = useToast()
  const [rows, setRows] = useState<Row[]>([])
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    setRows(files.map((file) => ({ file, startupId: guess(file.name, startups), state: 'ready' })))
  }, [files]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  const chosen = rows.filter((r) => r.startupId && r.state !== 'done')
  const dupes = new Set(rows.map((r) => r.startupId).filter((id, i, a) => id && a.indexOf(id) !== i))

  const upload = async () => {
    setBusy(true)
    let ok = 0
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]!
      if (!r.startupId || r.state === 'done') continue
      set(i, { state: 'uploading', error: undefined })
      try {
        const data = await r.file.arrayBuffer()
        if (new TextDecoder().decode(new Uint8Array(data, 0, Math.min(5, data.byteLength))) !== '%PDF-') throw new Error('Not a PDF file')
        await store.orgUploadDeck(r.startupId, r.file)
        set(i, { state: 'done' })
        ok++
        // keep a copy on this device too, so presenting here needs no download
        const v = (await store.orgListDeckFiles()).get(r.startupId)
        if (v) await putLocalDeck({ startupId: r.startupId, name: r.file.name, size: r.file.size, savedAt: v, data })
      } catch (e) {
        set(i, { state: 'error', error: (e as Error).message })
      }
    }
    await reload('decks')
    setBusy(false)
    if (ok) toast({ kind: 'success', title: `${ok} deck${ok === 1 ? '' : 's'} uploaded`, body: 'They show when presenting and on the projector.' })
  }

  const done = rows.length > 0 && rows.every((r) => r.state === 'done' || !r.startupId)
  return (
    <Modal
      open={files.length > 0}
      onClose={() => !busy && onClose()}
      wide
      title="Upload deck PDFs"
      footer={
        <>
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            {done ? 'Close' : 'Cancel'}
          </Button>
          {!done && (
            <Button icon={<FileUp className="h-4 w-4" />} loading={busy} disabled={!chosen.length || dupes.size > 0} onClick={upload}>
              Upload {chosen.length} deck{chosen.length === 1 ? '' : 's'}
            </Button>
          )}
        </>
      }
    >
      <p className="mb-3 text-sm text-slate-700">
        Each file is matched to a startup by its name; change any match below. Uploaded decks replace earlier ones and show when
        presenting and on the projector.
      </p>
      {dupes.size > 0 && <p className="mb-3 text-sm text-amber-600">Two files are matched to the same startup: pick one of them.</p>}
      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
        {rows.map((r, i) => (
          <li key={r.file.name + i} className="flex flex-wrap items-center gap-2 px-3 py-2 sm:flex-nowrap">
            <span className="min-w-0 flex-1 truncate text-slate-950" title={r.file.name}>
              {r.file.name}
              <span className="ml-2 text-xs text-slate-500">{Math.max(1, Math.round(r.file.size / 1024))} KB</span>
            </span>
            <Select
              aria-label={`Startup for ${r.file.name}`}
              value={r.startupId}
              disabled={busy || r.state === 'done'}
              onChange={(e) => set(i, { startupId: e.target.value, state: 'ready', error: undefined })}
              className="w-full sm:w-64"
            >
              <option value="">Skip this file</option>
              {startups.map((s) => (
                <option key={s.id} value={s.id}>
                  #{s.position} {s.name}
                  {deckFiles.has(s.id) ? ' (has a deck)' : ''}
                </option>
              ))}
            </Select>
            <span className="w-24 shrink-0 text-right">
              {r.state === 'uploading' && <Loader2 className="ml-auto h-4 w-4 animate-spin text-slate-500" aria-label="Uploading" />}
              {r.state === 'done' && (
                <Badge tone="go">
                  <Check className="h-3 w-3" aria-hidden /> Uploaded
                </Badge>
              )}
              {r.state === 'error' && (
                <span className="inline-flex items-center gap-1 text-xs text-amber-600" title={r.error}>
                  <TriangleAlert className="h-3.5 w-3.5" aria-hidden /> Failed
                </span>
              )}
              {r.state === 'ready' && !r.startupId && <span className="text-xs text-slate-400">No match</span>}
            </span>
            {r.state === 'error' && <p className="w-full text-xs text-amber-600">{r.error}</p>}
          </li>
        ))}
      </ul>
    </Modal>
  )
}
