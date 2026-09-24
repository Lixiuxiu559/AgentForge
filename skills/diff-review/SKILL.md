---
name: diff-review
description: 三轴代码评审。沿 Correctness（有 bug 吗）、Standards（符合本仓库文档化的编码规范吗）、Spec（忠实实现原始需求吗）三条轴评审一个 diff，各轴独立报告、不合并、不重排。当用户要求评审改动、做提交前审查、找 bug、检查是否符合编码规范、或检查是否实现了原始需求时使用。
user-invocable: true
---

# 三轴代码评审

## 三条轴

| 轴 | 回答的问题 | 判据来源 |
|---|---|---|
| **Correctness** | 这段代码**有 bug 吗**？ | `references/correctness-checks.md` |
| **Standards** | 符合**本仓库文档化的编码规范**吗？ | 仓库规范文件 + `references/standards-baseline.md` |
| **Spec** | 忠实实现了**原始需求**吗？ | 原始 spec / 需求文档 |

**三条轴互不替代。** 一个改动可以同时满足以下任何组合：

- 符合所有规范，但做错了事 → Standards 通过，Spec 失败
- 忠实实现了需求，但引入了 bug → Spec 通过，Correctness 失败
- 修好了 bug，但破坏了项目约定 → Correctness 通过，Standards 失败

所以**不要合并、不要重排、不要在结尾挑"总体最严重"的问题**。

## 能力是自包含的

三条轴**全部由本技能自己完成**，不依赖任何宿主环境专有的命令、技能或工具链。

这意味着：

- 不假设运行环境里有某个配套的评审命令
- 不把任何一条轴"让给"外部工具
- 在只有 git 和文件系统的环境里，本技能仍应完整可用

**只依赖 git 和基础文件操作。** 这是本技能能在任何运行环境里工作的前提。

## 核心原则

1. **三轴分开，不合并** —— 见 `references/why-separate-axes.md`
2. **每条 finding 必须带引用和后果**：
   - Correctness：触发路径 + 后果（什么输入/时序导致什么错误）
   - Standards：规范文件 + 规则，或 smell 名 + 代码片段
   - Spec：spec 原句

   **没有引用或说不出后果的怀疑，不要报。**
3. **仓库规范压过 smell 基线** —— 仓库明确认可的做法，基线不得标记
4. **smell 永远是判断项** —— 写成 `possible Feature Envy`，绝不报成硬性违规
5. **不臆造需求** —— 找不到 spec 就如实降级，不要从代码反推需求
6. **宁少勿多** —— 不确定就不报

## 流程

### 1. 钉住基线

```bash
git rev-parse <固定点>                    # 失败就停下报告，不要继续
BASE=$(git merge-base <固定点> HEAD)      # 固化基线，固定点被推进也不漂移
git diff --stat "$BASE"
git status --short                        # 找出未跟踪文件
git log <固定点>..HEAD --oneline          # Spec 轴找需求线索
```

**四个关键点**（详见 `references/fixed-point-and-scope.md`）：

- 用 `git merge-base` 固化基线，避免评审期间固定点被推进导致结果漂移
- `git diff "$BASE"` **不带第二 ref** → 对比工作区，同时覆盖已提交 / 已暂存 / 未暂存
- **`git diff` 看不到未跟踪的新文件**，必须用 `git status --short`（`??` 开头）单独找出，它们的全部内容都是新增
- diff 为空且无未跟踪文件 → **报告"无内容可评审"**，不要虚构结果

### 2. 收集判据

**Correctness**：判据是固定检查清单，见 `references/correctness-checks.md`，不需要查找。

**Standards**：找出仓库里所有说明"代码该怎么写"的文件（`CONTRIBUTING.md`、`CODING_STANDARDS.md`、`REVIEW.md`、`.editorconfig`、lint/format 配置、目录级 `CLAUDE.md`/`AGENTS.md`）。

同时确认**工具已经强制了什么**（lint、格式化、类型检查）——这些一律跳过，不要重复工具的工作。

**Spec**：按可靠性顺序找原始需求——① 调用方传入的路径 ② commit message 里的需求线索（`#123`、`Closes #45`）③ Glob 搜 `**/prd/**`、`**/specs/**`、`docs/**` 下与分支名或功能名匹配的文件。

**找不到就如实降级**，让 Spec 轴报告"无 spec 可用"。不要从代码反推需求、不要发明验收标准。

### 3. 执行三条轴

**Correctness**：按 `references/correctness-checks.md` 的清单逐类对照 diff。每条必须给出**触发路径**（什么输入、什么时序、什么状态导致什么后果）——说不出触发路径的怀疑不要报。

**Standards**：对照仓库规范找硬性违规（引规范文件 + 规则）；对照 smell 基线找判断项（引名称 + 代码片段）。

**Spec**：找三类——spec 要求但缺失或只做了一半的、diff 里做了但 spec 没要求的（scope creep）、看起来实现了但实现方式可疑的。每条引 spec 原句。

**三轴不要互相参考结论**，写完一轴再开始下一轴。执行细节与并行策略见 `references/verification.md`。

### 4. 输出

严格按 `references/report-format.md` 的模板。要点：

- 三轴各自独立成节
- 每条 finding 带位置 + 引用 + 后果
- Standards 轴内区分**硬性违规**与**判断项**
- 结尾只给「每轴几条 + 每轴最严重的一条」，**不写跨轴冠军**
- 如实报告降级（无 spec、无规范文档、串行执行）

## References

- `references/why-separate-axes.md` —— 为什么三条轴不能合并
- `references/fixed-point-and-scope.md` —— 基线算法、工作区改动、未跟踪文件
- `references/correctness-checks.md` —— Correctness 轴的 bug 检查清单与误报控制
- `references/standards-baseline.md` —— Standards 轴的仓库规范 + 12 条 Fowler smell 基线
- `references/verification.md` —— 三轴执行细节、并行策略、能力边界
- `references/report-format.md` —— 输出模板
