# Changelog

本文件记录 AgentForge 的**已发布版本**。

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循[语义化版本](https://semver.org/lang/zh-CN/)。

> **注意**：只有 bump `.claude-plugin/plugin.json` 的 `version` 并打标签才算发版。
> 日常 push 不改变用户看到的版本。详见 [`docs/releasing.md`](docs/releasing.md)。

---

## [Unreleased]

### Added

- **DSH 插件适配：子 agent 注册** —— `src/index.js` 现在把 `agents/*.md` 注册成一个
  `agentforge` 工具（用 `agent` 参数枚举选择），至此 4 个技能 + 4 个子 agent
  在 DSH 侧全部可用。子 agent 的 persona、工具白名单、模型覆盖都走调用期参数。
- **两端差异适配层**（全部收在桥接插件，内容文件保持单份）：
  - CC→DSH 工具名映射（`Read`→`read`、`WebSearch`→`web_search` …），
    未映射的名字会被丢弃并记 warning
  - 白名单在**调用期**与真实工具表求交集 —— `tools.restrict()` 对未知工具名和
    空 filter 都会抛错，静态判断会误伤未挂载的工具行
  - `${CLAUDE_PLUGIN_ROOT}` 在技能正文与子 agent persona 里展开为真实包路径
  - 子 agent persona 前置「AgentForge 资源位置」，让正文里的 `skills/...`
    相对路径在 DSH 侧也可解析
  - CC 的 `model: haiku/sonnet` 别名与 `maxTurns` 在 DSH 侧忽略（可用
    `config.agents.<name>` 覆盖模型）
- `tools/doctor.mjs` 新增 `dsh` 检查组：bundle 清单、桥接插件可加载性、
  agent 工具名映射完整性、工具名与 DSH 保留名冲突。
  该组直接 import `src/index.js` 读取映射表，不抄第二份，避免漂移。
- `docs/architecture.md` 补齐实测结论：DSH 工具注册契约、`tools.restrict()` 的
  硬约束、隔离 `DSH_HOME` 的端到端验证步骤与结果。

### Changed

- 桥接插件的 `inject` 从 `['skills']` 扩为 `['skills', 'tools']`；
  `subagents` 刻意**不**设为硬依赖（改在调用期 `ctx.get()`），
  避免某个 profile 没挂 subagent provider 时整个插件停在 waiting。
- `package.json` 的 `files` 去掉并不存在的 `hooks`。
- `skills/complexity-audit/references/java-jacoco.md` 补 DSH 侧的脚本定位方式。

### Notes

- `hooks/` 仍未实装（仓库内无 hooks 资产），因此没有挂 `dsh-hooks-claude-code` 桥。
- 工具名不叫 `subagent`：dsh-base 已注册 `subagent` / `subagent_fork`，重名会让插件装载失败。

---

## [0.1.1] - 2026-09-24

### Added

- `researcher` 子 agent —— 技术调研、代码库调查、日志排查、证据收集与研究报告
- `research` 技能 —— 调研工作流：定义问题、限定范围、证据优先级、交叉验证、置信度评估
- 发布流程规范与 `tools/release.mjs` 发版脚本
- CI 校验工作流

---

## [0.1.0] - 2026-09-23

首个版本。

### Added

**技能**

- `implementation-workflow` —— 实施编排：评估任务规模与风险、拆分依赖、
  串行/并行调度 `implementer`、集成验证、按风险选择性调用审计 agent。
  详细规则下沉到 `references/`（拆分、并行、质量门、任务卡模板）。
- `complexity-audit` —— 复杂度风险审计：用 CRAP 定位「复杂且测试保护不足」的函数。
  支持 Java、Python、Go、JavaScript、TypeScript 适配；
  内置 `scripts/crap.js`（Java + JaCoCo 的完整 CRAP 计算）。
- `mutation-testing` —— 测试有效性审计：用突变测试找出存活突变体与无覆盖代码。
  支持 Java(PIT)、Python(mutmut)、Go(go-mutesting)、JavaScript/TypeScript(Stryker)。

**子 agent**

- `implementer` —— 实现代码、修改代码、编写测试、局部验证。
- `complexity-auditor` —— 复杂度与覆盖率风险审计，**只读**（无 Edit/Write）。
- `mutation-auditor` —— 突变测试与测试有效性审计，**只读**（无 Edit/Write）。

**工程**

- `.claude-plugin/plugin.json` + `marketplace.json` —— 可作为 Claude Code 插件安装。
- `tools/doctor.mjs` —— 8 项结构与资产校验，零依赖，可接进 CI。

### Notes

- 零外部依赖：不使用 MCP，不依赖网络，不依赖项目预装工具。
- 两个审计 agent 从工具层面保证「只报告不改码」。
