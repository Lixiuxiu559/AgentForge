---
name: mutation-testing
description: 测试有效性审计能力。当需要通过突变测试验证测试是否真正覆盖业务逻辑、定位存活突变体、发现测试漏网点或评估测试质量时使用。该能力只生成审计报告，不修改代码或测试。
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

## 执行流程

### 1. 确定目标范围

按以下优先级确定范围：

1. 用户明确指定的模块、类或文件
2. 用户指定的 git 基线
3. 最近未提交或最近一次提交涉及的源码文件
4. 没有任何目标时，明确询问用户；不要默认全量运行

突变测试通常很慢，必须尽量缩小范围。

### 2. 识别语言和工具链

检查项目根目录的构建声明：

| 文件 | 语言/构建 | 常见工具 |
|---|---|---|
| `pom.xml` | Java/Maven | PIT |
| `build.gradle` / `build.gradle.kts` | Java/Gradle | PIT |
| `package.json` | JavaScript/TypeScript | Stryker |
| `pyproject.toml` / `setup.py` | Python | mutmut 或 cosmic-ray |

识别不到语言、构建系统或突变工具时停止并报告，不要猜测。

### 3. 确定突变目标

只把源码文件作为目标，不把测试文件、生成代码和构建产物作为目标。

从目标源码推导工具需要的标识：

- Java：包名、类名或 PIT 支持的 targetClasses
- JavaScript/TypeScript：Stryker 的 mutate 文件范围
- Python：模块路径或 mutmut 支持的模块范围

### 4. 执行突变测试

优先复用项目已经存在的配置，不要擅自创建新配置。

典型命令：

```bash
# Maven + PIT
mvn org.pitest:pitest-maven:mutationCoverage \
  -DtargetClasses='<目标>' \
  -q

# Gradle + PIT
./gradlew pitest

# JavaScript/TypeScript
npx stryker run

# Python
mutmut run
```

只有在对应工具已经存在或项目明确允许使用时才执行。不要自动联网安装依赖。

### 5. 输出报告

重点报告：

- 存活突变体：位置、突变类型、原始逻辑、为什么测试没有失败
- 无覆盖代码：模块、方法、建议补充的测试场景
- 测试范围和实际执行命令
- 工具输出是否完整
- 未解决的环境问题

## 边界

- 只分析测试有效性，不修改生产代码
- 不修改测试代码
- 不为了杀死突变体添加无意义断言
- 不绕过失败的测试
- 不默认全量运行
- 不与复杂度审计、行为验收、代码评审重复
