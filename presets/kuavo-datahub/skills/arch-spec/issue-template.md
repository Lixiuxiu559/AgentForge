# Issue 模板（arch-spec 产出用）

使用方式：arch-spec 完成 Plan 并获用户批准后，按此模板生成**一个整体 issue**（arch-spec 的产出是全栈方案，前后端工作项在同一 issue 下跟踪，完成后由相关人员评论汇报）。

## 标题

`feat({版本号})[{模块}]: {功能概述}`

> 对齐仓库 commit 风格（如 `feat(V3.3.1)[任务/工单]: 任务修改字段锁定与接收后同步`）。模块取主要涉及的 Wiki 模块，多个用 `/` 连接。

## 描述

### 需求概述

<!-- 3-6 句话说明本次需求：解决什么问题、核心行为（来自 PRD 问题陈述与执行摘要） -->

### 相关文档

| 文档 | 位置 |
|------|------|
| PRD | `assets/docs/prd/v{版本}/{日期}-{功能}PRD.md` |
| ADR | `docs/adr/{编号}-{slug}.md`（如无新增 ADR 写"无新增，复用 ADR-XXXX"） |
| 全栈 Spec | `assets/docs/architecture/specs/{日期}-{功能}/spec.md` |
| 协调 Plan | `assets/docs/architecture/specs/{日期}-{功能}/plan.md` |
| 后端深化产出 | `{日期}-{功能}/backend-spec.md`、`backend-plan.md`（开工时生成） |
| 前端深化产出 | `{日期}-{功能}/frontend-spec.md`、`frontend-plan.md`（开工时生成） |

### 工作项

#### 后端（/arch-backend）

> 开工命令：`/arch-backend assets/docs/architecture/specs/{日期}-{功能}/`

<!-- 来自 Plan 模块分工表中后端的全部工作项，按执行顺序 -->

- [ ]

#### 前端（/arch-frontend）

> 开工命令：`/arch-frontend assets/docs/architecture/specs/{日期}-{功能}/`

<!-- 来自 Plan 模块分工表中前端的工作项，标注优先级与依赖 -->

- [ ]

#### 其他（文档/Gym CLI 等）

- [ ]

### 接口契约要点

<!-- 来自 Spec API 契约：变更接口、错误码、对 Gym CLI 的影响结论 -->

### 验收标准

<!-- PRD AC 归并分组，逐条 checkbox -->

- [ ]

### 发布约束

<!-- 版本列车、Schema/Flyway、实施顺序（如后端先行）、环境发布顺序 -->

## 完成汇报

各端完成后在本 issue 下评论汇报（关联 MR、验证结果），勾选对应工作项 checkbox。

## 标签建议

- `{功能名称}`（如无标签权限可省略）

## 创建方式

1. 渲染好 issue 标题与描述后，用 glab 创建：

```bash
glab issue create -t "feat(V3.3.1)[模块]: 功能概述" -d "<渲染后的描述>"
```

2. glab 不可用或未认证时，把渲染好的内容输出给用户手动创建。

## 是否拆分前后端 issue？

**默认不拆**。理由：

- arch-spec 产出的是全栈方案，API 契约把两端绑在一起——接口契约要点、验收标准（联调项）拆开会重复或遗漏
- 前后端工作量常不对称（本类需求后端 7 项 vs 前端 2 项），拆分后小的一端 issue 信息密度低
- 单 issue 的评论流天然承载跨端联动（契约调整、联调结论），拆分后要靠交叉引用

**例外**：前后端由不同团队认领、且需要独立排期/看板流转时，可按本模板的"工作项"章节各拆一份，标题前缀改为 `[前端]`/`[后端]`，并在两份 issue 中互相引用。
