# 需求与设计技能

> 说明 pm、prototype、architecture-design、architecture-scout、research、test-design 的交付物、输入与边界；不涉及实施、评审与质量审计。

## 概述

这六个技能覆盖“做什么、长什么样、技术上怎么成立、值不值得改、证据是什么、怎么验证”。它们各自独立交付，不指定也不调用下一个技能；用户可以只带其中任意材料进入实施。

| 技能 | 输入 | 交付物 | 明确不做 |
|---|---|---|---|
| `pm` | 想法、需求变更、已有材料 | 默认 `prd.html`，含业务规则、范围、用户故事、验收标准、假设与开放问题 | 技术选型、架构、实施 |
| `prototype` | PRD、对话需求、截图、现有页面 | 可离线走查的 HTML 原型与页面/字段/交互状态清单 | 生产组件、连接真实服务、实施 |
| `architecture-design` | 需求、PRD、原型、已有方案或工程事实 | 默认 `spec.html`，含边界、流程、数据归属、契约与风险验证 | 生产代码、数据库变更、发布 |
| `architecture-scout` | 指定范围 | 架构机会报告，允许零候选 | 修改代码 |
| `research` | 需要多步取证的问题 | 有证据的结论与不确定性说明 | 简单事实查询 |
| `test-design` | 业务规则、已有材料 | 默认 HTML 测试设计，含用例与断言缺口 | 编写或执行测试、运行覆盖率/突变工具 |

## 核心流程

### pm：按需澄清，直接产出

只追问会改变业务规则、范围边界或验收结果的缺口，问题一次集中提出；需求明确时直接产出，不设访谈仪式或审批门。材料冲突时指出冲突及影响，不静默选择一方；无法确认但不阻塞的内容标为“假设”或“开放问题”，不编造业务规则（[pm/SKILL.md](../../../skills/pm/SKILL.md)）。

默认保存到目标项目 `docs/requirements/YYYY-MM-DD-主题/prd.html`；用户指定位置或项目已有需求目录时优先，HTML 为正本，不强制另出 Markdown 副本。

### prototype：先列清单，再画页面

原型回答“页面呈现什么、用户如何操作、状态如何反馈”，配套清单保留需求依据。轻量本地脚本可以模拟导航与状态切换，但必须标明哪些行为是模拟的；不连接真实业务服务、不提交真实数据（[prototype/SKILL.md](../../../skills/prototype/SKILL.md)）。

### architecture-design：用户决定关键取舍

先建立依据与约束，再比较真实可行方案，由用户决定重大取舍后才定稿；单端任务不凭空增加另一端。交付可含契约、Schema、迁移草案与关键伪代码，不写生产实现。数据库设计要比较迁移脚本与实际 Schema，没有连接时标明环境未核实（[architecture-design/SKILL.md](../../../skills/architecture-design/SKILL.md)）。

### research：证据先于结论

调查问题先限定范围，证据不足的结论标注为推断；子任务可委派给宿主子 agent，但结论由主 Agent 汇总。简单事实查询、定位符号不属于本技能（[research/SKILL.md](../../../skills/research/SKILL.md)）。

### test-design：从规则推导，不反推实现

按规则来源读取已确认需求与契约，为关键规则保留编号（如 R1），记录适用角色/状态、触发条件、期望结果与禁止的副作用。测试形式跟随项目已有设施，不新增框架、不生成空骨架；没有自动化承接入口时明确保留验证缺口（[test-design/SKILL.md](../../../skills/test-design/SKILL.md)）。

### architecture-scout：只报告

仅在用户明确要求架构机会调查时启动，先定范围、再取证、按硬门槛筛选候选，允许零候选；不修改代码，报告后停下等用户决定（[architecture-scout/SKILL.md](../../../skills/architecture-scout/SKILL.md)）。

## 关键实现

| 职责 | 位置 |
|---|---|
| PRD 模板与 HTML 交付 | [pm/references](../../../skills/pm/references) |
| 原型清单与 HTML 交付 | [prototype/references](../../../skills/prototype/references) |
| 方案比较、质量验证、HTML 交付 | [architecture-design/references](../../../skills/architecture-design/references) |
| 侦察判据 | [architecture-scout/references](../../../skills/architecture-scout/references) |
| 测试设计模板 | [test-design/references](../../../skills/test-design/references) |

## 修改须知

- 技能之间没有调用关系：任何“必须先跑 pm/architecture-design”的说法都是实现偏差，应删除。
- 默认 HTML 交付是契约的一部分；改回 Markdown 正本属于行为变化，按版本规则处理。
- 各技能 references 中的模板与交付说明是执行依据，改模板时同步自检清单。

<details><summary>来源</summary>

- [skills/pm/SKILL.md](../../../skills/pm/SKILL.md)
- [skills/prototype/SKILL.md](../../../skills/prototype/SKILL.md)
- [skills/architecture-design/SKILL.md](../../../skills/architecture-design/SKILL.md)
- [skills/architecture-scout/SKILL.md](../../../skills/architecture-scout/SKILL.md)
- [skills/research/SKILL.md](../../../skills/research/SKILL.md)
- [skills/test-design/SKILL.md](../../../skills/test-design/SKILL.md)

</details>
