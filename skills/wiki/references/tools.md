# 只读检查与来源清单

## 新结构（catalog.json）

```bash
node /absolute/skill-directory/scripts/wiki.mjs scan [--root /absolute/project] [--wiki docs/wiki]
node /absolute/skill-directory/scripts/wiki.mjs check [--root /absolute/project] [--wiki docs/wiki]
```

`scan` 的 `--root` 默认当前 Git 根，只读输出文件清单、语言分布、入口候选、目录体量和文档语言建议；语言信号按类别最多抽样 200 个文件，抽样时报告覆盖限制。`check` 的 `--wiki` 默认 `docs/wiki`；目录中存在 `catalog.json` 时按 catalog 检查：格式、页面存在（`planned` 可缺）、来源存在、标题和摘要、摘要与 catalog 一致、正文主要语言（仅中英文）、未收录页面、从 README 可达；来源超过 15 个文件的页面列在 `coverage.catalog.oversized`，只作拆页提示，不影响退出码。非法 catalog 以退出码 2 报错。

退出码：0 通过，1 有问题或覆盖受限，2 执行错误。

## 旧结构（wiki.config.json）

工具需要Node.js，无npm依赖、模型调用或网络请求。check不依赖Git；changes、mapping及新鲜度命令需要Git仓库根。显式提供技能安装路径、目标根和项目配置，不自动搜索配置。

```bash
node /absolute/skill-directory/scripts/wiki.mjs check --root /absolute/project --wiki docs/wiki --config docs/wiki/wiki.config.json
node /absolute/skill-directory/scripts/wiki.mjs mapping --root /absolute/project --config docs/wiki/wiki.config.json
node /absolute/skill-directory/scripts/wiki.mjs mapping --root /absolute/project --config docs/wiki/wiki.config.json --document docs/wiki/example.md
node /absolute/skill-directory/scripts/wiki.mjs changes --root /absolute/project --config docs/wiki/wiki.config.json --scope staged
node /absolute/skill-directory/scripts/wiki.mjs changes --root /absolute/project --config docs/wiki/wiki.config.json --scope worktree
node /absolute/skill-directory/scripts/wiki.mjs changes --root /absolute/project --config docs/wiki/wiki.config.json --scope range --base origin/main --head HEAD
```

## 结构与链接

check核对指定知识目录中的文档、可支持的本地Markdown链接和显式structure规则，模板配置见 `references/templates.md`。支持普通行内/引用式链接、图片、相对路径、URI编码和常见GitHub标题锚点；忽略代码和注释。复杂嵌套、部分列表缩进、HTML、站点根路径、非Markdown锚点和符号链接等产生覆盖限制，外链不联网检查。不读项目根外文件。

check不是完整的 Markdown 格式检查器，也不自动排版或重组正文；标题层级、表格和代码块格式、追加内容的归位、重复与过时说明按 `references/content-verification.md` 由执行者检查。项目已有格式检查命令时沿用其约定。

## 来源映射

配置示例：`{"version":1,"modules":[{"id":"orders","sources":["src/orders","tests/orders.test.mjs"],"docs":["docs/wiki/orders.md"]}]}`。

sources按文件或目录边界前缀匹配，不支持glob；docs精确匹配。知识与代码多对多关联，重命名同时看新旧路径。当前库存只含Git可见、实际存在的普通文件，含未忽略的未跟踪文件，不跟随符号链接。

默认mapping只读路径元数据，输出各模块sourceFiles/documents、unmatchedSources/missingDocuments、overlaps和unmappedPaths；记录文件及明确排除项另列。共享比例是两个模块各自的来源文件占比，不是语义重复率；未映射候选不意味着全仓文件都应写入知识库。

--document另读所选Markdown页，输出带行号正文和直接清单，不输出全仓库存：

| 字段 | 含义 |
|---|---|
| coverageMessage / coverageSummary | 按引用位置计数的直接摘要 |
| coveredSources | 唯一候选已由本页全部所属模块覆盖 |
| sourceGaps | 唯一候选未被本页任一所属模块覆盖，附路径和missingModules |
| partiallyCovered | 只有部分所属模块覆盖，附coveredModules/missingModules |
| ambiguousReferences | 同名多候选及各自覆盖情况 |
| knowledgeReferences | 已配置知识页引用，可能只是导航 |
| unresolvedReferences | 未匹配Git文件的路径样字面值，可能是运行时路径 |
| passages / references | 带行号正文及原始候选明细，保留既有输出 |

直接阅读清单，无需自写脚本解析嵌套字段。候选不决定真实依赖，未在正文出现的来源仍需追代码；不要为清空报告盲目扩sources。默认mapping与单页模式均不读源码正文、不写项目。

## Git比较与同步

staged是索引相对HEAD（无首个提交时为空树）；worktree是工作区相对索引并含未跟踪文件；range是base/head的merge-base到head。用户要求所有未提交改动时同时采集staged和worktree，不用最终工作区掩盖两层差异。

changes输出路径、状态、关联模块和未映射项，不提供完整语义diff；仍需读所选版本的实际改动及相关知识。代码行为变化就维护正文，内部重构重点核对入口/依赖；实现缺陷如实说明现状，修复另行处理。比较期间候选变动应重新采集。新鲜度、复核与gate见 `references/freshness.md`。

## 结果

| status | 含义 | 退出码 |
|---|---|---|
| passed | 声明的机械覆盖范围内无发现 | 0 |
| issues | 有需处理的问题 | 1 |
| partial | 存在无法检查/未覆盖部分 | 1 |
| error | 参数、配置或执行失败 | 2 |

同时读findings和coverage，不能只看退出码。semantic:not_run表示脚本不判断正文语义，执行者仍须追源；结构、路径或指纹通过不能写成知识正确或已上线。检查均只读，唯一写入工具review仅保存显式复核声明。
