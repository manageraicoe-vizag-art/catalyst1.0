import { cn } from '../lib/utils'

/** Four-point sparkle from the poster. */
export function Sparkle({ className, twinkle }: { className?: string; twinkle?: boolean }) {
  return (
    <svg viewBox="0 0 40 40" className={cn('text-paper', twinkle && 'animate-twinkle', className)} aria-hidden>
      <path
        d="M20 0c1.2 10.5 4.5 15.8 20 20-15.5 4.2-18.8 9.5-20 20-1.2-10.5-4.5-15.8-20-20C15.5 15.8 18.8 10.5 20 0z"
        fill="currentColor"
      />
    </svg>
  )
}

/** Simple lighthouse-on-the-cliff silhouette (Visakhapatnam coast), drawn as outline. */
export function Lighthouse({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 320 120" className={cn('text-paper', className)} fill="none" aria-hidden>
      <g stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round">
        <path d="M0 112c40-6 70-14 104-26 18-6 34-8 52-8h60c26 0 48 8 72 14 12 3 22 6 32 8" />
        <path d="M168 78l6-50h18l6 50" />
        <path d="M171 56h24M173 42h20" />
        <path d="M172 28h22v-8h-22z" />
        <path d="M176 20l7-9 7 9" />
        <path d="M183 11V6" />
        <path d="M140 80h22v-12h-22zM206 80h26v-10h-26z" />
        <path d="M196 24l60-10M196 26l60 2" strokeOpacity=".45" />
      </g>
    </svg>
  )
}

/** The diagonal "C1/26" ribbon from the poster's corner. */
export function Ribbon({ className }: { className?: string }) {
  return (
    <div className={cn('pointer-events-none absolute overflow-hidden', className)} aria-hidden>
      <div className="absolute left-[-30%] top-[38%] w-[160%] rotate-[28deg] border-t-2 border-paper/80" />
      <div className="absolute left-[-30%] top-[62%] w-[160%] rotate-[28deg] border-t-2 border-paper/80" />
      <span className="absolute left-[10%] top-[30%] rotate-[28deg] font-pixel text-sm font-bold text-go">C1/26</span>
      <span className="absolute left-[46%] top-[66%] rotate-[28deg] font-pixel text-sm font-bold text-flame">C1/26</span>
    </div>
  )
}

export function IdeasToImpact({ className }: { className?: string }) {
  return (
    <p className={cn('text-center font-display text-xs font-light uppercase tracking-[0.55em] text-slate-500', className)}>
      Ideas to Impact
    </p>
  )
}

/** Host hub (main). */
export function RtihMain({ className }: { className?: string }) {
  return (
    <img
      src="./brand/rtih-visakhapatnam.png"
      alt="RTIH Visakhapatnam"
      width={340}
      height={77}
      className={cn('h-auto', className)}
    />
  )
}

/** "in association with" partner hubs, styled like the poster. */
export function Association({ className, size = 'lg' }: { className?: string; size?: 'lg' | 'sm' }) {
  const logo = size === 'lg' ? 'w-[132px] sm:w-[170px]' : 'w-[92px] sm:w-[108px]'
  return (
    <div className={cn('flex flex-col items-center', className)}>
      <p
        className={cn(
          'font-display text-brand-800 underline decoration-brand-800/70 underline-offset-4',
          size === 'lg' ? 'text-base sm:text-lg' : 'text-xs',
        )}
      >
        in association with
      </p>
      <div className={cn('flex items-center justify-center', size === 'lg' ? 'mt-4 gap-6 sm:gap-12' : 'mt-2.5 gap-5')}>
        <img src="./brand/rtih-anantapuramu.png" alt="RTIH Anantapuramu" width={311} height={70} className={cn('h-auto', logo)} />
        <img src="./brand/rtih-tirupati.png" alt="RTIH Tirupati" width={311} height={70} className={cn('h-auto', logo)} />
      </div>
    </div>
  )
}

/** Footer used on every app page: host hub, partner hubs, tagline. */
export function SiteFooter({ className }: { className?: string }) {
  return (
    <footer className={cn('mx-auto flex max-w-5xl flex-col items-center gap-5 border-t border-slate-200 px-4 pt-8', className)}>
      <div className="flex flex-col items-center gap-1.5">
        <span className="font-display text-[11px] uppercase tracking-[0.25em] text-slate-500">Hosted by</span>
        <RtihMain className="w-[124px] sm:w-[140px]" />
      </div>
      <Association size="sm" />
      <IdeasToImpact className="pt-1" />
    </footer>
  )
}
