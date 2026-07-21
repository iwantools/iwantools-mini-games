export type Difficulty = 'beginner' | 'intermediate' | 'expert'
export type GameStatus = 'ready' | 'playing' | 'won' | 'lost'

export interface DifficultyConfig {
  label: string
  rows: number
  columns: number
  mines: number
}

export interface Cell {
  adjacent: number
  flagged: boolean
  mine: boolean
  revealed: boolean
}

export interface GameState {
  cells: Cell[]
  difficulty: Difficulty
  firstMove: boolean
  revealedSafeCells: number
  status: GameStatus
}

export type RandomSource = () => number
