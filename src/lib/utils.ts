/** Same format on every phone at the event: 12-hour Indian English, e.g. "3:30 pm, 16 Nov". */
const LOCALE = 'en-IN'

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export function token(): string {
  const bytes = new Uint8Array(12)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export function nowIso(): string {
  return new Date().toISOString()
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return ''
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 45) return 'just now'
  if (diff < 3600) return `${Math.round(diff / 60)} min ago`
  if (diff < 86400) return `${Math.round(diff / 3600)} h ago`
  return new Date(iso).toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' })
}

export function clockTime(iso: string | null | undefined): string {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString(LOCALE, { hour: 'numeric', minute: '2-digit', hour12: true })
}

export function formatEventDate(ymd: string): string {
  if (!ymd) return 'Date to be announced'
  const d = new Date(ymd + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return ymd
  return d.toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

/**
 * Meeting time is stored as either "HH:MM" (on event day) or "yyyy-mm-ddTHH:MM"
 * (a later date) or free text. Render it for humans.
 */
export function formatMeetingAt(value: string, eventDate?: string): string {
  if (!value) return ''
  const hm = /^(\d{2}):(\d{2})$/.exec(value)
  if (hm) {
    const d = new Date(`${eventDate || '2000-01-01'}T${value}:00`)
    const t = d.toLocaleTimeString(LOCALE, { hour: 'numeric', minute: '2-digit', hour12: true })
    return eventDate ? `${t}, today (${shortDate(eventDate)})` : t
  }
  const dt = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(value)
  if (dt) {
    const d = new Date(`${dt[1]}T${dt[2]}:00`)
    return d.toLocaleString(LOCALE, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }
  return value
}

function shortDate(ymd: string): string {
  const d = new Date(ymd + 'T00:00:00')
  return d.toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' })
}

/** Comparison key for fund names: case-, space- and punctuation-insensitive ("Sea Fund" == "seafund"). */
export function normFund(name: string): string {
  return name.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '')
}

/** Merge fund lists, de-duplicated by normFund; the first spelling seen wins (curated lists go first). */
export function mergeFunds(...lists: string[][]): string[] {
  const seen = new Map<string, string>()
  for (const list of lists)
    for (const raw of list) {
      const name = raw.trim().replace(/\s+/g, ' ')
      const key = normFund(name)
      if (key && !seen.has(key)) seen.set(key, name)
    }
  return [...seen.values()].sort((a, b) => a.localeCompare(b))
}

/** Snap a typed fund to an existing spelling when it is the same fund. */
export function canonicalFund(typed: string, options: string[]): string {
  const key = normFund(typed)
  return options.find((o) => normFund(o) === key) ?? typed.trim().replace(/\s+/g, ' ')
}

/**
 * How to show a deck link inside the app. Google Drive/Slides/Canva get their embed views;
 * SharePoint/OneDrive refuse to be embedded, so those only get an "Open" button.
 */
export function deckEmbed(url: string): { embed: string | null; open: string } {
  const u = url.trim()
  const drive =
    /drive\.google\.com\/file\/d\/([\w-]+)/.exec(u) ||
    /docs\.google\.com\/(?:presentation|document|spreadsheets)\/d\/([\w-]+)/.exec(u) ||
    /drive\.google\.com\/open\?id=([\w-]+)/.exec(u)
  if (drive) return { embed: `https://drive.google.com/file/d/${drive[1]}/preview`, open: u }
  const folder = /drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\/([\w-]+)/.exec(u)
  if (folder) return { embed: `https://drive.google.com/embeddedfolderview?id=${folder[1]}#grid`, open: u }
  if (/canva\.com\/design\/[^/]+\/[^/]+\/view/.test(u)) return { embed: u.split('?')[0] + '?embed', open: u }
  if (/sharepoint\.com|onedrive\.live\.com|1drv\.ms|canva\.link|docsend\.com/.test(u)) return { embed: null, open: u }
  if (/^https?:\/\//i.test(u)) return { embed: u, open: u }
  return { embed: null, open: u }
}

export function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]!.toUpperCase())
      .join('') || '?'
  )
}

export function personalLink(inviteToken: string): string {
  const base = window.location.href.split('#')[0]
  return `${base}#/i/${inviteToken}`
}

export function eventLink(): string {
  return window.location.href.split('#')[0] + '#/'
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  }
}

// ---------- CSV ----------

export function toCsv(rows: Array<Record<string, unknown>>, columns?: string[]): string {
  const cols = columns ?? Array.from(new Set(rows.flatMap((r) => Object.keys(r))))
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : Array.isArray(v) ? v.join('; ') : String(v)
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n')
}

export function downloadFile(filename: string, content: string, type = 'text/csv;charset=utf-8') {
  const blob = new Blob(['﻿' + content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Parses CSV or TSV (auto-detected) with quoted fields. Returns header-keyed rows. */
export function parseDelimited(text: string): Array<Record<string, string>> {
  const clean = text.replace(/^﻿/, '').trim()
  if (!clean) return []
  const firstLine = clean.split(/\r?\n/, 1)[0]!
  const delim = (firstLine.match(/\t/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? '\t' : ','
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i]!
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          field += '"'
          i++
        } else inQuotes = false
      } else field += ch
    } else if (ch === '"') inQuotes = true
    else if (ch === delim) {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && clean[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += ch
  }
  row.push(field)
  rows.push(row)
  const header = rows.shift()!.map((h) => h.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''))
  return rows
    .filter((r) => r.some((c) => c.trim() !== ''))
    .map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()])))
}

export function waLink(phone: string, text: string): string | null {
  const digits = phone.replace(/[^\d]/g, '')
  if (digits.length < 10) return null
  const full = digits.length === 10 ? '91' + digits : digits
  return `https://wa.me/${full}?text=${encodeURIComponent(text)}`
}

export function mailtoLink(email: string, subject: string, body: string): string | null {
  if (!email || !email.includes('@')) return null
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}
