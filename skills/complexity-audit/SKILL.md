---
name: complexity-audit
description: 代码复杂度风险审计能力。当需要评估函数是否难以安全修改、分析复杂度与测试覆盖率、定位高 CRAP 值方法，或执行 Java、Python、Go、JavaScript、TypeScript 复杂度体检时使用。该能力只生成审计报告，不修改代码。
user-invocable: true
---

# 代码复杂度风险审计

## 目标

定位**复杂度高且测试保护不足**的函数或方法，帮助主 Agent 决定：

- 应该拆分函数降低复杂度
- 应该补充测试提高覆盖率
- 还是当前风险可以接受

本技能不负责修改代码。修改由实施子任务执行。

## 委派

需要独立上下文时，用宿主通用子 agent 工具实际派发。传入目标项目的绝对路径、范围/基线、约束、所需技能资源的绝对路径和交付要求（资源不可读时附必要方法）；子 agent 只做分配的任务，回报证据、完成状态与未验证项。仅在任务及文件/工具产物互不冲突时并行；无派发能力时自行执行并说明。

## 指标说明

### CRAP

当能拿到函数级复杂度和函数级覆盖率时，使用：

```text
CRAP(m) = complexity(m)² × (1 - coverage(m))³ + complexity(m)
```

默认阈值为 `30`。CRAP 不是单纯的复杂度排序：复杂但测试充分的方法，风险可能低于复杂度中等但没有测试保护的方法。

### 无法计算完整 CRAP 时

不同语言的覆盖率工具粒度不同。必须明确区分：

| 结果等级 | 含义 |
|---|---|
| `full-crap` | 函数级复杂度 + 函数级覆盖率都可匹配 |
| `complexity-only` | 只有复杂度，不能伪造 CRAP |
| `file-level-risk` | 只有文件级覆盖率，只能做近似风险排序 |
| `unavailable` | 缺少工具、报告或项目配置，停止并报告 |

如果只能退化分析，报告中必须写清楚实际等级。

## 支持矩阵

| 语言 | 复杂度来源 | 覆盖率来源 | 当前能力 | 适配文档 |
|---|---|---|---|---|
| Java | JaCoCo complexity | JaCoCo XML | `full-crap` | `references/java-jacoco.md` |
| Python | radon / xenon | coverage.py | 默认 `file-level-risk` | `references/python-radon-coverage.md` |
| Go | gocyclo / gocognit | `go test -coverprofile` + `go tool cover -func` | `full-crap` 或近似 | `references/go-complexity-coverage.md` |
| JavaScript | ESLint complexity / escomplex | c8 / Istanbul | `full-crap` 取决于配置 | `references/javascript-eslint-istanbul.md` |
| TypeScript | ESLint complexity / escomplex | c8 / Istanbul + source map | `full-crap` 取决于映射 | `references/typescript-eslint-istanbul.md` |

## 执行

1. 范围按用户指定 > 指定 git 基线/最近改动 > 用户明确要求全量确定；不默认扫描整个大型仓库。
2. 根据目标模块的构建声明和已有报告，确认复杂度工具、覆盖率粒度、函数定位是否能匹配。按支持矩阵读取对应 reference，复用项目已有配置，不自动安装工具。
3. 只在数据足够时计算 CRAP；否则使用上表的降级等级。报告目标位置、复杂度、可得的覆盖率、等级及建议，并说明命令、数据缺口和实际运行范围。

## 风险判断

- 复杂度很高、覆盖率低：优先拆分方法，再补测试
- 复杂度中等、覆盖率为零：优先补测试
- 只有文件级覆盖率：不要把它写成函数级覆盖率
- 覆盖率全部为零：说明当前测试可能没有执行到业务代码，必须说明前提
- 不要为了降低 CRAP 进行无意义拆分
- 不要为了提高覆盖率添加空断言

## 边界

只报告风险，不修改业务源码或测试；已有工具可生成分析报告与临时产物。
