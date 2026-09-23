# Java + JaCoCo 适配

## 复杂度与覆盖率

JaCoCo XML 可以提供方法级 complexity 和 line coverage。两者能够按类、方法和签名匹配时，可以计算完整 CRAP。

常见报告位置：

```text
target/site/jacoco/jacoco.xml
```

查找报告：

```bash
find . -path '*/target/site/jacoco/jacoco.xml' \
  -not -path '*/node_modules/*'
```

## 执行

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/complexity-audit/scripts/crap.js" \
  target/site/jacoco/jacoco.xml \
  --lang java \
  --threshold 30 \
  --top 30
```

## 规则

- 多模块项目选择与审计范围对应的模块报告。
- 没有覆盖率时只能退化为 `complexity-only`。
- 不要把类级覆盖率当成函数级覆盖率。
- 不要因为 CRAP 超阈值就直接要求重写整个类。
