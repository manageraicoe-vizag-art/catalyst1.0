import { useMemo } from 'react'
import { useOrganiser } from '../../context/Organiser'
import { ACTION_SHORT } from '../../lib/constants'
import type { EventSettings, InterestRequest, Investor, RequestHandling, Startup } from '../../lib/types'
import { formatMeetingAt, mailtoLink, waLink } from '../../lib/utils'

export function useLookups() {
  const { investors, startups, handling } = useOrganiser()
  return useMemo(
    () => ({
      investorById: new Map(investors.map((i) => [i.id, i])),
      startupById: new Map(startups.map((s) => [s.id, s])),
      handlingOf: (id: string): RequestHandling | undefined => handling.get(id),
    }),
    [investors, startups, handling],
  )
}

export type RowStatus = 'new' | 'approved' | 'notified' | 'withdrawn' | 'archived'

export function rowStatus(r: InterestRequest, h?: RequestHandling): RowStatus {
  if (!r.active) return 'withdrawn'
  if (!h || h.status === 'new') return 'new'
  if (h.status === 'archived') return 'archived'
  return h.notifiedAt ? 'notified' : 'approved'
}

/** Text an organiser can send through another channel (email / WhatsApp) after approval. */
export function noticeText(
  r: InterestRequest,
  h: RequestHandling,
  inv: Investor | undefined,
  s: Startup | undefined,
  settings: EventSettings,
): { subject: string; body: string } {
  const first = inv?.name.split(' ')[0] ?? ''
  const name = s?.name ?? 'the startup'
  const lines: string[] = [`Hi ${first},`, '']
  if (r.type === 'deck') {
    lines.push(`Thank you for your interest in ${name} at ${settings.eventName} ${settings.eventTitle}.`)
    if (h.deckLink) lines.push('', `Pitch deck: ${h.deckLink}`)
  } else {
    lines.push(`Your meeting with ${name} (${ACTION_SHORT[r.type].toLowerCase()}) is confirmed.`)
    if (h.room) lines.push(`Room: ${h.room}`)
    if (h.meetingAt) lines.push(`Time: ${formatMeetingAt(h.meetingAt, r.type === 'meet_today' ? settings.date : undefined)}`)
  }
  if (h.message) lines.push('', h.message)
  lines.push('', `RTIH team, ${settings.eventName} ${settings.eventTitle}`)
  const subject = r.type === 'deck' ? `${name}: pitch deck` : `${name}: meeting confirmed`
  return { subject: `${settings.eventName} · ${subject}`, body: lines.join('\n') }
}

export function channelLinks(
  r: InterestRequest,
  h: RequestHandling,
  inv: Investor | undefined,
  s: Startup | undefined,
  settings: EventSettings,
) {
  const { subject, body } = noticeText(r, h, inv, s, settings)
  return {
    email: inv ? mailtoLink(inv.email, subject, body) : null,
    whatsapp: inv ? waLink(inv.phone, body) : null,
  }
}
