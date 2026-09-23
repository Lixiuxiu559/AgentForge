# JavaScript / Stryker 适配

## 项目识别

检查：

- `package.json`
- `stryker.conf.js`
- `stryker.conf.cjs`
- `stryker.conf.mjs`
- `stryker.config.json`

## 执行

优先使用项目已有配置：

```bash
npx stryker run
```

不要在没有配置的情况下自动生成 Stryker 配置或安装依赖。先向用户报告缺少的配置和工具。

## 范围

优先使用配置中的 `mutate` 范围。若用户指定了文件，应确认 Stryker 版本支持命令行覆盖；否则临时修改配置前必须得到用户确认。

## 结果

重点关注：

- `Survived` / `survived`：测试没有捕获突变
- `Killed` / `killed`：测试捕获突变
- `No coverage`：没有测试覆盖
- `Compile error`、`Test failure`、`Timeout`：结果不完整

## 注意

- 不要默认扫描整个前端仓库。
- 不要把构建产物、`node_modules` 和生成代码加入 mutate 范围。
