import { getLocalDeck, putLocalDeck } from './localDecks'
import { store } from './store'

/**
 * A startup's deck PDF for presenting. Decks live in the shared "decks" bucket (live mode) so the
 * projector can show what an editor uploaded; each device keeps a copy and only downloads again
 * when the file has been replaced. In demo mode the decks are this browser's own copies.
 */
export async function fetchDeck(startupId: string, version: string | undefined): Promise<ArrayBuffer | null> {
  const cached = await getLocalDeck(startupId)
  if (cached && (store.mode === 'demo' || !version || cached.savedAt === version)) return cached.data
  if (!version) return null
  const data = await store.orgDownloadDeck(startupId)
  if (data && store.mode === 'live')
    await putLocalDeck({ startupId, name: `${startupId}.pdf`, size: data.byteLength, savedAt: version, data })
  return data ?? cached?.data ?? null
}
