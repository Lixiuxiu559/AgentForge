# 扫描与检查

```bash
node /absolute/skill-directory/scripts/wiki.mjs scan  [--root /absolute/project] [--wiki docs/wiki]
node /absolute/skill-directory/scripts/wiki.mjs check [--root /absolute/project] [--wiki docs/wiki]
```

`--root` 默认当前 Git 根，不在 Git 仓库内时必须传入；`--wiki` 默认 `docs/wiki`。两者只读，需要 Node.js，无 npm 依赖、模型调用或网络请求。`scan` 的语言信号按类别最多抽样 200 个文件；`check` 要求 wiki 目录有 `catalog.json`。

`check` 的问题代码：

| 类别 | 代码 |
|---|---|
| catalog 与文件 | `missing-page`、`planned-page-exists`、`missing-source`、`uncatalogued-page`、`empty-wiki`、`empty-document` |
| 页面开头 | `missing-title`、`missing-summary`、`summary-mismatch` |
| 语言 | `language-mismatch`（仅中英文）、`bilingual-heading` |
| 粒度 | `page-too-broad`（宽度 > 30）；16～30 只列入 `coverage.catalog.oversized`，不影响退出码 |
| 链接与可达 | `broken-link`、`missing-anchor`、`missing-reference`、`invalid-link`、`empty-link`、`missing-readme`、`unreachable-page` |

页面宽度与拆页规则见 `generate.md` 的“页面粒度”。

链接检查支持行内与引用式链接、图片、相对路径、URI 编码和常见 GitHub 标题锚点，忽略代码块和注释；指向源码的行号锚点不检查行号。嵌套列表缩进、复杂 HTML、站点根路径和符号链接记入 `coverage.limitations`；外链不联网检查，不读项目根外的文件。

| status | 含义 | 退出码 |
|---|---|---|
| passed | 机械检查范围内无问题 | 0 |
| issues | 有需处理的问题 | 1 |
| partial | 有无法检查的部分，见 `coverage.limitations` | 1 |
| error | 参数、catalog 或执行失败 | 2 |

同时读 `findings` 与 `coverage`，不只看退出码。`semantic: not_run` 表示脚本不判断正文是否符合代码，执行者仍须追源。
