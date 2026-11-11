import { CalendarPlus, Check, FileText, Handshake, Loader2 } from 'lucide-react'
import { reqKey, useInvestor } from '../context/Investor'
import { ACTION_HELP, ACTION_LABEL, ACTION_SHORT } from '../lib/constants'
import { ACTION_TYPES, type ActionType, type Startup } from '../lib/types'
import { cn } from '../lib/utils'

export const ACTION_ICON: Record<ActionType, typeof FileText> = {
  deck: FileText,
  meet_today: Handshake,
  meet_later: CalendarPlus,
}

/** Three independent toggles. Each tap saves immediately. */
export function ActionToggles({ startup, layout = 'compact' }: { startup: Startup; layout?: 'compact' | 'full' }) {
  const { requests, pending, toggle } = useInvestor()

  return (
    <div className={cn('grid gap-2', layout === 'compact' ? 'grid-cols-3' : 'grid-cols-1')}>
      {ACTION_TYPES.map((type) => {
        const k = reqKey(startup.id, type)
        const on = !!requests.get(k)?.active
        const busy = pending.has(k)
        const Icon = ACTION_ICON[type]
        return (
          <button
            key={type}
            type="button"
            aria-pressed={on}
            onClick={() => toggle(startup, type)}
            className={cn(
              'group relative flex rounded-xl text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 active:scale-[0.98]',
              layout === 'compact'
                ? 'min-h-[60px] flex-col items-center justify-center gap-1 px-1.5 py-2 text-center'
                : 'items-start gap-3 p-3.5',
              on
                ? 'bg-brand-800 text-black shadow-sm ring-1 ring-brand-800'
                : 'bg-slate-100 text-slate-800 ring-1 ring-inset ring-slate-300 hover:ring-brand-500',
            )}
          >
            <span
              className={cn(
                'flex shrink-0 items-center justify-center rounded-full',
                layout === 'compact' ? 'h-6 w-6' : 'mt-0.5 h-8 w-8',
                on ? 'bg-black/15' : 'bg-slate-200 text-slate-700',
              )}
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : on ? (
                <Check className="h-4 w-4" strokeWidth={3} aria-hidden />
              ) : (
                <Icon className="h-4 w-4" aria-hidden />
              )}
            </span>
            {layout === 'compact' ? (
              <span className="text-[12.5px] font-semibold leading-tight sm:text-[13px]">{ACTION_SHORT[type]}</span>
            ) : (
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="text-[15px] font-semibold">{ACTION_LABEL[type]}</span>
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold',
                      on ? 'bg-black/15 text-black' : 'bg-slate-200 text-slate-600',
                    )}
                  >
                    {on ? 'Requested · tap to withdraw' : 'Tap to request'}
                  </span>
                </span>
                <span className={cn('mt-1 block text-[13px] leading-snug', on ? 'text-black/70' : 'text-slate-500')}>
                  {ACTION_HELP[type]}
                </span>
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
