import {
  BarChart3,
  CalendarPlus,
  Check,
  ChevronRight,
  Coffee,
  FileUp,
  Handshake,
  LayoutDashboard,
  ListOrdered,
  LogOut,
  Maximize,
  MessagesSquare,
  Mic,
  Minimize,
  Plus,
  Presentation,
  Square,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { RtihMain } from '../../components/Decor'
import { PdfSlides } from '../../components/PdfSlides'
import { QrCode } from '../../components/Qr'
import { Spinner } from '../../components/ui'
import { useOrganiser } from '../../context/Organiser'
import { ACTION_SHORT, LIVE_DISCLAIMER, ROUTING_NOTE } from '../../lib/constants'
import { deckSource, probeDeckLink } from '../../lib/deckSource'
import { fetchDeck } from '../../lib/decks'
import { getLocalDeck, putLocalDeck, saveLocalDeck } from '../../lib/localDecks'
import { closePdf, openPdf, type PDFDocumentProxy } from '../../lib/pdf'
import {
  breakTimes,
  CLICKER_NEXT,
  CLICKER_PREV,
  EVENT_SCHEDULE,
  fmtClock,
  fmtCountdown,
  PHASE_MINUTES,
  slotIndexById,
  slotTime,
  useCountdown,
} from '../../lib/stage'
import { store } from '../../lib/store'
import type { InterestRequest, LiveInterest, Startup } from '../../lib/types'
import { cn, eventLink } from '../../lib/utils'
import { useStageControls } from './useStageControls'

/**
 * Projector screen for Demo Day (#/organiser/stage), for the projector login (admin2) or an editor.
 * Follows the shared stage row that admin1 drives: schedule → pitch 5:00 (the startup's deck, or a
 * name card) → Q&A 5:00 → investor interest, which stays until admin1 starts the next pitch.
 * A clicker plugged into the projector flips the deck's slides; editors also get controls at the bottom.
 */
export function StagePage() {
  const { ready, organiser } = useOrganiser()
  if (!ready) return <Spinner />
  if (!organiser) return <Navigate to="/organiser" replace />
  return <Stage />
}

const PHASE_LABEL: Record<'pitch' | 'qa' | 'interest', string> = { pitch: 'Pitch', qa: 'Q&A', interest: 'Investors respond' }

/** Interest in one startup: request counts per option and the funds behind any request (as on the Live board). */
function interestIn(startupId: string, requests: InterestRequest[], live: LiveInterest[]) {
  const active = requests.filter((r) => r.active && r.startupId === startupId)
  const funds = new Map<string, string>()
  for (const l of live) if (l.startupId === startupId) funds.set(l.fund.trim().toLowerCase(), l.fund.trim())
  return {
    today: active.filter((r) => r.type === 'meet_today').length,
    later: active.filter((r) => r.type === 'meet_later').length,
    funds: [...funds.values()].sort((a, b) => a.localeCompare(b)),
  }
}

function Stage() {
  const { startups, settings, deckFiles, privates, organiser, signOut, stageError, requests, live: liveInterest, reload } = useOrganiser()
  const { view, pitching, nextUp, busy, canEdit, startPitch, endPitch, setPhase, showResults, showSchedule, toggleBreak, addMinute } = useStageControls()
  const isDisplay = organiser?.role === 'display'
  const rootRef = useRef<HTMLDivElement>(null)
  const slots = slotIndexById(startups)
  const onStage = startups.find((s) => s.id === view.startupId) ?? null
  const live = view.phase === 'pitch' || view.phase === 'qa'

  // ---------- the deck of the startup on stage (shared decks bucket, cached on this device) ----------
  const deckId = onStage && (live || view.phase === 'interest') ? onStage.id : null
  const version = deckId ? deckFiles.get(deckId) : undefined
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [showDeck, setShowDeck] = useState(true)
  // which startup's PDF lookup has finished (so the deck link is only used when there is no PDF)
  const [checked, setChecked] = useState<string | null>(null)
  // PDFs loaded on this projector this session win over the shared copy
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [nonce, setNonce] = useState(0)
  const usePicked = !!deckId && picked.has(deckId)
  useEffect(() => {
    let cancelled = false
    setDoc(null)
    setChecked(null)
    if (!deckId) return
    void (usePicked ? getLocalDeck(deckId).then((d) => d?.data ?? null) : fetchDeck(deckId, version))
      .then((data) => (data ? openPdf(data) : null))
      .catch(() => null)
      .then((x) => {
        if (cancelled) return x && closePdf(x)
        setDoc(x)
        setChecked(deckId)
      })
    return () => {
      cancelled = true
    }
  }, [deckId, version, usePicked, nonce])

  // a PDF picked on this laptop (e.g. a founder's USB stick): editors upload it for every screen, the projector keeps it here
  const fileRef = useRef<HTMLInputElement>(null)
  const [loadNote, setLoadNote] = useState<string | null>(null)
  const loadPdf = async (f: File) => {
    const id = deckId
    if (!id) return
    const data = await f.arrayBuffer()
    try {
      closePdf(await openPdf(data))
    } catch {
      return setLoadNote(`“${f.name}” is not a PDF that can be shown.`)
    }
    let shared = false
    if (canEdit) {
      try {
        await store.orgUploadDeck(id, f)
        const v = (await store.orgListDeckFiles()).get(id)
        if (v) await putLocalDeck({ startupId: id, name: f.name, size: f.size, savedAt: v, data })
        shared = true
        void reload('decks')
      } catch {
        /* keep it on this laptop below */
      }
    }
    if (!shared) await saveLocalDeck(id, f, data)
    setPicked((p) => new Set(p).add(id))
    setNonce((n) => n + 1)
    setLoadNote(shared ? null : `Showing “${f.name}” from this laptop.`)
  }
  useEffect(() => setLoadNote(null), [deckId])

  // no PDF: show the startup's deck link instead (Google Slides plays with the clicker; Drive/Canva/web pages scroll)
  const linkUrl = deckId ? privates.get(deckId)?.deckUrl?.trim() ?? '' : ''
  const linkSource = useMemo(() => (linkUrl ? deckSource(linkUrl) : null), [linkUrl])
  const frameSrc = useMemo(() => {
    const src = linkSource
    if (!src) return null
    if (src.kind === 'slides' || src.kind === 'drive' || src.kind === 'frame') return src.embed
    return src.kind === 'pdf' ? src.fetchUrl : null
  }, [linkSource])
  // never put Google's sign-in / error page on the projector: only embed links this screen can actually open
  const [linkCheck, setLinkCheck] = useState<{ url: string; ok: boolean } | null>(null)
  useEffect(() => {
    if (!linkSource || !frameSrc) return
    let cancelled = false
    void probeDeckLink(linkSource).then((ok) => !cancelled && setLinkCheck({ url: linkUrl, ok }))
    return () => {
      cancelled = true
    }
  }, [linkSource, frameSrc, linkUrl])
  const linkOk = !!frameSrc && linkCheck?.url === linkUrl && linkCheck.ok
  const linkBlocked = !!frameSrc && linkCheck?.url === linkUrl && !linkCheck.ok
  const frameRef = useRef<HTMLIFrameElement>(null)
  useEffect(
    () => () => {
      if (doc) closePdf(doc)
    },
    [doc],
  )
  // download the next startup's deck in the background so it opens instantly
  const nextVersion = nextUp ? deckFiles.get(nextUp.id) : undefined
  useEffect(() => {
    if (nextUp && nextVersion) void fetchDeck(nextUp.id, nextVersion).catch(() => {})
  }, [nextUp?.id, nextVersion]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- slides: follow the shared page; a clicker here moves at once and syncs it ----------
  const total = doc?.numPages ?? 0
  const [page, setPage] = useState(1)
  const pageRef = useRef(1)
  pageRef.current = page
  const localAt = useRef(0)
  useEffect(() => {
    // right after a clicker press here, wait out our own echoes, then take whatever the shared page is
    const wait = 1500 - (Date.now() - localAt.current)
    if (wait <= 0) return setPage(view.deckPage)
    const t = window.setTimeout(() => setPage(view.deckPage), wait)
    return () => window.clearTimeout(t)
  }, [view.deckPage, deckId])
  const shown = total ? Math.min(Math.max(page, 1), total) : 1
  const deckOn = !!doc && showDeck && live
  const deckOnRef = useRef(deckOn)
  deckOnRef.current = deckOn
  const frameOn = !doc && checked === deckId && linkOk && showDeck && live
  const frameOnRef = useRef(frameOn)
  frameOnRef.current = frameOn
  const totalRef = useRef(total)
  totalRef.current = total
  const slide = useCallback((d: 1 | -1) => {
    if (!deckOnRef.current) return
    const from = Math.min(Math.max(pageRef.current, 1), totalRef.current || 1)
    const to = Math.min(Math.max(from + d, 1), totalRef.current || 1)
    if (to === from) return
    localAt.current = Date.now()
    setPage(to)
    void store.orgStageSlide(to).catch(() => {})
  }, [])

  // ---------- full screen, keys, screen wake, auto-hiding controls ----------
  const [full, setFull] = useState(false)
  const toggleFull = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
    else void rootRef.current?.requestFullscreen().catch(() => {})
  }, [])
  useEffect(() => {
    const onFs = () => setFull(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFs)
    let lock: { release: () => Promise<void> } | null = null
    void (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock
      ?.request('screen')
      .then((l) => (lock = l))
      .catch(() => {})
    return () => {
      document.removeEventListener('fullscreenchange', onFs)
      void lock?.release().catch(() => {})
    }
  }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F5') {
        e.preventDefault() // clicker "start slideshow" button: never reload the stage
        if (!document.fullscreenElement) toggleFull()
        return
      }
      if ((e.key === 'f' || e.key === 'F') && !e.metaKey && !e.ctrlKey) return toggleFull()
      if (frameOnRef.current && (CLICKER_NEXT.has(e.key) || CLICKER_PREV.has(e.key))) {
        // the key reached this page instead of the embedded deck: hand focus to the deck for the next press
        frameRef.current?.focus()
        return
      }
      if (CLICKER_NEXT.has(e.key)) (e.preventDefault(), slide(1))
      else if (CLICKER_PREV.has(e.key)) (e.preventDefault(), slide(-1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [slide, toggleFull])

  const [controls, setControls] = useState(true)
  const wakeRef = useRef(() => {})
  useEffect(() => {
    let t = window.setTimeout(() => setControls(false), 3500)
    const wake = () => {
      setControls(true)
      window.clearTimeout(t)
      t = window.setTimeout(() => setControls(false), 3500)
    }
    wakeRef.current = wake
    window.addEventListener('mousemove', wake)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('mousemove', wake)
    }
  }, [])

  // ---------- which screen ----------
  let screen: ReactNode
  if (view.phase === 'break') screen = <BreakScreen nextUp={nextUp} slots={slots} />
  else if (view.phase === 'interest' && onStage)
    screen = <InterestScreen startup={onStage} endsAt={view.endsAt} nextUp={nextUp} slots={slots} responded={interestIn(onStage.id, requests, liveInterest).funds.length} />
  else if (view.phase === 'results' && onStage)
    screen = <ResultsScreen startup={onStage} {...interestIn(onStage.id, requests, liveInterest)} nextUp={nextUp} slots={slots} />
  else if (live && onStage)
    screen = deckOn ? (
      <>
        <PdfSlides doc={doc!} page={shown} />
        <TimerChip phase={view.phase as 'pitch' | 'qa'} endsAt={view.endsAt} />
      </>
    ) : frameOn ? (
      <>
        <iframe
          key={frameSrc!}
          ref={frameRef}
          src={frameSrc!}
          title={`${onStage.name} pitch deck`}
          className="absolute inset-0 h-full w-full border-0 bg-black"
          allow="fullscreen"
          allowFullScreen
          referrerPolicy="no-referrer"
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-presentation allow-forms"
          onLoad={() => frameRef.current?.focus()}
        />
        {/* the deck page swallows mouse moves: this strip along the bottom still brings up the controls */}
        <div className="absolute inset-x-0 bottom-0 z-10 h-10" onMouseMove={() => wakeRef.current()} aria-hidden />
        <TimerChip phase={view.phase as 'pitch' | 'qa'} endsAt={view.endsAt} />
      </>
    ) : (
      <NowScreen
        startup={onStage}
        phase={view.phase as 'pitch' | 'qa'}
        endsAt={view.endsAt}
        nextUp={nextUp}
        slots={slots}
        missingDeck={
          checked === deckId && !doc && (!frameSrc || linkBlocked) && controls ? (
            <div className="mt-[4vh] inline-flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/60 bg-amber-950/60 px-4 py-3 text-base text-amber-100">
              <span>
                {linkBlocked
                  ? `${onStage.name}’s deck link is not shared publicly, so it can’t be shown.`
                  : `No pitch deck for ${onStage.name} yet.`}{' '}
                {canEdit ? 'Load the PDF here (it is uploaded for every screen),' : 'Load the PDF here,'} or upload it in Pitch queue → Upload deck PDFs.
              </span>
              <button
                type="button"
                onClick={(e) => (e.currentTarget.blur(), fileRef.current?.click())}
                className="inline-flex items-center gap-1.5 rounded-lg bg-paper px-3 py-1.5 text-sm font-semibold text-black hover:bg-slate-800"
              >
                <FileUp className="h-4 w-4" aria-hidden /> Load PDF
              </button>
            </div>
          ) : undefined
        }
      />
    )
  else screen = <ScheduleScreen startups={startups} nextUp={nextUp} slots={slots} eventTitle={settings.eventTitle} />

  const nextLabel = nextUp ? `#${(slots.get(nextUp.id) ?? 0) + 1} ${nextUp.name}` : ''

  return (
    <div ref={rootRef} className={cn('circuit-bg fixed inset-0 select-none overflow-hidden bg-black', !controls && 'cursor-none')}>
      {screen}

      <input
        ref={fileRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) void loadPdf(f)
        }}
      />
      {loadNote && controls && (
        <p className="absolute left-1/2 top-3 z-30 -translate-x-1/2 rounded-full bg-black/85 px-4 py-1.5 text-sm text-slate-700">{loadNote}</p>
      )}

      {stageError && (
        <p className={cn('absolute inset-x-0 top-0 z-30 bg-amber-900/95 px-4 py-2 text-center text-sm text-amber-50 transition-opacity', !controls && 'opacity-0')}>
          Stage not connected: {stageError}
        </p>
      )}

      {/* controls appear when the mouse moves; the projector login gets deck, full screen and sign out only */}
      <div className={cn('absolute inset-x-0 bottom-0 z-20 flex justify-center p-3 transition-opacity duration-300', !controls && 'pointer-events-none opacity-0')}>
        <div className="flex max-w-full flex-wrap items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-black/90 p-1.5 shadow-xl">
          {canEdit &&
            (pitching ? (
              <>
                {(['pitch', 'qa', 'interest'] as const).map((p) => (
                  <Ctl key={p} icon={p === 'pitch' ? Mic : p === 'qa' ? MessagesSquare : Users} active={view.phase === p} disabled={busy} onClick={() => void setPhase(p)}>
                    {PHASE_LABEL[p]}
                    {p !== 'interest' && ` ${PHASE_MINUTES[p]}:00`}
                  </Ctl>
                ))}
                <Ctl icon={BarChart3} active={view.phase === 'results'} disabled={busy} onClick={() => void showResults()}>
                  Show VC interest
                </Ctl>
                {live && (
                  <Ctl icon={Plus} disabled={busy} onClick={() => void addMinute()}>
                    1 min
                  </Ctl>
                )}
                {nextUp && (
                  <Ctl icon={ChevronRight} accent disabled={busy} onClick={() => void startPitch(nextUp.id)}>
                    Next: {nextLabel}
                  </Ctl>
                )}
                <Ctl icon={Square} disabled={busy} onClick={() => void endPitch()}>
                  End pitch
                </Ctl>
              </>
            ) : (
              <>
                {nextUp && (
                  <Ctl icon={Mic} accent disabled={busy} onClick={() => void startPitch(nextUp.id)}>
                    Start {nextLabel}
                  </Ctl>
                )}
                {view.phase !== 'idle' && view.phase !== 'break' && (
                  <Ctl icon={ListOrdered} disabled={busy} onClick={() => void showSchedule()}>
                    Schedule
                  </Ctl>
                )}
                <Ctl icon={Coffee} active={view.phase === 'break'} disabled={busy} onClick={() => void toggleBreak()}>
                  {view.phase === 'break' ? 'End break' : EVENT_SCHEDULE.breaks[0]?.label ?? 'Break'}
                </Ctl>
              </>
            ))}
          {(doc || frameSrc) && live && (
            <Ctl icon={Presentation} onClick={() => setShowDeck((v) => !v)}>
              {showDeck ? 'Hide deck' : 'Show deck'}
            </Ctl>
          )}
          {deckId && live && (
            <Ctl icon={FileUp} onClick={() => fileRef.current?.click()}>
              {doc ? 'Replace PDF' : 'Load PDF'}
            </Ctl>
          )}
          {canEdit && <span className="mx-1 h-6 w-px bg-slate-200" aria-hidden />}
          <span className="px-2 text-xs text-slate-500" title="Deck PDFs uploaded for the projector that this screen can see">
            {deckFiles.size} deck PDF{deckFiles.size === 1 ? '' : 's'} ready
          </span>
          <Ctl icon={full ? Minimize : Maximize} onClick={toggleFull}>
            {full ? 'Exit full screen' : 'Full screen'}
          </Ctl>
          {isDisplay ? (
            <Ctl icon={LogOut} onClick={() => void signOut()}>
              Sign out
            </Ctl>
          ) : (
            <Ctl icon={LayoutDashboard} onClick={() => window.open(`${window.location.href.split('#')[0]}#/organiser/queue`, 'catalyst-dashboard')}>
              Dashboard
            </Ctl>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------- pieces ----------

function Ctl({ icon: Icon, children, onClick, active, accent, disabled }: { icon: LucideIcon; children: ReactNode; onClick: () => void; active?: boolean; accent?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      // drop focus so a clicker's Space / Enter flips slides instead of pressing this button again
      onClick={(e) => (e.currentTarget.blur(), onClick())}
      className={cn(
        'inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-xl px-3 text-sm font-semibold transition-colors disabled:opacity-40',
        accent ? 'bg-paper text-black hover:bg-slate-800' : active ? 'bg-brand-800 text-black' : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950',
      )}
    >
      <Icon className="h-4 w-4" aria-hidden />
      <span className="max-w-[26ch] truncate">{children}</span>
    </button>
  )
}

function useClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 5000)
    return () => window.clearInterval(t)
  }, [])
  return now.getHours() * 60 + now.getMinutes()
}

function Header({ eventTitle = 'Demo Day' }: { eventTitle?: string }) {
  const now = useClock()
  return (
    <header className="flex items-center justify-between gap-[3vw]">
      <RtihMain className="w-[12vw]" />
      <img src="./brand/catalyst-wordmark.png" alt="Catalyst 1.0" className="w-[26vw]" />
      <div className="text-right">
        <p className="tabular font-pixel text-[2.3vw] font-bold leading-none text-paper">{fmtClock(now)}</p>
        <p className="eyebrow mt-[0.8vh] text-[0.95vw]">{eventTitle} · 16 Nov</p>
      </div>
    </header>
  )
}

const timeOf = (slots: Map<string, number>, s: Startup) => {
  const i = slots.get(s.id)
  return i === undefined ? '' : fmtClock(slotTime(i).start)
}

function UpNext({ nextUp, slots, className }: { nextUp: Startup | undefined; slots: Map<string, number>; className?: string }) {
  if (!nextUp) return null
  return (
    <p className={cn('text-[1.5vw] text-slate-500', className)}>
      Up next: <span className="font-semibold text-slate-900">#{(slots.get(nextUp.id) ?? 0) + 1} {nextUp.name}</span> · {timeOf(slots, nextUp)}
    </p>
  )
}

function ScheduleScreen({ startups, nextUp, slots, eventTitle }: { startups: Startup[]; nextUp: Startup | undefined; slots: Map<string, number>; eventTitle: string }) {
  const visible = startups.filter((s) => !s.hidden)
  type Row = { kind: 'slot'; s: Startup; i: number } | { kind: 'break'; label: string; start: number; end: number }
  const rows: Row[] = []
  visible.forEach((s, i) => {
    rows.push({ kind: 'slot', s, i })
    for (const b of EVENT_SCHEDULE.breaks) if (i + 1 === b.afterSlot && i < visible.length - 1) rows.push({ kind: 'break', label: b.label, ...breakTimes(b) })
  })
  const half = Math.ceil(rows.length / 2)
  // big enough to scan from the back of the hall: fills the column under "Up next"
  const qrPx = Math.round(Math.min(window.innerWidth * 0.17, window.innerHeight * 0.42))

  return (
    <div className="flex h-full flex-col px-[3.5vw] pb-[4vh] pt-[3.5vh]">
      <Header eventTitle={eventTitle} />
      <h1 className="mt-[3vh] font-pixel text-[2.6vw] font-bold uppercase leading-none text-paper">Startup pitch schedule</h1>
      <div className="mt-[2.5vh] grid min-h-0 flex-1 grid-cols-[1fr_1fr_0.72fr] gap-[1.6vw]">
        {[rows.slice(0, half), rows.slice(half)].map((col, c) => (
          <ol key={c} className="flex flex-col gap-[0.9vh]">
            {col.map((r) =>
              r.kind === 'break' ? (
                <li key={`b${r.start}`} className="flex items-center justify-center gap-[0.8vw] rounded-[0.7vw] border border-dashed border-slate-300 py-[1.1vh] text-[1.2vw] text-slate-500">
                  <Coffee className="h-[1.3vw] w-[1.3vw]" aria-hidden /> {r.label} · {fmtClock(r.start)} – {fmtClock(r.end)}
                </li>
              ) : (
                <li
                  key={r.s.id}
                  className={cn(
                    'flex items-center gap-[0.9vw] rounded-[0.7vw] border px-[0.9vw] py-[1.05vh]',
                    r.s.status === 'pitching'
                      ? 'border-go bg-go/10'
                      : nextUp?.id === r.s.id
                        ? 'border-brand-800 bg-brand-800/10'
                        : 'border-slate-200 bg-white/60',
                    r.s.status === 'done' && 'opacity-45',
                  )}
                >
                  <span className={cn('tabular w-[2.2vw] text-center font-pixel text-[1.25vw] font-bold', nextUp?.id === r.s.id ? 'text-brand-800' : 'text-slate-500')}>
                    {r.s.status === 'done' ? <Check className="mx-auto h-[1.3vw] w-[1.3vw] text-go" aria-label="Pitched" /> : r.i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[1.35vw] font-semibold text-slate-950">{r.s.name}</span>
                  <span className="tabular text-[1.1vw] text-slate-500">{fmtClock(slotTime(r.i).start)}</span>
                </li>
              ),
            )}
          </ol>
        ))}
        <aside className="flex flex-col gap-[2vh]">
          {nextUp && (
            <div className="rounded-[1vw] border border-brand-800 bg-brand-800/10 p-[1.4vw]">
              <p className="eyebrow text-[0.95vw] text-brand-800">Up next · {timeOf(slots, nextUp)}</p>
              <p className="mt-[1vh] text-[2.1vw] font-bold leading-tight text-slate-950">{nextUp.name}</p>
              {nextUp.sector && <p className="mt-[0.6vh] text-[1.15vw] text-slate-500">{nextUp.sector}</p>}
            </div>
          )}
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-[1.6vh] rounded-[1vw] border border-slate-200 bg-white/60 p-[1.2vw] text-center">
            <p className="text-[1.35vw] leading-snug text-slate-700">
              <span className="font-semibold text-slate-950">Investors:</span> scan to join the Catalyst app
            </p>
            <QrCode value={eventLink()} size={qrPx} />
            <p className="text-[1vw] text-slate-500">Then tap Meet today or Schedule a call later on any startup</p>
          </div>
        </aside>
      </div>
    </div>
  )
}

function ringColor(left: number) {
  return left < 0 ? '#ef4444' : left <= 60 ? '#f59e0b' : '#34d27b'
}

function BigTimer({ endsAt, totalSecs, size, done }: { endsAt: number | null; totalSecs: number; size: string; done?: string }) {
  const left = useCountdown(endsAt) ?? totalSecs
  const frac = Math.max(0, Math.min(1, left / totalSecs))
  const r = 46
  const circ = 2 * Math.PI * r
  const finished = done && left <= 0
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="4" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={ringColor(left)} strokeWidth="4" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (1 - frac)} style={{ transition: 'stroke-dashoffset .25s linear, stroke .3s' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="tabular font-pixel font-bold leading-none" style={{ fontSize: `calc(${size} * 0.24)`, color: ringColor(left) }} role="timer">
          {finished ? '0:00' : fmtCountdown(left)}
        </span>
        <span className="eyebrow mt-[1vh]" style={{ fontSize: `calc(${size} * 0.05)` }}>
          {finished ? done : left < 0 ? 'Over time' : 'remaining'}
        </span>
      </div>
    </div>
  )
}

/** Timer over the deck: a bar at the bottom centre plus a thin progress line along the bottom edge. */
function TimerChip({ phase, endsAt }: { phase: 'pitch' | 'qa'; endsAt: number | null }) {
  const left = useCountdown(endsAt)
  if (left === null) return null
  const total = PHASE_MINUTES[phase] * 60
  const used = Math.min(1, Math.max(0, 1 - left / total))
  return (
    <>
      <div className="pointer-events-none absolute bottom-[1.6vh] left-1/2 z-10 flex -translate-x-1/2 items-center gap-[1vw] rounded-full border border-white/15 bg-black/80 px-[1.6vw] py-[0.9vh] shadow-lg">
        <span className="eyebrow text-[1vw]">{phase === 'pitch' ? 'Pitch' : 'Q&A'}</span>
        <span className="tabular text-[2.2vw] font-bold leading-none" style={{ color: ringColor(left) }} role="timer">
          {fmtCountdown(left)}
        </span>
        {left < 0 && <span className="eyebrow text-[0.9vw] text-red-500">over time</span>}
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[0.6vh] bg-white/10" aria-hidden>
        <div className="h-full transition-[width] duration-300" style={{ width: `${used * 100}%`, background: ringColor(left) }} />
      </div>
    </>
  )
}

function NowScreen({
  startup,
  phase,
  endsAt,
  nextUp,
  slots,
  missingDeck,
}: {
  startup: Startup
  phase: 'pitch' | 'qa'
  endsAt: number | null
  nextUp: Startup | undefined
  slots: Map<string, number>
  /** shown to the operator (while the mouse moves) when this startup has no deck to put on screen */
  missingDeck?: ReactNode
}) {
  const i = slots.get(startup.id)
  return (
    <div className="flex h-full flex-col px-[4.5vw] pb-[5vh] pt-[3.5vh]">
      <Header />
      <div className="flex min-h-0 flex-1 items-center gap-[5vw]">
        <div className="min-w-0 flex-1">
          <p className="eyebrow text-[1.25vw] text-go">
            {phase === 'pitch' ? 'Now pitching' : 'Questions & answers'}
            {i !== undefined && ` · Slot ${i + 1} · ${fmtClock(slotTime(i).start)}`}
          </p>
          <h1 className="mt-[2.5vh] text-[5vw] font-bold leading-[1.05] text-slate-950">{startup.name}</h1>
          {startup.sector && <p className="mt-[2vh] text-[2vw] text-slate-500">{startup.sector}</p>}
          {missingDeck}
        </div>
        <BigTimer endsAt={endsAt} totalSecs={PHASE_MINUTES[phase] * 60} size="26vw" />
      </div>
      <UpNext nextUp={nextUp} slots={slots} />
    </div>
  )
}

function InterestScreen({ startup, endsAt, nextUp, slots, responded }: { startup: Startup; endsAt: number | null; nextUp: Startup | undefined; slots: Map<string, number>; responded: number }) {
  const qrPx = Math.round(window.innerWidth * 0.075)
  const pill = (Icon: LucideIcon, label: string, sub: string) => (
    <div className="flex items-center gap-[1vw] rounded-[1.1vw] border-2 border-brand-800 bg-brand-800/10 px-[1.5vw] py-[1.6vh]">
      <Icon className="h-[2.6vw] w-[2.6vw] shrink-0 text-brand-800" aria-hidden />
      <div>
        <p className="text-[2vw] font-bold leading-tight text-slate-950">{label}</p>
        <p className="text-[1.05vw] text-slate-500">{sub}</p>
      </div>
    </div>
  )
  return (
    <div className="flex h-full flex-col px-[4.5vw] pb-[5vh] pt-[3.5vh]">
      <Header />
      <div className="grid min-h-0 flex-1 grid-cols-[1.45fr_1fr] items-center gap-[4vw]">
        <div>
          <p className="eyebrow text-[1.3vw] text-brand-800">Investors · your {PHASE_MINUTES.interest === 1 ? 'minute' : `${PHASE_MINUTES.interest} minutes`}</p>
          <h1 className="mt-[2vh] text-[4vw] font-bold leading-[1.08] text-slate-950">
            Interested in <span className="text-brand-800">{startup.name}</span>?
          </h1>
          <p className="mt-[3vh] text-[1.7vw] leading-snug text-slate-700">
            Open the Catalyst app.{' '}
            {startup.status === 'pitching' ? (
              <>
                {startup.name} is pinned at the top as <span className="font-semibold text-slate-950">Now pitching</span>.
              </>
            ) : (
              <>Find {startup.name} in the startup list.</>
            )}{' '}
            Tap:
          </p>
          <div className="mt-[2.5vh] grid grid-cols-2 gap-[1.3vw]">
            {pill(Handshake, ACTION_SHORT.meet_today, 'Meet the founders at the venue today')}
            {pill(CalendarPlus, ACTION_SHORT.meet_later, 'Schedule a call after Demo Day')}
          </div>
          <p className="mt-[3vh] text-[1.05vw] text-slate-500">{ROUTING_NOTE} You can still respond later in the day.</p>
        </div>
        <div className="flex flex-col items-center gap-[3.5vh]">
          <BigTimer endsAt={endsAt} totalSecs={PHASE_MINUTES.interest * 60} size="21vw" done="Thank you" />
          <p className="text-[1.5vw] text-slate-700">
            <span className="tabular text-[2.2vw] font-bold text-brand-800">{responded}</span> fund{responded === 1 ? '' : 's'} interested so far
          </p>
          <div className="flex items-center gap-[1vw]">
            <QrCode value={eventLink()} size={qrPx} />
            <p className="text-[1.15vw] leading-snug text-slate-700">
              Not in the app yet?
              <br />
              <span className="font-semibold text-slate-950">Scan to join</span>
            </p>
          </div>
        </div>
      </div>
      <UpNext nextUp={nextUp} slots={slots} />
    </div>
  )
}

function ResultsScreen({
  startup,
  today,
  later,
  funds,
  nextUp,
  slots,
}: {
  startup: Startup
  today: number
  later: number
  funds: string[]
  nextUp: Startup | undefined
  slots: Map<string, number>
}) {
  const i = slots.get(startup.id)
  const stat = (Icon: LucideIcon, label: string, n: number) => (
    <div className="flex items-center gap-[1.6vw] rounded-[1.2vw] border-2 border-brand-800 bg-brand-800/10 px-[2vw] py-[2.4vh]">
      <Icon className="h-[3.4vw] w-[3.4vw] shrink-0 text-brand-800" aria-hidden />
      <div>
        <p className="tabular text-[5vw] font-bold leading-none text-paper">{n}</p>
        <p className="mt-[1vh] text-[1.6vw] font-semibold text-slate-950">{label}</p>
        <p className="text-[1vw] text-slate-500">{n === 1 ? 'request' : 'requests'}</p>
      </div>
    </div>
  )
  return (
    <div className="flex h-full flex-col px-[4.5vw] pb-[4.5vh] pt-[3.5vh]">
      <Header />
      <div className="flex min-h-0 flex-1 flex-col justify-center">
        <p className="eyebrow text-[1.3vw] text-brand-800">VC interest{i !== undefined && ` · Slot ${i + 1}`}</p>
        <h1 className="mt-[1.5vh] text-[4vw] font-bold leading-[1.08] text-slate-950">{startup.name}</h1>
        <div className="mt-[4vh] grid grid-cols-2 gap-[2vw]">
          {stat(Handshake, ACTION_SHORT.meet_today, today)}
          {stat(CalendarPlus, ACTION_SHORT.meet_later, later)}
        </div>
        {funds.length > 0 ? (
          <div className="mt-[4vh]">
            <p className="eyebrow text-[1vw]">
              {funds.length} fund{funds.length === 1 ? '' : 's'} interested
            </p>
            <div className="mt-[1.6vh] flex flex-wrap gap-[0.8vw]">
              {funds.map((f) => (
                <span key={f} className="rounded-full border border-slate-300 bg-white/60 px-[1.3vw] py-[0.9vh] text-[1.5vw] font-semibold text-slate-950">
                  {f}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <p className="mt-[4vh] text-[1.7vw] text-slate-500">Investors can still respond in the Catalyst app throughout the day.</p>
        )}
      </div>
      <p className="text-[0.9vw] text-slate-500">{LIVE_DISCLAIMER}</p>
      <UpNext nextUp={nextUp} slots={slots} className="mt-[1.5vh]" />
    </div>
  )
}

function BreakScreen({ nextUp, slots }: { nextUp: Startup | undefined; slots: Map<string, number> }) {
  const b = EVENT_SCHEDULE.breaks[0]!
  const t = breakTimes(b)
  return (
    <div className="flex h-full flex-col px-[4.5vw] pb-[5vh] pt-[3.5vh]">
      <Header />
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <Coffee className="h-[6vw] w-[6vw] text-brand-800" aria-hidden />
        <h1 className="mt-[3vh] font-pixel text-[6vw] font-bold uppercase leading-none text-paper">{b.label}</h1>
        <p className="tabular mt-[3vh] text-[2.4vw] text-slate-700">
          {fmtClock(t.start)} – {fmtClock(t.end)}
        </p>
        <p className="mt-[4vh] text-[1.8vw] text-slate-500">
          Pitches resume at <span className="font-semibold text-slate-900">{fmtClock(t.end)}</span>
        </p>
      </div>
      <UpNext nextUp={nextUp} slots={slots} className="text-center" />
    </div>
  )
}

