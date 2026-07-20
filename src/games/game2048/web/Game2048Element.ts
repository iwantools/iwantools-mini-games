import { continueGame, createGame, move } from '../core/game'
import type { Direction } from '../core/types'
import { loadBestScore, saveBestScore } from '../storage/bestScore'

const SWIPE_THRESHOLD = 28

function directionFromKey(key: string): Direction | undefined {
  return ({
    ArrowUp: 'up', w: 'up', W: 'up',
    ArrowDown: 'down', s: 'down', S: 'down',
    ArrowLeft: 'left', a: 'left', A: 'left',
    ArrowRight: 'right', d: 'right', D: 'right',
  } as Record<string, Direction>)[key]
}

export class Game2048Element extends HTMLElement {
  readonly #root: ShadowRoot
  #state = createGame()
  #bestScore = 0
  #pointerStart: { x: number, y: number } | undefined
  #connected = false

  constructor() {
    super()
    this.#root = this.attachShadow({ mode: 'open' })
  }

  connectedCallback(): void {
    if (this.#connected) return
    this.#connected = true
    this.#bestScore = loadBestScore()
    this.#root.addEventListener('click', this.#handleClick)
    this.#root.addEventListener('keydown', this.#handleKeyDown)
    this.#root.addEventListener('pointerdown', this.#handlePointerDown)
    this.#root.addEventListener('pointerup', this.#handlePointerUp)
    this.#root.addEventListener('pointercancel', this.#cancelPointer)
    this.#render()
  }

  disconnectedCallback(): void {
    this.#root.removeEventListener('click', this.#handleClick)
    this.#root.removeEventListener('keydown', this.#handleKeyDown)
    this.#root.removeEventListener('pointerdown', this.#handlePointerDown)
    this.#root.removeEventListener('pointerup', this.#handlePointerUp)
    this.#root.removeEventListener('pointercancel', this.#cancelPointer)
    this.#connected = false
  }

  #handleClick = (event: Event): void => {
    const target = event.composedPath().find((item): item is HTMLElement => item instanceof HTMLElement)
    const action = target?.closest<HTMLElement>('[data-action]')?.dataset.action
    if (action === 'restart') this.#restart()
    else if (action === 'continue') {
      this.#state = continueGame(this.#state)
      this.#render(true)
    } else if (action?.startsWith('move-')) {
      this.#move(action.slice(5) as Direction)
    }
  }

  #handleKeyDown = (event: Event): void => {
    if (!(event instanceof KeyboardEvent)) return
    const direction = directionFromKey(event.key)
    if (!direction) return
    event.preventDefault()
    this.#move(direction)
  }

  #handlePointerDown = (event: Event): void => {
    if (!(event instanceof PointerEvent) || event.pointerType === 'mouse') return
    this.#pointerStart = { x: event.clientX, y: event.clientY }
  }

  #handlePointerUp = (event: Event): void => {
    if (!(event instanceof PointerEvent) || !this.#pointerStart) return
    const deltaX = event.clientX - this.#pointerStart.x
    const deltaY = event.clientY - this.#pointerStart.y
    this.#pointerStart = undefined
    if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < SWIPE_THRESHOLD) return
    event.preventDefault()
    this.#move(Math.abs(deltaX) > Math.abs(deltaY)
      ? deltaX > 0 ? 'right' : 'left'
      : deltaY > 0 ? 'down' : 'up')
  }

  #cancelPointer = (): void => { this.#pointerStart = undefined }

  #move(direction: Direction): void {
    const previousStatus = this.#state.status
    const next = move(this.#state, direction)
    if (next === this.#state) return
    this.#state = next
    if (next.score > this.#bestScore) {
      this.#bestScore = next.score
      saveBestScore(this.#bestScore)
    }
    if (next.status !== previousStatus && (next.status === 'won' || next.status === 'lost')) {
      this.dispatchEvent(new CustomEvent('iw-game-result', {
        bubbles: true,
        composed: true,
        detail: { game: '2048', result: next.status, score: next.score },
      }))
    }
    this.#render(true)
  }

  #restart(): void {
    this.#state = createGame()
    this.#render(true)
  }

  #render(restoreFocus = false): void {
    const tiles = this.#state.cells.map((value, index) => `
      <div class="tile ${value ? `tile--${Math.min(value, 8192)}` : ''}" role="gridcell" aria-label="第 ${Math.floor(index / 4) + 1} 行第 ${index % 4 + 1} 列，${value || '空'}">
        ${value || ''}
      </div>`).join('')

    this.#root.innerHTML = `
      <style>${styles}</style>
      <section class="game" aria-labelledby="game-2048-title">
        <div class="title-row">
          <div>
            <p class="kicker">IWANTOOLS MINI GAME / 002</p>
            <div class="heading"><h2 id="game-2048-title">2048</h2><details><summary aria-label="查看 2048 规则">?</summary><div class="rules"><strong>合并到 2048</strong><p>滑动棋盘，相同数字相撞后合并。每个方块一次移动只能合并一次；达到 2048 后还可以继续挑战更高分。</p></div></details></div>
          </div>
          <button class="restart" type="button" data-action="restart">重新开始</button>
        </div>
        <div class="scores" aria-label="分数"><div><span>本局分数</span><strong>${this.#state.score}</strong></div><div><span>本机最高</span><strong>${this.#bestScore}</strong></div></div>
        <p class="status" role="status" aria-live="polite">${this.#state.status === 'playing' ? '用方向键、WASD 或滑动开始合并' : this.#state.status === 'won' ? '已经合成 2048！' : '没有可移动的方块了'}</p>
        <div class="board-wrap">
          <div class="board" role="grid" aria-label="2048 棋盘" tabindex="0">${tiles}</div>
          ${this.#state.status === 'won' ? `<div class="overlay overlay--won"><strong>2048!</strong><span>漂亮，目标达成</span><button type="button" data-action="continue">继续挑战</button><button type="button" data-action="restart">再来一局</button></div>` : ''}
          ${this.#state.status === 'lost' ? `<div class="overlay overlay--lost"><strong>本局结束</strong><span>得分 ${this.#state.score}</span><button type="button" data-action="restart">立即重开</button></div>` : ''}
        </div>
        <div class="direction-pad" aria-label="移动方向">
          <button type="button" data-action="move-up" aria-label="向上">↑</button>
          <button type="button" data-action="move-left" aria-label="向左">←</button>
          <button type="button" data-action="move-down" aria-label="向下">↓</button>
          <button type="button" data-action="move-right" aria-label="向右">→</button>
        </div>
        <p class="help">桌面：方向键 / WASD　·　手机：滑动棋盘或使用方向按钮</p>
      </section>`

    if (restoreFocus) queueMicrotask(() => this.#root.querySelector<HTMLElement>('.board')?.focus())
  }
}

const styles = `
  :host { display:block; color:#eafaff; color-scheme:dark; font-family:Inter,ui-sans-serif,system-ui,sans-serif; }
  * { box-sizing:border-box; } button { color:inherit; font:inherit; }
  .game { max-width:720px; margin:auto; padding:clamp(18px,4vw,34px); border:1px solid rgba(70,211,255,.25); border-radius:18px; background:radial-gradient(circle at 80% 0,rgba(0,174,255,.18),transparent 35%),#03121f; box-shadow:0 24px 80px rgba(0,5,14,.5); }
  .title-row { display:flex; align-items:center; justify-content:space-between; gap:18px; }
  .kicker { margin:0 0 5px; color:#50ddff; font:700 10px/1.3 ui-monospace,monospace; letter-spacing:.15em; }
  .heading { display:flex; align-items:center; gap:10px; } h2 { margin:0; font-size:clamp(42px,8vw,68px); line-height:1; letter-spacing:-.07em; }
  details { position:relative; } summary { display:grid; width:28px; height:28px; place-items:center; border:1px solid #52dfff; border-radius:50%; color:#52dfff; background:#08243a; font-weight:900; cursor:pointer; list-style:none; } summary::-webkit-details-marker{display:none}.rules{position:absolute;z-index:8;top:36px;left:0;width:min(360px,calc(100vw - 52px));padding:14px;border:1px solid rgba(82,223,255,.38);border-radius:10px;background:rgba(1,15,26,.98);box-shadow:0 18px 50px #000a;font-size:12px;line-height:1.6}.rules p{margin:7px 0 0;color:#8cacbd}.rules strong{color:#dcf9ff}
  .restart,.overlay button,.direction-pad button{border:1px solid rgba(82,223,255,.35);border-radius:8px;background:#092a41;cursor:pointer}.restart{min-height:42px;padding:0 14px;color:#8fe8ff;font-weight:750}
  .scores { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin:20px 0 8px; }.scores div{display:grid;gap:3px;padding:12px 16px;border:1px solid rgba(69,164,205,.24);border-radius:9px;background:#010b14;text-align:center}.scores span{color:#7095a9;font-size:10px}.scores strong{color:#62edff;font:850 23px/1 ui-monospace,monospace}
  .status { min-height:30px;margin:0;color:#88a7b8;font-size:11px;line-height:30px;text-align:center; }
  .board-wrap { position:relative; width:min(100%,520px); margin:auto; }.board{display:grid;grid-template-columns:repeat(4,1fr);gap:clamp(6px,1.5vw,10px);padding:clamp(8px,2vw,12px);border:1px solid rgba(86,201,239,.28);border-radius:14px;background:#061725;touch-action:none;outline:none}.board:focus-visible{outline:2px solid #fff;outline-offset:3px}
  .tile{display:grid;aspect-ratio:1;place-items:center;border-radius:10px;color:#668396;background:#0b2638;font:900 clamp(22px,7vw,48px)/1 ui-monospace,monospace;box-shadow:inset 0 1px rgba(255,255,255,.04)}
  .tile:not(:empty){animation:tile-pop .18s ease-out}.tile--2{color:#c7f7ff;background:#123d52}.tile--4{color:#d8fff8;background:#145465}.tile--8{color:#082331;background:#55e3d0}.tile--16{color:#081d29;background:#65dffc}.tile--32{color:#fff;background:#3b9ff0}.tile--64{color:#fff;background:#6b6df5}.tile--128{color:#fff;background:#a55eea;font-size:clamp(19px,6vw,41px)}.tile--256{color:#fff;background:#d64fc5;font-size:clamp(19px,6vw,41px)}.tile--512{color:#fff;background:#ef4b8d;font-size:clamp(19px,6vw,41px)}.tile--1024{color:#fff;background:#f06e58;font-size:clamp(16px,5vw,34px)}.tile--2048{color:#071b1d;background:#72ffd0;font-size:clamp(16px,5vw,34px);box-shadow:0 0 28px rgba(114,255,208,.58)}.tile--4096,.tile--8192{color:#fff;background:#ffb63f;font-size:clamp(14px,4.5vw,30px)}
  .overlay{position:absolute;inset:0;display:grid;place-content:center;gap:10px;padding:20px;border-radius:14px;background:rgba(2,14,23,.88);text-align:center;animation:overlay-in .35s ease-out both}.overlay strong{font-size:clamp(36px,10vw,70px);line-height:1}.overlay span{color:#b5d3df}.overlay button{min-height:42px;padding:0 18px;font-weight:800}.overlay--won{box-shadow:inset 0 0 80px rgba(93,255,202,.22)}.overlay--won strong{color:#71ffd0;text-shadow:0 0 30px #4cffbd}.overlay--lost strong{color:#ff8294}.overlay--lost button{border-color:#ff6f84;background:#a92c46}
  .direction-pad{display:grid;grid-template-columns:repeat(3,48px);grid-template-areas:". up ." "left down right";justify-content:center;gap:7px;margin:18px auto 10px}.direction-pad button{width:48px;height:42px;color:#95eaff;font-size:20px;font-weight:900}.direction-pad button[data-action="move-up"]{grid-area:up}.direction-pad button[data-action="move-left"]{grid-area:left}.direction-pad button[data-action="move-down"]{grid-area:down}.direction-pad button[data-action="move-right"]{grid-area:right}.direction-pad button:hover{border-color:#5cecff;background:#10405c}.help{margin:0;color:#607f91;font-size:10px;text-align:center}
  @keyframes tile-pop{from{opacity:.55;transform:scale(.82)}to{opacity:1;transform:none}}@keyframes overlay-in{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:none}}
  @media(max-width:560px){.game{padding:16px 12px;border-radius:13px}.restart{padding:0 10px}.rules{left:-145px}.tile{border-radius:7px}.direction-pad{margin-top:14px}}
  @media(prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}}
`
