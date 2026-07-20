import { describe, expect, it } from 'vitest'
import { canMove, continueGame, createGame, mergeLine, move } from '../src/games/game2048/core/game'
import type { Game2048State } from '../src/games/game2048/core/types'

const lowRandom = () => 0

describe('2048 core', () => {
  it('starts with two tiles', () => {
    const state = createGame(lowRandom)
    expect(state.cells.filter(Boolean)).toHaveLength(2)
    expect(state.cells.filter(Boolean)).toEqual([2, 2])
  })

  it.each([
    [[2, 2, 2, 2], [4, 4, 0, 0], 8],
    [[4, 4, 8, 0], [8, 8, 0, 0], 8],
    [[2, 0, 2, 2], [4, 2, 0, 0], 4],
  ])('merges each tile once: %j', (input, expected, gained) => {
    expect(mergeLine(input)).toEqual({ values: expected, gained })
  })

  it('moves in all four directions and only spawns after a valid move', () => {
    const base: Game2048State = { cells: [2, 2, 0, 0, ...Array(12).fill(0)], score: 0, status: 'playing', achieved2048: false }
    expect(move(base, 'left', lowRandom).cells.slice(0, 4)).toEqual([4, 2, 0, 0])
    expect(move(base, 'right', lowRandom).cells.slice(0, 4)).toEqual([2, 0, 0, 4])
    const vertical: Game2048State = { ...base, cells: [2, 0, 0, 0, 2, 0, 0, 0, ...Array(8).fill(0)] }
    expect(move(vertical, 'up', lowRandom).cells.filter(Boolean)).toHaveLength(2)
    expect(move(vertical, 'down', lowRandom).cells.filter(Boolean)).toHaveLength(2)

    const immovable: Game2048State = { ...base, cells: [2, 4, 0, 0, ...Array(12).fill(0)] }
    expect(move(immovable, 'left', lowRandom)).toBe(immovable)
  })

  it('pauses once at 2048 and can continue', () => {
    const state: Game2048State = { cells: [1024, 1024, ...Array(14).fill(0)], score: 0, status: 'playing', achieved2048: false }
    const won = move(state, 'left', lowRandom)
    expect(won.status).toBe('won')
    expect(won.achieved2048).toBe(true)
    expect(continueGame(won).status).toBe('playing')
  })

  it('detects a board with no legal moves', () => {
    expect(canMove([2, 4, 2, 4, 4, 2, 4, 2, 2, 4, 2, 4, 4, 2, 4, 2])).toBe(false)
    expect(canMove([2, 2, ...Array(14).fill(4)])).toBe(true)
  })
})
