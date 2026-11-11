export type ActionType = 'deck' | 'meet_today' | 'meet_later'

export const ACTION_TYPES: ActionType[] = ['deck', 'meet_today', 'meet_later']

export interface EventSettings {
  /** e.g. "Catalyst 1.0" */
  eventName: string
  /** e.g. "Demo Day" */
  eventTitle: string
  organiserName: string
  tagline: string
  /** yyyy-mm-dd */
  date: string
  /** e.g. "9 AM to 4 PM" */
  hours: string
  venue: string
  /** Fund names offered as suggestions so the live board stays consistent */
  participatingFunds: string[]
  /** Fixed list of meeting rooms organisers pick from */
  rooms: string[]
  /** Whether organisers may type a room that is not in the list */
  allowCustomRoom: boolean
  contactEmail: string
  contactPhone: string
}

export type StartupStatus = 'queued' | 'pitching' | 'done'

export interface Startup {
  id: string
  position: number
  name: string
  sector: string
  description: string
  city: string
  stage: string
  founders: string
  website: string
  problem: string
  solution: string
  market: string
  traction: string
  businessModel: string
  team: string
  ask: string
  onePagerUrl: string
  status: StartupStatus
  hidden: boolean
  /** Investors can open the pitch deck in the app (no request needed) */
  deckAvailable: boolean
  updatedAt: string
}

/** Organiser-only details about a startup (never shown to investors). */
export interface StartupPrivate {
  startupId: string
  deckUrl: string
  contactName: string
  contactEmail: string
  contactPhone: string
  notes: string
}

export interface InvestorInput {
  name: string
  fund: string
  email: string
  phone: string
  designation: string
}

export interface Investor extends InvestorInput {
  id: string
  inviteToken: string
  createdAt: string
  createdBy: 'self' | 'organiser'
}

/** One investor's selection of one action for one startup. */
export interface InterestRequest {
  id: string
  investorId: string
  startupId: string
  type: ActionType
  active: boolean
  createdAt: string
  updatedAt: string
  withdrawnAt: string | null
}

export type HandlingStatus = 'new' | 'approved' | 'archived'

/** Organiser-side handling of a request. Investors never read this directly. */
export interface RequestHandling {
  requestId: string
  status: HandlingStatus
  room: string
  meetingAt: string
  deckLink: string
  message: string
  organiserNote: string
  approvedAt: string | null
  notifiedAt: string | null
}

/** What an organiser explicitly sends to one investor. */
export interface Notice {
  id: string
  investorId: string
  requestId: string
  startupId: string
  type: ActionType
  room: string
  meetingAt: string
  deckLink: string
  message: string
  createdAt: string
  readAt: string | null
}

/** Public-to-participants: which fund expressed interest in which startup. */
export interface LiveInterest {
  startupId: string
  investorId: string
  fund: string
  updatedAt: string
}

export type OrganiserRole = 'editor' | 'viewer'

/** An investor opened a startup's deck (organiser analytics). */
export interface DeckView {
  investorId: string
  startupId: string
  firstViewedAt: string
  lastViewedAt: string
  views: number
}

export interface Organiser {
  email: string
  name: string
  /** editor: full control · viewer: read-only overview */
  role: OrganiserRole
}

export type Topic =
  | 'settings'
  | 'startups'
  | 'requests'
  | 'handling'
  | 'live'
  | 'notices'
  | 'investors'
  | 'private'
  | 'deckViews'
