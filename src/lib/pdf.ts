import type { PDFDocumentProxy } from 'pdfjs-dist'
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

// pdf.js frees a document through the task that loaded it
const loadingTasks = new WeakMap<PDFDocumentProxy, { destroy: () => Promise<void> }>()

/** Opens a PDF with pdf.js (loaded on first use, so the main app stays small). */
export async function openPdf(data: ArrayBuffer): Promise<PDFDocumentProxy> {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc
  // pdf.js hands the buffer to its worker, so give it a copy and keep the caller's intact
  const task = pdfjs.getDocument({ data: new Uint8Array(data.slice(0)) })
  const doc = await task.promise
  loadingTasks.set(doc, task)
  return doc
}

export function closePdf(doc: PDFDocumentProxy): void {
  void loadingTasks.get(doc)?.destroy().catch(() => {})
}

export type { PDFDocumentProxy }
