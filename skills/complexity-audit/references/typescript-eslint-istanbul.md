# TypeScript / ESLint + c8/Istanbul 适配

## 项目识别

检查：

- `package.json`
- `tsconfig.json`
- ESLint 配置
- c8/Istanbul/nyc 配置
- source map 配置

## 复杂度

优先使用 ESLint complexity 规则：

```bash
npx eslint <目标文件> --format json
```

复杂度报告需要保留源码位置、函数名和行列信息，方便与 coverage 报告匹配。

## 覆盖率

```bash
npx c8 --reporter=json <项目测试命令>
```

如果 coverage 只对应编译后的 JavaScript，必须检查 source map 是否能够映射回 TypeScript 源码。映射失败时降级为 `complexity-only` 或 `file-level-risk`。

## 注意

- 不要把 `dist/`、`build/`、生成 `.js`、`*.test.ts`、`*.spec.ts` 加入复杂度目标。
- 不要自动修改 tsconfig、ESLint 或测试配置。
- TypeScript 装饰器、泛型擦除和 source map 可能使函数位置匹配不稳定。
