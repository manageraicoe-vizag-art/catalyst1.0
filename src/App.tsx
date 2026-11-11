import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { HashRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Sparkle } from './components/Decor'
import { InvestorShell } from './components/Layout'
import { Spinner } from './components/ui'
import { InvestorProvider, useInvestor } from './context/Investor'
import { OrganiserProvider, useOrganiser } from './context/Organiser'
import { ToastProvider } from './context/Toast'
import { ClaimInvitePage, JoinPage } from './pages/Join'
import { LiveBoard, LivePage } from './pages/Live'
import { MePage } from './pages/Me'
import { StartupDetailPage } from './pages/StartupDetail'
import { StartupsPage } from './pages/Startups'
import { OrganiserGate } from './pages/organiser/Gate'
import { InvestorsPage } from './pages/organiser/Investors'
import { MeetingsPage } from './pages/organiser/Meetings'
import { OverviewPage } from './pages/organiser/Overview'
import { QueuePage } from './pages/organiser/Queue'
import { RequestsPage } from './pages/organiser/Requests'
import { SettingsPage } from './pages/organiser/Settings'

function RequireInvestor({ children }: { children: ReactNode }) {
  const { ready, me, unread } = useInvestor()
  const loc = useLocation()
  if (!ready) return <Spinner />
  if (!me) return <Navigate to="/" replace state={{ from: loc.pathname }} />
  return (
    <InvestorShell unread={unread} name={`${me.name} · ${me.fund}`}>
      {children}
    </InvestorShell>
  )
}

function InvestorLive() {
  const { startups, live, me } = useInvestor()
  return <LivePage startups={startups} live={live} myFund={me?.fund} />
}

function InvestorRoutes() {
  return (
    <Routes>
      <Route path="/" element={<JoinPage />} />
      <Route path="/i/:token" element={<ClaimInvitePage />} />
      <Route path="/startups" element={<RequireInvestor><StartupsPage /></RequireInvestor>} />
      <Route path="/startups/:id" element={<RequireInvestor><StartupDetailPage /></RequireInvestor>} />
      <Route path="/live" element={<RequireInvestor><InvestorLive /></RequireInvestor>} />
      <Route path="/me" element={<RequireInvestor><MePage /></RequireInvestor>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

/** Full-screen live board for projecting in the hall (organiser sign-in required). */
function ProjectorBoard() {
  const { ready, organiser, startups, live, settings } = useOrganiser()
  if (!ready) return <Spinner />
  if (!organiser) return <Navigate to="/organiser" replace />
  return (
    <div className="circuit-bg min-h-dvh bg-black px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <Link to="/organiser/overview" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
            <ArrowLeft className="h-4 w-4" aria-hidden /> Dashboard
          </Link>
          <Sparkle className="h-6 w-6" twinkle />
        </div>
        <img src="./brand/catalyst-logo.png" alt={`${settings.eventName}: ${settings.tagline}`} width={606} height={96} className="w-[min(100%,480px)]" />
        <h1 className="mb-6 mt-1 font-pixel text-3xl font-bold uppercase text-paper sm:text-5xl">Live interest</h1>
        <LiveBoard startups={startups.filter((s) => !s.hidden)} live={live} />
      </div>
    </div>
  )
}

function OrganiserRoutes() {
  return (
    <Routes>
      <Route path="board" element={<ProjectorBoard />} />
      <Route
        path="*"
        element={
          <OrganiserGate>
            <Routes>
              <Route index element={<RequestsPage />} />
              <Route path="queue" element={<QueuePage />} />
              <Route path="meetings" element={<MeetingsPage />} />
              <Route path="investors" element={<InvestorsPage />} />
              <Route path="overview" element={<OverviewPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/organiser" replace />} />
            </Routes>
          </OrganiserGate>
        }
      />
    </Routes>
  )
}

export default function App() {
  return (
    <HashRouter>
      <ToastProvider>
        <Routes>
          <Route
            path="/organiser/*"
            element={
              <OrganiserProvider>
                <OrganiserRoutes />
              </OrganiserProvider>
            }
          />
          <Route
            path="/*"
            element={
              <InvestorProvider>
                <InvestorRoutes />
              </InvestorProvider>
            }
          />
        </Routes>
      </ToastProvider>
    </HashRouter>
  )
}
