import { MinesweeperElement } from './web/MinesweeperElement'

export const MINESWEEPER_ELEMENT_NAME = 'iw-minesweeper'

if (!customElements.get(MINESWEEPER_ELEMENT_NAME)) {
  customElements.define(MINESWEEPER_ELEMENT_NAME, MinesweeperElement)
}
