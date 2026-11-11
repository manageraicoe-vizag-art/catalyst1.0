import { FileDown, Upload } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button, Field, Modal, Notice, Segmented, Textarea } from '../../components/ui'
import { useOrganiser } from '../../context/Organiser'
import { useToast } from '../../context/Toast'
import { store } from '../../lib/store'
import type { PrivateDraft, StartupDraft } from '../../lib/store/types'
import { downloadFile, parseDelimited } from '../../lib/utils'

const ALIASES: Record<string, string[]> = {
  order: ['order', 'position', 'pitch_order', 's_no', 'sl_no', 'sno', 'no', 'sr_no', 'serial'],
  name: ['name', 'startup', 'startup_name', 'company', 'company_name'],
  sector: ['sector', 'industry', 'domain', 'category'],
  description: ['description', 'short_description', 'tagline', 'one_liner', 'oneliner', 'about'],
  stage: ['stage', 'funding_stage'],
  city: ['city', 'location'],
  founders: ['founders', 'founder', 'founder_names', 'founder_name'],
  website: ['website', 'url', 'web'],
  problem: ['problem'],
  solution: ['solution', 'product'],
  market: ['market', 'market_size'],
  traction: ['traction'],
  businessModel: ['business_model', 'revenue_model'],
  team: ['team'],
  ask: ['ask', 'funding_ask', 'raise', 'raising'],
  onePagerUrl: ['one_pager', 'one_pager_url', 'onepager', 'one_pager_link'],
  deckUrl: ['deck', 'deck_url', 'pitch_deck', 'deck_link', 'pitch_deck_link'],
  contactName: ['contact_name', 'contact_person'],
  contactEmail: ['contact_email', 'email', 'founder_email'],
  contactPhone: ['contact_phone', 'phone', 'founder_phone', 'mobile'],
  notes: ['notes', 'organiser_notes', 'review_notes', 'internal_notes'],
}

const TEMPLATE_COLS = ['order', 'name', 'sector', 'stage', 'description', 'problem', 'solution', 'market', 'traction', 'business_model', 'team', 'ask', 'founders', 'city', 'website', 'one_pager_url', 'deck_url', 'contact_name', 'contact_email', 'contact_phone', 'notes']

function pick(row: Record<string, string>, key: string): string {
  for (const a of ALIASES[key] ?? [key]) if (row[a] !== undefined && row[a] !== '') return row[a]!
  return ''
}

export function ImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { startups, reload } = useOrganiser()
  const { toast } = useToast()
  const [text, setText] = useState('')
  const [mode, setMode] = useState<'append' | 'replace'>('append')
  const [confirmReplace, setConfirmReplace] = useState(false)
  const [busy, setBusy] = useState(false)

  const parsed = useMemo(() => {
    const rows = parseDelimited(text)
    const items = rows
      .map((r, i) => ({ order: Number(pick(r, 'order')) || i + 1, row: r }))
      .filter((x) => pick(x.row, 'name'))
      .sort((a, b) => a.order - b.order)
    return { rows, items, headers: rows[0] ? Object.keys(rows[0]) : [] }
  }, [text])

  const onFile = async (file: File) => setText(await file.text())

  const run = async () => {
    if (!parsed.items.length) return
    if (mode === 'replace' && !confirmReplace) {
      setConfirmReplace(true)
      return
    }
    setBusy(true)
    try {
      if (mode === 'replace') for (const s of startups) await store.orgDeleteStartup(s.id)
      const base = mode === 'replace' ? 0 : startups.reduce((m, s) => Math.max(m, s.position), 0)
      let i = 0
      for (const { row } of parsed.items) {
        i++
        const draft: StartupDraft = {
          name: pick(row, 'name'),
          sector: pick(row, 'sector'),
          description: pick(row, 'description'),
          stage: pick(row, 'stage'),
          city: pick(row, 'city'),
          founders: pick(row, 'founders'),
          website: pick(row, 'website'),
          problem: pick(row, 'problem'),
          solution: pick(row, 'solution'),
          market: pick(row, 'market'),
          traction: pick(row, 'traction'),
          businessModel: pick(row, 'businessModel'),
          team: pick(row, 'team'),
          ask: pick(row, 'ask'),
          onePagerUrl: pick(row, 'onePagerUrl'),
          position: base + i,
        }
        const priv: PrivateDraft = {
          deckUrl: pick(row, 'deckUrl'),
          contactName: pick(row, 'contactName'),
          contactEmail: pick(row, 'contactEmail'),
          contactPhone: pick(row, 'contactPhone'),
          notes: pick(row, 'notes'),
        }
        await store.orgSaveStartup(draft, priv)
      }
      await reload()
      toast({ title: `Imported ${parsed.items.length} startups`, body: 'Investors see the new list immediately.' })
      setText('')
      setConfirmReplace(false)
      onClose()
    } catch (e) {
      toast({ kind: 'error', title: 'Import stopped', body: (e as Error).message })
      await reload()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title="Import startups"
      footer={
        <>
          <Button variant="ghost" icon={<FileDown className="h-4 w-4" />} onClick={() => downloadFile('catalyst-startups-template.csv', TEMPLATE_COLS.join(',') + '\n')} className="mr-auto">
            Template
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={confirmReplace ? 'danger' : 'primary'} loading={busy} disabled={!parsed.items.length} onClick={run}>
            {confirmReplace
              ? `Yes, delete ${startups.length} and import ${parsed.items.length}`
              : `Import ${parsed.items.length || ''} startups`}
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm text-slate-600">
        Copy the shared startup sheet (with its header row) and paste it below, or upload a CSV. Rows are imported in
        pitch order (an <code className="text-brand-800">order</code> / <code className="text-brand-800">S.No</code> column is
        used if present). Columns are matched by name: name, sector, description, stage, problem, solution, market,
        traction, business model, team, ask, founders, city, website, one-pager URL, deck URL, contact name/email/phone.
      </p>
      <Field label="Paste rows (CSV or tab-separated from Google Sheets / Excel)" htmlFor="imp-text">
        <Textarea id="imp-text" rows={8} value={text} onChange={(e) => setText(e.target.value)} className="font-mono text-xs" placeholder={'name\tsector\tdescription\nTideSense\tAquaTech\tIoT water-quality sensors…'} />
      </Field>
      <label className="mt-2 inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-brand-700">
        <Upload className="h-4 w-4" aria-hidden />
        Upload .csv
        <input type="file" accept=".csv,.tsv,text/csv,text/plain" className="sr-only" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
      </label>

      {text && (
        <div className="mt-4 rounded-xl bg-slate-100 p-3 text-sm ring-1 ring-inset ring-slate-200">
          <p className="font-medium text-slate-900">
            {parsed.items.length} startups found{parsed.rows.length > parsed.items.length && ` (${parsed.rows.length - parsed.items.length} rows skipped: no name)`}
          </p>
          <p className="mt-1 text-xs text-slate-500">Columns: {parsed.headers.join(', ') || '—'}</p>
          {parsed.items.length > 0 && (
            <ol className="mt-2 max-h-40 list-decimal overflow-auto pl-5 text-slate-700">
              {parsed.items.map(({ row }, i) => (
                <li key={i}>
                  {pick(row, 'name')} <span className="text-slate-500">· {pick(row, 'sector')}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Segmented
          value={mode}
          onChange={(m) => {
            setMode(m)
            setConfirmReplace(false)
          }}
          options={[
            { value: 'append', label: 'Add to current list' },
            { value: 'replace', label: 'Replace current list' },
          ]}
        />
      </div>
      {mode === 'replace' && startups.length > 0 && (
        <Notice tone="amber" className="mt-3">
          Replacing deletes the {startups.length} current startups <strong>and every investor request for them</strong>. Use
          this before the event (for example to remove sample data), not during it.
        </Notice>
      )}
    </Modal>
  )
}
