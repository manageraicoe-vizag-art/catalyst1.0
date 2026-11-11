import { ExternalLink, FileText, Loader2, Lock, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { store } from '../lib/store'
import type { Startup } from '../lib/types'
import { cn, deckEmbed } from '../lib/utils'
import { Button, Notice } from './ui'

/** Full-screen pitch deck viewer with an "Open link" fallback. */
export function DeckViewer({ startup, open, onClose }: { startup: Startup; open: boolean; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [frameLoaded, setFrameLoaded] = useState(false)
  // keep the latest onClose without re-running the scroll-lock effect on every parent render
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return
    setUrl(null)
    setError(null)
    setFrameLoaded(false)
    store
      .openDeck(startup.id)
      .then(setUrl)
      .catch((e: Error) => setError(e.message))
  }, [open, startup.id])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCloseRef.current()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open) return null
  const deck = url ? deckEmbed(url) : null

  return createPortal(
    <div className="fixed inset-0 z-[55] flex flex-col bg-black" role="dialog" aria-modal aria-label={`${startup.name} pitch deck`}>
      <header className="flex items-center gap-3 border-b border-slate-200 bg-black px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <FileText className="h-5 w-5 shrink-0 text-brand-800" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-slate-950">{startup.name}</p>
          <p className="text-xs text-slate-500">Pitch deck</p>
        </div>
        {deck && (
          <a href={deck.open} target="_blank" rel="noopener noreferrer">
            <Button variant="secondary" size="sm" icon={<ExternalLink className="h-4 w-4" />} type="button">
              Open link
            </Button>
          </a>
        )}
        <button onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900" aria-label="Close deck">
          <X className="h-5 w-5" />
        </button>
      </header>

      <div className="relative flex-1 bg-slate-100">
        {error && (
          <div className="mx-auto max-w-md p-6">
            <Notice tone="amber">{error}</Notice>
          </div>
        )}
        {!error && !deck && (
          <div className="flex h-full items-center justify-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> Opening deck…
          </div>
        )}
        {deck && !deck.embed && (
          <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
            <p className="text-sm text-slate-600">This deck opens on the startup’s own file-sharing page.</p>
            <a href={deck.open} target="_blank" rel="noopener noreferrer">
              <Button size="lg" icon={<ExternalLink className="h-5 w-5" />} type="button">
                Open pitch deck
              </Button>
            </a>
          </div>
        )}
        {deck?.embed && (
          <>
            {!frameLoaded && (
              <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> Loading deck…
              </div>
            )}
            <iframe
              src={deck.embed}
              title={`${startup.name} pitch deck`}
              // absolutely pinned: a percentage-height iframe inside a flex item can stop repainting
              className={cn('absolute inset-0 h-full w-full border-0', frameLoaded ? 'bg-white' : 'bg-transparent')}
              allow="fullscreen"
              allowFullScreen
              referrerPolicy="no-referrer"
              // third-party pages may run scripts, but may not navigate this app away
              sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-presentation allow-forms"
              onLoad={() => setFrameLoaded(true)}
            />
          </>
        )}
      </div>

      <footer className="flex items-start gap-2 border-t border-slate-200 bg-black px-4 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] text-xs text-slate-500">
        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>
          Shared for Catalyst 1.0 investors only; please keep it confidential. RTIH can see which decks you open; founders
          are not notified. If it doesn’t load here, use <strong className="text-slate-700">Open link</strong>.
        </span>
      </footer>
    </div>,
    document.body,
  )
}
