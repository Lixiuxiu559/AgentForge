# 检查与复核辅助工具

工具需要 Node.js；check 不依赖 Git，changes、mapping、freshness、review 和 gate 需要目标 Git 仓库。无 npm 依赖，无必需 MCP、外部模型或网络请求。脚本路径由技能安装位置决定，项目根由 `--root` 显式指定；不从脚本所在仓库推导项目根。

check、changes、mapping、freshness 和 gate 只读；review 是显式写入复核记录的命令，且仅写项目配置指定的记录文件。新鲜度、收尾复核、索引/提交快照及检查门协议见 `references/freshness.md`；它们和 mapping 需要 Git，不通过自动改写业务知识消除差异。

```bash
node /absolute/skill-directory/scripts/wiki.mjs check --root /absolute/project --wiki docs/wiki
node /absolute/skill-directory/scripts/wiki.mjs changes --root /absolute/project --scope staged
node /absolute/skill-directory/scripts/wiki.mjs changes --root /absolute/project --scope worktree
node /absolute/skill-directory/scripts/wiki.mjs changes --root /absolute/project --scope range --base origin/main --head HEAD
node /absolute/skill-directory/scripts/wiki.mjs mapping --root /absolute/project --config docs/wiki/wiki.config.json
```

`check` 检查指定知识目录及可支持的 Markdown 本地链接。检查结果以工具报告的 coverage 为准；它不是完整 Markdown 渲染器，也不判断规则正确性、依赖是否合理、规则编号是否唯一或事实是否过期。外部 URL 不进行网络验证。无法可靠处理的语法或范围应保留为检查缺口，不能据此宣称全部链接有效。

默认沿用项目既有结构，不强制默认模板。需要检查默认骨架或项目声明的文档规则时，在 `--config` 指定的 JSON 中增加 `structure`；配置方式、模板和必需字段见 `references/templates.md`。工具使用随技能分发的 `assets/schema.json` 检查默认规范；`coverage.structure` 标明所选规范及检查范围。结构合格不证明来源真实或核验确实执行。structure.documents 和 modules 分别管理模板检查和来源映射，前者不会自动建立后者。

structure.documents 可用可选 type 显式选择 schema 中的文档类型（含 architecture、deployment、environments、operations、troubleshooting）；类型会叠加共同字段、类型章节及额外字段检查，requiredSections 继续叠加项目要求。未声明 type 的 project 页面保持原有规则；不根据路径强制迁移旧文档。environments 要求适用环境、观察时间和证据来源字段非空，允许具体未知；工具不核实线上状态、证据效力或外部漂移。

执行前读取所选知识目录的既有约定和检查命令；项目已保存 Wiki 检查配置时，显式传入对应 `--config`。工具不会自动搜索或加载配置，不能在省略配置后声称已验证该项目声明的默认骨架或自定义结构。

当前支持 `.md` 文件中的简单行内链接、图片和引用式链接，忽略围栏代码、缩进代码、行内代码与 HTML 注释。支持相对路径（含 `../`）、URI 编码和常见 GitHub 风格标题锚点；其他渲染器应另行核验。列表内缩进的潜在链接、复杂嵌套链接、HTML 链接、站点根路径、非 Markdown 锚点以及遍历时遇到的符号链接会产生覆盖限制。它不验证外链可达性，不跟随知识目录中的符号链接扫描，也不读取项目根外目标。

`changes` 的范围：

- staged：索引相对 HEAD，适用于待提交内容。
- worktree：工作区相对索引，并包含未跟踪文件；不包含已暂存而工作区未继续修改的内容。
- range：base 与 head 的 merge-base 到 head；`--base` 必填，head 默认 HEAD。

changes 输出变化路径、状态、映射模块和 unmapped 材料，不自动读取并评审全部 diff。通用技能不自动安装 Git hook 或修改目标项目 CI；项目可按 freshness 协议显式接入检查门，AgentForge 自用仓库已有对应 PR 工作流。

changes 的 `--root` 必须是 Git 仓库根。尚无首个提交时，staged 以空树为基线。新路径放在 `path`，识别到的重命名同时带 `oldPath`；普通删除以 `path` 记录原路径。存在无法映射的变化时报告 partial，需要 Agent 继续定位影响，不表示采集失败；没有变化时可通过采集检查，语义仍未执行。

## 可选模块映射

check 和 changes 均可加 `--config <项目相对 JSON 文件>`。不要求项目为了阅读 Wiki 创建配置；需要重复运行确定性映射时再按项目约定保存。示例：

```json
{
  "version": 1,
  "modules": [
    {
      "id": "orders",
      "sources": ["src/orders", "tests/orders.test.mjs"],
      "docs": ["docs/wiki/orders.md"]
    }
  ]
}
```

sources 是项目相对文件或目录前缀，按路径边界匹配，不支持 glob；`src/order` 不匹配 `src/orders`，`.` 可覆盖整个项目。docs 是项目相对文档文件，也参与变更的精确路径映射。一个变更可以关联多个模块，模块不固定为 Java 包或前端页面。check 可核查配置里的目标是否存在；changes 使用旧、新路径匹配，因此删除项不应仅因当前文件不存在而失去关联。

## 映射覆盖报告

mapping 按配置列出模块的实际 sourceFiles、documents、unmatchedSources 和 missingDocuments。它检查当前 Git 可见工作区的普通文件，包括未被忽略的未跟踪文件；已删除文件不算现有来源，不跟随符号链接。默认只读取路径元数据，不读取源码正文或判断业务含义；指定 --document 时另读取所选知识页，生成下述核对包。

overlaps 列出模块对的 sharedFiles、shareOfSources 和 identicalSourceSets。shareOfSources 的两个 0 到 1 比例分别以该模块的实际来源文件数为分母；它们不是“语义重复率”。高重叠可能来自真实共享能力，也可能来自映射过粗，需要按 `references/initialization.md` 核对并说明理由。

unmappedPaths 只列本次仓库库存中未关联的候选，不要求把每个文件纳入知识库；记录文件和已明确排除的未映射路径放在 excludedPaths。共享或未映射候选本身不使命令失败，缺少已声明的文件、空覆盖及无法检查的路径仍报告 issues 或 partial。`coverage.mapping.assessment` 固定为 path-coverage-only，不能将路径检查通过描述成模块划分已获业务确认。

mapping 不提取正文语义，也不自动检查“这条结论的依据是否进了本页所属模块”。Agent 按 `references/content-verification.md` 做反向核对，必要时补齐来源映射；报告 passed 不能代替这一检查。

## 结果解释

命令输出 JSON，包含 `status`、`findings` 和 `coverage`，并有命令对应的材料。

| status | 含义 | 退出码 |
|---|---|---|
| passed | 已执行且在声明覆盖范围内无发现 | 0 |
| issues | 发现需要处理的问题 | 1 |
| partial | 有未覆盖或无法完成的部分 | 1 |
| error | 参数、环境、配置或执行失败 | 2 |

保留 findings 与 coverage，不只读取退出码。某些问题与覆盖缺口可能同时存在；即使 status 为 issues，仍需报告未覆盖项。结构检查通过与成功采集变更都不等于语义通过；`coverage.semantic` 未执行时不能写成“文档与代码一致”。脚本失败时报告原始原因，不将异常或空材料改成通过。

## 单页正文核对包

在已有 Git 仓库和配置上执行 `mapping --document <项目相对Markdown路径>`。它只返回所选页面的 documentReview 核对包，避免把全仓路径库存与重叠报告塞入正文核对上下文；默认 mapping 仍输出完整路径报告。核对包包含 owningModules、带行号/章节的 passages，以及行内代码和常见本地 Markdown 链接的 references。候选提供每个本页所属模块的 mappedSource，同名文件保留 ambiguous，不替 Agent 选择。仅读取目标知识页，源码内容不读取或输出；忽略文件、符号链接和越界页面不能作为目标。

此输出是逐段工作的输入，不是语义验收证书。字面引用可能只是导航，正文没写出的真实依赖也不会自动发现；候选未映射不直接使 mapping 失败。正文、来源范围、同名文件实际读写者与跨页冲突仍由 Agent 核实。未归属页面报告 partial。默认不带 document 的 mapping 行为保持不变，不修改项目配置或文档，也不产生新永久台账。
