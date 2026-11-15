/**
 * Pitch-deck PDFs saved on this device (IndexedDB), one per startup, for the organiser's stage presenter.
 * Nothing here is uploaded: a deck picked on the presentation laptop stays on that laptop.
 * Every call fails soft (private windows or blocked storage just mean "no saved deck").
 */
export interface LocalDeck {
  startupId: string
  name: string
  size: number
  savedAt: string
  data: ArrayBuffer
}

const DB = 'rtih-catalyst-decks'
const STORE = 'decks'

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'startupId' })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open()
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = fn(db.transaction(STORE, mode).objectStore(STORE))
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  } finally {
    db.close()
  }
}

export async function getLocalDeck(startupId: string): Promise<LocalDeck | null> {
  try {
    return ((await run('readonly', (s) => s.get(startupId))) as LocalDeck | undefined) ?? null
  } catch {
    return null
  }
}

/** Saves the deck; returns false if this browser would not store it (the deck still presents this time). */
export async function saveLocalDeck(startupId: string, file: File, data: ArrayBuffer): Promise<boolean> {
  try {
    const deck: LocalDeck = { startupId, name: file.name, size: file.size, savedAt: new Date().toISOString(), data }
    await run('readwrite', (s) => s.put(deck))
    return true
  } catch {
    return false
  }
}

export async function removeLocalDeck(startupId: string): Promise<void> {
  try {
    await run('readwrite', (s) => s.delete(startupId))
  } catch {
    /* nothing saved */
  }
}

export async function listLocalDeckIds(): Promise<Set<string>> {
  try {
    return new Set(((await run('readonly', (s) => s.getAllKeys())) as IDBValidKey[]).map(String))
  } catch {
    return new Set()
  }
}

/** Stores a deck as-is (used to cache downloaded decks on this device). */
export async function putLocalDeck(deck: LocalDeck): Promise<void> {
  try {
    await run('readwrite', (s) => s.put(deck))
  } catch {
    /* cache only */
  }
}

/** startup id → saved-at stamp of every deck saved on this device. */
export async function listLocalDeckVersions(): Promise<Map<string, string>> {
  try {
    const all = (await run('readonly', (s) => s.getAll())) as LocalDeck[]
    return new Map(all.map((d) => [d.startupId, d.savedAt]))
  } catch {
    return new Map()
  }
}
