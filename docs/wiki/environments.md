# 分发、安装与环境状态

## 文档信息

| 字段 | 内容 |
|---|---|
| 适用范围 | AgentForge 仓库声明、用户宿主与本轮本地验证 |
| 事实状态 | 部分核验 |
| 核验基线 | ee58dfd 后开发工作区；来源与文档由复核指纹追溯 |
| 核验时间 | 2026-10-28 |
| 适用环境 | 本地开发、GitHub 工作流、用户侧 DSH/Codex/Claude Code |
| 观察时间 | 2026-10-28 静态核对仓库；未查询远端或用户运行环境 |
| 证据来源 | 本页链接的包/插件清单、CI、发布约定；运行状态未取证 |

## 环境清单

| 环境或运行位置 | 声明方式 | 当前实际状态 |
|---|---|---|
| 本地开发工作区 | Node 执行 provider 测试、Wiki CLI 与 doctor | 本轮命令结果在验证页；不推导用户环境行为 |
| GitHub 校验 | validate.yml 在 main/dev push、PR 和手动触发；Wiki job 仅 PR | 已静态核对定义，未查询本轮远端 run |
| GitHub Release | release.yml 响应 v* 标签推送创建 Release | 已静态核对定义，未查询当前发布对象或版本 |
| 用户 DSH | 包入口与 bundle patch 注册 skills provider | 用户实际安装版本、加载与健康未知 |
| 用户 Codex / Claude Code | 各自插件清单定位共用技能目录 | 用户实际安装版本、缓存与 UI 状态未知 |
| 自营 dev/test/prod 服务 | 本仓库源码未声明此类服务或数据库部署 | 对本插件不适用；不代表宿主或目标项目没有这些环境 |

## 状态证据

三份清单的声明版本为 0.11.0；本页核验时已完成本地版本准备，不能据此说用户已得到新能力。远端发布结果应按实际平台记录核查。未采集用户已安装 commit、远端发布 run、镜像 digest 或服务健康证据，相关运行状态保持未知；不存在镜像构建声明时 digest 不适用。每次新增实际安装或发布观察，另记环境、版本/commit、观察时间、方法及受控证据位置，不覆盖成无时间范围的“已上线”。

[验证记录](verification.md) 是本地检查证据。[发布约定](../releasing.md) 是项目流程来源，[npm 历史说明](../npm-publishing.md) 是带日期的渠道约定，不作为本轮远端 registry 查询结果。生产实时健康与用户缓存不由仓库文件指纹检测。

## 配置与差异

本地开发与用户安装路径不同；CLI 的 --root 指向目标项目，技能脚本来自安装目录。DSH 还需宿主 skills 服务与 bundle 装配，Codex/Claude Code 依靠各自发现配置；不由插件代管宿主模型或凭据。CI 声明 Node 22/24 矩阵，本轮只记录实际本机执行的版本；不把配置当作远端双版本通过证据。

仓库的 GitHub Release 工作流使用平台提供的 GITHUB_TOKEN；npm 工作流声明 OIDC 并仅手动触发，实际可信发布设置未查询。只记录名称与机制，不保存凭据值。运行环境、宿主缓存或外部配置的变化需受控查询和维护记录；Wiki 不在后台监听。

## 依据与核验

2026-10-28 静态核对 [package.json](../../package.json)、[Codex 清单](../../.codex-plugin/plugin.json)、[Claude Code 清单](../../.claude-plugin/plugin.json)、[bundle](../../cordis.patch.yml)、[校验工作流](../../.github/workflows/validate.yml)、[Release 工作流](../../.github/workflows/release.yml) 和 [npm 工作流](../../.github/workflows/publish.yml)。未执行安装、发布、外部 API 查询或生产核验。

## 待确认项

远端实际版本、CI 最近结果、分支保护必需状态和用户宿主安装/运行均未查询。本页完成的是部署/安装方式和状态边界说明。
