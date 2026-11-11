import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { DEFAULT_SETTINGS } from '../lib/constants'
import { store } from '../lib/store'
import type {
  EventSettings,
  InterestRequest,
  Investor,
  LiveInterest,
  Notice,
  Organiser,
  RequestHandling,
  Startup,
  StartupPrivate,
  Topic,
} from '../lib/types'
import { useToast } from './Toast'

interface OrganiserState {
  ready: boolean
  organiser: Organiser | null
  settings: EventSettings
  startups: Startup[]
  privates: Map<string, StartupPrivate>
  investors: Investor[]
  requests: InterestRequest[]
  handling: Map<string, RequestHandling>
  notices: Notice[]
  live: LiveInterest[]
  /** request ids that arrived (or changed) since this dashboard opened, for highlighting */
  fresh: Set<string>
  signIn: (email: string, secret: string) => Promise<void>
  signOut: () => Promise<void>
  reload: (topic?: Topic) => Promise<void>
  setStartups: (s: Startup[]) => void
}

const Ctx = createContext<OrganiserState | null>(null)

export function OrganiserProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast()
  const [ready, setReady] = useState(false)
  const [organiser, setOrganiser] = useState<Organiser | null>(null)
  const [settings, setSettings] = useState<EventSettings>(DEFAULT_SETTINGS)
  const [startups, setStartups] = useState<Startup[]>([])
  const [privates, setPrivates] = useState<Map<string, StartupPrivate>>(new Map())
  const [investors, setInvestors] = useState<Investor[]>([])
  const [requests, setRequests] = useState<InterestRequest[]>([])
  const [handling, setHandling] = useState<Map<string, RequestHandling>>(new Map())
  const [notices, setNotices] = useState<Notice[]>([])
  const [live, setLive] = useState<LiveInterest[]>([])
  const [fresh, setFresh] = useState<Set<string>>(new Set())
  const seen = useRef<Map<string, string> | null>(null)

  const ingestRequests = useCallback(
    (rs: InterestRequest[]) => {
      setRequests(rs)
      const prev = seen.current
      const next = new Map(rs.map((r) => [r.id, `${r.active}|${r.updatedAt}`]))
      if (prev) {
        const changed = rs.filter((r) => prev.get(r.id) !== next.get(r.id))
        const added = changed.filter((r) => r.active && !prev.has(r.id)).length
        if (changed.length) {
          setFresh((f) => {
            const n = new Set(f)
            changed.forEach((r) => n.add(r.id))
            return n
          })
          if (added) toast({ kind: 'info', title: `${added} new request${added > 1 ? 's' : ''}`, ms: 3000 })
        }
      }
      seen.current = next
    },
    [toast],
  )

  const loadTopic = useCallback(
    async (topic: Topic) => {
      try {
        switch (topic) {
          case 'settings':
            setSettings(await store.getSettings())
            break
          case 'startups':
            setStartups(await store.orgListStartups())
            break
          case 'private':
            setPrivates(new Map((await store.orgListStartupPrivate()).map((p) => [p.startupId, p])))
            break
          case 'investors':
            setInvestors(await store.orgListInvestors())
            break
          case 'requests':
            ingestRequests(await store.orgListRequests())
            break
          case 'handling':
            setHandling(new Map((await store.orgListHandling()).map((h) => [h.requestId, h])))
            break
          case 'notices':
            setNotices(await store.orgListNotices())
            break
          case 'live':
            setLive(await store.orgLiveInterest())
            break
        }
      } catch (e) {
        console.warn('organiser refresh failed', topic, e)
      }
    },
    [ingestRequests],
  )

  const ALL: Topic[] = useMemo(() => ['settings', 'startups', 'private', 'investors', 'requests', 'handling', 'notices', 'live'], [])

  const reload = useCallback(
    async (topic?: Topic) => {
      if (topic) return loadTopic(topic)
      await Promise.all(ALL.map(loadTopic))
    },
    [ALL, loadTopic],
  )

  useEffect(() => {
    store
      .getOrganiser()
      .then(async (o) => {
        setOrganiser(o)
        if (o) await reload()
      })
      .catch(() => setOrganiser(null))
      .finally(() => setReady(true))
  }, [reload])

  useEffect(() => {
    if (!organiser) return
    const timers = new Map<Topic, number>()
    const schedule = (t: Topic) => {
      window.clearTimeout(timers.get(t))
      timers.set(t, window.setTimeout(() => void loadTopic(t), 200))
    }
    const unsub = store.subscribe('organiser', (t) => {
      schedule(t)
      if (t === 'requests') schedule('live')
    })
    const poll = window.setInterval(() => {
      if (document.visibilityState === 'visible') ALL.forEach(schedule)
    }, store.mode === 'live' ? 15000 : 60000)
    return () => {
      unsub()
      window.clearInterval(poll)
      timers.forEach((t) => window.clearTimeout(t))
    }
  }, [organiser, loadTopic, ALL])

  // Unhandled count in the browser tab title, so organisers notice from another tab.
  const unhandled = useMemo(
    () => requests.filter((r) => r.active && (handling.get(r.id)?.status ?? 'new') === 'new').length,
    [requests, handling],
  )
  useEffect(() => {
    if (!organiser) return
    const base = 'Organiser · Catalyst Demo Day'
    document.title = unhandled ? `(${unhandled}) ${base}` : base
    return () => {
      document.title = 'Catalyst Demo Day · RTIH'
    }
  }, [organiser, unhandled])

  const signIn = useCallback(
    async (email: string, secret: string) => {
      const o = await store.organiserSignIn(email, secret)
      setOrganiser(o)
      seen.current = null
      await reload()
    },
    [reload],
  )

  const signOut = useCallback(async () => {
    await store.organiserSignOut()
    setOrganiser(null)
  }, [])

  const value = useMemo<OrganiserState>(
    () => ({
      ready,
      organiser,
      settings,
      startups,
      privates,
      investors,
      requests,
      handling,
      notices,
      live,
      fresh,
      signIn,
      signOut,
      reload,
      setStartups,
    }),
    [ready, organiser, settings, startups, privates, investors, requests, handling, notices, live, fresh, signIn, signOut, reload],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useOrganiser() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useOrganiser outside provider')
  return v
}
