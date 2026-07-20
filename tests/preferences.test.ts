import { describe, expect, it } from 'vitest'
import { PREFERENCES_KEY, loadPreferences, parsePreferences, savePreferences } from '../src/games/minesweeper/storage/preferences'

describe('minesweeper preferences', () => {
  it('validates persisted values', () => {
    expect(parsePreferences('{"lastDifficulty":"expert","bestTimes":{"expert":1234,"beginner":-1}}')).toEqual({
      lastDifficulty: 'expert',
      bestTimes: { expert: 1234 },
    })
    expect(parsePreferences('broken')).toEqual({ lastDifficulty: 'beginner', bestTimes: {} })
  })

  it('degrades when storage is unavailable', () => {
    const brokenStorage = {
      getItem: () => { throw new Error('disabled') },
      setItem: () => { throw new Error('disabled') },
    }
    expect(loadPreferences(brokenStorage)).toEqual({ lastDifficulty: 'beginner', bestTimes: {} })
    expect(savePreferences({ lastDifficulty: 'beginner', bestTimes: {} }, brokenStorage)).toBe(false)
  })

  it('uses the versioned storage key', () => {
    let savedKey = ''
    savePreferences({ lastDifficulty: 'intermediate', bestTimes: {} }, {
      setItem: (key) => { savedKey = key },
    })
    expect(savedKey).toBe(PREFERENCES_KEY)
  })
})
