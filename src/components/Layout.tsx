import {
  BarChart3,
  CalendarClock,
  Eye,
  FlaskConical,
  Inbox,
  LayoutList,
  ListOrdered,
  LogOut,
  Radio,
  Settings,
  UserRound,
  Users,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { NavLink, Link } from 'react-router-dom'
import { isDemo } from '../lib/store'
import { SiteFooter } from './Decor'
import { cn } from '../lib/utils'

/** Header brand, one line: RTIH Visakhapatnam | Catalyst 1.0 */
export function Brand({ to = '/', compact }: { to?: string; sub?: string; compact?: boolean }) {
  return (
    <Link
      to={to}
      className={cn('flex min-w-0 shrink-0 items-center', compact ? 'gap-2 max-[379px]:gap-1.5 sm:gap-3' : 'gap-2.5 sm:gap-3')}
      aria-label="RTIH Visakhapatnam · Catalyst 1.0"
    >
      <img
        src="./brand/rtih-visakhapatnam.png"
        alt="RTIH Visakhapatnam"
        width={340}
        height={77}
        className={cn('w-auto shrink-0', compact ? 'h-6 max-[379px]:h-5 sm:h-8' : 'h-7 sm:h-8')}
      />
      <span className={cn('w-px shrink-0 bg-slate-400', compact ? 'h-5 max-[379px]:h-4 sm:h-7' : 'h-6 sm:h-7')} aria-hidden />
      <img
        src="./brand/catalyst-wordmark.png"
        alt="Catalyst 1.0"
        width={606}
        height={46}
        className={cn('w-auto shrink-0', compact ? 'h-[11px] max-[379px]:h-[9px] sm:h-[16px]' : 'h-[14px] sm:h-[16px]')}
      />
    </Link>
  )
}

export function DemoBanner() {
  if (!isDemo) return null
  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-center text-xs text-amber-950">
      <FlaskConical className="mr-1 inline h-3.5 w-3.5 align-[-2px]" aria-hidden />
      <strong>Demo mode:</strong> sample data, saved only in this browser. Connect Supabase for the live event.
    </div>
  )
}

interface NavItem {
  to: string
  label: string
  icon: ReactNode
  badge?: number
  end?: boolean
}

/** `from`: the width at which the top tabs replace the bottom tab bar */
function TopNav({ items, from = 'md' }: { items: NavItem[]; from?: 'md' | 'xl' }) {
  return (
    <nav className={cn('hidden items-center gap-1', from === 'xl' ? 'xl:flex' : 'md:flex')} aria-label="Main">
      {items.map((it) => (
        <NavLink
          key={it.to}
          to={it.to}
          end={it.end}
          className={({ isActive }) =>
            cn(
              'relative flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              isActive ? 'bg-brand-50 text-brand-900' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
            )
          }
        >
          {it.icon}
          {it.label}
          {!!it.badge && (
            <span className="tabular rounded-full bg-brand-800 px-1.5 text-[11px] font-bold text-black">{it.badge}</span>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

function BottomNav({ items, from = 'md' }: { items: NavItem[]; from?: 'md' | 'xl' }) {
  return (
    <nav
      className={cn('fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-black/90 backdrop-blur pb-safe', from === 'xl' ? 'xl:hidden' : 'md:hidden')}
      aria-label="Main"
    >
      <div className="mx-auto flex max-w-lg">
        {items.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.end}
            className={({ isActive }) =>
              cn(
                'relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium',
                isActive ? 'text-brand-800' : 'text-slate-500',
              )
            }
          >
            {({ isActive }) => (
              <>
                <span className={cn('rounded-full px-4 py-1 transition-colors', isActive && 'bg-brand-50')}>{it.icon}</span>
                {it.label}
                {!!it.badge && (
                  <span className="tabular absolute right-[calc(50%-22px)] top-1 min-w-[18px] rounded-full bg-brand-800 px-1 text-center text-[10px] font-bold text-black">
                    {it.badge}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

export function InvestorShell({ children, unread, name }: { children: ReactNode; unread: number; name?: string }) {
  const items: NavItem[] = [
    { to: '/startups', label: 'Startups', icon: <LayoutList className="h-5 w-5" aria-hidden /> },
    { to: '/live', label: 'Live board', icon: <Radio className="h-5 w-5" aria-hidden /> },
    { to: '/me', label: 'My requests', icon: <UserRound className="h-5 w-5" aria-hidden />, badge: unread },
  ]
  return (
    <div className="circuit-bg min-h-dvh">
      <DemoBanner />
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-black/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4">
          <Brand to="/startups" />
          <TopNav items={items} />
          {name && <span className="hidden max-w-[10rem] truncate text-sm text-slate-500 lg:block">{name}</span>}
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 pb-10 pt-4 md:pt-6">{children}</main>
      <SiteFooter className="pb-28 md:pb-10" />
      <BottomNav items={items} />
    </div>
  )
}

export function OrganiserShell({
  children,
  pendingCount,
  onSignOut,
  who,
  viewOnly,
}: {
  children: ReactNode
  pendingCount: number
  onSignOut: () => void
  who: string
  viewOnly?: boolean
}) {
  const items: NavItem[] = [
    { to: '/organiser', label: 'Requests', icon: <Inbox className="h-5 w-5" aria-hidden />, badge: pendingCount, end: true },
    { to: '/organiser/queue', label: 'Pitch queue', icon: <ListOrdered className="h-5 w-5" aria-hidden /> },
    { to: '/organiser/meetings', label: 'Meetings', icon: <CalendarClock className="h-5 w-5" aria-hidden /> },
    { to: '/organiser/investors', label: 'Investors', icon: <Users className="h-5 w-5" aria-hidden /> },
    { to: '/organiser/overview', label: 'Overview', icon: <BarChart3 className="h-5 w-5" aria-hidden /> },
  ]
  const mobileItems = items.map((i) => (i.to === '/organiser/queue' ? { ...i, label: 'Queue' } : i))
  return (
    <div className="circuit-bg min-h-dvh">
      <DemoBanner />
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-black/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4">
          <Brand to="/organiser" sub="Organiser dashboard" compact />
          <TopNav items={items} from="xl" />
          <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
            {viewOnly && (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-1.5 py-0.5 text-[11px] font-semibold text-sky-800 ring-1 ring-inset ring-sky-200 sm:mr-1 sm:px-2"
                title="Your organiser access is read-only"
              >
                <Eye className="h-3 w-3" aria-hidden /> <span className="hidden sm:inline">View only</span>
              </span>
            )}
            <NavLink
              to="/organiser/settings"
              className={({ isActive }) =>
                cn('rounded-lg p-1.5 sm:p-2', isActive ? 'bg-brand-50 text-brand-900' : 'text-slate-500 hover:bg-slate-100')
              }
              aria-label="Settings"
              title="Settings"
            >
              <Settings className="h-5 w-5" />
            </NavLink>
            <button
              onClick={onSignOut}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 sm:p-2"
              aria-label="Sign out"
              title={`Sign out ${who}`}
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 pb-10 pt-4 md:pt-6">{children}</main>
      <SiteFooter className="pb-28 xl:pb-10" />
      <BottomNav items={mobileItems} from="xl" />
    </div>
  )
}
