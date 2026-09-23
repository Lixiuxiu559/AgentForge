# TypeScript / Stryker 适配

## 项目识别

检查：

- `package.json`
- `tsconfig.json`
- Stryker 配置文件
- 项目使用的测试运行器（Jest、Vitest、Mocha 等）

## 执行

```bash
npx stryker run
```

优先使用项目已有的 TypeScript、测试运行器和 Stryker 配置。不要自动生成配置或安装依赖。

## 范围

使用 Stryker 配置中的 `mutate` 范围。目标应是源码 `.ts` / `.tsx` 文件，不应包含：

- `*.test.ts`
- `*.spec.ts`
- `node_modules/`
- `dist/`、`build/`、生成代码

如果需要临时改动 mutate 范围，先确认项目配置和 Stryker 版本的覆盖方式。

## 结果

重点关注：

- `Survived` / `survived`：测试没有捕获突变
- `Killed` / `killed`：测试捕获突变
- `No coverage`：没有测试覆盖
- 编译失败、测试失败、超时：结果不完整

## 注意

TypeScript 的编译、source map 和路径别名会影响报告位置。报告中的源码位置无法映射时，应说明映射问题，不要猜测行号。
