export type Direction = 'up' | 'down' | 'left' | 'right'
export type Game2048Status = 'playing' | 'won' | 'lost'
export type RandomSource = () => number

export interface Game2048State {
  cells: number[]
  score: number
  status: Game2048Status
  achieved2048: boolean
}
