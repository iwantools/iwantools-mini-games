import { continueGame, createGame, move, reachedCelebrationMilestone } from '../core/game'
import type { CelebrationMilestone } from '../core/game'
import type { Direction } from '../core/types'
import { loadBestScore, saveBestScore } from '../storage/bestScore'

const SWIPE_THRESHOLD = 28
const CELEBRATION_DURATION = 2800

const milestoneCelebrations: Record<CelebrationMilestone, { title: string, subtitle: string, theme: string }> = {
  2048: { title: '2048!', subtitle: '经典目标达成，精彩才刚开始', theme: 'mint' },
  4096: { title: '4096', subtitle: '能量跃迁，棋盘开始发光', theme: 'gold' },
  8192: { title: '8192', subtitle: '超频成功，你已经非常接近极限', theme: 'violet' },
  16384: { title: '16384', subtitle: '突破边界，欢迎来到无人区', theme: 'rose' },
}

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
  #celebration: CelebrationMilestone | undefined
  #celebrationTimer: ReturnType<typeof setTimeout> | undefined
  #previewMilestoneIndex = 0
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
    if (this.#celebrationTimer) clearTimeout(this.#celebrationTimer)
    this.#connected = false
  }

  #handleClick = (event: Event): void => {
    const target = event.composedPath().find((item): item is HTMLElement => item instanceof HTMLElement)
    const action = target?.closest<HTMLElement>('[data-action]')?.dataset.action
    if (action === 'restart') this.#restart()
    else if (action === 'preview-win') this.#previewMilestone(2048)
    else if (action === 'preview-next-milestone') {
      const milestones: CelebrationMilestone[] = [4096, 8192, 16384]
      this.#previewMilestone(milestones[this.#previewMilestoneIndex % milestones.length]!)
      this.#previewMilestoneIndex += 1
    }
    else if (action === 'continue') {
      this.#state = continueGame(this.#state)
      this.#celebration = undefined
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
    const milestone = reachedCelebrationMilestone(this.#state.cells, next.cells)
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
    if (milestone) {
      this.#celebration = milestone
      this.dispatchEvent(new CustomEvent('iw-game-milestone', {
        bubbles: true,
        composed: true,
        detail: { game: '2048', milestone, score: next.score },
      }))
      if (milestone !== 2048) this.#scheduleCelebrationDismiss()
    }
    this.#render(true)
  }

  #scheduleCelebrationDismiss(): void {
    if (this.#celebrationTimer) clearTimeout(this.#celebrationTimer)
    this.#celebrationTimer = setTimeout(() => {
      this.#celebration = undefined
      this.#celebrationTimer = undefined
      this.#render()
    }, CELEBRATION_DURATION)
  }

  #previewMilestone(milestone: CelebrationMilestone): void {
    if (!['localhost', '127.0.0.1', '::1'].includes(window.location.hostname)) return
    if (this.#celebrationTimer) clearTimeout(this.#celebrationTimer)
    this.#celebrationTimer = undefined
    this.#celebration = milestone
    this.#state = {
      cells: [milestone, 1024, 512, 256, 128, 64, 32, 16, 8, 4, 2, 0, 0, 0, 0, 0],
      score: milestone * 2,
      status: milestone === 2048 ? 'won' : 'playing',
      achieved2048: true,
    }
    if (milestone !== 2048) this.#scheduleCelebrationDismiss()
    this.#render()
  }

  #restart(): void {
    if (this.#celebrationTimer) clearTimeout(this.#celebrationTimer)
    this.#celebrationTimer = undefined
    this.#celebration = undefined
    this.#state = createGame()
    this.#render(true)
  }

  #render(restoreFocus = false): void {
    const celebration = this.#celebration ? milestoneCelebrations[this.#celebration] : undefined
    const showTestControls = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname)
    const screenConfetti = celebration ? Array.from({ length: 72 }, (_, index) =>
      `<b style="--x:${(index * 47) % 101}vw;--delay:-${((index * 31) % 29) / 10}s;--duration:${2.4 + ((index * 17) % 18) / 10}s;--drift:${((index * 43) % 180) - 90}px;--spin:${360 + (index % 5) * 180}deg"></b>`).join('') : ''
    const tiles = this.#state.cells.map((value, index) => `
      <div class="tile ${value ? `tile--${Math.min(value, 8192)}` : ''}" role="gridcell" aria-label="第 ${Math.floor(index / 4) + 1} 行第 ${index % 4 + 1} 列，${value || '空'}">
        ${value || ''}
      </div>`).join('')

    this.#root.innerHTML = `
      <style>${styles}</style>
      <section class="game" aria-labelledby="game-2048-title">
        ${celebration ? `<div class="screen-confetti celebration--${celebration.theme}" aria-hidden="true">${screenConfetti}</div>` : ''}
        <div class="title-row">
          <div>
            <p class="kicker">IWANTOOLS MINI GAME / 002</p>
            <div class="heading"><h2 id="game-2048-title">2048</h2><details><summary aria-label="查看 2048 规则">?</summary><div class="rules"><strong>合并到 2048</strong><p>滑动棋盘，相同数字相撞后合并。每个方块一次移动只能合并一次；达到 2048 后还可以继续挑战更高分。</p></div></details></div>
          </div>
          <button class="restart" type="button" data-action="restart">重新开始</button>
        </div>
        <div class="scores" aria-label="分数"><div><span>本局分数</span><strong>${this.#state.score}</strong></div><div><span>本机最高</span><strong>${this.#bestScore}</strong></div></div>
        ${showTestControls ? `<div class="test-controls" aria-label="本地庆祝预览"><span>本地测试</span><button type="button" data-action="preview-win">预览成功</button><button type="button" data-action="preview-next-milestone">下一节点</button></div>` : ''}
        <p class="status" role="status" aria-live="polite">${this.#state.status === 'playing' ? '用方向键、WASD 或滑动开始合并' : this.#state.status === 'won' ? '已经合成 2048！' : '没有可移动的方块了'}</p>
        <div class="board-wrap">
          <div class="board" role="grid" aria-label="2048 棋盘" tabindex="0">${tiles}</div>
          ${this.#state.status === 'won' ? `<div class="overlay overlay--won celebration--mint"><div class="celebration-burst" aria-hidden="true">${'<i></i>'.repeat(16)}</div><small>里程碑达成</small><strong>${celebration?.title ?? '2048!'}</strong><span>${celebration?.subtitle ?? '经典目标达成，精彩才刚开始'}</span><button type="button" data-action="continue">继续挑战更高数字</button><button type="button" data-action="restart">再来一局</button></div>` : ''}
          ${this.#state.status === 'lost' ? `<div class="overlay overlay--lost"><strong>本局结束</strong><span>得分 ${this.#state.score}</span><button type="button" data-action="restart">立即重开</button></div>` : ''}
          ${celebration && this.#state.status === 'playing' ? `<div class="milestone-toast celebration--${celebration.theme}" role="status" aria-live="polite"><div class="celebration-rings" aria-hidden="true"></div><small>新里程碑</small><strong>${celebration.title}</strong><span>${celebration.subtitle}</span></div>` : ''}
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
  .test-controls{display:flex;align-items:center;justify-content:flex-end;gap:7px;margin:0 0 4px}.test-controls span{margin-right:2px;color:#678597;font:700 9px/1 ui-monospace,monospace;letter-spacing:.1em;text-transform:uppercase}.test-controls button{min-height:28px;padding:0 9px;border:1px dashed rgba(118,169,191,.34);border-radius:6px;color:#83a9bb;background:rgba(4,24,38,.58);font-size:10px;cursor:pointer}.test-controls button:hover{color:#bfefff;border-color:rgba(92,236,255,.55);background:rgba(14,54,70,.65)}
  .status { min-height:30px;margin:0;color:#88a7b8;font-size:11px;line-height:30px;text-align:center; }
  .board-wrap { position:relative; width:min(100%,520px); margin:auto; }.board{display:grid;grid-template-columns:repeat(4,1fr);gap:clamp(6px,1.5vw,10px);padding:clamp(8px,2vw,12px);border:1px solid rgba(86,201,239,.28);border-radius:14px;background:#061725;touch-action:none;outline:none}.board:focus-visible{outline:2px solid #fff;outline-offset:3px}
  .tile{display:grid;aspect-ratio:1;place-items:center;border-radius:10px;color:#668396;background:#0b2638;font:900 clamp(22px,7vw,48px)/1 ui-monospace,monospace;box-shadow:inset 0 1px rgba(255,255,255,.04)}
  .tile:not(:empty){animation:tile-pop .18s ease-out}.tile--2{color:#c7f7ff;background:#123d52}.tile--4{color:#d8fff8;background:#145465}.tile--8{color:#082331;background:#55e3d0}.tile--16{color:#081d29;background:#65dffc}.tile--32{color:#fff;background:#3b9ff0}.tile--64{color:#fff;background:#6b6df5}.tile--128{color:#fff;background:#a55eea;font-size:clamp(19px,6vw,41px)}.tile--256{color:#fff;background:#d64fc5;font-size:clamp(19px,6vw,41px)}.tile--512{color:#fff;background:#ef4b8d;font-size:clamp(19px,6vw,41px)}.tile--1024{color:#fff;background:#f06e58;font-size:clamp(16px,5vw,34px)}.tile--2048{color:#071b1d;background:#72ffd0;font-size:clamp(16px,5vw,34px);box-shadow:0 0 28px rgba(114,255,208,.58)}.tile--4096,.tile--8192{color:#fff;background:#ffb63f;font-size:clamp(14px,4.5vw,30px)}
  .overlay{position:absolute;inset:0;display:grid;place-content:center;gap:10px;overflow:hidden;padding:20px;border-radius:14px;background:rgba(2,14,23,.9);text-align:center;animation:overlay-in .35s ease-out both}.overlay small,.milestone-toast small{color:#8baab8;font:800 9px/1 ui-monospace,monospace;letter-spacing:.18em;text-transform:uppercase}.overlay strong{position:relative;font-size:clamp(36px,10vw,70px);line-height:1}.overlay span{position:relative;color:#b5d3df}.overlay button{position:relative;min-height:42px;padding:0 18px;font-weight:800}.overlay--won{box-shadow:inset 0 0 90px rgba(93,255,202,.24)}.overlay--won strong{color:#71ffd0;text-shadow:0 0 30px #4cffbd}.overlay--lost strong{color:#ff8294}.overlay--lost button{border-color:#ff6f84;background:#a92c46}
  .celebration-burst{position:absolute;inset:50%;width:1px;height:1px}.celebration-burst i{position:absolute;width:7px;height:34px;border-radius:9px;background:#71ffd0;box-shadow:0 0 18px currentColor;transform-origin:50% 190px;animation:burst 1.7s cubic-bezier(.16,.9,.22,1) infinite}.celebration-burst i:nth-child(3n){background:#56dfff}.celebration-burst i:nth-child(4n){background:#fff}.celebration-burst i:nth-child(1){transform:rotate(0deg) translateY(-190px)}.celebration-burst i:nth-child(2){transform:rotate(22.5deg) translateY(-190px)}.celebration-burst i:nth-child(3){transform:rotate(45deg) translateY(-190px)}.celebration-burst i:nth-child(4){transform:rotate(67.5deg) translateY(-190px)}.celebration-burst i:nth-child(5){transform:rotate(90deg) translateY(-190px)}.celebration-burst i:nth-child(6){transform:rotate(112.5deg) translateY(-190px)}.celebration-burst i:nth-child(7){transform:rotate(135deg) translateY(-190px)}.celebration-burst i:nth-child(8){transform:rotate(157.5deg) translateY(-190px)}.celebration-burst i:nth-child(9){transform:rotate(180deg) translateY(-190px)}.celebration-burst i:nth-child(10){transform:rotate(202.5deg) translateY(-190px)}.celebration-burst i:nth-child(11){transform:rotate(225deg) translateY(-190px)}.celebration-burst i:nth-child(12){transform:rotate(247.5deg) translateY(-190px)}.celebration-burst i:nth-child(13){transform:rotate(270deg) translateY(-190px)}.celebration-burst i:nth-child(14){transform:rotate(292.5deg) translateY(-190px)}.celebration-burst i:nth-child(15){transform:rotate(315deg) translateY(-190px)}.celebration-burst i:nth-child(16){transform:rotate(337.5deg) translateY(-190px)}
  .milestone-toast{pointer-events:none;position:absolute;z-index:4;left:50%;top:50%;display:grid;width:min(88%,360px);gap:5px;padding:22px 26px;overflow:hidden;border:1px solid currentColor;border-radius:16px;background:rgba(2,14,23,.91);box-shadow:0 18px 70px #000c,0 0 45px color-mix(in srgb,currentColor 35%,transparent);text-align:center;transform:translate(-50%,-50%);animation:milestone-in 2.8s ease both}.milestone-toast strong{font:950 clamp(38px,9vw,64px)/1 ui-monospace,monospace;letter-spacing:-.07em}.milestone-toast span{font-size:12px}.celebration--mint{color:#71ffd0}.celebration--gold{color:#ffc95c}.celebration--violet{color:#bb87ff}.celebration--rose{color:#ff6f9e}.celebration-rings{position:absolute;inset:50%;border:2px solid currentColor;border-radius:50%;animation:rings 1.35s ease-out infinite}
  .screen-confetti{pointer-events:none;position:fixed;z-index:9999;inset:0;overflow:hidden;contain:strict}.screen-confetti b{position:absolute;top:-10vh;left:var(--x);width:clamp(7px,1vw,12px);height:clamp(14px,2vw,24px);border-radius:2px;background:currentColor;box-shadow:0 0 12px color-mix(in srgb,currentColor 60%,transparent);animation:screen-fall var(--duration) linear var(--delay) infinite;will-change:transform}.screen-confetti b:nth-child(3n){color:#54ddff;border-radius:50%}.screen-confetti b:nth-child(4n){color:#fff;width:6px}.screen-confetti b:nth-child(5n){color:#ff78ad}.screen-confetti b:nth-child(7n){color:#ffd76c}
  .direction-pad{display:grid;grid-template-columns:repeat(3,48px);grid-template-areas:". up ." "left down right";justify-content:center;gap:7px;margin:18px auto 10px}.direction-pad button{width:48px;height:42px;color:#95eaff;font-size:20px;font-weight:900}.direction-pad button[data-action="move-up"]{grid-area:up}.direction-pad button[data-action="move-left"]{grid-area:left}.direction-pad button[data-action="move-down"]{grid-area:down}.direction-pad button[data-action="move-right"]{grid-area:right}.direction-pad button:hover{border-color:#5cecff;background:#10405c}.help{margin:0;color:#607f91;font-size:10px;text-align:center}
  @keyframes tile-pop{from{opacity:.55;transform:scale(.82)}to{opacity:1;transform:none}}@keyframes overlay-in{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:none}}@keyframes burst{0%{opacity:0;scale:.25}30%{opacity:1}100%{opacity:0;scale:1.2}}@keyframes milestone-in{0%{opacity:0;transform:translate(-50%,-44%) scale(.82)}12%,78%{opacity:1;transform:translate(-50%,-50%) scale(1)}100%{opacity:0;transform:translate(-50%,-56%) scale(.96)}}@keyframes rings{from{width:20px;height:20px;opacity:.8;transform:translate(-50%,-50%)}to{width:420px;height:420px;opacity:0;transform:translate(-50%,-50%)}}@keyframes screen-fall{0%{opacity:0;transform:translate3d(0,-12vh,0) rotate(0)}8%{opacity:1}88%{opacity:1}100%{opacity:0;transform:translate3d(var(--drift),112vh,0) rotate(var(--spin))}}
  @media(max-width:560px){.game{padding:16px 12px;border-radius:13px}.restart{padding:0 10px}.rules{left:-145px}.test-controls{justify-content:center}.tile{border-radius:7px}.direction-pad{margin-top:14px}}
  @media(prefers-reduced-motion:reduce){*,*::before,*::after{transition:none!important}}
`
