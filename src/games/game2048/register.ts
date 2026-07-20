import { Game2048Element } from './web/Game2048Element'

export const GAME_2048_ELEMENT_NAME = 'iw-2048'

if (!customElements.get(GAME_2048_ELEMENT_NAME)) {
  customElements.define(GAME_2048_ELEMENT_NAME, Game2048Element)
}
