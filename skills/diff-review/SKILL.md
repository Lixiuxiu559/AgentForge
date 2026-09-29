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

## 判据

每条 finding 都要给出位置、证据和后果：Correctness 给触发路径，Standards 引仓库规则或 smell 名称与代码，Spec 引需求原句。仓库明确认可的做法不算违规；smell 仅作判断项。证据不足时不报；三轴结论分别保留。

## 流程

### 1. 钉住基线

```bash
git rev-parse <固定点>                    # 失败就停下报告，不要继续
BASE=$(git merge-base <固定点> HEAD)      # 固化基线，固定点被推进也不漂移
git diff --stat "$BASE"
git status --short                        # 找出未跟踪文件
git log <固定点>..HEAD --oneline          # Spec 轴找需求线索
```

`git diff "$BASE"` 不带第二个 ref，才能包含工作区改动；未跟踪文件须单独读取。没有改动时报告“无内容可评审”。基线细节见 `references/fixed-point-and-scope.md`。

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

**三轴互不参考结论**。有通用子 agent 工具时按 `references/verification.md` 派发独立轴，可并行；结构判据未命中、或只有一条轴有实质材料时单遍串行（判据见同一文件），无派发能力时串行并说明。

### 4. 输出

按 `references/report-format.md` 分轴报告 finding、数量和各轴最严重项，标注缺少 spec、规范或独立上下文等降级；不合并三轴排名。

## References

- `references/why-separate-axes.md` —— 为什么三条轴不能合并
- `references/fixed-point-and-scope.md` —— 基线算法、工作区改动、未跟踪文件
- `references/correctness-checks.md` —— Correctness 轴的 bug 检查清单与误报控制
- `references/standards-baseline.md` —— Standards 轴的仓库规范 + 12 条 Fowler smell 基线
- `references/verification.md` —— 三轴执行细节、并行策略、能力边界
- `references/report-format.md` —— 输出模板
