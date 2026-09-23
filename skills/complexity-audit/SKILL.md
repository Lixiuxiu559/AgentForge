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

本技能不负责修改代码。修改由 `implementer` 执行。

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

**工具使用原则**：优先复用项目已有工具和配置；不自动安装依赖；不因为语言在表中就假装工具一定可用。

## 执行流程

### 1. 确定范围

按以下优先级确定审计范围：

1. 用户明确指定的文件、目录、模块或方法
2. 用户要求审计最近改动时，使用 `git diff --name-only` 或指定 git 基线
3. 用户明确要求全量审计时，才扫描整个项目
4. 没有范围时，询问用户；不要默认扫描大型仓库

### 2. 识别项目和语言

检查最近的构建声明：

- Java：`pom.xml`、`build.gradle`、`build.gradle.kts`
- Python：`pyproject.toml`、`setup.py`、`requirements.txt`
- Go：`go.mod`、`go.work`
- JavaScript/TypeScript：`package.json`、ESLint 配置、覆盖率配置

多模块仓库按照被审计文件所属模块分别处理。

### 3. 识别数据源

逐项确认：

- 是否存在复杂度工具
- 是否存在覆盖率工具
- 覆盖率粒度是函数、方法、文件还是行
- 报告是否能与源码函数稳定匹配
- 目标范围是否会被构建配置扩大

缺少数据时选择正确的降级等级，不要拼接无法证明有效的数字。

### 4. 选择适配器

按语言读取对应 reference，再执行项目已有命令：

- Java：查找 JaCoCo XML，可使用本技能内置脚本
- Python：优先 `radon cc -j` / `xenon`，再检查 coverage.py 报告粒度
- Go：优先 `gocyclo` / `gocognit`，覆盖率使用 `go test -coverprofile`
- JavaScript：优先 ESLint complexity 与 c8/Istanbul
- TypeScript：优先 ESLint complexity 与 c8/Istanbul，并检查 source map

### 5. 输出报告

报告只保留精炼结果，不粘贴完整覆盖率 XML、JSON 或冗长构建日志。

每个风险项至少包含：

- 类名、函数名或方法名
- 文件位置
- 复杂度值
- 覆盖率值（如可得）
- 结果等级：`full-crap` / `complexity-only` / `file-level-risk`
- 风险判断
- 建议拆分、补测试还是先完善分析数据

## 风险判断

- 复杂度很高、覆盖率低：优先拆分方法，再补测试
- 复杂度中等、覆盖率为零：优先补测试
- 只有文件级覆盖率：不要把它写成函数级覆盖率
- 覆盖率全部为零：说明当前测试可能没有执行到业务代码，必须说明前提
- 不要为了降低 CRAP 进行无意义拆分
- 不要为了提高覆盖率添加空断言

## 边界

- 只分析，不修改代码
- 不使用 Edit 或 Write
- 不自动安装外部工具
- 不把未实现的语言能力伪装成已支持
- 不默认扫描全仓库
- 不与突变测试、行为验收、通用代码评审重复
