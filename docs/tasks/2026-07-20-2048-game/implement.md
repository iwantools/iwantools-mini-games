# 2048 正式迭代

## 背景

扫雷已完成首款游戏验证，用户明确项目进入正式迭代并要求增加第二款游戏 2048。

## 决策

- 2048 是独立 game module，不复用扫雷状态或存储。
- 使用纯 TypeScript 核心和可注入随机源；Web 层继续使用原生 Custom Element。
- Vite 改为多入口，但每款游戏仍产出独立 ESM。
- 官网增加独立页面和通用化的轻量 adapter 加载组件，不引入游戏 registry。

## 执行计划

- [x] 修订 PRD/SDD 的迭代边界。
- [x] 实现并测试 core 与 storage。
- [x] 实现键盘、滑动、按钮和结算界面。
- [x] 构建独立 adapter 并接入官网。
- [x] 完成源码、官网和真实浏览器验证。

## 验证计划

- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- 官网 `pnpm verify:games && pnpm typecheck && pnpm generate && pnpm test:e2e`
- 桌面和 390×844 浏览器验证。

## 检查点

2048 已作为第二款正式游戏完成；源码 24 项测试、独立构建、官网固定资源校验、静态生成、E2E 和桌面/390×844 浏览器实测均通过。

## 回退点

2048 使用独立路由和 adapter；官网可移除 2048 清单项与页面并保留扫雷不受影响。

## 下一步

无；等待产品体验反馈后进入下一轮迭代。
