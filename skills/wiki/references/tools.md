# 只读辅助工具

工具需要 Node.js；changes 还需要 Git。无 npm 依赖，无必需 MCP、外部模型或网络请求。脚本路径由技能安装位置决定，项目根由 `--root` 显式指定；不从脚本所在仓库推导项目根。

```bash
node /absolute/skill-directory/scripts/wiki.mjs check --root /absolute/project --wiki docs/wiki
node /absolute/skill-directory/scripts/wiki.mjs changes --root /absolute/project --scope staged
node /absolute/skill-directory/scripts/wiki.mjs changes --root /absolute/project --scope worktree
node /absolute/skill-directory/scripts/wiki.mjs changes --root /absolute/project --scope range --base origin/main --head HEAD
```

`check` 检查指定知识目录及可支持的 Markdown 本地链接。检查结果以工具报告的 coverage 为准；它不是完整 Markdown 渲染器，也不判断规则正确性、依赖是否合理、规则编号是否唯一或事实是否过期。外部 URL 不进行网络验证。无法可靠处理的语法或范围应保留为检查缺口，不能据此宣称全部链接有效。

默认沿用项目既有结构，不强制默认模板。需要检查默认骨架或项目声明的文档规则时，在 `--config` 指定的 JSON 中增加 `structure`；配置方式、模板和必需字段见 `references/templates.md`。工具使用随技能分发的 `assets/schema.json` 检查默认规范；`coverage.structure` 标明所选规范及检查范围。结构合格不证明来源真实或核验确实执行。

执行前读取所选知识目录的既有约定和检查命令；项目已保存 Wiki 检查配置时，显式传入对应 `--config`。工具不会自动搜索或加载配置，不能在省略配置后声称已验证该项目声明的默认骨架或自定义结构。

当前支持 `.md` 文件中的简单行内链接、图片和引用式链接，忽略围栏代码、缩进代码、行内代码与 HTML 注释。支持相对路径（含 `../`）、URI 编码和常见 GitHub 风格标题锚点；其他渲染器应另行核验。列表内缩进的潜在链接、复杂嵌套链接、HTML 链接、站点根路径、非 Markdown 锚点以及遍历时遇到的符号链接会产生覆盖限制。它不验证外链可达性，不跟随知识目录中的符号链接扫描，也不读取项目根外目标。

`changes` 的范围：

- staged：索引相对 HEAD，适用于待提交内容。
- worktree：工作区相对索引，并包含未跟踪文件；不包含已暂存而工作区未继续修改的内容。
- range：base 与 head 的 merge-base 到 head；`--base` 必填，head 默认 HEAD。

输出变化路径、状态、映射模块和 unmapped 材料，不自动读取并评审全部 diff。它不是 Git hook，也不会自动接入 CI 或阻止部署。

changes 的 `--root` 必须是 Git 仓库根。尚无首个提交时，staged 以空树为基线。新路径放在 `path`，识别到的重命名同时带 `oldPath`；普通删除以 `path` 记录原路径。存在无法映射的变化时报告 partial，需要 Agent 继续定位影响，不表示采集失败；没有变化时可通过采集检查，语义仍未执行。

## 可选模块映射

两个命令均可加 `--config <项目相对 JSON 文件>`。不要求项目为了阅读 Wiki 创建配置；需要重复运行确定性映射时再按项目约定保存。示例：

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

## 结果解释

命令输出 JSON，包含 `status`、`findings` 和 `coverage`，并有命令对应的材料。

| status | 含义 | 退出码 |
|---|---|---|
| passed | 已执行且在声明覆盖范围内无发现 | 0 |
| issues | 发现需要处理的问题 | 1 |
| partial | 有未覆盖或无法完成的部分 | 1 |
| error | 参数、环境、配置或执行失败 | 2 |

保留 findings 与 coverage，不只读取退出码。某些问题与覆盖缺口可能同时存在；即使 status 为 issues，仍需报告未覆盖项。结构检查通过与成功采集变更都不等于语义通过；`coverage.semantic` 未执行时不能写成“文档与代码一致”。脚本失败时报告原始原因，不将异常或空材料改成通过。
