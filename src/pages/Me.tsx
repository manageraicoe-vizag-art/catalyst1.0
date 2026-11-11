import { BellRing, Copy, LogOut, Pencil, Share2, Smartphone } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ACTION_ICON } from '../components/ActionToggles'
import { NoticeCard, latestNotices } from '../components/NoticeCard'
import { Badge, Button, Card, EmptyState, Modal, Notice } from '../components/ui'
import { useInvestor } from '../context/Investor'
import { useToast } from '../context/Toast'
import { ACTION_SHORT, ROUTING_NOTE } from '../lib/constants'
import { ACTION_TYPES } from '../lib/types'
import { copyText, personalLink, timeAgo } from '../lib/utils'
import { InvestorForm } from './Join'

export function MePage() {
  const { me, startups, requests, notices, settings, toggle, pending, markAllRead, updateMe, forget, fundOptions } = useInvestor()
  const { toast } = useToast()
  const [editing, setEditing] = useState(false)
  const [confirmForget, setConfirmForget] = useState(false)

  // Opening this page marks updates as read (after a short delay so the highlight is visible).
  useEffect(() => {
    const t = window.setTimeout(() => void markAllRead(), 2500)
    return () => window.clearTimeout(t)
  }, [markAllRead])

  const byId = useMemo(() => new Map(startups.map((s) => [s.id, s])), [startups])
  const latest = latestNotices(notices)
  const confirmedReq = new Set(latest.map((n) => n.requestId))

  const myStartups = startups
    .map((s) => ({ s, reqs: ACTION_TYPES.map((t) => requests.get(`${s.id}:${t}`)).filter((r) => r?.active) }))
    .filter((x) => x.reqs.length > 0)

  if (!me) return null
  const link = personalLink(me.inviteToken)

  const share = async () => {
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> }
    if (nav.share) {
      try {
        await nav.share({ title: `${settings.eventName}: my investor link`, url: link })
        return
      } catch {
        /* cancelled */
      }
    }
    if (await copyText(link)) toast({ title: 'Link copied', body: 'Open it on your other device.' })
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <section aria-labelledby="updates">
        <div className="mb-3 flex items-center gap-2">
          <BellRing className="h-5 w-5 text-emerald-700" aria-hidden />
          <h1 id="updates" className="pixel-title text-xl text-slate-950">
            Updates from RTIH
          </h1>
        </div>
        {latest.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {latest.map((n) => (
              <NoticeCard key={n.id} notice={n} startup={byId.get(n.startupId)} eventDate={settings.date} />
            ))}
          </div>
        ) : (
          <Notice tone="slate">
            Nothing yet. When the RTIH team approves a meeting or shares a deck, the details (room, time, link) appear
            here and only you can see them.
          </Notice>
        )}
      </section>

      <section aria-labelledby="mine">
        <h2 id="mine" className="mb-1 text-lg font-bold text-slate-950">
          My requests
        </h2>
        <p className="mb-3 text-sm text-slate-600">{ROUTING_NOTE} Tap a request to withdraw it.</p>
        {myStartups.length === 0 ? (
          <EmptyState
            title="No requests yet"
            body="Browse the startups and tap Pitch deck, Meet today or Meet after event."
            action={
              <Link to="/startups">
                <Button>See startups</Button>
              </Link>
            }
          />
        ) : (
          <ul className="space-y-2">
            {myStartups.map(({ s, reqs }) => (
              <li key={s.id}>
                <Card className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <Link to={`/startups/${s.id}`} className="min-w-0">
                      <span className="tabular mr-2 text-xs font-bold text-slate-400">#{s.position}</span>
                      <span className="font-semibold text-slate-950 hover:text-brand-700">{s.name}</span>
                    </Link>
                    <span className="shrink-0 text-xs text-slate-400">{timeAgo(reqs[0]!.updatedAt)}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {ACTION_TYPES.map((t) => {
                      const r = requests.get(`${s.id}:${t}`)
                      if (!r?.active) return null
                      const Icon = ACTION_ICON[t]
                      const confirmed = confirmedReq.has(r.id)
                      return (
                        <button
                          key={t}
                          onClick={() => toggle(s, t)}
                          disabled={pending.has(`${s.id}:${t}`)}
                          className="group inline-flex items-center gap-1.5 rounded-full bg-brand-50 py-1 pl-2 pr-1 text-sm font-medium text-brand-900 ring-1 ring-inset ring-brand-200 hover:bg-red-50 hover:text-red-800 hover:ring-red-200"
                          title="Withdraw this request"
                        >
                          <Icon className="h-3.5 w-3.5" aria-hidden />
                          {ACTION_SHORT[t]}
                          {confirmed ? <Badge tone="green">Confirmed</Badge> : <Badge tone="slate">Received</Badge>}
                          <span className="px-1 text-xs text-slate-400 group-hover:text-red-700">Withdraw</span>
                        </button>
                      )
                    })}
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="details" className="grid gap-3 md:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 id="details" className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                My details
              </h2>
              <p className="mt-2 font-semibold text-slate-950">{me.name}</p>
              <p className="text-sm text-slate-700">
                {me.designation ? `${me.designation}, ` : ''}
                {me.fund}
              </p>
              <p className="mt-1 text-sm text-slate-500">{[me.email, me.phone].filter(Boolean).join(' · ')}</p>
            </div>
            <Button variant="ghost" size="sm" icon={<Pencil className="h-4 w-4" />} onClick={() => setEditing(true)}>
              Edit
            </Button>
          </div>
          <p className="mt-3 text-xs text-slate-500">Visible only to you and the RTIH organising team.</p>
        </Card>

        <Card className="p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            <Smartphone className="h-4 w-4" aria-hidden /> Use another device
          </h2>
          <p className="mt-2 text-sm text-slate-700">
            Open your personal link on a phone, tablet or laptop to continue there without re-entering details. Keep it
            private: anyone with it can respond as you.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" icon={<Share2 className="h-4 w-4" />} onClick={share}>
              Share my link
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={<Copy className="h-4 w-4" />}
              onClick={async () => (await copyText(link)) && toast({ title: 'Link copied' })}
            >
              Copy
            </Button>
          </div>
          <button onClick={() => setConfirmForget(true)} className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-red-700">
            <LogOut className="h-3.5 w-3.5" aria-hidden /> Not {me.name.split(' ')[0]}? Sign out on this device
          </button>
        </Card>
      </section>

      <Modal open={editing} onClose={() => setEditing(false)} title="Edit my details">
        <InvestorForm
          initial={me}
          fundSuggestions={fundOptions}
          submitLabel="Save details"
          onSubmit={async (v) => {
            await updateMe(v)
            setEditing(false)
            toast({ title: 'Details saved' })
          }}
        />
      </Modal>

      <Modal
        open={confirmForget}
        onClose={() => setConfirmForget(false)}
        title="Sign out on this device?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmForget(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                await forget()
                setConfirmForget(false)
              }}
            >
              Sign out
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-700">
          Your requests stay with the RTIH team. To come back on this device, use your personal link
          {me.email ? ' or enter your details again' : ''}.
        </p>
      </Modal>
    </div>
  )
}
