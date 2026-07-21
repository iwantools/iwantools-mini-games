import type { Difficulty } from '../core/types'

export const PREFERENCES_KEY = 'iwantools.mini-games.minesweeper.preferences.v1'

export interface Preferences {
  lastDifficulty: Difficulty
  bestTimes: Partial<Record<Difficulty, number>>
}

export const DEFAULT_PREFERENCES: Preferences = {
  lastDifficulty: 'beginner',
  bestTimes: {},
}

function isDifficulty(value: unknown): value is Difficulty {
  return value === 'beginner' || value === 'intermediate' || value === 'expert'
}

export function parsePreferences(value: string | null): Preferences {
  if (!value) return { ...DEFAULT_PREFERENCES, bestTimes: {} }

  try {
    const parsed: unknown = JSON.parse(value)
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_PREFERENCES, bestTimes: {} }
    const record = parsed as Record<string, unknown>
    const sourceTimes = record.bestTimes && typeof record.bestTimes === 'object'
      ? record.bestTimes as Record<string, unknown>
      : {}
    const bestTimes: Partial<Record<Difficulty, number>> = {}

    for (const difficulty of ['beginner', 'intermediate', 'expert'] as const) {
      const time = sourceTimes[difficulty]
      if (typeof time === 'number' && Number.isFinite(time) && time > 0) bestTimes[difficulty] = time
    }

    return {
      lastDifficulty: isDifficulty(record.lastDifficulty) ? record.lastDifficulty : 'beginner',
      bestTimes,
    }
  } catch {
    return { ...DEFAULT_PREFERENCES, bestTimes: {} }
  }
}

export function loadPreferences(storage?: Pick<Storage, 'getItem'>): Preferences {
  try {
    const target = storage ?? globalThis.localStorage
    return parsePreferences(target.getItem(PREFERENCES_KEY))
  } catch {
    return { ...DEFAULT_PREFERENCES, bestTimes: {} }
  }
}

export function savePreferences(preferences: Preferences, storage?: Pick<Storage, 'setItem'>): boolean {
  try {
    const target = storage ?? globalThis.localStorage
    target.setItem(PREFERENCES_KEY, JSON.stringify(preferences))
    return true
  } catch {
    return false
  }
}
