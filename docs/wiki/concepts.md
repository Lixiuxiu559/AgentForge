# 核心概念

> 统一技能、方法真源、宿主适配、调用策略与版本开关的口径及跨宿主差异；不替代各技能的适用场景说明。

## 概述

| 概念 | 口径 | 不是什么 |
|---|---|---|
| 技能（skill） | `skills/<name>/SKILL.md`，含 frontmatter 的 `name`、`description` 与正文方法 | 不是带独立上下文的 agent 定义 |
| 方法真源 | 技能正文与 `references/`、`scripts/`，四个宿主共用同一份 | 不按宿主分叉出多套提示词 |
| 宿主适配 | 清单、桥接、打包三类差异 | 不改变技能方法本身 |
| 调用策略 | 模型可否主动调用、用户可否从命令面板调用 | 不是权限或授权机制 |
| 版本开关 | Claude Code 按 `version` 判断更新；DSH `github:` 安装按 commit | 不是所有宿主都按版本号更新 |
| 交付物 | 各技能约定的文件，如 PRD、原型、设计、测试设计默认交付 HTML | 不要求维护重复的 Markdown 正本 |

## 核心流程

### 技能如何被调用

用户直接调用（如 `/agentforge:complexity-audit`）或模型按 `description` 判断需要时调用；`architecture-scout` 只接受用户主动调用。技能之间没有固定调用顺序，也不自动互相调度：需求、设计、实施、评审、审计可以任意组合，也可只凭明确需求直接实施。

需要独立上下文或并行时，主 Agent 调用宿主的通用子 agent 能力；技能本身不提供执行引擎。没有派发能力的宿主上只能在主上下文执行，并如实报告限制。

### 四个宿主的差异

| 宿主 | 发现方式 | 版本与更新 | 备注 |
|---|---|---|---|
| Claude Code | `.claude-plugin/` 清单，自动发现插件根的 `skills/` | `/plugin update`，按 `version` 判断 | 技能调用名带插件命名空间 |
| Codex | `.codex-plugin/plugin.json` 的 `skills: "./skills/"`，`.agents/plugins/marketplace.json` 指仓库根 | 刷新 marketplace 后更新 | `architecture-scout` 的 `agents/openai.yaml` 是策略元数据 |
| Qoder | 导入构建出的 ZIP | 重新下载并导入新 ZIP；无 marketplace 自动更新 | ZIP 只含清单、`skills/`、`LICENSE`、README |
| DSH | npm 包装载 `src/index.js` 桥接，`dsh.bundle.patch` 挂载 | 装法决定：`link:` 直接读盘、`github:` 钉 commit、`github:…#tag` 钉标签 | 正文中的 `${CLAUDE_PLUGIN_ROOT}` 加载时展开 |

DSH 的 `github:` 安装没有版本门控：lockfile 钉具体 commit，`pnpm update` 会重解析到分支最新 commit；要稳定版本应钉 tag（[docs/releasing.md](../../docs/releasing.md)）。

### 版本与破坏性变更

- 只改正文、不改名字：PATCH。
- 新增技能或能力：MINOR。
- 重命名或删除技能：破坏性变更；`1.0.0` 之前用 MINOR 承载（[docs/releasing.md](../../docs/releasing.md)）。
- 插件名 `agentforge` 改名需要 marketplace 的 renames 字段，当前不计划改动。

## 关键实现

| 职责 | 位置 |
|---|---|
| 技能正文与方法 | [skills/](../../skills) |
| 调用策略的 DSH 实现 | [src/index.js](../../src/index.js#L145) |
| Claude Code 清单 | [.claude-plugin/plugin.json](../../.claude-plugin/plugin.json) |
| Codex 清单 | [.codex-plugin/plugin.json](../../.codex-plugin/plugin.json) |
| Qoder 清单 | [.qoder-plugin/plugin.json](../../.qoder-plugin/plugin.json) |

## 修改须知

- 改技能 `description` 会改变模型触发时机；改 `name` 会破坏用户已有的调用习惯与脚本。
- 新增技能要同步四处清单的描述、打包断言与版本号，详见[构建与发布](guides/release.md)。
- 跨宿主行为不一致时，先确认是清单或桥接差异，而不是方法本身分叉；方法应始终回到 `skills/` 真源。

<details><summary>来源</summary>

- [README.md](../../README.md)
- [docs/architecture.md](../../docs/architecture.md)
- [src/index.js](../../src/index.js)
- [.claude-plugin/plugin.json](../../.claude-plugin/plugin.json)
- [.codex-plugin/plugin.json](../../.codex-plugin/plugin.json)
- [.qoder-plugin/plugin.json](../../.qoder-plugin/plugin.json)
- [docs/releasing.md](../../docs/releasing.md)
- [docs/qoder.md](../../docs/qoder.md)

</details>
