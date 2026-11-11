import { ArrowRight, Lock, MousePointerClick, Radio, ShieldCheck } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { IdeasToImpact, Lighthouse, Ribbon, Sparkle } from '../components/Decor'
import { DemoBanner } from '../components/Layout'
import { Button, Field, Input, Notice, Spinner } from '../components/ui'
import { useInvestor } from '../context/Investor'
import { useToast } from '../context/Toast'
import { ROUTING_NOTE } from '../lib/constants'
import type { EventSettings, InvestorInput } from '../lib/types'

const EMPTY: InvestorInput = { name: '', fund: '', email: '', phone: '', designation: '' }

export function InvestorForm({
  initial = EMPTY,
  submitLabel,
  onSubmit,
  fundSuggestions = [],
}: {
  initial?: InvestorInput
  submitLabel: string
  onSubmit: (v: InvestorInput) => Promise<void>
  fundSuggestions?: string[]
}) {
  const [v, setV] = useState<InvestorInput>(initial)
  const [errors, setErrors] = useState<Partial<Record<keyof InvestorInput, string>>>({})
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const set = (k: keyof InvestorInput) => (e: { target: { value: string } }) => setV((x) => ({ ...x, [k]: e.target.value }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const errs: typeof errors = {}
    if (!v.name.trim()) errs.name = 'Please enter your name'
    if (!v.fund.trim()) errs.fund = 'Please enter your fund or firm'
    if (!v.email.trim() && !v.phone.trim()) errs.email = 'Add an email or a phone number so RTIH can reach you'
    if (v.email.trim() && !/^\S+@\S+\.\S+$/.test(v.email.trim())) errs.email = 'That email does not look right'
    setErrors(errs)
    if (Object.keys(errs).length) return
    setBusy(true)
    setFormError(null)
    try {
      await onSubmit(v)
    } catch (err) {
      setFormError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Your name" required error={errors.name} htmlFor="inv-name">
          <Input id="inv-name" autoComplete="name" value={v.name} onChange={set('name')} placeholder="Full name" />
        </Field>
        <Field
          label="Fund / firm"
          required
          error={errors.fund}
          htmlFor="inv-fund"
          hint={fundSuggestions.length ? 'Pick from the list so your fund shows correctly on the live board' : undefined}
        >
          <Input
            id="inv-fund"
            autoComplete="organization"
            list="participating-funds"
            value={v.fund}
            onChange={set('fund')}
            placeholder="Start typing your fund"
          />
          <datalist id="participating-funds">
            {fundSuggestions.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
        </Field>
        <Field label="Email" error={errors.email} htmlFor="inv-email">
          <Input id="inv-email" type="email" inputMode="email" autoComplete="email" value={v.email} onChange={set('email')} placeholder="you@fund.com" />
        </Field>
        <Field label="Phone / WhatsApp" htmlFor="inv-phone">
          <Input id="inv-phone" type="tel" inputMode="tel" autoComplete="tel" value={v.phone} onChange={set('phone')} placeholder="+91 98xxx xxxxx" />
        </Field>
        <Field label="Designation" className="sm:col-span-2" htmlFor="inv-des">
          <Input id="inv-des" autoComplete="organization-title" value={v.designation} onChange={set('designation')} placeholder="Partner, Principal, Angel…" />
        </Field>
      </div>
      {formError && <Notice tone="amber">{formError}</Notice>}
      <Button type="submit" size="lg" className="w-full" loading={busy} icon={!busy && <ArrowRight className="h-5 w-5" />}>
        {submitLabel}
      </Button>
    </form>
  )
}

function dayMonth(ymd: string): [string, string] {
  const d = new Date(ymd + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return ['', '']
  return [String(d.getDate()), d.toLocaleDateString('en-GB', { month: 'short' })]
}

/** The poster, as a responsive hero. */
export function PosterHero({ settings, children }: { settings: EventSettings; children?: React.ReactNode }) {
  const [day, mon] = dayMonth(settings.date)
  return (
    <div className="circuit-bg relative overflow-hidden bg-black">
      <Sparkle className="absolute left-[6%] top-[18%] h-10 w-10 sm:h-16 sm:w-16" twinkle />
      <Sparkle className="absolute left-[11%] top-[34%] h-3 w-3 sm:h-4 sm:w-4" />
      <Sparkle className="absolute right-[8%] top-[9%] h-5 w-5 sm:h-7 sm:w-7" twinkle />
      <Sparkle className="absolute right-[5%] top-[46%] hidden h-6 w-6 sm:block" />
      <Ribbon className="bottom-0 left-0 h-24 w-44 sm:h-40 sm:w-72" />
      <Lighthouse className="pointer-events-none absolute -bottom-1 right-0 w-48 opacity-25 sm:w-96" />

      <div className="relative mx-auto max-w-3xl px-4 pb-28 pt-8 text-center sm:pb-32 sm:pt-12">
        <p className="font-serif text-2xl font-medium tracking-wide text-paper sm:text-3xl">RTIH</p>
        <p className="-mt-0.5 font-display text-[10px] font-semibold uppercase tracking-[0.3em] text-paper sm:text-xs">
          Visakhapatnam
        </p>

        <h1 className="mt-6 font-pixel text-3xl font-bold uppercase tracking-[0.12em] text-brand-800 sm:text-5xl">
          {settings.eventName}
        </h1>
        <p className="mt-1 font-serif text-base text-paper sm:text-xl">{settings.tagline}</p>

        <div className="mt-6 flex items-center justify-center gap-3 sm:gap-5">
          <span className="font-pixel text-[2.6rem] font-bold uppercase leading-none text-paper sm:text-7xl">
            {settings.eventTitle}
          </span>
          {day && (
            <>
              <span className="h-12 w-[3px] bg-brand-800 sm:h-20" aria-hidden />
              <span className="text-left font-pixel font-bold leading-none text-paper">
                <span className="block text-3xl sm:text-5xl">{day}</span>
                <span className="block text-base sm:text-2xl">{mon}</span>
              </span>
            </>
          )}
        </div>

        <div className="mt-7 flex items-center gap-3 text-paper/90" aria-hidden>
          <span className="h-px flex-1 bg-paper/50" />
          <span className="h-1.5 w-1.5 rotate-45 border border-paper/70" />
          <span className="font-display text-sm sm:text-base">{settings.hours} · Invite-only</span>
          <span className="h-1.5 w-1.5 rotate-45 border border-paper/70" />
          <span className="h-px flex-1 bg-paper/50" />
        </div>
        <p className="sr-only">
          {settings.hours}, invite-only, at {settings.venue}
        </p>
        {children}
      </div>
    </div>
  )
}

export function JoinPage() {
  const { ready, me, settings, register } = useInvestor()
  const nav = useNavigate()
  const loc = useLocation()
  const from = (loc.state as { from?: string } | null)?.from ?? '/startups'

  if (!ready) return <Spinner />
  if (me) return <Navigate to={from} replace />

  return (
    <div className="min-h-dvh bg-black">
      <DemoBanner />
      <PosterHero settings={settings} />

      <div className="relative mx-auto grid max-w-5xl gap-6 px-4 pb-10 pt-2 lg:grid-cols-[1fr_340px]">
        <div className="rounded-2xl border border-brand-300 bg-white p-5 shadow-[0_0_0_1px_rgba(246,168,200,.08),0_20px_60px_-20px_rgba(246,168,200,.25)] sm:p-7">
          <p className="eyebrow text-brand-700">Investor check-in</p>
          <h2 className="mt-1 text-lg font-bold text-slate-950">Enter your details once</h2>
          <p className="mb-5 mt-1 text-sm text-slate-600">
            Then respond to any startup with a single tap. No separate QR code per startup, nothing to re-enter.
          </p>
          <InvestorForm
            submitLabel="Continue to the startups"
            fundSuggestions={settings.participatingFunds}
            onSubmit={async (v) => {
              await register(v)
              nav(from, { replace: true })
            }}
          />
          <p className="mt-4 flex items-start gap-2 text-xs text-slate-500">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            Your contact details are visible only to the RTIH organising team. Other investors see only your fund name on
            the live interest board.
          </p>
        </div>

        <aside className="space-y-3">
          {[
            { icon: <MousePointerClick className="h-5 w-5" />, t: 'Tap to respond', b: 'Each startup has three options: pitch deck, meeting today, meeting after the event. Pick any, change any time.' },
            { icon: <ShieldCheck className="h-5 w-5" />, t: 'RTIH reviews every request', b: ROUTING_NOTE + ' Meeting requests are expressions of interest, not bookings.' },
            { icon: <Radio className="h-5 w-5" />, t: 'Live interest board', b: 'See which funds have expressed interest in each startup, updated live.' },
          ].map((x) => (
            <div key={x.t} className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-200">
                {x.icon}
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-950">{x.t}</p>
                <p className="mt-0.5 text-sm text-slate-600">{x.b}</p>
              </div>
            </div>
          ))}
          <p className="pt-2 text-center text-xs text-slate-500">
            RTIH team?{' '}
            <Link to="/organiser" className="font-medium text-brand-700 underline-offset-2 hover:underline">
              Organiser sign-in
            </Link>
          </p>
        </aside>
      </div>
      <IdeasToImpact className="pb-10" />
    </div>
  )
}

/** /i/:token: personal link that restores an investor's identity on this device. */
export function ClaimInvitePage() {
  const { token } = useParams()
  const { claimInvite } = useInvestor()
  const { toast } = useToast()
  const nav = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    claimInvite(token)
      .then((inv) => {
        toast({ title: `Welcome, ${inv.name.split(' ')[0]}`, body: `Signed in as ${inv.fund}.` })
        nav('/startups', { replace: true })
      })
      .catch((e: Error) => setError(e.message))
  }, [token]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!error) return <Spinner label="Opening your personal link…" />
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <Notice tone="amber">{error}</Notice>
      <Link to="/" className="mt-4 inline-block text-sm font-medium text-brand-700">
        Enter your details instead →
      </Link>
    </div>
  )
}
