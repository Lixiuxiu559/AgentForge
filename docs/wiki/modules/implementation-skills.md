# 实施、评审与审计技能

> 说明 implementation-workflow、bug-debugging、diff-review、complexity-audit、mutation-testing、worktree 的角色、触发条件与边界；不包含需求定义与项目知识维护。

## 概述

| 技能 | 什么时候用 | 输出 | 不做什么 |
|---|---|---|---|
| `implementation-workflow` | 实现功能、修复 Bug、重构、补测试、拆分开发任务 | 代码改动 + 任务拆分与验证报告 | 不替用户做重大取舍 |
| `bug-debugging` | 有具体错误、失败测试、偶发异常或性能回归 | 根因结论与修复方案，获批准后实施 | 不把诊断自动扩展成修复 |
| `diff-review` | 评审一个 diff、提交前审查 | Correctness / Standards / Spec 三轴独立结论 | 不合并不重排、不三选一 |
| `complexity-audit` | 评估函数是否难改、定位高 CRAP | 复杂度与覆盖率风险报告 | 不改代码或测试 |
| `mutation-testing` | 验证测试能否发现逻辑错误 | 存活突变体与无覆盖报告 | 不改测试、不装工具 |
| `worktree` | 创建或删除 Git worktree | 工作树与分支操作结果 | 不推送、不删分支、不自动清理 |

## 核心流程

### implementation-workflow：九步编排

理解任务 → 评估规模 → 拆分 → 判断并行/串行 → 派发 → 集成检查 → 统一验证 → 选择性质量审计 → 汇总（[SKILL.md](../../../skills/implementation-workflow/SKILL.md)）。

| 约束 | 行为 |
|---|---|
| 任务拆分 | 一个任务一个可验收结果；同一文件只由一个并行任务负责 |
| 共享契约 | 公共接口、数据模型、类型先确定，再并行实现使用方 |
| 质量审计 | 按变更风险从 `diff-review`、`complexity-audit`、`mutation-testing` 中选择，记录跳过或降级原因（[§8](../../../skills/implementation-workflow/SKILL.md)） |
| 失败归属 | 子任务内部错误 → 重派原任务；集成冲突 → 主 Agent 修复；测试或环境问题 → 标为环境阻塞 |
| Bug 请求 | 先走 `bug-debugging` 的确认点，用户同意方案后才实施；不把“修复 Bug”当作对未展示方案的批准 |

技能独立使用：输入可以是明确需求、PRD、技术方案、测试用例的任意组合，缺文档不阻止实施，缺用例时在任务内补足。

### bug-debugging：先验证根因，再等批准

确认症状 → 建立复现或可核对观测 → 用实验验证原因 → 提交方案等待同意 → 实施 → 验证与交付。根因结论分三级：**已验证**（触发链与区分性实验相符）、**有证据支持**、**未确定**（[根因标注](../../../skills/bug-debugging/SKILL.md)）。

确认前允许读代码、跑测试、在临时目录做可撤销实验；不把实验补丁应用到工作区，不弱化测试“试修”。部署、外发、生产写操作不随修复批准自动获得授权（[执行边界](../../../skills/bug-debugging/SKILL.md)）。

### diff-review：三轴各自成立

先钉住基线（`git rev-parse` → `merge-base` → `git diff`），再分别执行 Correctness、Standards、Spec；每条 finding 要给位置、证据和后果，三轴结论分别保留，不合并成总分（[三轴](../../../skills/diff-review/SKILL.md)）。仓库明确认可的做法不算违规，证据不足时不报。

### complexity-audit：CRAP 只在数据足够时计算

```text
CRAP(m) = complexity(m)² × (1 - coverage(m))³ + complexity(m)
```

默认阈值 30。数据不完整时降级并写明等级：`full-crap`、`complexity-only`、`file-level-risk`、`unavailable`（[指标说明](../../../skills/complexity-audit/SKILL.md)）。支持 Java、Python、Go、JavaScript、TypeScript，工具复用项目已有配置，不自动安装；范围默认按用户指定或最近改动，不默认全仓扫描。

### mutation-testing：只看测试能否发现错误

识别项目已有的突变工具（PIT、mutmut、go-mutesting、Stryker），限定目标源码，执行后分析 `survived` 与 `no-coverage`；工具失败标为结果不完整，不能当通过。不安装工具、不为杀死突变体加无意义断言（[边界](../../../skills/mutation-testing/SKILL.md)）。

### worktree：两个动作、固定目录

目录固定为 `<主工作树根>/worktree/<分支>/`，用 `git -C` 显式指定仓库。add 选择本地或远端基线、锁定 OID、检查本地与远端冲突、必要时追加忽略规则，再创建并验证；remove 精确核对登记路径、分支与提交，检查包括忽略文件在内的未提交内容后移除，保留分支。远端名视为不可信输入，必须出现在 `git worktree` / `remote` 的输出中且不能以 `-` 开头（[公共规则](../../../skills/worktree/SKILL.md)）。

## 关键实现

| 职责 | 位置 |
|---|---|
| 实施编排流程 | [implementation-workflow/SKILL.md](../../../skills/implementation-workflow/SKILL.md) |
| 任务卡与质量门参考 | [implementation-workflow/references](../../../skills/implementation-workflow/references) |
| 调试确认点 | [bug-debugging/SKILL.md](../../../skills/bug-debugging/SKILL.md) |
| 三轴判据 | [diff-review/references](../../../skills/diff-review/references) |
| CRAP 计算脚本 | [complexity-audit/scripts/crap.cjs](../../../skills/complexity-audit/scripts/crap.cjs) |
| 语言适配矩阵 | [complexity-audit/SKILL.md](../../../skills/complexity-audit/SKILL.md) |
| 突变工具适配 | [mutation-testing/references](../../../skills/mutation-testing/references) |
| 工作树命令细节 | [worktree/SKILL.md](../../../skills/worktree/SKILL.md) |

## 修改须知

- `implementation-workflow` 的审计选择是“按风险”，不是固定三件套；改成分必跑会让小任务成本失控。
- `bug-debugging` 的确认点不能通过委派绕过：交给子 agent 时也要传当前阶段与授权范围。
- 审计技能只报告；修复由实施任务执行，修完重跑相关验证。
- `worktree` 的强制删除必须先说明数据风险并获得用户同意，不能靠 `prune` 或覆盖来“修复”状态。

<details><summary>来源</summary>

- [skills/implementation-workflow/SKILL.md](../../../skills/implementation-workflow/SKILL.md)
- [skills/bug-debugging/SKILL.md](../../../skills/bug-debugging/SKILL.md)
- [skills/diff-review/SKILL.md](../../../skills/diff-review/SKILL.md)
- [skills/complexity-audit/SKILL.md](../../../skills/complexity-audit/SKILL.md)
- [skills/complexity-audit/scripts/crap.cjs](../../../skills/complexity-audit/scripts/crap.cjs)
- [skills/mutation-testing/SKILL.md](../../../skills/mutation-testing/SKILL.md)
- [skills/worktree/SKILL.md](../../../skills/worktree/SKILL.md)

</details>
