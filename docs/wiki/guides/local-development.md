# 本地开发与测试

> 说明本地安装各宿主插件、测试与校验命令、新增技能时需要同步的位置；不覆盖发版流程与线上工作流的实际结果。

## 概述

仓库是零依赖的 Node.js 包，本地只需 Node.js（`validate.yml` 在 Node 22 与 24 上校验）。开发循环是：改 `skills/` 或 `tools/` → 跑 `npm test` 与 `node tools/doctor.mjs` → 在对应宿主验证实际加载。

## 核心流程

### 本地安装

本地安装用于验证真实加载：Claude Code 与 DSH 本地目录直接读盘；Codex 使用安装副本，改动后需刷新或重装并开启新任务。

```bash
claude plugin marketplace add /path/to/AgentForge
claude plugin install agentforge@agentforge
codex plugin marketplace add /path/to/AgentForge
codex plugin add agentforge@agentforge
dsh plugin --profile <name> add /abs/path/to/AgentForge
```

### 测试

```bash
npm test                  # node --test tests/*.test.mjs
node tools/doctor.mjs     # 结构与清单校验
```

| 测试文件 | 覆盖 |
|---|---|
| `skill-provider.test.mjs` | DSH 桥接发现十三个技能、调用策略、资源路径、迁移后重新扫描 |
| `release.test.mjs` | `--dry-run` 不改动、patch 发版同步三处版本与 CHANGELOG |
| `complexity-audit.test.mjs` | `crap.cjs` 在 `type: module` 源码树下可运行 |
| `wiki-*.test.mjs` | wiki 的 scan、catalog 检查、链接与锚点 |

测试大量使用临时目录与 `GIT_*` 环境隔离，不依赖当前工作目录；修改脚本时优先补对应测试，而不是手工点验证。

### 新增或修改技能

1. 在 `skills/<kebab-name>/SKILL.md` 写 frontmatter（`name` 与目录一致、`description` 说明何时用）。
2. 需要时加 `references/`、`scripts/`；SKILL.md 中用反引号写的 `references/...` 路径必须真实存在，`doctor` 会检查。
3. 同步三处清单的描述；改版本号与发版见[构建与发布](release.md)。
4. 跑 `npm test`、`node tools/doctor.mjs`。
5. 在本地宿主里重新加载，确认技能可被发现、资源路径可读。

## 关键实现

| 职责 | 位置 |
|---|---|
| 测试命令 | [package.json](../../../package.json#L41) |
| 结构校验 | [doctor.mjs](../../../tools/doctor.mjs) |
| CI 校验矩阵 | [validate.yml](../../../.github/workflows/validate.yml#L29) |

## 修改须知

- `doctor` 失败时的 error 必须修；warn（如与内置技能同名）需要判断是否接受。
- 修改 `src/index.js` 的 frontmatter 解析后，运行 `skill-provider.test.mjs`，核对发现、调用策略和按需读取行为。
- 本地验证与已发布版本是两回事；仓库改动不代表用户已拿到更新。

<details><summary>来源</summary>

- [package.json](../../../package.json)
- [tools/doctor.mjs](../../../tools/doctor.mjs)
- [tests](../../../tests)
- [README.md](../../../README.md)
- [docs/releasing.md](../../../docs/releasing.md)

</details>
