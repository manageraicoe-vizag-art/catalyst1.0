import type {
  ActionType,
  DeckView,
  EventSettings,
  InterestRequest,
  Investor,
  InvestorInput,
  LiveInterest,
  Notice,
  Organiser,
  RequestHandling,
  Startup,
  StartupPrivate,
  StartupStatus,
  Topic,
} from '../types'

export type StartupDraft = Omit<Startup, 'id' | 'position' | 'updatedAt' | 'status' | 'hidden' | 'deckAvailable'> &
  Partial<Pick<Startup, 'id' | 'position' | 'status' | 'hidden' | 'deckAvailable'>>

export type PrivateDraft = Omit<StartupPrivate, 'startupId'>

export type Audience = 'investor' | 'organiser'

/**
 * Everything the UI needs from a backend. Two implementations:
 *  - LocalStore: demo mode, data in this browser (syncs across tabs)
 *  - SupabaseStore: live mode, shared Postgres + realtime + row-level security
 */
export interface Store {
  readonly mode: 'demo' | 'live'

  // ---- shared ----
  getSettings(): Promise<EventSettings>
  /** Investor-visible startups (hidden ones excluded), in pitch order. */
  listStartups(): Promise<Startup[]>

  // ---- investor ----
  getMe(): Promise<Investor | null>
  register(input: InvestorInput): Promise<Investor>
  claimInvite(token: string): Promise<Investor>
  updateMe(input: InvestorInput): Promise<Investor>
  forgetDevice(): Promise<void>
  listMyRequests(): Promise<InterestRequest[]>
  setRequest(startupId: string, type: ActionType, active: boolean): Promise<InterestRequest>
  listMyNotices(): Promise<Notice[]>
  markNoticesRead(ids: string[]): Promise<void>
  listLiveInterest(): Promise<LiveInterest[]>
  /** Fund names investors have already entered (names only), for teammates to pick. */
  listFundSuggestions(): Promise<string[]>
  /** Deck link for a startup whose deck is switched on (records the view for RTIH). */
  openDeck(startupId: string): Promise<string>

  // ---- organiser ----
  getOrganiser(): Promise<Organiser | null>
  organiserSignIn(email: string, secret: string): Promise<Organiser>
  organiserSignOut(): Promise<void>
  /** Signed-in organiser changes their own password (live mode). */
  orgChangePassword(newPassword: string): Promise<void>
  orgListStartups(): Promise<Startup[]>
  orgListStartupPrivate(): Promise<StartupPrivate[]>
  orgSaveStartup(draft: StartupDraft, priv?: PrivateDraft): Promise<Startup>
  orgDeleteStartup(id: string): Promise<void>
  orgReorder(ids: string[]): Promise<void>
  orgSetStatus(id: string, status: StartupStatus): Promise<void>
  /** Makes `id` the one startup pitching now (others that were pitching become done). */
  orgSetPitching(id: string | null): Promise<void>
  orgListInvestors(): Promise<Investor[]>
  orgCreateInvestor(input: InvestorInput): Promise<Investor>
  orgUpdateInvestor(id: string, input: InvestorInput): Promise<Investor>
  orgDeleteInvestor(id: string): Promise<void>
  orgListRequests(): Promise<InterestRequest[]>
  orgListHandling(): Promise<RequestHandling[]>
  orgSaveHandling(requestId: string, patch: Partial<Omit<RequestHandling, 'requestId'>>): Promise<RequestHandling>
  /** Sends the current approved details to the investor (in-site notice). */
  orgNotify(requestId: string): Promise<Notice>
  orgListNotices(): Promise<Notice[]>
  orgSaveSettings(settings: EventSettings): Promise<EventSettings>
  orgLiveInterest(): Promise<LiveInterest[]>
  orgListDeckViews(): Promise<DeckView[]>

  /** Calls `cb` when data in a topic may have changed (realtime or cross-tab). */
  subscribe(audience: Audience, cb: (topic: Topic) => void): () => void
}
