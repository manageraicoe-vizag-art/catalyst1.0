import type {
  ActionType,
  CrmActivity,
  CrmConnection,
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
  StageMode,
  StageSnapshot,
  StartupStatus,
  Topic,
} from '../types'

export type StartupDraft = Omit<Startup, 'id' | 'position' | 'updatedAt' | 'status' | 'hidden' | 'deckAvailable'> &
  Partial<Pick<Startup, 'id' | 'position' | 'status' | 'hidden' | 'deckAvailable'>>

export type PrivateDraft = Omit<StartupPrivate, 'startupId'>

export type CrmConnectionDraft = Pick<CrmConnection, 'investorId' | 'startupId'> &
  Partial<Pick<CrmConnection, 'stage' | 'priority' | 'owner' | 'source' | 'ticket' | 'summary' | 'createdBy'>>
export type CrmConnectionPatch = Partial<Pick<CrmConnection, 'stage' | 'priority' | 'owner' | 'ticket' | 'summary'>>
export type CrmActivityDraft = Pick<CrmActivity, 'connectionId' | 'kind'> &
  Partial<Pick<CrmActivity, 'body' | 'dueOn' | 'doneAt' | 'owner' | 'createdBy'>>
export type CrmActivityPatch = Partial<Pick<CrmActivity, 'body' | 'dueOn' | 'doneAt' | 'owner'>>

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
  /** Archives and clears all investor interest (requests, their handling and notices). Returns how many requests. */
  orgArchiveInterest(): Promise<number>
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

  // ---- stage screen ----
  /** Shared stage state (anyone may read it: investors' phones show the interest prompt). */
  getStage(): Promise<StageSnapshot>
  /** Puts a startup on stage (the previous one becomes pitched) and starts its pitch timer. */
  orgStartPitch(id: string, pitchSecs: number, qaSecs: number): Promise<void>
  orgSetStage(mode: StageMode, startupId: string | null, pitchSecs: number, qaSecs: number): Promise<void>
  /** Adds time to whichever timer is running (pitch or Q&A). */
  orgStageAddTime(secs: number): Promise<void>
  /** Skips the interest countdown: the projector shows the VC-interest results until the next pitch. */
  orgStageShowResults(startupId: string, interestSecs: number): Promise<void>
  /** Current slide of the deck on the projector (any organiser, so the projector's clicker can sync it). */
  orgStageSlide(page: number): Promise<void>
  /** Deck PDFs for the projector: startup id → version (changes when the file is replaced). */
  orgListDeckFiles(): Promise<Map<string, string>>
  orgUploadDeck(startupId: string, file: File): Promise<void>
  orgDownloadDeck(startupId: string): Promise<ArrayBuffer | null>
  orgDeleteDeck(startupId: string): Promise<void>

  // ---- CRM (organisers; editors write) ----
  orgListConnections(): Promise<CrmConnection[]>
  /** Adds connections; pairs already in the CRM are skipped. Returns the ones added. */
  orgAddConnections(drafts: CrmConnectionDraft[]): Promise<CrmConnection[]>
  orgUpdateConnection(id: string, patch: CrmConnectionPatch): Promise<CrmConnection>
  /** Removes a connection and its whole timeline. */
  orgDeleteConnection(id: string): Promise<void>
  orgListActivities(): Promise<CrmActivity[]>
  orgAddActivities(drafts: CrmActivityDraft[]): Promise<CrmActivity[]>
  orgUpdateActivity(id: string, patch: CrmActivityPatch): Promise<CrmActivity>
  orgDeleteActivity(id: string): Promise<void>
  /** Interest cleared by queue restarts (update 006), so it can still go into the CRM. */
  orgListArchivedRequests(): Promise<InterestRequest[]>

  /** Calls `cb` when data in a topic may have changed (realtime or cross-tab). */
  subscribe(audience: Audience, cb: (topic: Topic) => void): () => void
}
