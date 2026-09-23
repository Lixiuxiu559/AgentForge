# JavaScript / ESLint + c8/Istanbul 适配

## 项目识别

检查：

- `package.json`
- ESLint 配置
- `c8`、Istanbul、nyc 或测试框架覆盖率配置

## 复杂度

优先使用项目已有 ESLint complexity 规则或 escomplex：

```bash
npx eslint <目标文件> --format json
```

如果 ESLint 只输出规则告警而没有稳定的函数级结构，降级为 `complexity-only`。

## 覆盖率

优先使用项目已有配置：

```bash
npx c8 --reporter=json <项目测试命令>
```

也可以使用 Istanbul/nyc 生成 JSON 报告。只有当复杂度结果和 coverage 函数位置能稳定匹配时，才计算完整 CRAP。

## 注意

- 不要默认扫描 `node_modules`、构建产物和生成代码。
- 不要自动修改 ESLint 配置。
- JavaScript 的匿名函数、回调和动态代码可能导致函数映射不稳定。
