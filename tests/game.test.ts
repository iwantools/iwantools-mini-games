import { describe, expect, it } from 'vitest'
import {
  DIFFICULTIES,
  chordCell,
  createGame,
  generateBoard,
  neighbors,
  revealCell,
  restartGame,
  toggleFlag,
} from '../src/games/minesweeper/core/game'
import type { GameState } from '../src/games/minesweeper/core/types'

const fixedRandom = () => 0.42

describe('minesweeper core', () => {
  it.each([
    ['beginner', 9, 9, 10],
    ['intermediate', 16, 16, 40],
    ['expert', 16, 30, 99],
  ] as const)('creates %s difficulty', (difficulty, rows, columns, mines) => {
    const state = createGame(difficulty)
    expect(state.cells).toHaveLength(rows * columns)
    expect(DIFFICULTIES[difficulty].mines).toBe(mines)
    expect(state.status).toBe('ready')
  })

  it('keeps the first cell and all of its neighbors safe', () => {
    const state = createGame('intermediate')
    const firstIndex = 100
    const generated = generateBoard(state, firstIndex, fixedRandom)
    const safeIndices = [firstIndex, ...neighbors(firstIndex, 16, 16)]

    expect(generated.cells.filter((cell) => cell.mine)).toHaveLength(40)
    expect(safeIndices.every((index) => !generated.cells[index]!.mine)).toBe(true)
    expect(generated.cells[firstIndex]!.adjacent).toBe(0)
  })

  it('expands a zero area on the first reveal', () => {
    const state = revealCell(createGame('beginner'), 40, fixedRandom)
    expect(state.status).toBe('playing')
    expect(state.cells[40]!.revealed).toBe(true)
    expect(state.cells[40]!.adjacent).toBe(0)
    expect(state.revealedSafeCells).toBeGreaterThan(1)
  })

  it('toggles flags and will not reveal a flagged cell', () => {
    const state = createGame('beginner')
    const flagged = toggleFlag(state, 4)
    expect(flagged.cells[4]!.flagged).toBe(true)
    expect(revealCell(flagged, 4, fixedRandom)).toBe(flagged)
    expect(toggleFlag(flagged, 4).cells[4]!.flagged).toBe(false)
  })

  it('loses when a mine is revealed and ignores later actions', () => {
    const generated = generateBoard(createGame('beginner'), 0, fixedRandom)
    const mineIndex = generated.cells.findIndex((cell) => cell.mine)
    const lost = revealCell(generated, mineIndex)
    expect(lost.status).toBe('lost')
    expect(lost.cells.filter((cell) => cell.mine).every((cell) => cell.revealed)).toBe(true)
    expect(toggleFlag(lost, 0)).toBe(lost)
  })

  it('wins after every safe cell is revealed', () => {
    const cells = Array.from({ length: 81 }, () => ({ adjacent: 1, flagged: false, mine: false, revealed: true }))
    cells[80] = { adjacent: 0, flagged: false, mine: false, revealed: false }
    for (let index = 0; index < 10; index += 1) cells[index] = { adjacent: 0, flagged: false, mine: true, revealed: false }
    const state: GameState = {
      cells,
      difficulty: 'beginner',
      firstMove: false,
      revealedSafeCells: 70,
      status: 'playing',
    }

    expect(revealCell(state, 80).status).toBe('won')
  })

  it('chords a revealed number when its adjacent flag count matches', () => {
    const cells = Array.from({ length: 81 }, () => ({ adjacent: 1, flagged: false, mine: false, revealed: false }))
    cells[0] = { adjacent: 0, flagged: true, mine: true, revealed: false }
    cells[1] = { adjacent: 1, flagged: false, mine: false, revealed: true }
    const state: GameState = {
      cells,
      difficulty: 'beginner',
      firstMove: false,
      revealedSafeCells: 1,
      status: 'playing',
    }

    const chorded = chordCell(state, 1)
    expect(chorded.cells[2]!.revealed).toBe(true)
    expect(chorded.cells[9]!.revealed).toBe(true)
    expect(chorded.cells[10]!.revealed).toBe(true)
    expect(chorded.cells[0]!.revealed).toBe(false)
  })

  it('does not chord until the adjacent flag count matches the number', () => {
    const generated = generateBoard(createGame('beginner'), 40, fixedRandom)
    const numberedIndex = generated.cells.findIndex((cell) => cell.adjacent > 0)
    const cells = generated.cells.map((cell, index) => ({ ...cell, revealed: index === numberedIndex }))
    const revealed: GameState = { ...generated, cells, revealedSafeCells: 1 }

    expect(chordCell(revealed, numberedIndex)).toBe(revealed)
  })

  it('loses when matching flags are placed on the wrong neighbors before chording', () => {
    const cells = Array.from({ length: 81 }, () => ({ adjacent: 1, flagged: false, mine: false, revealed: false }))
    cells[0] = { adjacent: 0, flagged: false, mine: true, revealed: false }
    cells[1] = { adjacent: 1, flagged: false, mine: false, revealed: true }
    cells[2] = { adjacent: 1, flagged: true, mine: false, revealed: false }
    const state: GameState = {
      cells,
      difficulty: 'beginner',
      firstMove: false,
      revealedSafeCells: 1,
      status: 'playing',
    }

    expect(chordCell(state, 1).status).toBe('lost')
  })

  it('restarts with the same difficulty and an empty board', () => {
    const restarted = restartGame(revealCell(createGame('expert'), 50, fixedRandom))
    expect(restarted.difficulty).toBe('expert')
    expect(restarted.firstMove).toBe(true)
    expect(restarted.cells.some((cell) => cell.mine)).toBe(false)
  })
})
