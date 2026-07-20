# iwantools-mini-games SDD

## 文档状态

- 项目: iwantools-mini-games
- 适用里程碑: 持续迭代；当前为 2048
- 文档状态: 已确认
- 负责人: Caoshenyang
- 关联工作项: `iwantools/iwantools#21`

## 背景

项目已经完成扫雷首个里程碑，当前新增第二款正式游戏 2048。两款游戏分别维护规则、Web adapter 和本地存储，不提前抽象通用游戏平台；构建层只增加多入口输出。

## 2048 模块

```text
src/games/game2048/core/
  Interface: createGame / move / continueGame / restartGame
  责任: 4×4 棋盘、移动、单次合并、计分、新方块、2048 与终局

src/games/game2048/storage/
  Interface: loadBestScore / saveBestScore
  责任: 版本化本机最高分与存储不可用降级

src/games/game2048/web/
  Adapter: <iw-2048>
  责任: 键盘、WASD、触屏滑动、方向按钮、规则和结算反馈
```

2048 核心保持纯 TypeScript，随机源可注入。`won` 只暂停一次并允许 `continueGame`；继续后达到更高方块不重复阻塞。`lost` 在棋盘填满且相邻无相同数字时产生。

## 架构概览

项目采用 TypeScript、Vite、原生 Custom Element、Shadow DOM 和 Vitest。

- 游戏规则使用纯 TypeScript，不依赖 DOM、官网或存储。
- Web adapter 注册 `<iw-minesweeper>`，封装视图、输入、计时和无障碍交互。
- 首版不引入 Vue runtime。扫雷属于低复杂度嵌入模块，原生 Custom Element 可以减少每款小游戏重复携带框架代码。
- Vite library build 生成单款游戏的版本化 ESM。
- 官网拥有入口、路由、品牌外壳、版本清单和加载失败界面。
- 游戏源码只在 `iwantools-mini-games` 维护；官网只保存固定版本构建产物。

```text
官网 /games/minesweeper/
  -> 读取固定版本清单
  -> 动态 import 同源 iw-minesweeper.js
  -> 注册 <iw-minesweeper>
  -> game core 处理规则与状态转换
  -> storage adapter 保存允许的本地偏好
```

## 模块

```text
src/games/minesweeper/core/
  Interface: createGame / revealCell / toggleFlag / restartGame
  责任: 难度、雷区生成、相邻计数、展开、胜负和不可变状态转换

src/games/minesweeper/web/
  Adapter: <iw-minesweeper>
  责任: DOM、Shadow DOM 样式、鼠标、触屏、键盘、计时和结果反馈

src/games/minesweeper/storage/
  Interface: loadPreferences / savePreferences
  责任: 版本化本地数据读取、校验、写入和不可用降级

src/games/minesweeper/register.ts
  责任: 幂等注册 Custom Element
```

首版不创建通用 `GameHost`、跨游戏 registry 或共享平台 module。第二款真实游戏出现后，再根据两款游戏共同需求提取 interface。

## 游戏状态与规则

核心状态至少表达：

- 当前难度与棋盘尺寸。
- `ready`、`playing`、`won`、`lost` 状态。
- 每格是否为雷、相邻雷数、是否翻开、是否插旗。
- 首次翻格是否已经发生。
- 已翻开的安全格数量。

核心规则：

1. `createGame` 创建未布雷的 `ready` 状态。
2. 第一次有效 `revealCell` 才生成雷区。
3. 首次格及其相邻格组成安全区；雷只分布在安全区之外。
4. 雷区生成接受可注入的随机源，生产使用浏览器随机源，测试使用确定性随机源。
5. 翻开零相邻雷格时，迭代展开相邻安全格，避免递归深度风险。
6. 已插旗格不能直接翻开；已翻开格不能插旗。
7. 翻开雷格进入 `lost`；全部安全格翻开进入 `won`。
8. 胜负后棋盘操作不再改变游戏状态，重新开始除外。

核心 module 返回新状态和可观察结果，不访问 DOM、计时器或 `localStorage`。

## 计时

- Web adapter 在首次有效翻格后启动计时。
- 使用单调时钟计算经过时间，渲染更新不作为真实时间来源。
- 页面隐藏、渲染延迟或计时器节流不会改变实际经过时间。
- 胜利、失败、重新开始和 element 卸载时停止更新并清理计时器。
- 最佳时间以毫秒保存，界面按一致规则显示。

## 输入与无障碍

### 桌面

- 主按钮翻格。
- 次按钮插旗或取消旗帜。
- 阻止棋盘格的默认上下文菜单，但不影响页面其他区域。

### 移动

- 轻触按当前模式执行翻格或插旗。
- 长按执行插旗或取消旗帜，并取消随后产生的单击。
- 显式插旗模式提供可靠兜底。
- 手势监听在 element 卸载时清理。

### 键盘

- 棋盘使用单一可移动焦点。
- 方向键移动焦点。
- `Enter` 或 `Space` 翻格。
- `F` 插旗或取消旗帜。
- 状态、剩余雷数和胜负变化通过可访问文本表达，颜色不是唯一信息来源。

## Custom Element interface

首版外部 interface 保持最小：

- Element name: `iw-minesweeper`。
- 不要求官网传入账号、存储、主题或游戏规则配置。
- element 自包含首版视觉和本地偏好。
- 注册函数检测 `customElements.get('iw-minesweeper')`，重复加载不重复定义。
- 游戏结束时派发一个 `iw-game-result` `CustomEvent`，只包含游戏标识、难度、胜负和耗时；首版官网可以忽略该事件。

结果事件不包含用户身份、棋盘完整状态、操作历史或凭据。未来同步能力不得依赖首版客户端事件作为可信排行榜证据。

## 本地数据

使用版本化 key：

```text
iwantools.mini-games.minesweeper.preferences.v1
```

值只包含：

- `lastDifficulty`。
- `bestTimes.beginner`。
- `bestTimes.intermediate`。
- `bestTimes.expert`。

读取时进行结构校验；无效、缺失或存储不可用时使用默认值。写入失败不阻止游玩，只放弃持久化并保持当前页面状态。首版不迁移其他站点、旧 key 或账号数据。

## 样式与资源

- Shadow DOM 隔离游戏样式，避免官网全局 CSS 影响棋盘。
- adapter 自包含所需 CSS，不额外请求远程字体、图片或纹理。
- 数字、雷和旗帜优先使用 CSS 或内联矢量表达，不依赖第三方图标运行时。
- 保留经典扫雷层级，使用 iwantools 深色赛博蓝色彩和焦点状态。
- 动效只使用 `transform` 与 `opacity`，并尊重 `prefers-reduced-motion`。
- 首版不播放音频，不调用振动接口。

## 构建与官网集成

Vite 为扫雷生成独立 ESM：

```text
dist/minesweeper/iw-minesweeper.js
```

发布与官网集成流程：

1. 在小游戏项目中完成 typecheck、lint、unit、build 和 adapter 浏览器验证。
2. 为构建产物记录版本和 SHA-256。
3. 官网将已确认版本复制到 `public/games-assets/minesweeper/<version>/`。
4. 官网版本清单记录游戏标识、版本、同源路径、element name 和 SHA-256。
5. `/games/minesweeper/` 只在客户端动态导入该固定路径。
6. import 或注册失败时显示可恢复错误，不回退到未知版本。
7. 回滚时将官网清单指向上一个已验证版本并重新生成官网。

首版可以手工复制经验证的构建产物；第二款游戏或第二次发布出现后，再把复制与校验自动化。无论手工还是自动化，线上都只加载官网本地同源文件。

## 性能

- 官网未进入扫雷页面时不加载游戏 adapter。
- adapter 不包含路由、状态库、分析 SDK 或 Vue runtime。
- 游戏运行不发出网络请求。
- 构建验证记录原始与 gzip 体积；首版 gzip 预算为 50 KB，超出时作为发布 finding 处理。
- 高级棋盘避免为每格创建不必要的长期监听器或外部对象。

## 验证

### Core unit

- 三档棋盘尺寸与雷数。
- 确定性雷区生成和安全区约束。
- 相邻雷计数与零格展开。
- 翻格、插旗、取消旗帜和非法动作不变性。
- 胜利、失败、重启和终局后操作。

### Adapter behavior

- 幂等注册与重复加载。
- 首次操作启动计时，胜负和卸载停止计时。
- 鼠标左右键、键盘、长按和插旗模式。
- `iw-game-result` 内容和派发时机。
- 本地数据读取、更新、无效数据和存储不可用降级。
- 无音频、震动、Cookie 读取和网络请求。

### 官网集成

- `/games/` 和 `/games/minesweeper/` 静态生成。
- 仅进入游戏页时加载固定版本 adapter。
- adapter 成功、加载失败和重复加载路径。
- 桌面、平板、手机、键盘和减少动画模式的浏览器流程。
- 从官网入口完成一局、刷新后恢复上次难度和最佳时间。

测试通过公开 interface 和用户可观察行为验证，不穿透 Shadow DOM 私有结构断言实现细节；core 纯函数测试直接使用其 interface。

## 风险与回退

- 原生 Custom Element 的手势和无障碍细节需要真实浏览器验证，不能只依赖单元测试。
- 本地存储不可用或被清除时记录会丢失，界面不得承诺云端同步。
- 官网与游戏版本清单漂移会导致加载失败，必须保留校验和失败提示。
- 客户端结果可被伪造，未来排行榜需要独立的服务端可信度设计。
- 首次正式版本没有上一 adapter 可回退；首发严重失败时从官网移除入口并重新部署。
