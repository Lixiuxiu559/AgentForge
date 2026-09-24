# Changelog

本文件记录 AgentForge 的**已发布版本**。

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循[语义化版本](https://semver.org/lang/zh-CN/)。

> **注意**：只有 bump `.claude-plugin/plugin.json` 的 `version` 并打标签才算发版。
> 日常 push 不改变用户看到的版本。详见 [`docs/releasing.md`](docs/releasing.md)。

---

## [Unreleased]

### Added

- 

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
