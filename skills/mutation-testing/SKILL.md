---
name: mutation-testing
description: 测试有效性审计能力。当需要通过突变测试验证测试是否真正覆盖业务逻辑、定位存活突变体、发现测试漏网点或评估测试质量时使用。支持 Java、Python、Go、JavaScript、TypeScript。该能力只生成审计报告，不修改代码或测试。
user-invocable: true
---

# 测试有效性审计

## 目标

通过突变测试回答：

> 如果把生产代码中的一小段逻辑改错，现有测试能不能失败？

重点发现：

- **存活突变体**：代码被改动后测试仍然通过
- **无覆盖代码**：突变工具无法执行到相关逻辑
- **测试断言不足**：测试执行了代码，但没有验证关键结果

## 支持范围

本技能至少支持以下语言。支持的含义是：能够识别项目、选择对应的既有工具配置、限定目标范围、执行工具并统一解读报告；**不负责自动安装突变测试工具**。

| 语言 | 首选工具 | 适配文档 |
|---|---|---|
| Java | PIT | `references/java-pitest.md` |
| Python | mutmut | `references/python-mutmut.md` |
| Go | go-mutesting | `references/go-mutesting.md` |
| JavaScript | Stryker | `references/javascript-stryker.md` |
| TypeScript | Stryker | `references/typescript-stryker.md` |

如果项目已经配置了其他工具（如 cosmic-ray、gremlins），优先遵循项目现有配置，并在报告中说明实际使用的工具。

## 执行流程

### 1. 确定目标范围

按以下优先级确定范围：

1. 用户明确指定的模块、类或文件
2. 用户指定的 git 基线
3. 最近未提交或最近一次提交涉及的源码文件
4. 没有任何目标时，明确询问用户；不要默认全量运行

突变测试通常很慢，必须尽量缩小范围。

### 2. 识别语言和工具链

检查项目声明文件：

- Java：`pom.xml`、`build.gradle`、`build.gradle.kts`
- Python：`pyproject.toml`、`setup.py`、`requirements.txt`
- Go：`go.mod`
- JavaScript/TypeScript：`package.json`、`stryker.conf.*`

然后检查工具是否已经存在、是否有配置文件、测试命令是什么。不要仅因为发现语言就直接执行命令。

### 3. 确定突变目标

只把源码文件作为目标，不把测试文件、生成代码和构建产物作为目标。

目标映射规则：

- Java：PIT 的 `targetClasses` 或项目已有类过滤配置
- Python：mutmut 的模块/文件范围
- Go：go-mutesting 的包、文件或函数范围
- JavaScript：Stryker 的 `mutate` 文件范围
- TypeScript：Stryker 的 TypeScript `mutate` 文件范围，使用项目已有编译配置

如果工具不支持精确目标过滤，说明实际运行范围和可能的额外成本。

### 4. 执行突变测试

优先复用项目已有配置，不要擅自创建新配置。只有工具已经安装或项目明确允许时才执行：

```bash
# Java / Maven
mvn org.pitest:pitest-maven:mutationCoverage -DtargetClasses='<目标>' -q

# Java / Gradle
./gradlew pitest

# Python
mutmut run

# Go
go-mutesting ./path/to/package/...

# JavaScript / TypeScript
npx stryker run
```

具体参数、报告位置和配置入口见对应 reference。

### 5. 统一解读结果

不同工具的名称不同，但统一映射为：

| 统一结果 | 常见工具状态 | 含义 |
|---|---|---|
| killed | `KILLED`、`killed` | 测试捕获了代码变化 |
| survived | `SURVIVED`、`survived` | 测试没有捕获代码变化，重点问题 |
| no-coverage | `NO_COVERAGE`、`no coverage` | 目标逻辑没有被测试执行 |
| error | 构建失败、测试失败、工具失败 | 结果不完整，不能当成通过 |

## 输出报告

重点报告：

- 目标范围和实际运行范围
- 识别到的语言、构建系统和突变工具
- 实际执行的命令
- 存活突变体：位置、突变类型、原始逻辑、为什么测试没有失败
- 无覆盖代码：模块、方法、建议补充的测试场景
- 工具输出是否完整
- 未解决的环境问题

## 边界

- 只分析测试有效性，不修改生产代码
- 不修改测试代码
- 不为了杀死突变体添加无意义断言
- 不绕过失败的测试
- 不默认全量运行
- 不自动联网安装依赖
- 不与复杂度审计、行为验收、代码评审重复
