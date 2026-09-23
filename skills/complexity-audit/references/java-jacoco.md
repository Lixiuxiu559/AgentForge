# Java + JaCoCo 适配说明

## 输入

Java 项目需要提供 JaCoCo XML 报告，通常位于：

```text
target/site/jacoco/jacoco.xml
```

多模块项目可能存在多个报告，应根据审计范围选择对应模块的报告。

## 运行命令

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/complexity-audit/scripts/crap.js" \
  target/site/jacoco/jacoco.xml \
  --lang java \
  --threshold 30 \
  --top 30
```

## 限制

- JaCoCo 报告必须包含函数级 complexity 与 line coverage 信息。
- 没有覆盖率时只能退化为复杂度排序。
- 不要把类级覆盖率当成函数级覆盖率。
- 不要因为 CRAP 超阈值就直接要求重写整个类，应结合改动范围和业务风险判断。
