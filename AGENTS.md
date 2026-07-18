# iwantools-mini-games

## 项目身份

- 名称: iwantools-mini-games
- 公司项目登记册: `../../company/PROJECTS.md`
- Operating Board: `iwantools/iwantools#21`

项目生命周期状态和阶段以公司项目登记册为准，不在本文件复制。

## 首次必读

- `README.md`
- `docs/PRD.md`
- `docs/SDD.md`
- `../../standards/AI-CODING.md`

## 任务路由

- 新项目或范围变化: `../../playbooks/project/start-new-project.md`
- 产品定义: `../../playbooks/product/turn-idea-into-prd.md`
- 架构变化: `../../playbooks/engineering/design-architecture.md`
- 前端实现: `../../skills/iwantools-frontend-development/`
- 实现流程: `../../playbooks/engineering/implement-feature.md`
- 发布: `../../playbooks/engineering/release.md`

## 标准

- 工程改动: `../../standards/ENGINEERING.md`
- Git、分支、提交或发布: `../../standards/GIT.md`
- 文档: `../../standards/DOCS.md`
- 密钥、凭证和用户数据: `../../standards/SECURITY.md`

## 项目边界

- 每款游戏的规则和运行状态属于自己的 game module。
- 官网只加载固定版本的构建产物，不复制游戏源码。
- 首版不引入账号、后端 API、数据库、挑战、排行榜、广告或分析脚本。
- 首版只保存 PRD 明确允许的浏览器本地数据。
- 游戏 adapter 不读取 Cookie、凭据或官网内部状态，不产生未声明的网络请求。
- 未来登录同步属于独立里程碑；不得以“预留”为由提前实现账号或平台框架。
- 远端仓库创建、官网接入、发布和部署分别遵守对应授权闸门。
