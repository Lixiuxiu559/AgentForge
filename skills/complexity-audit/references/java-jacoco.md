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

脚本位于**本技能目录**的 `scripts/crap.js`。两端定位方式不同：

```bash
# Claude Code：插件根用 ${CLAUDE_PLUGIN_ROOT} 定位
node "${CLAUDE_PLUGIN_ROOT}/skills/complexity-audit/scripts/crap.js" \
  target/site/jacoco/jacoco.xml \
  --lang java \
  --threshold 30 \
  --top 30

# DSH：技能加载时会给出本技能的 Base directory，以它为基准
node "<技能目录>/scripts/crap.js" \
  target/site/jacoco/jacoco.xml \
  --lang java \
  --threshold 30 \
  --top 30
```

**不要凭猜写死绝对路径**：先确认脚本存在（`ls <技能目录>/scripts/`），
再执行；找不到就退回纯复杂度排序，并在报告里说明。

## 规则

- 多模块项目选择与审计范围对应的模块报告。
- 没有覆盖率时只能退化为 `complexity-only`。
- 不要把类级覆盖率当成函数级覆盖率。
- 不要因为 CRAP 超阈值就直接要求重写整个类。
