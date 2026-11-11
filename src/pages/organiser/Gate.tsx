import { KeyRound, LogIn } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Brand, DemoBanner, OrganiserShell } from '../../components/Layout'
import { Button, Field, Input, Notice, Spinner } from '../../components/ui'
import { useOrganiser } from '../../context/Organiser'
import { isDemo } from '../../lib/store'
import { DEMO_ORGANISER_PASSCODE } from '../../lib/store/local'

export function OrganiserGate({ children }: { children: ReactNode }) {
  const { ready, organiser, signOut, requests, handling } = useOrganiser()
  if (!ready) return <Spinner />
  if (!organiser) return <OrganiserLogin />
  const pending = requests.filter((r) => r.active && (handling.get(r.id)?.status ?? 'new') === 'new').length
  return (
    <OrganiserShell pendingCount={pending} onSignOut={signOut} who={organiser.email}>
      {children}
    </OrganiserShell>
  )
}

function OrganiserLogin() {
  const { signIn } = useOrganiser()
  const [email, setEmail] = useState('')
  const [secret, setSecret] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await signIn(email, secret)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="circuit-bg min-h-dvh bg-black">
      <DemoBanner />
      <div className="mx-auto flex max-w-sm flex-col px-4 pt-14">
        <Brand to="/" sub="Organiser dashboard" />
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6">
          <div className="mb-4 flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-brand-800" aria-hidden />
            <h1 className="pixel-title text-lg text-slate-950">Organiser sign-in</h1>
          </div>
          <form onSubmit={submit} className="space-y-4">
            <Field label="Email" htmlFor="org-email">
              <Input id="org-email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required={!isDemo} placeholder="you@rtih.in" />
            </Field>
            <Field label={isDemo ? 'Passcode' : 'Password'} htmlFor="org-secret">
              <Input id="org-secret" type="password" autoComplete="current-password" value={secret} onChange={(e) => setSecret(e.target.value)} required />
            </Field>
            {error && <Notice tone="amber">{error}</Notice>}
            <Button type="submit" className="w-full" size="lg" loading={busy} icon={!busy && <LogIn className="h-5 w-5" />}>
              Sign in
            </Button>
          </form>
          {isDemo ? (
            <p className="mt-4 text-xs text-slate-500">
              Demo mode: any email, passcode <code className="rounded bg-slate-100 px-1 text-brand-800">{DEMO_ORGANISER_PASSCODE}</code>.
            </p>
          ) : (
            <p className="mt-4 text-xs text-slate-500">
              Access is limited to emails on the RTIH organiser list. Ask the event admin if you need access.
            </p>
          )}
        </div>
        <Link to="/" className="mt-6 text-center text-sm text-slate-500 hover:text-slate-800">
          ← Investor view
        </Link>
      </div>
    </div>
  )
}
