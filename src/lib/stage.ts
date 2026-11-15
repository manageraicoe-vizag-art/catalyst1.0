import { useEffect, useState } from 'react'
import type { StageSnapshot, Startup } from './types'

// ---------- the 16 Nov pitch schedule ----------

/**
 * Demo Day running order (from "Catalyst – Pitch Slot Schedule"): 12-minute slots
 * (5 min pitch + 5 min Q&A + 2 min buffer) from 10:00, lunch 1:00–2:00 PM after slot 15.
 * `match` holds name fragments (letters and digits only) used to find each startup in the queue.
 */
export const EVENT_SCHEDULE = {
  firstStart: '10:00',
  slotMinutes: 12,
  breaks: [{ afterSlot: 15, start: '13:00', end: '14:00', label: 'Lunch break' }],
  slots: [
    { label: 'SEMAPI Instruments', match: ['semapi'] },
    { label: 'Oceanautics', match: ['oceanautics'] },
    { label: 'JOLT (ODL Network)', match: ['jolt', 'ondl', 'odlnetwork'] },
    { label: 'Trustit Technologies', match: ['trustit', 'witomark'] },
    { label: 'Raudranex Space Technologies', match: ['raudranex'] },
    { label: 'Akrivis Health Care', match: ['akrivis'] },
    { label: '72 Street AI', match: ['72street'] },
    { label: 'Mythri InnovoTech', match: ['mythri', 'safeguardair'] },
    { label: 'Gofresho Retail Services', match: ['gofresh'] },
    { label: 'NGEN Water Solutions', match: ['ngenwater', 'ngen'] },
    { label: 'CarbonLite Infrastructure Solutions', match: ['carbonlite'] },
    { label: 'SuperrApp', match: ['superrapp'] },
    { label: 'Dreambot', match: ['dreambot'] },
    { label: 'Reker', match: ['reker'] },
    { label: 'IntegrationWings', match: ['integrationwings'] },
    { label: 'CheqUPI', match: ['chequpi', 'cheq'] },
    { label: 'Infarmsys Technologies', match: ['infarmsys'] },
    { label: 'Rijuven Medicare', match: ['rijuven'] },
  ],
}

/** Minutes for each stage phase. */
export const PHASE_MINUTES = { pitch: 5, qa: 5, interest: 1 } as const

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

/** Pairs each schedule slot with a queue startup by name; returns the new order and anything left over. */
export function matchSchedule(startups: Startup[]) {
  const left = [...startups]
  const matched: Array<{ slot: number; label: string; startup: Startup | null }> = []
  EVENT_SCHEDULE.slots.forEach((slot, i) => {
    const idx = left.findIndex((s) => slot.match.some((m) => squash(s.name).includes(m)))
    matched.push({ slot: i + 1, label: slot.label, startup: idx >= 0 ? left.splice(idx, 1)[0]! : null })
  })
  return { matched, unmatched: left }
}

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h! * 60 + m!
}

export function fmtClock(totalMin: number): string {
  const h = Math.floor(totalMin / 60) % 24
  const m = totalMin % 60
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

/** Planned start/end (minutes after midnight) of the n-th visible slot (0-based), with breaks applied. */
export function slotTime(index: number): { start: number; end: number } {
  let start = toMin(EVENT_SCHEDULE.firstStart) + index * EVENT_SCHEDULE.slotMinutes
  for (const b of EVENT_SCHEDULE.breaks)
    if (index >= b.afterSlot) start = toMin(b.end) + (index - b.afterSlot) * EVENT_SCHEDULE.slotMinutes
  return { start, end: start + EVENT_SCHEDULE.slotMinutes }
}

export const breakTimes = (b: (typeof EVENT_SCHEDULE.breaks)[number]) => ({ start: toMin(b.start), end: toMin(b.end) })

// ---------- what the stage shows right now ----------

export type StagePhase = 'idle' | 'break' | 'pitch' | 'qa' | 'interest' | 'results'

export interface StageView {
  phase: StagePhase
  startupId: string | null
  /** When the current timer runs out, on this device's clock (null = no timer) */
  endsAt: number | null
  deckPage: number
}

/**
 * The shared stage row → what to show now. A running stage goes pitch → Q&A → investor interest (countdown)
 * → VC-interest results by itself (from the server's start time); the results stay until an editor starts the next pitch.
 */
export function stageView(snap: StageSnapshot | null, now: number): StageView {
  if (!snap) return { phase: 'idle', startupId: null, endsAt: null, deckPage: 1 }
  const s = snap.stage
  const base = { startupId: s.startupId, deckPage: s.deckPage }
  if (s.mode !== 'running' || !s.startupId) return { ...base, phase: s.mode === 'break' ? 'break' : 'idle', endsAt: null }
  const start = Date.parse(s.startedAt) - snap.serverOffsetMs
  const pitchEnd = start + s.pitchSecs * 1000
  const qaEnd = pitchEnd + s.qaSecs * 1000
  if (now < pitchEnd) return { ...base, phase: 'pitch', endsAt: pitchEnd }
  if (now < qaEnd) return { ...base, phase: 'qa', endsAt: qaEnd }
  const interestEnd = qaEnd + PHASE_MINUTES.interest * 60_000
  if (now < interestEnd) return { ...base, phase: 'interest', endsAt: interestEnd }
  return { ...base, phase: 'results', endsAt: null }
}

/** Ticks a few times a second so phases and timers move on by themselves. */
export function useStageView(snap: StageSnapshot | null): StageView {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(t)
  }, [])
  return stageView(snap, now)
}

/** Seconds left on a timer (negative once over time), ticking every second. */
export function useCountdown(endsAt: number | null): number | null {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (endsAt === null) return
    const t = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(t)
  }, [endsAt])
  return endsAt === null ? null : Math.ceil((endsAt - now) / 1000)
}

export function fmtCountdown(secs: number): string {
  const s = Math.abs(secs)
  return `${secs < 0 ? '+' : ''}${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export const STAGE_WINDOW = 'catalyst-stage'
export const stageUrl = () => `${window.location.href.split('#')[0]}#/organiser/stage`

// ---------- who is on and who is next ----------

/** Next startup to pitch: after whoever is on (or the last one that pitched); wraps round for anyone skipped. */
export function nextUpOf(startups: Startup[]): Startup | undefined {
  const pitching = startups.find((s) => s.status === 'pitching')
  const anchor = pitching?.position ?? Math.max(0, ...startups.filter((s) => s.status === 'done').map((s) => s.position))
  const ready = (s: Startup) => s.status === 'queued' && !s.hidden
  return startups.find((s) => s.position > anchor && ready(s)) ?? startups.find(ready)
}

/** Planned slot (index among startups shown to investors) for each startup id. */
export function slotIndexById(startups: Startup[]): Map<string, number> {
  const m = new Map<string, number>()
  startups.filter((s) => !s.hidden).forEach((s, i) => m.set(s.id, i))
  return m
}

/** Keys a presentation clicker sends (most send Page Down / Page Up; some send arrows). */
export const CLICKER_NEXT = new Set(['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter', 'n', 'N'])
export const CLICKER_PREV = new Set(['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace', 'p', 'P'])
