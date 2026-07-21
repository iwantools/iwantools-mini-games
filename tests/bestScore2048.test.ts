import { describe, expect, it } from 'vitest'
import { loadBestScore, saveBestScore } from '../src/games/game2048/storage/bestScore'

describe('2048 best score storage', () => {
  it('loads valid data and rejects invalid data', () => {
    expect(loadBestScore({ getItem: () => '{"bestScore":4096}' })).toBe(4096)
    expect(loadBestScore({ getItem: () => '{"bestScore":"bad"}' })).toBe(0)
  })

  it('degrades when storage is unavailable', () => {
    expect(loadBestScore({ getItem: () => { throw new Error('blocked') } })).toBe(0)
    expect(saveBestScore(10, { setItem: () => { throw new Error('blocked') } })).toBe(false)
  })
})
