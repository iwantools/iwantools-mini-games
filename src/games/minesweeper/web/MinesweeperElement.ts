import {
  DIFFICULTIES,
  chordCell,
  countFlags,
  createGame,
  generateBoard,
  revealCell,
  toggleFlag,
} from '../core/game'
import type { Difficulty, GameState } from '../core/types'
import {
  loadPreferences,
  savePreferences,
  type Preferences,
} from '../storage/preferences'

const LONG_PRESS_MS = 460

function formatTime(milliseconds: number): string {
  return Math.floor(milliseconds / 1000).toString().padStart(3, '0')
}

function cellLabel(state: GameState, index: number): string {
  const cell = state.cells[index]!
  const config = DIFFICULTIES[state.difficulty]
  const row = Math.floor(index / config.columns) + 1
  const column = index % config.columns + 1
  if (cell.flagged) return `第 ${row} 行第 ${column} 列，已插旗`
  if (!cell.revealed) return `第 ${row} 行第 ${column} 列，未翻开`
  if (cell.mine) return `第 ${row} 行第 ${column} 列，地雷`
  return `第 ${row} 行第 ${column} 列，${cell.adjacent === 0 ? '空白' : `${cell.adjacent} 个相邻地雷`}`
}

export class MinesweeperElement extends HTMLElement {
  readonly #root: ShadowRoot
  #state = createGame()
  #preferences: Preferences = { lastDifficulty: 'beginner', bestTimes: {} }
  #flagMode = false
  #focusedIndex = 0
  #elapsedMs = 0
  #startedAt = 0
  #timer: number | undefined
  #longPressTimer: number | undefined
  #ignoreClick = false
  #pointerStart = { x: 0, y: 0 }
  #connected = false

  constructor() {
    super()
    this.#root = this.attachShadow({ mode: 'open' })
  }

  connectedCallback(): void {
    if (this.#connected) return
    this.#connected = true
    this.#preferences = loadPreferences()
    this.#state = createGame(this.#preferences.lastDifficulty)
    this.#root.addEventListener('click', this.#handleClick)
    this.#root.addEventListener('change', this.#handleChange)
    this.#root.addEventListener('contextmenu', this.#handleContextMenu)
    this.#root.addEventListener('keydown', this.#handleKeyDown)
    this.#root.addEventListener('pointerdown', this.#handlePointerDown)
    this.#root.addEventListener('pointermove', this.#handlePointerMove)
    this.#root.addEventListener('pointerup', this.#cancelLongPress)
    this.#root.addEventListener('pointercancel', this.#cancelLongPress)
    this.#render()
  }

  disconnectedCallback(): void {
    this.#stopTimer()
    this.#cancelLongPress()
    this.#root.removeEventListener('click', this.#handleClick)
    this.#root.removeEventListener('change', this.#handleChange)
    this.#root.removeEventListener('contextmenu', this.#handleContextMenu)
    this.#root.removeEventListener('keydown', this.#handleKeyDown)
    this.#root.removeEventListener('pointerdown', this.#handlePointerDown)
    this.#root.removeEventListener('pointermove', this.#handlePointerMove)
    this.#root.removeEventListener('pointerup', this.#cancelLongPress)
    this.#root.removeEventListener('pointercancel', this.#cancelLongPress)
    this.#connected = false
  }

  #cellFromEvent(event: Event): HTMLElement | undefined {
    return event.composedPath().find((target): target is HTMLElement =>
      target instanceof HTMLElement && target.dataset.index !== undefined)
  }

  #handleClick = (event: Event): void => {
    const target = event.composedPath().find((item): item is HTMLElement => item instanceof HTMLElement)
    const action = target?.closest<HTMLElement>('[data-action]')?.dataset.action

    if (action === 'restart') {
      this.#restart()
      return
    }
    if (action === 'set-reveal-mode' || action === 'set-flag-mode') {
      this.#flagMode = action === 'set-flag-mode'
      this.#render()
      return
    }
    if (action === 'preview-win' || action === 'preview-loss') {
      this.#previewResult(action === 'preview-win' ? 'won' : 'lost')
      return
    }

    const cell = this.#cellFromEvent(event)
    if (!cell) return
    const index = Number(cell.dataset.index)
    this.#focusedIndex = index
    if (this.#ignoreClick) {
      this.#ignoreClick = false
      return
    }
    this.#flagMode ? this.#flag(index) : this.#reveal(index)
  }

  #handleChange = (event: Event): void => {
    const target = event.target
    if (!(target instanceof HTMLSelectElement) || target.name !== 'difficulty') return
    const difficulty = target.value as Difficulty
    if (!DIFFICULTIES[difficulty]) return
    this.#preferences.lastDifficulty = difficulty
    savePreferences(this.#preferences)
    this.#state = createGame(difficulty)
    this.#focusedIndex = 0
    this.#elapsedMs = 0
    this.#flagMode = false
    this.#stopTimer()
    this.#render()
  }

  #handleContextMenu = (event: Event): void => {
    const cell = this.#cellFromEvent(event)
    if (!cell) return
    event.preventDefault()
    this.#focusedIndex = Number(cell.dataset.index)
    this.#flag(this.#focusedIndex)
  }

  #handleKeyDown = (event: Event): void => {
    if (!(event instanceof KeyboardEvent)) return
    const cell = this.#cellFromEvent(event)
    if (!cell) return
    const config = DIFFICULTIES[this.#state.difficulty]
    let nextIndex = Number(cell.dataset.index)

    if (event.key === 'ArrowLeft') nextIndex = Math.max(0, nextIndex - 1)
    else if (event.key === 'ArrowRight') nextIndex = Math.min(this.#state.cells.length - 1, nextIndex + 1)
    else if (event.key === 'ArrowUp') nextIndex = Math.max(0, nextIndex - config.columns)
    else if (event.key === 'ArrowDown') nextIndex = Math.min(this.#state.cells.length - 1, nextIndex + config.columns)
    else if (event.key === 'f' || event.key === 'F') {
      event.preventDefault()
      this.#flag(nextIndex)
      return
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      this.#reveal(nextIndex)
      return
    } else return

    event.preventDefault()
    this.#focusedIndex = nextIndex
    this.#render(true)
  }

  #handlePointerDown = (event: Event): void => {
    if (!(event instanceof PointerEvent)) return
    const cell = this.#cellFromEvent(event)
    if (!cell) return
    const index = Number(cell.dataset.index)

    if (event.pointerType === 'mouse' && (event.buttons & 3) === 3) {
      event.preventDefault()
      this.#focusedIndex = index
      this.#ignoreClick = true
      this.#chord(index)
      return
    }
    if (event.pointerType !== 'touch') return
    this.#cancelLongPress()
    this.#pointerStart = { x: event.clientX, y: event.clientY }
    this.#longPressTimer = window.setTimeout(() => {
      this.#focusedIndex = index
      this.#ignoreClick = true
      this.#flag(index)
      this.#longPressTimer = undefined
    }, LONG_PRESS_MS)
  }

  #handlePointerMove = (event: Event): void => {
    if (!(event instanceof PointerEvent) || this.#longPressTimer === undefined) return
    if (Math.hypot(event.clientX - this.#pointerStart.x, event.clientY - this.#pointerStart.y) > 10) {
      this.#cancelLongPress()
    }
  }

  #cancelLongPress = (): void => {
    if (this.#longPressTimer !== undefined) window.clearTimeout(this.#longPressTimer)
    this.#longPressTimer = undefined
  }

  #reveal(index: number): void {
    if (this.#state.cells[index]?.revealed) {
      this.#chord(index)
      return
    }
    const wasFirstMove = this.#state.firstMove
    const previousStatus = this.#state.status
    const nextState = revealCell(this.#state, index)
    if (nextState === this.#state) return
    this.#state = nextState
    if (wasFirstMove && !nextState.firstMove) this.#startTimer()
    this.#finishIfNeeded(previousStatus)
    this.#render(true)
  }

  #chord(index: number): void {
    const previousStatus = this.#state.status
    const nextState = chordCell(this.#state, index)
    if (nextState === this.#state) return
    this.#state = nextState
    this.#finishIfNeeded(previousStatus)
    this.#render(true)
  }

  #flag(index: number): void {
    const nextState = toggleFlag(this.#state, index)
    if (nextState === this.#state) return
    this.#state = nextState
    this.#render(true)
  }

  #restart(): void {
    this.#state = createGame(this.#state.difficulty)
    this.#elapsedMs = 0
    this.#focusedIndex = 0
    this.#flagMode = false
    this.#stopTimer()
    this.#render()
  }

  #previewResult(status: 'won' | 'lost'): void {
    if (!['localhost', '127.0.0.1', '::1'].includes(window.location.hostname)) return
    const config = DIFFICULTIES[this.#state.difficulty]
    const generated = this.#state.firstMove ? generateBoard(this.#state, 0) : this.#state
    const cells = generated.cells.map((cell) => ({
      ...cell,
      flagged: status === 'won' && cell.mine,
      revealed: status === 'won' ? !cell.mine : cell.mine,
    }))
    this.#stopTimer()
    this.#elapsedMs = 42_000
    this.#flagMode = false
    this.#state = {
      ...generated,
      cells,
      revealedSafeCells: status === 'won' ? cells.length - config.mines : generated.revealedSafeCells,
      status,
    }
    this.#render()
  }

  #startTimer(): void {
    this.#startedAt = performance.now()
    this.#timer = window.setInterval(() => {
      this.#elapsedMs = performance.now() - this.#startedAt
      const display = this.#root.querySelector<HTMLElement>('[data-time]')
      if (display) display.textContent = formatTime(this.#elapsedMs)
    }, 200)
  }

  #stopTimer(): void {
    if (this.#timer !== undefined) window.clearInterval(this.#timer)
    this.#timer = undefined
  }

  #finishIfNeeded(previousStatus: GameState['status']): void {
    if (previousStatus === this.#state.status || (this.#state.status !== 'won' && this.#state.status !== 'lost')) return
    this.#elapsedMs = performance.now() - this.#startedAt
    this.#stopTimer()

    if (this.#state.status === 'won') {
      const currentBest = this.#preferences.bestTimes[this.#state.difficulty]
      if (!currentBest || this.#elapsedMs < currentBest) {
        this.#preferences.bestTimes[this.#state.difficulty] = Math.round(this.#elapsedMs)
        savePreferences(this.#preferences)
      }
    }

    this.dispatchEvent(new CustomEvent('iw-game-result', {
      bubbles: true,
      composed: true,
      detail: {
        game: 'minesweeper',
        difficulty: this.#state.difficulty,
        result: this.#state.status,
        elapsedMs: Math.round(this.#elapsedMs),
      },
    }))
  }

  #render(restoreFocus = false): void {
    const config = DIFFICULTIES[this.#state.difficulty]
    const remainingMines = Math.max(0, config.mines - countFlags(this.#state))
    const showTestControls = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname)
    const bestTime = this.#preferences.bestTimes[this.#state.difficulty]
    const statusText = {
      ready: '选择一格，开始排雷',
      playing: '排雷进行中',
      won: '排雷完成，漂亮！',
      lost: '踩到雷了，再来一局',
    }[this.#state.status]
    const cells = this.#state.cells.map((cell, index) => {
      const content = cell.flagged ? '<span aria-hidden="true">⚑</span>'
        : cell.revealed && cell.mine ? '<span aria-hidden="true">✹</span>'
          : cell.revealed && cell.adjacent > 0 ? String(cell.adjacent)
            : ''
      const classes = [
        'cell',
        cell.revealed ? 'cell--revealed' : '',
        cell.flagged ? 'cell--flagged' : '',
        cell.mine && cell.revealed ? 'cell--mine' : '',
        cell.revealed && cell.adjacent > 0 ? `cell--n${cell.adjacent}` : '',
      ].filter(Boolean).join(' ')
      const victoryDelay = (index % config.columns) * 18 + Math.floor(index / config.columns) * 12
      return `<button class="${classes}" style="--victory-delay:${victoryDelay}ms" type="button" role="gridcell" data-index="${index}" tabindex="${index === this.#focusedIndex ? '0' : '-1'}" aria-label="${cellLabel(this.#state, index)}">${content}</button>`
    }).join('')

    this.#root.innerHTML = `
      <style>${styles}</style>
      <section class="game" aria-labelledby="game-title">
        <div class="title-row">
          <div class="title-block">
            <p class="kicker">IWANTOOLS MINI GAME / 001</p>
            <div class="game-heading">
              <h2 id="game-title">经典扫雷</h2>
              <details class="rules">
                <summary aria-label="查看扫雷规则" title="查看扫雷规则">?</summary>
                <div class="rules-panel">
                  <strong class="rules-title">扫雷怎么玩？</strong>
                  <ul>
                    <li><strong>目标：</strong>翻开所有非地雷格；第一次翻格一定安全。</li>
                    <li><strong>数字：</strong>表示周围最多 8 格中藏着多少颗雷。</li>
                    <li><strong>插旗：</strong>标记你判断为地雷的格子，旗帜不会自动判定对错。</li>
                    <li><strong>快排：</strong>周围旗数与数字相等时，点击数字或同时按左右键翻开其余邻格；旗插错仍会踩雷。</li>
                  </ul>
                </div>
              </details>
            </div>
          </div>
          <span class="local-pill">仅本机记录</span>
        </div>

        <div class="controls">
          <label class="difficulty-control"><span>难度</span>
            <span class="select-shell">
              <select name="difficulty" aria-label="选择难度">
                ${Object.entries(DIFFICULTIES).map(([key, value]) => `<option value="${key}" ${key === this.#state.difficulty ? 'selected' : ''}>${value.label} · ${value.columns}×${value.rows} / ${value.mines} 雷</option>`).join('')}
              </select>
              <span class="select-arrow" aria-hidden="true"></span>
            </span>
          </label>
          <div class="mode-switch" role="group" aria-label="棋盘操作模式">
            <button class="mode-button ${this.#flagMode ? '' : 'mode-button--active'}" type="button" data-action="set-reveal-mode" aria-pressed="${!this.#flagMode}">
              <span aria-hidden="true">◇</span> 翻格
            </button>
            <button class="mode-button ${this.#flagMode ? 'mode-button--active' : ''}" type="button" data-action="set-flag-mode" aria-pressed="${this.#flagMode}">
              <span aria-hidden="true">⚑</span> 插旗
            </button>
          </div>
          <button class="restart-button" type="button" data-action="restart">重新开始</button>
        </div>

        ${showTestControls ? `
          <div class="test-controls" aria-label="本地结果预览">
            <span>本地测试</span>
            <button type="button" data-action="preview-win">预览成功</button>
            <button type="button" data-action="preview-loss">预览失败</button>
          </div>
        ` : ''}

        <div class="dashboard" aria-label="游戏状态">
          <div><span>剩余雷数</span><strong>${remainingMines.toString().padStart(3, '0')}</strong></div>
          <div><span>本局用时</span><strong data-time>${formatTime(this.#elapsedMs)}</strong></div>
          <div><span>本机最佳</span><strong>${bestTime ? formatTime(bestTime) : '---'}</strong></div>
        </div>

        <div class="status ${this.#state.status === 'won' ? 'status--won' : ''} ${this.#state.status === 'lost' ? 'status--lost' : ''}" role="status" aria-live="polite">
          <span class="status-dot" aria-hidden="true"></span>${statusText}
        </div>

        ${this.#state.status === 'won' ? `
          <div class="win-banner" aria-hidden="true">
            <span class="win-rays"></span>
            <span class="win-confetti">
              ${Array.from({ length: 30 }, (_, index) => `<b style="--confetti:${index};--x:${(index * 37) % 101}%;--drift:${((index * 29) % 61) - 30}px;--hue:${(index * 47) % 360}"></b>`).join('')}
            </span>
            <span class="win-mark">✓</span>
            <span class="win-copy"><em>MISSION CLEARED</em><strong>完美排雷！</strong><small>${formatTime(this.#elapsedMs)} 秒完成 · 再破一次纪录</small></span>
            ${Array.from({ length: 18 }, (_, index) => `<i style="--spark:${index}"></i>`).join('')}
          </div>
        ` : ''}

        ${this.#state.status === 'lost' ? `
          <div class="loss-banner">
            <span><strong>差一点就成功了</strong><small>雷区已标出，趁手感还在再来一局。</small></span>
            <button type="button" data-action="restart">立即重开</button>
          </div>
        ` : ''}

        <div class="board-scroll" aria-label="扫雷棋盘，可横向滚动">
          <div class="board ${this.#state.status === 'won' ? 'board--won' : ''}" role="grid" aria-rowcount="${config.rows}" aria-colcount="${config.columns}" style="--columns:${config.columns}; --rows:${config.rows}">
            ${cells}
          </div>
        </div>

        <p class="help"><span>桌面：左键翻格 / 右键插旗 / 左右键快排</span><span>手机：选择翻格或插旗 / 长按插旗</span><span>键盘：方向键 / Enter 快排 / F</span></p>

      </section>
    `

    if (restoreFocus) {
      queueMicrotask(() => this.#root.querySelector<HTMLElement>(`[data-index="${this.#focusedIndex}"]`)?.focus())
    }
  }
}

const styles = `
  :host {
    display: block;
    color: #e9f8ff;
    color-scheme: dark;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }
  * { box-sizing: border-box; }
  button, select { font: inherit; }
  button { color: inherit; }
  .game {
    position: relative;
    overflow: hidden;
    padding: clamp(18px, 3vw, 32px);
    border: 1px solid rgba(72, 199, 255, .22);
    border-radius: 18px;
    background:
      linear-gradient(rgba(2, 17, 30, .96), rgba(1, 11, 22, .98)),
      repeating-linear-gradient(90deg, transparent 0 31px, rgba(61, 199, 255, .04) 32px);
    box-shadow: 0 24px 80px rgba(0, 5, 14, .5), inset 0 1px rgba(255,255,255,.04);
  }
  .game::before {
    position: absolute;
    width: 380px;
    height: 380px;
    top: -260px;
    right: -140px;
    border-radius: 50%;
    background: #0077ff;
    filter: blur(80px);
    opacity: .14;
    content: "";
    pointer-events: none;
  }
  .title-row, .controls, .test-controls, .dashboard, .status, .help { max-width: 920px; margin-inline: auto; }
  .title-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; margin-bottom: 20px; }
  .title-block { min-width: 0; }
  .game-heading { display: flex; align-items: center; gap: 8px; }
  .kicker { margin: 0 0 7px; color: #51ddff; font: 700 10px/1.3 ui-monospace, monospace; letter-spacing: .15em; }
  h2 { margin: 0; font-size: clamp(25px, 4vw, 38px); letter-spacing: -.04em; }
  .local-pill { padding: 6px 9px; border: 1px solid rgba(88, 199, 255, .25); border-radius: 999px; color: #87aabd; background: rgba(16, 49, 68, .46); font-size: 11px; white-space: nowrap; }
  .controls { display: flex; flex-wrap: wrap; gap: 10px; align-items: end; margin-bottom: 14px; }
  label { display: grid; flex: 1 1 260px; gap: 6px; color: #7f9aad; font-size: 11px; font-weight: 700; letter-spacing: .06em; }
  select, .mode-button, .restart-button {
    min-height: 42px;
    border: 1px solid rgba(76, 159, 204, .3);
    border-radius: 8px;
    background: rgba(5, 29, 47, .9);
  }
  .select-shell { position: relative; display: block; border-radius: 8px; background: linear-gradient(135deg, rgba(29,77,100,.5), rgba(5,27,43,.94)); box-shadow: inset 0 1px rgba(255,255,255,.045), 0 8px 20px rgba(0,0,0,.16); transition: box-shadow .16s ease, transform .16s ease; }
  .select-shell:hover { box-shadow: inset 0 1px rgba(255,255,255,.07), 0 8px 24px rgba(0,0,0,.2), 0 0 0 1px rgba(53,217,255,.22); }
  .select-shell:focus-within { box-shadow: 0 0 0 2px rgba(92,236,255,.2), 0 8px 24px rgba(0,0,0,.22); transform: translateY(-1px); }
  select { position: relative; z-index: 1; width: 100%; padding: 0 44px 0 14px; border-color: rgba(93,178,214,.28); color: #dff7ff; background: transparent; font-size: 13px; font-weight: 700; letter-spacing: .01em; cursor: pointer; appearance: none; -webkit-appearance: none; }
  select:focus { outline: none; border-color: #5cecff; }
  select option { color: #dff7ff; background: #071c2b; }
  .select-arrow { position: absolute; z-index: 2; top: 50%; right: 15px; width: 8px; height: 8px; border-right: 1.5px solid #70bfd4; border-bottom: 1.5px solid #70bfd4; pointer-events: none; transform: translateY(-70%) rotate(45deg); transition: border-color .16s ease, transform .16s ease; }
  .select-shell:hover .select-arrow, .select-shell:focus-within .select-arrow { border-color: #5cecff; transform: translateY(-60%) rotate(45deg); }
  .mode-switch { display: grid; grid-template-columns: 1fr 1fr; overflow: hidden; border: 1px solid rgba(76, 159, 204, .3); border-radius: 8px; }
  .mode-button, .restart-button { padding: 0 14px; cursor: pointer; font-size: 13px; font-weight: 750; }
  .mode-switch .mode-button { min-width: 84px; border: 0; border-radius: 0; }
  .mode-switch .mode-button + .mode-button { border-left: 1px solid rgba(76, 159, 204, .3); }
  .mode-button:hover, .restart-button:hover, select:hover { border-color: #35d9ff; }
  .mode-button--active { border-color: #36e7ff; color: #04141e; background: #45dff6; box-shadow: 0 0 22px rgba(54,231,255,.25); }
  .restart-button { color: #8fdfff; }
  .test-controls { display: flex; align-items: center; justify-content: flex-end; gap: 7px; margin-top: -5px; margin-bottom: 10px; }
  .test-controls span { margin-right: 2px; color: #678597; font: 700 9px/1 ui-monospace, monospace; letter-spacing: .1em; text-transform: uppercase; }
  .test-controls button { min-height: 28px; padding: 0 9px; border: 1px dashed rgba(118,169,191,.34); border-radius: 6px; color: #83a9bb; background: rgba(4,24,38,.58); font-size: 10px; cursor: pointer; }
  .test-controls button:hover { color: #bfefff; border-color: rgba(92,236,255,.55); background: rgba(14,54,70,.65); }
  .dashboard {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    border: 1px solid rgba(59, 146, 199, .24);
    border-radius: 10px;
    background: rgba(0, 8, 17, .72);
  }
  .dashboard div { display: grid; gap: 4px; padding: 13px 16px; text-align: center; }
  .dashboard div + div { border-left: 1px solid rgba(59, 146, 199, .2); }
  .dashboard span { color: #6f91a6; font-size: 10px; letter-spacing: .06em; }
  .dashboard strong { color: #5cecff; font: 800 22px/1 ui-monospace, SFMono-Regular, monospace; letter-spacing: .1em; text-shadow: 0 0 14px rgba(64,227,255,.28); }
  .status { display: flex; gap: 8px; align-items: center; min-height: 38px; color: #92acbb; font-size: 12px; }
  .status-dot { width: 7px; height: 7px; border-radius: 50%; background: #29c9f3; box-shadow: 0 0 10px #29c9f3; }
  .status--won { color: #65f5c1; }
  .status--won .status-dot { background: #46e7a9; box-shadow: 0 0 10px #46e7a9; }
  .status--lost { color: #ff8d9c; }
  .status--lost .status-dot { background: #ff536b; box-shadow: 0 0 10px #ff536b; }
  .win-banner {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 18px;
    max-width: 920px;
    min-height: 118px;
    margin: 0 auto 14px;
    overflow: hidden;
    border: 1px solid rgba(101, 245, 193, .72);
    border-radius: 14px;
    background: radial-gradient(circle at 50% 120%, rgba(70,231,169,.35), transparent 62%), linear-gradient(120deg, rgba(3,39,43,.98), rgba(4,73,71,.86), rgba(3,39,43,.98));
    box-shadow: 0 0 42px rgba(70,231,169,.2), inset 0 0 36px rgba(101,245,193,.08);
    animation: win-arrive .65s cubic-bezier(.2,.9,.2,1) both, win-glow 1.8s .5s ease-in-out infinite alternate;
  }
  .win-rays { position: absolute; width: 260px; height: 260px; border-radius: 50%; background: repeating-conic-gradient(from 0deg, rgba(110,255,208,.13) 0 8deg, transparent 8deg 20deg); animation: win-rays 8s linear infinite; }
  .win-confetti { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
  .win-confetti b { position: absolute; top: -14px; left: var(--x); width: 7px; height: 12px; border-radius: 2px; background: ${'hsl(var(--hue) 92% 66%)'}; box-shadow: 0 0 7px ${'hsl(var(--hue) 92% 66% / .45)'}; opacity: 0; animation: confetti-fall 1.8s calc(var(--confetti) * 31ms) cubic-bezier(.18,.72,.32,1) both; }
  .win-confetti b:nth-child(3n) { width: 9px; height: 9px; border-radius: 50%; }
  .win-confetti b:nth-child(4n) { width: 5px; height: 15px; }
  .win-mark { z-index: 1; display: grid; width: 58px; height: 58px; place-items: center; border-radius: 50%; color: #031b17; background: #77ffd0; font-size: 34px; font-weight: 900; box-shadow: 0 0 34px rgba(101,245,193,.85); animation: win-mark .8s .12s cubic-bezier(.2,1.6,.4,1) both; }
  .win-copy { z-index: 1; display: grid; gap: 4px; }
  .win-copy em { color: #53e8ba; font: 800 9px/1 ui-monospace, monospace; letter-spacing: .2em; }
  .win-copy strong { color: #d7ffef; font-size: clamp(23px, 4vw, 34px); line-height: 1; letter-spacing: -.02em; text-shadow: 0 0 18px rgba(101,245,193,.5); }
  .win-copy small { color: #8ed9bd; font: 700 11px/1.3 ui-monospace, monospace; }
  .win-banner i { --angle: calc(var(--spark) * 20deg); position: absolute; left: 50%; top: 50%; width: 6px; height: 9px; border-radius: 2px; background: ${'hsl(calc(150 + var(--spark) * 8) 90% 68%)'}; opacity: 0; animation: win-spark 1.25s calc(var(--spark) * 28ms) ease-out both; }
  .loss-banner { display: flex; align-items: center; justify-content: center; gap: 18px; max-width: 920px; min-height: 74px; margin: 0 auto 12px; padding: 12px 16px; border: 1px solid rgba(255,83,107,.42); border-radius: 10px; background: linear-gradient(100deg, rgba(61,12,28,.8), rgba(25,8,19,.92)); animation: loss-arrive .3s ease-out both; }
  .loss-banner span { display: grid; gap: 4px; }
  .loss-banner strong { color: #ffc2ca; font-size: 15px; }
  .loss-banner small { color: #b9838d; font-size: 11px; }
  .loss-banner button { min-height: 42px; padding: 0 18px; border: 1px solid #ff7186; border-radius: 8px; color: #fff; background: #c93653; font-size: 13px; font-weight: 800; cursor: pointer; box-shadow: 0 0 20px rgba(255,83,107,.22); }
  .loss-banner button:hover { background: #e34863; transform: translateY(-1px); }
  @keyframes win-arrive { from { opacity: 0; transform: translateY(8px) scale(.98); } to { opacity: 1; transform: none; } }
  @keyframes win-mark { from { opacity: 0; transform: scale(.45) rotate(-20deg); } to { opacity: 1; transform: none; } }
  @keyframes win-spark { 0% { opacity: 0; transform: rotate(var(--angle)) translateX(18px) scale(.4); } 20% { opacity: 1; } 100% { opacity: 0; transform: rotate(var(--angle)) translateX(110px) rotate(160deg) scale(1); } }
  @keyframes confetti-fall { 0% { opacity: 0; transform: translate3d(0,-12px,0) rotate(0deg) scale(.7); } 12% { opacity: 1; } 78% { opacity: 1; } 100% { opacity: 0; transform: translate3d(var(--drift),145px,0) rotate(620deg) scale(1); } }
  @keyframes win-rays { to { transform: rotate(360deg); } }
  @keyframes win-glow { to { box-shadow: 0 0 60px rgba(70,231,169,.34), inset 0 0 44px rgba(101,245,193,.12); } }
  @keyframes victory-cell { 0% { transform: scale(.78); filter: brightness(2.3); } 65% { transform: scale(1.09); } 100% { transform: none; filter: none; } }
  @keyframes loss-arrive { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: none; } }
  .board-scroll { overflow-x: auto; max-width: 100%; padding: 2px 2px 12px; scrollbar-color: rgba(63,204,244,.45) rgba(3,20,32,.5); }
  .board {
    --cell-size: clamp(18px, calc((100vw - 78px) / var(--columns)), 32px);
    display: grid;
    grid-template-columns: repeat(var(--columns), var(--cell-size));
    width: max-content;
    margin-inline: auto;
    padding: 7px;
    border: 1px solid rgba(81, 194, 238, .25);
    border-radius: 8px;
    background: #010811;
    box-shadow: inset 0 0 28px rgba(0, 110, 190, .12);
  }
  .cell {
    position: relative;
    display: grid;
    width: var(--cell-size);
    height: var(--cell-size);
    place-items: center;
    padding: 0;
    border: 1px solid #0e3c57;
    border-top-color: #2b718f;
    border-left-color: #2b718f;
    border-radius: 2px;
    background: linear-gradient(145deg, #174662, #09283e);
    box-shadow: inset 1px 1px rgba(255,255,255,.05);
    font: 850 clamp(10px, calc(var(--cell-size) * .52), 16px)/1 ui-monospace, SFMono-Regular, monospace;
    cursor: pointer;
    touch-action: manipulation;
    user-select: none;
  }
  .cell:hover:not(.cell--revealed) { z-index: 1; border-color: #42e6ff; filter: brightness(1.2); }
  .cell:focus-visible { z-index: 2; outline: 2px solid #fff; outline-offset: 1px; }
  .cell--revealed { border-color: #123044; background: #061622; box-shadow: inset 0 0 8px rgba(0,0,0,.5); cursor: default; }
  .cell--flagged { color: #60efff; text-shadow: 0 0 8px #20c9ef; }
  .cell--mine { color: #fff; border-color: #ff526b; background: radial-gradient(circle, #f14c68, #7e1932 68%, #240914); text-shadow: 0 0 8px #fff; }
  .cell--n1 { color: #54b7ff; } .cell--n2 { color: #49e0b2; } .cell--n3 { color: #ff6c82; }
  .cell--n4 { color: #bb83ff; } .cell--n5 { color: #ff9c57; } .cell--n6 { color: #61e9ef; }
  .cell--n7 { color: #d7e4eb; } .cell--n8 { color: #8ea1ad; }
  .board--won .cell--revealed { animation: victory-cell .55s var(--victory-delay) cubic-bezier(.2,.8,.2,1) both; }
  .help { display: flex; flex-wrap: wrap; justify-content: center; gap: 7px 18px; margin-top: 2px; margin-bottom: 0; color: #5f7c90; font-size: 10px; }
  .rules { position: relative; color: #7895a7; font-size: 11px; }
  .rules summary { display: grid; width: 22px; height: 22px; place-items: center; border: 1px solid rgba(137,177,194,.38); border-radius: 50%; color: #789aaa; background: rgba(7,29,43,.42); font: 700 12px/1 ui-sans-serif, system-ui, sans-serif; cursor: help; list-style: none; opacity: .82; transition: color .16s ease, border-color .16s ease, background .16s ease, opacity .16s ease, transform .16s ease; }
  .rules summary::-webkit-details-marker { display: none; }
  .rules summary:hover, .rules:focus-within summary, .rules[open] summary { color: #6fe8ff; border-color: rgba(92,236,255,.72); background: rgba(20,70,88,.42); opacity: 1; transform: translateY(-1px); }
  .rules-panel { position: absolute; z-index: 8; top: 22px; left: 0; display: none; width: min(390px, calc(100vw - 56px)); padding: 17px 16px 15px; border: 1px solid rgba(92,236,255,.3); border-radius: 10px; background: rgba(1,15,26,.98); box-shadow: 0 18px 52px rgba(0,0,0,.62), 0 0 24px rgba(53,217,255,.08); }
  .rules:hover .rules-panel, .rules:focus-within .rules-panel, .rules[open] .rules-panel { display: block; }
  .rules-panel::before { position: absolute; top: -5px; left: 7px; width: 9px; height: 9px; border-top: 1px solid rgba(92,236,255,.3); border-left: 1px solid rgba(92,236,255,.3); background: rgba(1,15,26,.98); content: ""; transform: rotate(45deg); }
  .rules-title { display: block; margin-bottom: 9px; color: #d9f8ff; font-size: 13px; }
  .rules ul { display: grid; gap: 7px; margin: 0; padding-left: 18px; line-height: 1.55; }
  .rules li strong { color: #b7d7e4; }
  @media (max-width: 560px) {
    .game { padding: 16px 12px; border-radius: 13px; }
    .title-row { align-items: center; }
    .local-pill { display: none; }
    .controls { display: grid; grid-template-columns: 1fr 1fr; }
    .test-controls { justify-content: center; }
    label { grid-column: 1 / -1; }
    .mode-switch { position: sticky; bottom: 8px; z-index: 4; min-height: 46px; box-shadow: 0 8px 24px rgba(0,0,0,.4); }
    .dashboard div { padding: 11px 5px; }
    .dashboard strong { font-size: 18px; }
    .board { margin-inline: 0; }
    .win-banner { min-height: 104px; gap: 12px; }
    .win-mark { width: 48px; height: 48px; font-size: 28px; }
    .loss-banner { align-items: stretch; flex-direction: column; gap: 10px; text-align: center; }
    .rules-panel { left: -136px; }
    .rules-panel::before { left: 142px; }
  }
  @media (prefers-reduced-motion: reduce) { *, *::before, *::after { scroll-behavior: auto !important; transition: none !important; animation: none !important; } }
`
