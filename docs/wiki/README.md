# AgentForge

> 通用 agent 工作流与工程技能集：一份技能真源，适配 Claude Code、Codex、Qoder 与 DeepSeek Harness。

## 项目简介

AgentForge 面向日常工程协作：需求整理、原型与架构设计、调研取证、测试设计、实施编排、Bug 调试、代码评审与质量审计。十三个技能以 Markdown 保存方法，配套参考与零依赖脚本；不维护自定义 agent 定义，需要独立上下文或并行时使用宿主提供的通用子 agent 能力。

不负责：生产部署、凭据管理、模型调用；技能内的脚本只做机械检查或打包，不联网。

## 技术栈

| 方面 | 选择 | 依据 |
|---|---|---|
| 运行时 | Node.js 22 / 24（零 dependencies） | [package.json](../../package.json)、[validate.yml](../../.github/workflows/validate.yml) |
| 技能格式 | Markdown + YAML frontmatter | [skills/](../../skills) |
| 宿主适配 | Claude Code、Codex、Qoder、DSH 四套清单与桥接 | [plugin.json](../../.claude-plugin/plugin.json)、[src/index.js](../../src/index.js) |
| 测试 | `node --test` | [tests/](../../tests) |
| 打包与发布 | 系统 `zip`、GitHub Actions | [package-qoder.mjs](../../tools/package-qoder.mjs)、[release.yml](../../.github/workflows/release.yml) |

## 快速上手

```bash
claude plugin marketplace add Lixiuxiu559/AgentForge
claude plugin install agentforge@agentforge      # 安装后重启 Claude Code

npm test                    # 技能、工具与 wiki 脚本测试
node tools/doctor.mjs       # 清单、技能与 DSH 适配校验
npm run package:qoder       # 构建 Qoder ZIP
```

其余宿主的安装与本地开发方式见[本地开发与测试](guides/local-development.md)。

## 文档导航

### 系统与概念

- [系统架构](architecture.md)：说明十三个技能如何以一份真源分发到四个宿主、DSH 桥接如何加载技能，以及打包与发布链路的边界；不展开单个技能的方法细节。
- [核心概念](concepts.md)：统一技能、方法真源、宿主适配、调用策略与版本开关的口径及跨宿主差异；不替代各技能的适用场景说明。

### 技能

- [技能套件与分工](modules/skills-overview.md)：列出十三个技能的分组、适用场景与调用策略，说明技能之间不互相调度；不展开单个技能的执行步骤。
- [需求与设计技能](modules/design-skills.md)：说明 pm、prototype、architecture-design、architecture-scout、research、test-design 的交付物、输入与边界；不涉及实施、评审与质量审计。
- [实施、评审与审计技能](modules/implementation-skills.md)：说明 implementation-workflow、bug-debugging、diff-review、complexity-audit、mutation-testing、worktree 的角色、触发条件与边界；不包含需求定义与项目知识维护。
- [Wiki 技能](modules/wiki-skill.md)：说明 wiki 技能的 scan、catalog 目录、逐页生成与 check 判定规则及脚本边界；不重复技能内的写作规范与模板正文。

### 工具与流程

- [仓库工具与校验](modules/tooling.md)：说明 doctor 的校验项、release 与 Qoder 打包脚本、CHANGELOG 提取工具及 DSH 桥接入口；不覆盖各宿主客户端的安装操作。
- [本地开发与测试](guides/local-development.md)：说明本地安装各宿主插件、测试与校验命令、新增技能时需要同步的位置；不覆盖发版流程与线上工作流的实际结果。
- [构建与发布](guides/release.md)：说明四个清单的版本同步、release.mjs 的前置检查、tag 触发的 Release 与 Qoder 包构建；不证明某个版本已在客户端安装生效。

<details><summary>来源</summary>

- [README.md](../../README.md)
- [package.json](../../package.json)
- [CHANGELOG.md](../../CHANGELOG.md)
- [docs/architecture.md](../../docs/architecture.md)

</details>
