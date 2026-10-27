# AgentForge Wiki 新鲜度与同步闭环

## 文档信息

| 字段 | 内容 |
|---|---|
| 适用范围 | 本仓库四模块的知识引用、开发收尾复核和 PR 同步检查 |
| 事实状态 | 部分核验 |
| 核验基线 | d64c4c5 基础提交 + 本次工作区；项目复核记录保存来源与文档内容指纹 |
| 核验时间 | 2026-10-27 |

## 内容

### 读取前检查

```bash
npm run wiki:freshness
npm run wiki:freshness -- --module skill-provider
```

模块为 skill-methods、skill-provider、wiki-tooling、distribution。命令从项目配置读取来源及知识文档范围，比对路径集合、内容 SHA-256、可执行模式和配置指纹；没有变化的旧文档仍可 fresh，昨日复核的资料发生变化也会 stale。

fresh 只表示当前内容仍匹配已保存的复核声明。stale 时核对变更，unknown 时说明缺记录或覆盖不足，blocked 时先核对上次记录的未决冲突；不能把这些状态当作当前已确认事实。

### 开发收尾同步

读取 diff、有效契约和对应知识后，决定需要更新、无需更新还是保留冲突。完成核对后才保存声明，例如：

```bash
npm run wiki:review -- --module skill-provider --decision no-change --reason "已对照 provider 源码与知识页，本次仅有内部说明调整，发现与读取契约不变" --reviewer "实际复核者" --evidence '["src/index.js","docs/wiki/modules/skill-provider/README.md"]'
```

这是一条说明命令，不能未经核对直接复制来取得通过。updated、no-change 都需要真实原因和属于该模块快照的证据；blocked 用于仍未解决的规则或实现冲突。review 只更新配置指定的复核记录，不改业务源码或 Wiki 内容。

项目配置位于 [wiki.config.json](wiki.config.json)，记录路径由其 freshness.records 指定。每模块保存最近的执行者、原因、证据、来源和文档指纹；Git 历史可保留记录演变。记录文件排除自身，配置变化也会使既有记录失效。来源范围包含源码、架构及规则文档、配置与测试；未映射的资料和外部网站变化仍需人工发现。

### 交付与合并前

```bash
npm run wiki:check
npm run wiki:gate
npm run wiki:gate -- --scope staged
npm run wiki:gate -- --scope range --base origin/main --head HEAD
```

check 验证结构、模板和链接；gate 验证复核状态与变更覆盖，两者都必须核对。项目快捷命令默认 gate 检查 worktree：工作区相对索引及未跟踪文件。staged 读索引里的配置、记录与源码，range 读 head 的 Git 树并比较 merge-base 到 head，不能借工作区的新记录让旧候选通过。

暂存区复核顺序是：先暂存来源、Wiki 与配置，再用 review 加 scope staged 生成记录，最后暂存记录并运行 staged gate。只在工作区写出记录还不等于该记录进入候选提交。

PR 的 [Wiki 合并前检查](../../.github/workflows/validate.yml) job 明确检出 head，运行 check 和 base/head 范围的 gate。它不会自动修改远端分支保护；若要禁止服务端绕过失败检查，需要管理员将该状态设为必需项。本次未执行远端 CI 或更改分支保护。

### 本次验证范围

自动回归覆盖状态转换、来源与文档变化、配置变动、无关提交、删除/重命名和模式变化、未映射路径、候选隔离、越界及记录损坏。AgentForge 自用记录和实际故障演练结果见 [验证页](verification.md)。来源哈希和复核声明能够追溯检查范围，不能自动证明业务语义正确或资料已上线。

## 依据与核验

2026-10-27 核对 [技能协议](../../skills/wiki/references/freshness.md)、[新鲜度引擎](../../skills/wiki/scripts/freshness.mjs)、[Git 快照](../../skills/wiki/scripts/snapshot.mjs)、[本仓库命令入口](../../tools/wiki-project.mjs)、[自动回归](../../tests/wiki-freshness.test.mjs)、[开发收尾约定](../../skills/implementation-workflow/SKILL.md) 与 [项目指令](../../AGENTS.md)。实际验证结果按验证页记录，不把机械状态写成自动语义审查。

## 待确认项

远端 Wiki 必需状态、PR 实际运行结果和三端宿主中对新约定的遵循情况尚未核实。外部知识源没有本地快照时无法依靠内容指纹自动发现变化；本次未加入定期外部资料巡检。
