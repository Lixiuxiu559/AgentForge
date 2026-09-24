---
name: standards-review
description: 两轴代码评审。沿 Standards（是否符合本仓库文档化的编码规范）与 Spec（是否忠实实现原始需求）评审 diff，两轴分开报告、不合并。当用户要求按编码规范评审、检查改动是否符合需求、做提交前审查、或提到"规范评审"、"标准审查"、"改动符合需求吗"时使用。不用于找 bug——那是 Claude Code 内置 /code-review 的职责。
user-invocable: true
---

# 两轴代码评审

## 你负责什么，不负责什么

**本技能回答两个问题：**

- **Standards** —— 这段代码符合本仓库文档化的编码规范吗？
- **Spec** —— 这段代码忠实实现了原始需求吗？

**本技能不找 bug。** 逻辑错误、安全漏洞、边界情况、性能问题由 **Claude Code 内置的 `/code-review`** 负责——它专门在 diff 里猎 bug，并且有 `--fix`、`--comment`、云端 `ultra` 深度评审等能力。

| | 内置 `/code-review` | 本技能 `standards-review` |
|---|---|---|
| 问题 | 有 bug 吗？能更简单吗？ | **做对了事吗？做对了吗？** |
| 判据 | 内置，`CLAUDE.md` 可微调 | 仓库文档 + Fowler smell 基线 + 原始 spec |
| 输出 | findings 列表，带分类标签 | 两轴分开的结构化报告，逐条带引用 |

**两者互补，不要互相替代。** 要全面审查，先跑内置 `/code-review` 找 bug，再跑本技能查规范与需求。

## 核心原则

1. **两轴分开，不合并** —— 最后不挑"总体最严重"的问题。见 `references/two-axes-rationale.md`。
2. **每条 finding 必须带引用** —— 规范文件 + 规则、smell 名 + 代码片段、或 spec 原句。没有引用的怀疑不要报。
3. **仓库规范压过基线** —— 仓库明确认可的做法，基线不得标记。
4. **smell 永远是判断项** —— 写成 `possible Feature Envy`，绝不报成硬性违规。
5. **不臆造需求** —— 找不到 spec 就如实降级，不要从代码反推需求。

## 流程

### 1. 钉住基线

调用方会给出一个固定点（commit、分支、tag、ref range）。用它算出真正的基线：

```bash
git rev-parse <固定点>                    # 失败就停下报告，不要继续
BASE=$(git merge-base <固定点> HEAD)      # 用 merge-base，即使固定点后来动过也正确
git diff --stat "$BASE"
git log <固定点>..HEAD --oneline          # Spec 轴找需求线索用
```

**用 `git merge-base` 而不是直接三点号比较**，这样即使固定点在评审期间被推进过，基线也不会漂移。

**关键：`git diff "$BASE"` 对比工作区，因此同时包含已提交、已暂存、未暂存的改动。** 刚改完还没提交的东西必须被看到。

**`git diff` 看不到未跟踪的新文件**，必须另外查 `git status --short`（`??` 开头的是未跟踪文件），它们的**全部内容都是新增**，直接用 Read 读。

diff 为空且无未跟踪文件时：**停下并报告"无内容可评审"**，不要虚构评审结果。

详细规则见 `references/fixed-point-and-scope.md`。

### 2. 收集 Standards 输入

找出仓库里所有说明"代码该怎么写"的文件：`CONTRIBUTING.md`、`CODING_STANDARDS.md`、`REVIEW.md`、`.editorconfig`、lint/format 配置、架构文档、目录级 `CLAUDE.md`/`AGENTS.md`。

同时确认**哪些检查工具已经强制**（lint、格式化、类型检查）——这些一律跳过，不要重复工具的工作。

### 3. 收集 Spec 输入

按可靠性顺序：

1. 调用方传入的 spec 路径（最可靠）
2. commit message 里的需求线索（`#123`、`Closes #45`）
3. 仓库里的需求文档：Glob 搜 `**/prd/**`、`**/specs/**`、`docs/**` 下与分支名或功能名匹配的文件

**找不到就如实降级**，让 Spec 轴报告"无 spec 可用"。不要从代码反推需求、不要发明验收标准。

### 4. 执行两轴评审

**Standards 轴**：对照仓库规范找硬性违规；对照 12 条 Fowler smell 基线找判断项。判据全文见 `references/standards-baseline.md`。

**Spec 轴**：找三类问题——spec 要求但缺失或只做了一半的、diff 里做了但 spec 没要求的（scope creep）、看起来实现了但实现方式可疑的。每条引 spec 原句。

**关于并行执行**：两个轴互不干扰，理想情况下各由一个 subagent 独立执行以免相互污染。但**不要假装已经派发**——只有确实存在可用的 subagent 派发通道时才并行，否则**自己串行跑完两轴**，并在报告里说明是串行完成的。

判据与执行细节见 `references/review-execution.md`。

### 5. 输出

严格按 `references/report-format.md` 的模板报告。要点：

- 两轴各自独立成节
- 每条 finding 带位置和引用
- 区分**硬性违规**（违反仓库文档化规范）与**判断项**（仅来自 smell 基线）
- 结尾只给「每轴几条 + 每轴最严重的一条」，**不写跨轴冠军**

## References

- `references/two-axes-rationale.md` —— 为什么两轴不能合并
- `references/fixed-point-and-scope.md` —— 基线算法、工作区改动、未跟踪文件
- `references/standards-baseline.md` —— 12 条 Fowler smell 基线全文与两条绑定规则
- `references/review-execution.md` —— 两轴执行细节与并行策略
- `references/report-format.md` —— 输出模板
