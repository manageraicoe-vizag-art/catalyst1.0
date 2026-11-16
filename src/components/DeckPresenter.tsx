import { ChevronLeft, ChevronRight, Download, ExternalLink, FileUp, Loader2, Maximize, Minimize, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { deckSource, probeDeckLink } from '../lib/deckSource'
import { useOrganiser } from '../context/Organiser'
import { fetchDeck } from '../lib/decks'
import { getLocalDeck, putLocalDeck, removeLocalDeck, saveLocalDeck } from '../lib/localDecks'
import { store } from '../lib/store'
import { closePdf, openPdf, type PDFDocumentProxy } from '../lib/pdf'
import type { Startup } from '../lib/types'
import { cn } from '../lib/utils'
import { PdfSlides } from './PdfSlides'
import { Button } from './ui'

/**
 * Organiser stage presenter: shows a startup's deck full screen for the projector.
 *
 * A PDF picked from this laptop is remembered for that startup (IndexedDB) and drawn slide by slide,
 * so a presentation clicker works: Page Down / Right / Down / Space / Enter = next,
 * Page Up / Left / Up / Backspace = previous, B or . = black screen, F5 = full screen (never reloads).
 * Without a laptop PDF the deck link is shown as well as its host allows (Google Slides' own player
 * handles the clicker; Drive's viewer and web pages only scroll), with a one-click PDF download.
 */

type Mode =
  | { kind: 'loading' }
  /** saved: shared = uploaded for the projector · laptop = only on this device · none = not stored */
  | { kind: 'pdf'; doc: PDFDocumentProxy; fromFile: string | null; saved: 'shared' | 'laptop' | 'none'; note?: string }
  | { kind: 'frame'; src: string; native: boolean; note: string }
  | { kind: 'link'; note: string }
  | { kind: 'error'; note: string }

const NEXT = new Set(['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter', 'n', 'N'])
const PREV = new Set(['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace', 'p', 'P'])
const BLANK = new Set(['b', 'B', '.', 'w', 'W', ','])

// Downloaded decks, kept for the session so reopening a deck is instant.
const pdfCache = new Map<string, ArrayBuffer>()

async function fetchPdf(url: string): Promise<ArrayBuffer> {
  const hit = pdfCache.get(url)
  if (hit) return hit
  const res = await fetch(url, { credentials: 'omit', referrerPolicy: 'no-referrer' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const buf = await res.arrayBuffer()
  // Drive answers with an HTML page for private or very large files
  const head = new TextDecoder().decode(new Uint8Array(buf, 0, Math.min(1024, buf.byteLength)))
  if (!head.includes('%PDF')) throw new Error('Not a PDF')
  pdfCache.set(url, buf)
  return buf
}

const LAPTOP_TIP = 'For slide-by-slide clicker control and the projector, download the PDF and load it with “PDF from laptop”.'

export function DeckPresenter({ startup, deckUrl, onClose }: { startup: Startup; deckUrl: string; onClose: () => void }) {
  const source = useMemo(() => deckSource(deckUrl), [deckUrl])
  const rootRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLIFrameElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<Mode>({ kind: 'loading' })
  const [page, setPage] = useState(1)
  const [blank, setBlank] = useState(false)
  const [full, setFull] = useState(false)
  const [chrome, setChrome] = useState(true)
  const fsChangedAt = useRef(0)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const { deckFiles, canEdit, reload } = useOrganiser()
  // read once when opening, so an upload made here does not reload the deck mid-presentation
  const sharedVersion = useRef(deckFiles.get(startup.id))

  const doc = mode.kind === 'pdf' ? mode.doc : null
  const total = doc?.numPages ?? 0

  // ---------- load the deck ----------
  useEffect(() => {
    let cancelled = false
    setMode({ kind: 'loading' })
    setPage(1)
    setBlank(false)
    void (async () => {
      // a PDF uploaded for the projector (or saved on this laptop) always wins: full clicker control
      try {
        const shared = sharedVersion.current ? await fetchDeck(startup.id, sharedVersion.current) : null
        const local = shared ? null : await getLocalDeck(startup.id)
        const data = shared ?? local?.data
        if (data) {
          const d = await openPdf(data)
          if (cancelled) closePdf(d)
          else setMode({ kind: 'pdf', doc: d, fromFile: shared ? 'PDF' : local!.name, saved: shared ? 'shared' : 'laptop' })
          return
        }
      } catch {
        /* unreadable copy: fall back to the link */
      }
      if (cancelled) return
      if (source.kind === 'pdf') {
        try {
          const d = await openPdf(await fetchPdf(source.fetchUrl))
          if (cancelled) closePdf(d)
          else setMode({ kind: 'pdf', doc: d, fromFile: null, saved: 'none' })
        } catch {
          if (!cancelled) setMode({ kind: 'frame', src: source.fetchUrl, native: false, note: `This PDF link can only be shown as a page here. ${LAPTOP_TIP}` })
        }
      } else if ((source.kind === 'drive' || source.kind === 'slides') && !(await probeDeckLink(source))) {
        if (!cancelled)
          setMode({
            kind: 'link',
            note: 'This Google deck is not shared publicly, so it would only show Google’s sign-in or error page. Ask the startup to share it as “Anyone with the link”, or load their PDF.',
          })
      } else if (source.kind === 'drive') {
        setMode({ kind: 'frame', src: source.embed, native: false, note: `Google Drive’s viewer shows the slides as one scrolling page, so the clicker won’t step through them. ${LAPTOP_TIP}` })
      } else if (source.kind === 'slides') {
        setMode({ kind: 'frame', src: source.embed, native: true, note: 'Google Slides: if the clicker does not move the slides, click the slide once.' })
      } else if (source.kind === 'frame') {
        setMode({ kind: 'frame', src: source.embed, native: false, note: `This deck is a web page, so the clicker may only scroll it. ${LAPTOP_TIP}` })
      } else if (source.kind === 'link') {
        setMode({ kind: 'link', note: 'This deck’s host (SharePoint, OneDrive or DocSend) does not allow it to be shown inside the app.' })
      } else {
        setMode({ kind: 'link', note: 'There is no deck link for this startup.' })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [source, startup.id])

  useEffect(
    () => () => {
      if (doc) closePdf(doc)
    },
    [doc],
  )

  const openFile = async (f: File) => {
    setMode({ kind: 'loading' })
    let d: PDFDocumentProxy
    let data: ArrayBuffer
    try {
      data = await f.arrayBuffer()
      d = await openPdf(data)
    } catch {
      return setMode({ kind: 'error', note: `“${f.name}” could not be opened as a PDF.` })
    }
    setPage(1)
    setBlank(false)
    // editors upload it for the projector (admin2's screen); otherwise it stays on this laptop
    let saved: 'shared' | 'laptop' | 'none' = 'none'
    let note: string | undefined
    if (canEdit) {
      try {
        await store.orgUploadDeck(startup.id, f)
        const version = (await store.orgListDeckFiles()).get(startup.id)
        if (version) await putLocalDeck({ startupId: startup.id, name: f.name, size: f.size, savedAt: version, data })
        saved = 'shared'
        void reload('decks')
      } catch (e) {
        note = `Not uploaded for the projector: ${(e as Error).message}`
      }
    }
    if (saved === 'none' && (await saveLocalDeck(startup.id, f, data))) saved = 'laptop'
    setMode({ kind: 'pdf', doc: d, fromFile: f.name, saved, note })
  }

  const forgetFile = async () => {
    if (mode.kind === 'pdf' && mode.saved === 'shared') await store.orgDeleteDeck(startup.id).catch(() => {})
    await removeLocalDeck(startup.id)
    void reload('decks')
    onCloseRef.current()
  }

  // ---------- full screen, keys, screen wake ----------
  const toggleFull = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
    else void rootRef.current?.requestFullscreen().catch(() => {})
  }, [])

  useEffect(() => {
    const onFs = () => {
      fsChangedAt.current = Date.now()
      setFull(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', onFs)
    void rootRef.current?.requestFullscreen().catch(() => {}) // opened by a click, so the browser allows it
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    let lock: { release: () => Promise<void> } | null = null
    void (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock
      ?.request('screen')
      .then((l) => (lock = l))
      .catch(() => {})
    return () => {
      document.removeEventListener('fullscreenchange', onFs)
      document.body.style.overflow = prevOverflow
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
      void lock?.release().catch(() => {})
    }
  }, [])

  const modeRef = useRef(mode)
  modeRef.current = mode
  const totalRef = useRef(total)
  totalRef.current = total

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      if (e.key === 'F5') {
        // clicker "start slideshow" button: never reload the dashboard
        e.preventDefault()
        if (!document.fullscreenElement) toggleFull()
        return
      }
      if (e.key === 'Escape') {
        // the first Esc only leaves full screen (the browser handles that); the next one closes
        if (document.fullscreenElement || Date.now() - fsChangedAt.current < 800) return
        onCloseRef.current()
        return
      }
      if ((e.key === 'f' || e.key === 'F') && !e.metaKey && !e.ctrlKey) {
        toggleFull()
        return
      }
      const m = modeRef.current
      if (m.kind === 'pdf') {
        const last = totalRef.current
        if (NEXT.has(e.key)) setPage((p) => Math.min(p + 1, last))
        else if (PREV.has(e.key)) setPage((p) => Math.max(p - 1, 1))
        else if (e.key === 'Home') setPage(1)
        else if (e.key === 'End') setPage(last)
        else if (BLANK.has(e.key)) return void (e.preventDefault(), setBlank((b) => !b))
        else return
        e.preventDefault()
        setBlank(false)
      } else if (m.kind === 'frame' && (NEXT.has(e.key) || PREV.has(e.key))) {
        // the key reached the dashboard rather than the deck: hand focus to the deck for the next press
        frameRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [toggleFull])

  // hide the controls and cursor while the mouse is still
  useEffect(() => {
    if (mode.kind !== 'pdf') return void setChrome(true)
    let t = window.setTimeout(() => setChrome(false), 2500)
    const wake = () => {
      setChrome(true)
      window.clearTimeout(t)
      t = window.setTimeout(() => setChrome(false), 2500)
    }
    window.addEventListener('mousemove', wake)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('mousemove', wake)
    }
  }, [mode.kind])

  const isPdf = mode.kind === 'pdf'
  const go = (d: number) => (setBlank(false), setPage((p) => Math.min(Math.max(p + d, 1), total)))
  // buttons drop focus after a click so Space / Enter from the clicker go to the slides, not the button
  const tap = (fn: () => void) => (e: React.MouseEvent<HTMLButtonElement>) => (e.currentTarget.blur(), fn())

  return createPortal(
    <div
      ref={rootRef}
      className={cn('fixed inset-0 z-[60] flex select-none flex-col bg-black', isPdf && !chrome && 'cursor-none')}
      role="dialog"
      aria-modal
      aria-label={`${startup.name} pitch deck, presenting`}
    >
      {/* top bar: floats over PDF slides and fades out; sits above embedded decks */}
      <div
        className={cn(
          'z-10 flex items-center gap-2 bg-black/85 px-4 py-2.5 transition-opacity duration-300',
          isPdf ? 'absolute inset-x-0 top-0' : 'relative border-b border-slate-200',
          isPdf && !chrome && 'pointer-events-none opacity-0',
        )}
      >
        <div className="min-w-0 flex-1">
          <p className="eyebrow">Presenting · #{startup.position}</p>
          <p className="truncate font-semibold text-slate-950">
            {startup.name}
            {mode.kind === 'pdf' && mode.fromFile && (
              <span className="ml-2 text-sm font-normal text-slate-500">
                {mode.fromFile} ·{' '}
                {mode.saved === 'shared'
                  ? 'ready for the projector'
                  : mode.saved === 'laptop'
                    ? 'on this laptop only'
                    : 'not saved (this browser blocks storage)'}
                {mode.note && <span className="ml-1 text-amber-500">· {mode.note}</span>}
              </span>
            )}
          </p>
        </div>
        {isPdf && (
          <span className="tabular mr-1 text-sm text-slate-600" aria-live="polite">
            {page} / {total}
          </span>
        )}
        {!isPdf && 'download' in source && (
          <a href={source.download} target="_blank" rel="noopener noreferrer" className="hidden sm:block">
            <Button variant="secondary" size="sm" icon={<Download className="h-4 w-4" />} type="button" tabIndex={-1}>
              Download PDF
            </Button>
          </a>
        )}
        <Button variant={isPdf ? 'secondary' : 'primary'} size="sm" icon={<FileUp className="h-4 w-4" />} onClick={tap(() => fileRef.current?.click())}>
          <span className="hidden sm:inline">{mode.kind === 'pdf' && mode.saved !== 'none' ? 'Replace PDF' : 'PDF from laptop'}</span>
        </Button>
        {mode.kind === 'pdf' && (mode.saved === 'laptop' || (mode.saved === 'shared' && canEdit)) && (
          <button onClick={tap(() => void forgetFile())} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900" aria-label="Remove this PDF" title={mode.saved === 'shared' ? 'Remove this PDF (also from the projector)' : 'Remove the PDF saved on this laptop'}>
            <Trash2 className="h-4 w-4" />
          </button>
        )}
        {!isPdf && 'open' in source && (
          <a href={source.open} target="_blank" rel="noopener noreferrer" className="hidden sm:block">
            <Button variant="secondary" size="sm" icon={<ExternalLink className="h-4 w-4" />} type="button" tabIndex={-1}>
              Open link
            </Button>
          </a>
        )}
        <button onClick={tap(toggleFull)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900" aria-label={full ? 'Exit full screen' : 'Full screen'}>
          {full ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
        </button>
        <button onClick={tap(onClose)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900" aria-label="Close presenter">
          <X className="h-5 w-5" />
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (f) void openFile(f)
          }}
        />
      </div>

      <div className="relative min-h-0 flex-1">
        {mode.kind === 'loading' && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> Loading deck…
          </div>
        )}

        {isPdf && (
          <>
            <PdfSlides
              doc={mode.doc}
              page={page}
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect()
                go(e.clientX - r.left < r.width / 3 ? -1 : 1)
              }}
            />
            <div className={cn('transition-opacity duration-300', !chrome && 'pointer-events-none opacity-0')}>
              <button onClick={tap(() => go(-1))} disabled={page <= 1} className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-3 text-slate-700 hover:text-slate-950 disabled:opacity-0" aria-label="Previous slide">
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button onClick={tap(() => go(1))} disabled={page >= total} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-3 text-slate-700 hover:text-slate-950 disabled:opacity-0" aria-label="Next slide">
                <ChevronRight className="h-6 w-6" />
              </button>
              <p className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-xs text-slate-500">
                Clicker or ← → to change slides · B blanks the screen · F full screen · Esc to close
              </p>
            </div>
            <div className="absolute inset-x-0 bottom-0 h-0.5 bg-white/10" aria-hidden>
              <div className="h-full bg-brand-800 transition-[width] duration-200" style={{ width: `${total ? (page / total) * 100 : 0}%` }} />
            </div>
            {blank && <div className="absolute inset-0 bg-black" onClick={() => setBlank(false)} aria-label="Screen blanked" />}
          </>
        )}

        {mode.kind === 'frame' && (
          <>
            <iframe
              ref={frameRef}
              src={mode.src}
              title={`${startup.name} pitch deck`}
              className="absolute inset-0 h-full w-full border-0 bg-black"
              allow="fullscreen"
              allowFullScreen
              referrerPolicy="no-referrer"
              sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-presentation allow-forms"
              onLoad={() => frameRef.current?.focus()}
            />
            <p className="absolute inset-x-0 bottom-0 bg-black/85 px-4 py-2 text-center text-xs text-slate-500">{mode.note}</p>
          </>
        )}

        {(mode.kind === 'link' || mode.kind === 'error') && (
          <div className="mx-auto flex h-full max-w-lg flex-col items-center justify-center gap-4 p-6 text-center">
            <p className="text-slate-700">{mode.note}</p>
            <p className="text-sm text-slate-500">
              Load the deck as a PDF from this laptop to present it with the clicker. Editors’ uploads also appear on the
              projector screen.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button size="lg" icon={<FileUp className="h-5 w-5" />} onClick={tap(() => fileRef.current?.click())}>
                PDF from laptop
              </Button>
              {'open' in source && (
                <a href={source.open} target="_blank" rel="noopener noreferrer">
                  <Button size="lg" variant="secondary" icon={<ExternalLink className="h-5 w-5" />} type="button" tabIndex={-1}>
                    Open link
                  </Button>
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
