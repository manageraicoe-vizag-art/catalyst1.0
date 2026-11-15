import type { ActionType, EventSettings } from './types'

export const ACTION_LABEL: Record<ActionType, string> = {
  deck: 'Request pitch deck',
  meet_today: 'Request a meeting today',
  meet_later: 'Schedule a call after the event',
}

export const ACTION_SHORT: Record<ActionType, string> = {
  deck: 'Pitch deck',
  meet_today: 'Meet today',
  meet_later: 'Schedule a call later',
}

export const ACTION_HELP: Record<ActionType, string> = {
  deck: 'The RTIH team reviews deck requests and shares the deck with you. Nothing is sent to founders automatically.',
  meet_today:
    'An expression of interest, not a confirmed booking. If approved, the RTIH team will send you the room and time here. Choosing this replaces a “Schedule a call later” request.',
  meet_later:
    'An expression of interest in a call after Demo Day. The RTIH team will be in touch to arrange it. Choosing this replaces a “Meet today” request.',
}

export const LIVE_DISCLAIMER =
  'This board shows expressions of interest only (pitch-deck and meeting requests). It does not indicate any investment decision, commitment or endorsement by any fund.'

export const ROUTING_NOTE =
  'All requests go to the RTIH team first. Nothing is sent to founders automatically.'

export const DEFAULT_SETTINGS: EventSettings = {
  eventName: 'Catalyst 1.0',
  eventTitle: 'Demo Day',
  organiserName: 'RTIH Visakhapatnam',
  tagline: 'The investor journey for founders',
  date: '2026-11-16',
  hours: '9 AM to 4 PM',
  venue: 'RTIH, Visakhapatnam',
  // From the event poster. Organisers can edit this list in Settings.
  participatingFunds: [
    'Pavestone',
    'India Quotient',
    'Seafund',
    'Java Capital',
    'The Investment Trust of India (Growth Opportunities Fund)',
    'India Accelerator',
    'Transition',
    'MeritX Ventures',
    'IN44',
    'abbstrat (Tagging India)',
    'IIM Calcutta Innovation Park',
    'IAN Group',
    'GTMX Ventures',
    'SIDBI',
    'Venture Catalysts',
    'Cumulative Capital',
    'IvyCap Ventures',
    'Pentathlon Ventures',
    'Unicorn India Ventures',
    'Soonicorn Ventures',
  ],
  rooms: ['Meeting Room 1', 'Meeting Room 2', 'Meeting Room 3', 'Board Room', 'Lounge Table A', 'Lounge Table B'],
  allowCustomRoom: true,
  contactEmail: '',
  contactPhone: '',
}

export const STORAGE_PREFIX = 'rtih-catalyst'
