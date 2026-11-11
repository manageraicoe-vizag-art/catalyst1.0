import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react'
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { cn } from '../lib/utils'

type Kind = 'success' | 'info' | 'error'
interface ToastItem {
  id: number
  kind: Kind
  title: string
  body?: string
}

interface ToastApi {
  toast: (t: { kind?: Kind; title: string; body?: string; ms?: number }) => void
}

const Ctx = createContext<ToastApi>({ toast: () => {} })

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const seq = useRef(0)

  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), [])

  const toast = useCallback<ToastApi['toast']>(
    ({ kind = 'success', title, body, ms = 3800 }) => {
      const id = ++seq.current
      // phones show one toast at a time so the list stays visible; larger screens stack up to 3
      const keep = window.matchMedia('(min-width: 768px)').matches ? 2 : 0
      setItems((xs) => [...xs.slice(xs.length - keep), { id, kind, title, body }])
      window.setTimeout(() => dismiss(id), ms)
    },
    [dismiss],
  )

  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6 md:items-end md:px-6"
      >
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cn(
              'pointer-events-auto flex w-full max-w-sm animate-rise items-start gap-2.5 rounded-xl border bg-slate-100 p-3 shadow-lg shadow-black/60',
              t.kind === 'error' ? 'border-red-200' : 'border-slate-200',
            )}
          >
            {t.kind === 'success' && <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden />}
            {t.kind === 'info' && <Info className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" aria-hidden />}
            {t.kind === 'error' && <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden />}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">{t.title}</p>
              {t.body && <p className="mt-0.5 text-[13px] leading-snug text-slate-600">{t.body}</p>}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              className="-m-1 rounded p-1 text-slate-400 hover:text-slate-700"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

export const useToast = () => useContext(Ctx)
