# AgentForge 项目约定

> **这是模板。** 复制到你的项目里，放在 `<项目根>/.claude/agentforge-conventions.md`，按实际情况填写。
> AgentForge 的技能会读取本文件来适配你项目的目录结构和流程约定。
> 文件不存在时，技能会退回通用默认值并在报告里说明。

```yaml
# ── 文档目录 ─────────────────────────────────────────────
# PRD 存放目录。留空表示项目未使用 PRD 流程，pm 技能会询问用户。
prd-dir: assets/docs/prd/

# 架构 Spec 存放目录。
spec-dir: assets/docs/architecture/specs/

# 需求工作目录（每个需求一个子目录，内含 prd.md / prototype.md / spec.md）。
requirement-dir: specs/

# 架构决策记录目录。
adr-dir: docs/adr/

# 编码规范文档（逗号分隔）。留空表示仓库未记录成文标准。
coding-rules: assets/docs/development/backend-coding-rules.md, assets/docs/development/frontend-coding-rules.md

# ── 分支与流程 ───────────────────────────────────────────
# worktree 的基础分支，也是"当前分支必须等于它才能开 worktree"的校验值。
base-branch: dev

# 主干分支（用于判断是否为长期分支）。
main-branch: main

# 合并目标分支（merge-to-dev 之类技能用）。
integration-branch: dev

# ── 验证命令 ─────────────────────────────────────────────
# 实施阶段的出口条件：这些命令必须全绿才能进入质量门。
# 按项目实际填写，留空表示由技能自动探测（找 package.json / pom.xml / pyproject.toml）。
verify:
  - "mvn test"
  - "pnpm test"

# 覆盖率产物路径（cleaner 的 CRAP 分析需要）。
coverage-report: target/site/jacoco/jacoco.xml

# ── 语言与工具链 ─────────────────────────────────────────
primary-languages: [java, typescript]

# 项目自带的 CLI 工具目录（若项目内封装了 ossutil 之类）。
local-tools-dir: tools/
```

---

## 字段说明

| 字段 | 被谁使用 | 缺失时的行为 |
|---|---|---|
| `prd-dir` | `pm` 技能 | 询问用户 PRD 放哪 |
| `spec-dir` | `arch-spec`、`code-review` | `Glob` 搜索 `**/specs/**` |
| `requirement-dir` | `prototype`、`arch-spec` | 用 `specs/` |
| `adr-dir` | `arch-spec` | 跳过 ADR 索引检查 |
| `coding-rules` | `code-review` | `Glob` 搜索 `**/*coding-rules*`、`CONTRIBUTING.md` |
| `base-branch` | `worktree` | 默认 `dev` |
| `integration-branch` | 合并类技能 | 默认 `dev` |
| `verify` | `/agentforge:feature` 阶段 5 | 自动探测构建文件 |
| `coverage-report` | `cleaner` 子 agent | 让用户指定 |

---

## 为什么要有这一层

AgentForge 的插件部分只装**通用能力**（方法、流程、检查）。
凡是编码了「你的 PRD 放在哪个目录」「你的基础分支叫什么」这类**项目约定**的技能，
都属于项目自己的资产 —— 强行通用化会让它们充满配置项，反而更难用。

约定文件把「方法」和「项目实例」解耦：插件升级不影响你的约定，约定改动不用碰插件。
