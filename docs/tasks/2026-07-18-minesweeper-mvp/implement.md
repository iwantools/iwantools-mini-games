# 扫雷 MVP 构建

## 背景

官网需要一个无需独立部署、可作为同源静态文件加载的扫雷 adapter。

## 决策

- 使用 TypeScript、Vite、Vitest、原生 Custom Element 和 Shadow DOM。
- 游戏规则不访问 DOM 与存储，随机源可注入。
- 官网只复制构建产物，不复制源码。

## 执行计划

- [x] 建立工程配置和核心规则测试。
- [x] 实现扫雷核心、偏好存储和 `<iw-minesweeper>`。
- [x] 完成类型检查、单测和构建。
- [x] 记录产物 gzip 体积与 SHA-256。

## 验证计划

- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- 检查 gzip 体积和 SHA-256。

## 检查点

扫雷 MVP 已完成。`pnpm typecheck`、12 项 Vitest 和 Vite 构建通过；产物 18,744 bytes，gzip 6,382 bytes，SHA-256 为 `baf4879dc32bf17b8431b6f4451a7e064610e8cdfd3bf523651053196a8d4cf3`。真实浏览器桌面与移动检查通过。

## 回退点

删除本任务新增源码和生成产物；不触碰已确认的 PRD/SDD。

## 下一步

无；等待用户决定是否提交、推送或发布版本。
