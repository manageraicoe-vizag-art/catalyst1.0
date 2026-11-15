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
  | { kind: 'drive'; embed: string; open: string; download: string }
  | { kind: 'slides'; embed: string; open: string; download: string }
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
      embed: `https://drive.google.com/file/d/${driveFile[1]}/preview`,
      open: u,
      download: `https://drive.usercontent.google.com/download?id=${driveFile[1]}&export=download`,
    }
  if (/^https?:\/\/[^?#]+\.pdf(?:[?#].*)?$/i.test(u)) return { kind: 'pdf', fetchUrl: u, open: u, download: u }
  const d = deckEmbed(u)
  return d.embed ? { kind: 'frame', embed: d.embed, open: d.open } : { kind: 'link', open: d.open }
}
