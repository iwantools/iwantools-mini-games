import type { Cell, Difficulty, DifficultyConfig, GameState, RandomSource } from './types'

export const DIFFICULTIES: Record<Difficulty, DifficultyConfig> = {
  beginner: { label: '初级', rows: 9, columns: 9, mines: 10 },
  intermediate: { label: '中级', rows: 16, columns: 16, mines: 40 },
  expert: { label: '高级', rows: 16, columns: 30, mines: 99 },
}

function emptyCell(): Cell {
  return { adjacent: 0, flagged: false, mine: false, revealed: false }
}

export function createGame(difficulty: Difficulty = 'beginner'): GameState {
  const config = DIFFICULTIES[difficulty]
  return {
    cells: Array.from({ length: config.rows * config.columns }, emptyCell),
    difficulty,
    firstMove: true,
    revealedSafeCells: 0,
    status: 'ready',
  }
}

export function cellIndex(row: number, column: number, columns: number): number {
  return row * columns + column
}

export function cellPosition(index: number, columns: number): { row: number; column: number } {
  return { row: Math.floor(index / columns), column: index % columns }
}

export function neighbors(index: number, rows: number, columns: number): number[] {
  const { row, column } = cellPosition(index, columns)
  const result: number[] = []

  for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
    for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
      if (rowOffset === 0 && columnOffset === 0) continue
      const nextRow = row + rowOffset
      const nextColumn = column + columnOffset
      if (nextRow >= 0 && nextRow < rows && nextColumn >= 0 && nextColumn < columns) {
        result.push(cellIndex(nextRow, nextColumn, columns))
      }
    }
  }

  return result
}

function copyCells(cells: Cell[]): Cell[] {
  return cells.map((cell) => ({ ...cell }))
}

function randomIndex(random: RandomSource, length: number): number {
  const value = Math.max(0, Math.min(0.999999999, random()))
  return Math.floor(value * length)
}

export function generateBoard(state: GameState, firstIndex: number, random: RandomSource = Math.random): GameState {
  const config = DIFFICULTIES[state.difficulty]
  const protectedCells = new Set([firstIndex, ...neighbors(firstIndex, config.rows, config.columns)])
  const candidates = state.cells.map((_, index) => index).filter((index) => !protectedCells.has(index))

  for (let index = candidates.length - 1; index > 0; index -= 1) {
    const swapIndex = randomIndex(random, index + 1)
    ;[candidates[index], candidates[swapIndex]] = [candidates[swapIndex]!, candidates[index]!]
  }

  const cells = copyCells(state.cells)
  for (const index of candidates.slice(0, config.mines)) {
    cells[index]!.mine = true
  }

  cells.forEach((cell, index) => {
    if (!cell.mine) {
      cell.adjacent = neighbors(index, config.rows, config.columns)
        .filter((neighborIndex) => cells[neighborIndex]!.mine).length
    }
  })

  return { ...state, cells, firstMove: false, status: 'playing' }
}

export function revealCell(state: GameState, index: number, random: RandomSource = Math.random): GameState {
  if (state.status === 'won' || state.status === 'lost') return state
  if (!state.cells[index] || state.cells[index].flagged || state.cells[index].revealed) return state

  const config = DIFFICULTIES[state.difficulty]
  let nextState = state.firstMove ? generateBoard(state, index, random) : state
  const cells = copyCells(nextState.cells)

  if (cells[index]!.mine) {
    cells.forEach((cell) => {
      if (cell.mine) cell.revealed = true
    })
    return { ...nextState, cells, status: 'lost' }
  }

  const queue = [index]
  const queued = new Set(queue)
  let revealedSafeCells = nextState.revealedSafeCells

  while (queue.length > 0) {
    const currentIndex = queue.shift()!
    const cell = cells[currentIndex]!
    if (cell.revealed || cell.flagged || cell.mine) continue

    cell.revealed = true
    revealedSafeCells += 1

    if (cell.adjacent === 0) {
      for (const neighborIndex of neighbors(currentIndex, config.rows, config.columns)) {
        const neighbor = cells[neighborIndex]!
        if (!neighbor.revealed && !neighbor.flagged && !neighbor.mine && !queued.has(neighborIndex)) {
          queued.add(neighborIndex)
          queue.push(neighborIndex)
        }
      }
    }
  }

  const safeCellCount = cells.length - config.mines
  const won = revealedSafeCells === safeCellCount
  return {
    ...nextState,
    cells,
    revealedSafeCells,
    status: won ? 'won' : 'playing',
  }
}

export function chordCell(state: GameState, index: number): GameState {
  if (state.status !== 'playing') return state
  const target = state.cells[index]
  if (!target?.revealed || target.mine || target.adjacent === 0) return state

  const config = DIFFICULTIES[state.difficulty]
  const adjacentIndices = neighbors(index, config.rows, config.columns)
  const adjacentFlags = adjacentIndices.filter((neighborIndex) => state.cells[neighborIndex]!.flagged).length
  if (adjacentFlags !== target.adjacent) return state

  let nextState = state
  for (const neighborIndex of adjacentIndices) {
    const neighbor = nextState.cells[neighborIndex]!
    if (!neighbor.revealed && !neighbor.flagged) {
      nextState = revealCell(nextState, neighborIndex)
      if (nextState.status === 'won' || nextState.status === 'lost') break
    }
  }
  return nextState
}

export function toggleFlag(state: GameState, index: number): GameState {
  if (state.status === 'won' || state.status === 'lost') return state
  const target = state.cells[index]
  if (!target || target.revealed) return state

  const cells = copyCells(state.cells)
  cells[index]!.flagged = !cells[index]!.flagged
  return { ...state, cells }
}

export function countFlags(state: GameState): number {
  return state.cells.filter((cell) => cell.flagged).length
}

export function restartGame(state: GameState): GameState {
  return createGame(state.difficulty)
}
