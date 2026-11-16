import { deckEmbed } from './utils'

/**
 * How the stage presenter shows a startup's deck link when no PDF is saved on this laptop.
 * Only a PDF drawn by the app gives full clicker control; Google blocks the app from downloading
 * Drive files itself, so for Drive and Slides decks the presenter offers a one-click PDF download
 * that the organiser then loads once from the laptop.
 * - pdf:    a direct link to a .pdf file; the app tries to download and draw it.
 * - drive:  a Google Drive file; shown in Drive's viewer (scrolls, no slide-by-slide clicker).
 * - slides: Google Slides' own player, which handles clicker keys itself once focused.
 * - frame:  any other embeddable page (Canva, websites, Drive folders).
 * - link:   cannot be embedded (SharePoint, OneDrive, DocSend); open in a new tab.
 * - none:   no link on file.
 */
export type DeckSource =
  | { kind: 'pdf'; fetchUrl: string; open: string; download: string }
  | { kind: 'drive'; id: string; embed: string; open: string; download: string }
  | { kind: 'slides'; id: string; embed: string; open: string; download: string }
  | { kind: 'frame'; embed: string; open: string }
  | { kind: 'link'; open: string }
  | { kind: 'none' }

export function deckSource(url: string): DeckSource {
  const u = url.trim()
  if (!u) return { kind: 'none' }
  const slides = /docs\.google\.com\/presentation\/d\/([\w-]+)/.exec(u)
  if (slides)
    return {
      kind: 'slides',
      id: slides[1],
      embed: `https://docs.google.com/presentation/d/${slides[1]}/embed?start=false&loop=false&delayms=60000&rm=minimal`,
      open: u,
      download: `https://docs.google.com/presentation/d/${slides[1]}/export/pdf`,
    }
  const driveFile =
    /drive\.google\.com\/file\/d\/([\w-]+)/.exec(u) ||
    /drive\.google\.com\/(?:open|uc)\?(?:[^#]*&)?id=([\w-]+)/.exec(u)
  if (driveFile)
    return {
      kind: 'drive',
      id: driveFile[1],
      embed: `https://drive.google.com/file/d/${driveFile[1]}/preview`,
      open: u,
      download: `https://drive.usercontent.google.com/download?id=${driveFile[1]}&export=download`,
    }
  if (/^https?:\/\/[^?#]+\.pdf(?:[?#].*)?$/i.test(u)) return { kind: 'pdf', fetchUrl: u, open: u, download: u }
  const d = deckEmbed(u)
  return d.embed ? { kind: 'frame', embed: d.embed, open: d.open } : { kind: 'link', open: d.open }
}

/**
 * Can this device show the deck link? A Google Slides / Drive file that is not shared publicly only shows
 * Google's sign-in or error page, so check first: Google serves a thumbnail image only for files this browser
 * may open (a cross-site image's load / error is visible to the page, unlike an embedded page's contents).
 * Other links are assumed fine.
 */
export function probeDeckLink(src: DeckSource, timeoutMs = 8000): Promise<boolean> {
  const url =
    src.kind === 'slides'
      ? `https://docs.google.com/presentation/d/${src.id}/export/png`
      : src.kind === 'drive'
        ? `https://drive.google.com/thumbnail?id=${src.id}&sz=w64`
        : null
  if (!url) return Promise.resolve(true)
  return new Promise((resolve) => {
    const img = new Image()
    const done = (ok: boolean) => {
      window.clearTimeout(timer)
      img.onload = img.onerror = null
      resolve(ok)
    }
    const timer = window.setTimeout(() => done(false), timeoutMs)
    img.onload = () => done(img.naturalWidth > 0)
    img.onerror = () => done(false)
    img.src = url
  })
}

/** File picker filter for decks: PDFs, plus slide files so we can explain how to convert them. */
export const DECK_FILE_ACCEPT = 'application/pdf,.pdf,.ppt,.pptx,.key,.odp'

/** Why a picked file cannot be shown, in words an organiser can act on. */
export function notAPdfMessage(name: string): string {
  return /\.(pptx?|key|odp)$/i.test(name)
    ? `“${name}” is a slides file. Browsers can only show PDFs: open it and save as PDF (PowerPoint: File → Save As → PDF; Keynote: File → Export To → PDF; Google Slides: File → Download → PDF), then load the PDF.`
    : `“${name}” is not a PDF that can be shown.`
}
