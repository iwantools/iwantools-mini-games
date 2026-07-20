import type { Direction, Game2048State, RandomSource } from './types'

export const BOARD_SIZE = 4
const CELL_COUNT = BOARD_SIZE * BOARD_SIZE

function clampRandom(random: RandomSource): number {
  return Math.max(0, Math.min(0.999999999, random()))
}

export function addRandomTile(state: Game2048State, random: RandomSource = Math.random): Game2048State {
  const emptyIndices = state.cells.map((value, index) => value === 0 ? index : -1).filter(index => index >= 0)
  if (emptyIndices.length === 0) return state
  const cells = [...state.cells]
  const target = emptyIndices[Math.floor(clampRandom(random) * emptyIndices.length)]!
  cells[target] = clampRandom(random) < 0.9 ? 2 : 4
  return { ...state, cells }
}

export function createGame(random: RandomSource = Math.random): Game2048State {
  const empty: Game2048State = {
    cells: Array<number>(CELL_COUNT).fill(0),
    score: 0,
    status: 'playing',
    achieved2048: false,
  }
  return addRandomTile(addRandomTile(empty, random), random)
}

export function mergeLine(values: number[]): { values: number[], gained: number } {
  const compact = values.filter(Boolean)
  const merged: number[] = []
  let gained = 0
  for (let index = 0; index < compact.length; index += 1) {
    const value = compact[index]!
    if (value === compact[index + 1]) {
      const next = value * 2
      merged.push(next)
      gained += next
      index += 1
    } else {
      merged.push(value)
    }
  }
  return { values: [...merged, ...Array<number>(BOARD_SIZE - merged.length).fill(0)], gained }
}

function lineIndices(direction: Direction, line: number): number[] {
  const natural = Array.from({ length: BOARD_SIZE }, (_, offset) =>
    direction === 'left' || direction === 'right'
      ? line * BOARD_SIZE + offset
      : offset * BOARD_SIZE + line)
  return direction === 'right' || direction === 'down' ? natural.reverse() : natural
}

export function canMove(cells: number[]): boolean {
  if (cells.includes(0)) return true
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let column = 0; column < BOARD_SIZE; column += 1) {
      const index = row * BOARD_SIZE + column
      if (column < BOARD_SIZE - 1 && cells[index] === cells[index + 1]) return true
      if (row < BOARD_SIZE - 1 && cells[index] === cells[index + BOARD_SIZE]) return true
    }
  }
  return false
}

export function move(state: Game2048State, direction: Direction, random: RandomSource = Math.random): Game2048State {
  if (state.status !== 'playing') return state
  const cells = [...state.cells]
  let gained = 0

  for (let line = 0; line < BOARD_SIZE; line += 1) {
    const indices = lineIndices(direction, line)
    const merged = mergeLine(indices.map(index => state.cells[index]!))
    gained += merged.gained
    indices.forEach((index, offset) => { cells[index] = merged.values[offset]! })
  }

  if (cells.every((value, index) => value === state.cells[index])) return state

  let next = addRandomTile({ ...state, cells, score: state.score + gained }, random)
  const reached2048 = !state.achieved2048 && next.cells.some(value => value >= 2048)
  next = {
    ...next,
    achieved2048: state.achieved2048 || reached2048,
    status: reached2048 ? 'won' : canMove(next.cells) ? 'playing' : 'lost',
  }
  return next
}

export function continueGame(state: Game2048State): Game2048State {
  return state.status === 'won' ? { ...state, status: canMove(state.cells) ? 'playing' : 'lost' } : state
}

export function restartGame(random: RandomSource = Math.random): Game2048State {
  return createGame(random)
}
