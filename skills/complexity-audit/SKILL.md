---
name: complexity-audit
description: 代码复杂度风险审计能力。当需要评估函数是否难以安全修改、分析复杂度与测试覆盖率、定位高 CRAP 值方法，或执行复杂度体检时使用。该能力只生成审计报告，不修改代码。
user-invocable: true
---

# 代码复杂度风险审计

## 目标

定位**复杂度高且测试保护不足**的函数或方法，帮助主 Agent 决定：

- 应该拆分函数降低复杂度
- 应该补充测试提高覆盖率
- 还是当前风险可以接受

本技能不负责修改代码。修改由实现型 agent 执行。

## CRAP 指标

```text
CRAP(m) = complexity(m)² × (1 - coverage(m))³ + complexity(m)
```

- `complexity`：函数或方法圈复杂度
- `coverage`：函数或方法测试覆盖率，范围为 `0~1`
- 默认阈值：`30`

CRAP 不是单纯的复杂度排序。一个复杂但测试充分的方法，风险可能低于一个复杂度中等但完全没有测试的方法。

## 执行流程

### 1. 确定范围

按以下优先级确定审计范围：

1. 用户明确指定的文件、目录、模块或方法
2. 用户要求审计最近改动时，使用 `git diff --name-only` 或指定的 git 基线
3. 用户明确要求全量审计时，才扫描整个项目
4. 没有范围时，询问用户；不要默认扫描大型仓库

### 2. 识别项目和语言

检查最近的构建声明：

- `pom.xml`：Java/Maven
- `build.gradle` 或 `build.gradle.kts`：Java/Gradle
- `package.json`：JavaScript/TypeScript
- `pyproject.toml` 或 `setup.py`：Python

多模块仓库按照被审计文件所属模块分别处理。

### 3. 检查分析数据

CRAP 至少需要函数级复杂度和覆盖率数据。

当前内置可靠分析器：

- Java + JaCoCo XML：可执行
- JavaScript/TypeScript：暂不内置函数级 CRAP 分析器
- Python：暂不内置函数级 CRAP 分析器

没有覆盖率数据时，不要伪造 CRAP 值。可以退化为复杂度排序，但必须在报告中说明：

> 当前结果不是完整 CRAP，只反映复杂度风险，缺少覆盖率保护数据。

### 4. 执行 Java 分析

查找 JaCoCo 报告：

```bash
find . -path '*/target/site/jacoco/jacoco.xml' \
  -not -path '*/node_modules/*'
```

使用本技能内置脚本：

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/complexity-audit/scripts/crap.js" \
  <jacoco.xml 路径> \
  --lang java \
  --threshold 30 \
  --top 30
```

缺少 JaCoCo 报告时，可以检查项目是否能通过测试生成报告，但不要自动安装依赖。

### 5. 输出报告

报告只保留精炼结果，不要粘贴完整 JaCoCo XML 或冗长构建日志。

每个高风险项至少包含：

- 类名和方法名
- 文件位置
- CRAP 值
- 圈复杂度
- 覆盖率
- 风险判断
- 建议拆分还是补测试

## 风险判断

- 复杂度很高、覆盖率低：优先拆分方法，再补测试
- 复杂度中等、覆盖率为零：优先补测试
- 覆盖率全部为零：说明当前测试可能没有执行到业务代码，报告中必须明确说明
- 不要为了降低 CRAP 进行无意义拆分
- 不要为了提高覆盖率添加空断言

## 边界

- 只分析，不修改代码
- 不使用 Edit 或 Write
- 不自动安装外部工具
- 不把未实现的语言支持伪装成已支持
- 不默认扫描全仓库
- 不与突变测试、行为验收、通用代码评审重复
