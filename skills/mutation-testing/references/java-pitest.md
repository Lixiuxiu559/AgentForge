# Java / PIT 适配

## 项目识别

检查：

- `pom.xml`
- `build.gradle`
- `build.gradle.kts`
- `pitest` 或 `pitest-maven` 配置

## Maven

优先使用项目已有的 PIT 配置。没有覆盖目标范围时，使用：

```bash
mvn org.pitest:pitest-maven:mutationCoverage \
  -DtargetClasses='<目标包或类>' \
  -q
```

## Gradle

```bash
./gradlew pitest
```

实际目标过滤参数以项目的 PIT 插件版本和现有配置为准，不要凭空添加参数。

## 结果

重点关注：

- `SURVIVED`：测试没有捕获该逻辑变化
- `NO_COVERAGE`：相关代码没有被测试执行
- `KILLED`：测试捕获了该逻辑变化

## 常见报告位置

- Maven：通常在 `target/pit-reports/`
- Gradle：通常在 `build/reports/pitest/`

## 注意

- 必须限制 target classes，不要默认扫描整个大型仓库。
- 不要为了让 PIT 通过写空断言。
- 如果报告不完整，明确说明缺失的报告文件或构建问题。
