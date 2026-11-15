import { useCallback, useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy } from '../lib/pdf'
import { cn } from '../lib/utils'

/**
 * One PDF page, scaled to fit its container (letterboxed on black).
 * The next page is drawn ahead of time so a clicker press shows it instantly.
 */
export function PdfSlides({
  doc,
  page,
  className,
  onClick,
}: {
  doc: PDFDocumentProxy
  page: number
  className?: string
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const total = doc.numPages

  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => e && setSize({ w: Math.floor(e.contentRect.width), h: Math.floor(e.contentRect.height) }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const cache = useRef(new Map<number, Promise<HTMLCanvasElement>>())
  useEffect(() => cache.current.clear(), [doc, size.w, size.h])

  const drawPage = useCallback(
    (n: number): Promise<HTMLCanvasElement> => {
      const hit = cache.current.get(n)
      if (hit) return hit
      const job = (async () => {
        const p = await doc.getPage(n)
        const base = p.getViewport({ scale: 1 })
        const dpr = Math.min(window.devicePixelRatio || 1, 2)
        const vp = p.getViewport({ scale: Math.min(size.w / base.width, size.h / base.height) * dpr })
        const c = document.createElement('canvas')
        c.width = Math.floor(vp.width)
        c.height = Math.floor(vp.height)
        await p.render({ canvas: c, viewport: vp }).promise
        return c
      })()
      job.catch(() => cache.current.delete(n))
      cache.current.set(n, job)
      return job
    },
    [doc, size.w, size.h],
  )

  useEffect(() => {
    if (!size.w || !size.h) return
    let stale = false
    // keep memory small: only the slides around the current one stay drawn
    for (const k of cache.current.keys()) if (k < page - 1 || k > page + 2) cache.current.delete(k)
    drawPage(page)
      .then((c) => {
        const v = canvasRef.current
        if (stale || !v) return
        const dpr = Math.min(window.devicePixelRatio || 1, 2)
        v.width = c.width
        v.height = c.height
        v.style.width = `${c.width / dpr}px`
        v.style.height = `${c.height / dpr}px`
        v.getContext('2d')?.drawImage(c, 0, 0)
        if (page < total) void drawPage(page + 1).catch(() => {})
      })
      .catch(() => {})
    return () => {
      stale = true
    }
  }, [page, total, size.w, size.h, drawPage])

  return (
    <div ref={boxRef} className={cn('absolute inset-0 flex items-center justify-center', className)} onClick={onClick}>
      <canvas ref={canvasRef} className="block" aria-label={`Slide ${page} of ${total}`} />
    </div>
  )
}
