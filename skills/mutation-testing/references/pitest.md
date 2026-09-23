# PIT（Java）适配说明

## 范围

PIT 适合 Java 项目的突变测试。优先使用项目已有的 `pitest-maven` 或 Gradle PIT 配置。

## Maven 示例

```bash
mvn org.pitest:pitest-maven:mutationCoverage \
  -DtargetClasses='<目标包或类>' \
  -q
```

## Gradle 示例

```bash
./gradlew pitest
```

## 重点报告

- `SURVIVED`：测试没有捕获该逻辑变化
- `NO_COVERAGE`：相关代码没有被测试执行
- 突变位置和类型
- 应补充的业务断言

## 注意

- 必须限制 `targetClasses`，不要默认对整个大型仓库运行。
- 不要为了让 PIT 通过而写空断言。
- 如果报告不完整，明确说明缺失的报告文件或构建问题。
