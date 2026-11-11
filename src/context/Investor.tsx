import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ACTION_SHORT, DEFAULT_SETTINGS } from '../lib/constants'
import { store } from '../lib/store'
import type {
  ActionType,
  EventSettings,
  InterestRequest,
  Investor,
  InvestorInput,
  LiveInterest,
  Notice,
  Startup,
  Topic,
} from '../lib/types'
import { useToast } from './Toast'

export const reqKey = (startupId: string, type: ActionType) => `${startupId}:${type}`

interface InvestorState {
  ready: boolean
  error: string | null
  settings: EventSettings
  startups: Startup[]
  me: Investor | null
  requests: Map<string, InterestRequest>
  pending: Set<string>
  notices: Notice[]
  live: LiveInterest[]
  unread: number
  register: (input: InvestorInput) => Promise<Investor>
  claimInvite: (token: string) => Promise<Investor>
  updateMe: (input: InvestorInput) => Promise<void>
  forget: () => Promise<void>
  toggle: (startup: Startup, type: ActionType) => Promise<void>
  markAllRead: () => Promise<void>
  reload: () => Promise<void>
}

const Ctx = createContext<InvestorState | null>(null)

export function InvestorProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast()
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [settings, setSettings] = useState<EventSettings>(DEFAULT_SETTINGS)
  const [startups, setStartups] = useState<Startup[]>([])
  const [me, setMe] = useState<Investor | null>(null)
  const [requests, setRequests] = useState<Map<string, InterestRequest>>(new Map())
  const [pending, setPending] = useState<Set<string>>(new Set())
  const [notices, setNotices] = useState<Notice[]>([])
  const [live, setLive] = useState<LiveInterest[]>([])
  const knownNotices = useRef<Set<string> | null>(null)
  const pendingRef = useRef(pending)
  pendingRef.current = pending

  const loadRequests = useCallback(async () => {
    const rs = await store.listMyRequests()
    setRequests((prev) => {
      const next = new Map(rs.map((r) => [reqKey(r.startupId, r.type), r]))
      // keep optimistic values for in-flight toggles
      for (const k of pendingRef.current) {
        const p = prev.get(k)
        if (p) next.set(k, p)
      }
      return next
    })
  }, [])

  const loadNotices = useCallback(async () => {
    const ns = await store.listMyNotices()
    setNotices(ns)
    if (knownNotices.current) {
      const fresh = ns.filter((n) => !knownNotices.current!.has(n.id))
      if (fresh.length) {
        toast({
          kind: 'info',
          title: 'Update from the RTIH team',
          body: fresh.length === 1 ? 'You have a new confirmation. See “My requests”.' : `You have ${fresh.length} new updates.`,
          ms: 7000,
        })
      }
    }
    knownNotices.current = new Set(ns.map((n) => n.id))
  }, [toast])

  const loadTopic = useCallback(
    async (topic: Topic) => {
      try {
        if (topic === 'settings') setSettings(await store.getSettings())
        else if (topic === 'startups') setStartups(await store.listStartups())
        else if (topic === 'live') setLive(await store.listLiveInterest())
        else if (topic === 'requests') await loadRequests()
        else if (topic === 'notices') await loadNotices()
        else if (topic === 'investors') setMe(await store.getMe())
      } catch (e) {
        console.warn('refresh failed', topic, e)
      }
    },
    [loadNotices, loadRequests],
  )

  const reloadAll = useCallback(async () => {
    const [s, st, m] = await Promise.all([store.getSettings(), store.listStartups(), store.getMe()])
    setSettings(s)
    setStartups(st)
    setMe(m)
    if (m) {
      const [lv] = await Promise.all([store.listLiveInterest(), loadRequests(), loadNotices()])
      setLive(lv)
    } else {
      setRequests(new Map())
      setNotices([])
      setLive([])
    }
  }, [loadNotices, loadRequests])

  // initial load
  useEffect(() => {
    reloadAll()
      .catch((e: Error) => setError(e.message))
      .finally(() => setReady(true))
  }, [reloadAll])

  // realtime + polling fallback (debounced per topic)
  useEffect(() => {
    const timers = new Map<Topic, number>()
    const schedule = (t: Topic) => {
      window.clearTimeout(timers.get(t))
      timers.set(t, window.setTimeout(() => void loadTopic(t), 250))
    }
    const unsub = store.subscribe('investor', schedule)
    const poll = window.setInterval(() => {
      if (document.visibilityState === 'visible') (['startups', 'live', 'notices', 'settings'] as Topic[]).forEach(schedule)
    }, store.mode === 'live' ? 20000 : 60000)
    const onVis = () => {
      if (document.visibilityState === 'visible') void reloadAll().catch(() => {})
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      unsub()
      window.clearInterval(poll)
      document.removeEventListener('visibilitychange', onVis)
      timers.forEach((t) => window.clearTimeout(t))
    }
  }, [loadTopic, reloadAll, me?.id])

  const register = useCallback(
    async (input: InvestorInput) => {
      const inv = await store.register(input)
      setMe(inv)
      await reloadAll()
      return inv
    },
    [reloadAll],
  )

  const claimInvite = useCallback(
    async (token: string) => {
      const inv = await store.claimInvite(token)
      setMe(inv)
      await reloadAll()
      return inv
    },
    [reloadAll],
  )

  const updateMe = useCallback(
    async (input: InvestorInput) => {
      setMe(await store.updateMe(input))
      setLive(await store.listLiveInterest())
    },
    [],
  )

  const forget = useCallback(async () => {
    await store.forgetDevice()
    knownNotices.current = null
    setMe(null)
    setRequests(new Map())
    setNotices([])
    setLive([])
  }, [])

  const toggle = useCallback(
    async (startup: Startup, type: ActionType) => {
      const k = reqKey(startup.id, type)
      if (pendingRef.current.has(k)) return
      const current = requests.get(k)
      const nextActive = !(current?.active ?? false)
      const optimistic: InterestRequest = current
        ? { ...current, active: nextActive }
        : {
            id: 'tmp-' + k,
            investorId: me?.id ?? '',
            startupId: startup.id,
            type,
            active: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            withdrawnAt: null,
          }
      setPending((p) => new Set(p).add(k))
      setRequests((m) => new Map(m).set(k, optimistic))
      try {
        const saved = await store.setRequest(startup.id, type, nextActive)
        setRequests((m) => new Map(m).set(k, saved))
        if (nextActive) {
          toast({
            title: `Request received: ${ACTION_SHORT[type]}`,
            body:
              type === 'deck'
                ? `${startup.name}. The RTIH team will review it and share the deck with you.`
                : `${startup.name}. This is an expression of interest, not a confirmed booking. RTIH will confirm.`,
          })
        } else {
          toast({ kind: 'info', title: `Withdrawn: ${ACTION_SHORT[type]}`, body: startup.name, ms: 2600 })
        }
        setLive(await store.listLiveInterest())
      } catch (e) {
        setRequests((m) => {
          const n = new Map(m)
          if (current) n.set(k, current)
          else n.delete(k)
          return n
        })
        toast({ kind: 'error', title: 'Not saved, please try again', body: (e as Error).message })
      } finally {
        setPending((p) => {
          const n = new Set(p)
          n.delete(k)
          return n
        })
      }
    },
    [me?.id, requests, toast],
  )

  const markAllRead = useCallback(async () => {
    const ids = notices.filter((n) => !n.readAt).map((n) => n.id)
    if (!ids.length) return
    setNotices((ns) => ns.map((n) => (ids.includes(n.id) ? { ...n, readAt: new Date().toISOString() } : n)))
    await store.markNoticesRead(ids).catch(() => {})
  }, [notices])

  const value = useMemo<InvestorState>(
    () => ({
      ready,
      error,
      settings,
      startups,
      me,
      requests,
      pending,
      notices,
      live,
      unread: notices.filter((n) => !n.readAt).length,
      register,
      claimInvite,
      updateMe,
      forget,
      toggle,
      markAllRead,
      reload: reloadAll,
    }),
    [ready, error, settings, startups, me, requests, pending, notices, live, register, claimInvite, updateMe, forget, toggle, markAllRead, reloadAll],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useInvestor() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useInvestor outside provider')
  return v
}
