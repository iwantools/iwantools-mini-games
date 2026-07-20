const STORAGE_KEY = 'iwantools.mini-games.2048.preferences.v1'

export function loadBestScore(storage?: Pick<Storage, 'getItem'>): number {
  try {
    const raw = (storage ?? globalThis.localStorage).getItem(STORAGE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : undefined
    if (!parsed || typeof parsed !== 'object') return 0
    const bestScore = (parsed as { bestScore?: unknown }).bestScore
    return typeof bestScore === 'number' && Number.isFinite(bestScore) && bestScore >= 0 ? bestScore : 0
  } catch {
    return 0
  }
}

export function saveBestScore(bestScore: number, storage?: Pick<Storage, 'setItem'>): boolean {
  try {
    ;(storage ?? globalThis.localStorage).setItem(STORAGE_KEY, JSON.stringify({ bestScore }))
    return true
  } catch {
    return false
  }
}
