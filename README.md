# AgentForge

> 通用 agent 工作流与工程技能集，可安装到 Codex、Claude Code、Qoder 与 DeepSeek Harness。
> 包内 JavaScript 零 dependencies，无必需 MCP 服务；审计复用项目已有工具，独立上下文和并行依赖宿主的通用子 agent 能力。

[![validate](https://github.com/Lixiuxiu559/AgentForge/actions/workflows/validate.yml/badge.svg)](https://github.com/Lixiuxiu559/AgentForge/actions/workflows/validate.yml)

**一份真源，四端适配**：十三个技能统一维护在 `skills/`。
Codex 与 Claude Code 加载技能目录，Qoder 使用构建生成的插件包，DSH 使用包内桥接插件（`src/index.js`）。

---

## 安装

### Codex

在仓库本地验证：

```bash
codex plugin marketplace add /path/to/AgentForge
codex plugin add agentforge@agentforge
```

插件发布到仓库默认分支后，也可从 GitHub 安装：

```bash
codex plugin marketplace add Lixiuxiu559/AgentForge
codex plugin add agentforge@agentforge
```

Codex 桌面端可在 Plugins Directory 选择 AgentForge 安装；安装后开启新任务验证技能。仓库的 `.agents/plugins/marketplace.json` 指向根目录插件，`.codex-plugin/plugin.json` 指向包含十三个技能的目录。`architecture-scout` 在 Codex 侧也只接受主动调用，其技能目录内的 `agents/openai.yaml` 是调用策略元数据，不是自定义子 agent。

### Claude Code

```bash
claude plugin marketplace add Lixiuxiu559/AgentForge
claude plugin install agentforge@agentforge
```

在 Claude Code 交互界面里对应：

```text
/plugin marketplace add Lixiuxiu559/AgentForge
/plugin install agentforge@agentforge
```

安装后**重启 Claude Code** 使其生效。

本地开发时可以装本地目录（原位加载，改动立即生效，不受版本号约束）：

```bash
claude plugin marketplace add /path/to/AgentForge
claude plugin install agentforge@agentforge
```

其他常用命令：

```bash
claude plugin list                            # 已装插件
claude plugin details agentforge              # 组件清单与 token 成本
claude plugin update agentforge@agentforge    # 更新到新版本
claude plugin disable agentforge              # 临时停用
claude plugin uninstall agentforge            # 卸载
```

### Qoder

从仓库构建 Qoder 插件包（需要 Node.js 22/24 和系统 `zip` 命令）：

```bash
npm run package:qoder
```

产物为 `dist/qoder/agentforge-<version>.zip`。新版 Qoder 可在 **Extensions → Plugins → Add Plugins → Upload Plugin** 导入 ZIP；提供本地文件夹导入的 IDE 版本，先解压到 `agentforge/`，再从 **Settings → Plugins → Marketplace** 的创建插件入口导入该目录。

使用 Qoder CLI 时，先解压，再验证和安装：

```bash
QODER_VERSION=$(node -p "require('./package.json').version")
unzip "dist/qoder/agentforge-${QODER_VERSION}.zip" -d /path/to/agentforge
qoder plugins validate /path/to/agentforge
qoder plugins install /path/to/agentforge
```

安装后重启会话；CLI 也可执行 `/plugins reload`。在 `/` 列表检查 AgentForge 技能，主动选择 `architecture-scout` 进行架构调查。更新时重新获取新版本 ZIP，并按当前客户端的管理入口替换插件；CLI 本地目录安装可卸载后重新安装，保留解压目录供宿主读取。

**使用生成的 ZIP 或其解压目录安装，不直接把仓库根作为 Qoder 插件源。** 打包时在副本中转换架构侦察的主动调用策略，并排除其他宿主元数据；共用的技能源文件保持原样。运行 Wiki 等脚本需 Node.js，涉及 Git 的检查和 worktree 操作还需 Git；不会自动安装这些工具。完整说明和验证边界见 [Qoder 安装与兼容说明](docs/qoder.md)。

### DeepSeek Harness

DSH 有两种形态，安装入口不同：

| 形态 | 安装入口 | profile |
|---|---|---|
| **桌面版 App** | 侧栏 **插件** → **添加插件** | 固定的 `desktop` |
| Web / CLI（`dsh web`） | `dsh plugin --profile <name> add …` | 自选，下文以 `web` 为例 |

#### 桌面版

侧栏打开**插件**，点**添加插件**（右侧箭头是「选择添加插件方式」），在输入框里填下面任一 spec：

| 装法 | 填入 | 升级语义 |
|---|---|---|
| GitHub 简写 | `github:Lixiuxiu559/AgentForge` | 钉 commit；升级要卸载后按同一 spec 重装，跟到 main 最新提交 |
| 钉 tag | `github:Lixiuxiu559/AgentForge#v0.15.0` | 钉该 tag 的 commit，不受分支变动影响 |
| 本地目录（开发用） | `/path/to/AgentForge` | 直接读磁盘，改动立即生效 |

点**安装**之后：

- Host 先检查 spec（是否已装、各安装源能否查到、有没有 bundle patch、`engines.dsh` 是否兼容）。不通过会直接在输入框下说明原因，spec 保留可继续修改。
- 通过后执行安装，完成页点**立即启用**；直接关闭则装好但保持关闭。
- 桌面端启用了 HMR，多数情况刷新页面即生效；页面提示需要重启时再重启 App。
- 升级 / 卸载都在插件页的组合包详情里；本插件未发布到 npm，所以没有显式「更新」按钮，升级 = 卸载后按上面的 spec 重装。
- 安装日志在 `~/.dsh/profiles/desktop/.plugin-manager/logs`。

> 桌面版由 App 自己管理 `desktop` profile，App 运行期间 `dsh plugin` CLI 不会改它；App 自带 Node 与 pnpm，不需要另装。若已从 CLI 装过 `web` profile，那份与桌面版互不影响。

#### Web / CLI

```bash
dsh plugin --profile web add github:Lixiuxiu559/AgentForge
```

`dsh plugin` 是 **pnpm 的转发器**：它在 profile 目录（`$DSH_HOME/profiles/<name>`）里执行
`pnpm <你的参数>`，然后读回 profile 的 `package.json` —— 凡是解析到声明了 `dsh.bundle`
的依赖，就自动追加进 `dsh.profile.bundles` 层栈（本仓库已声明，见 `package.json`）。
所以参数可以是 pnpm 接受的任何 spec：

| 装法 | 命令 | 升级语义 |
|---|---|---|
| GitHub 简写 | `dsh plugin --profile web add github:Lixiuxiu559/AgentForge` | 钉 commit，`update` 会跟到 main 最新提交 |
| 钉 tag | `dsh plugin --profile web add github:Lixiuxiu559/AgentForge#v0.15.0` | 钉该 tag 的 commit，不受分支变动影响 |
| 本地目录（开发用） | `dsh plugin --profile web add /path/to/AgentForge` | 直接读磁盘，改动立即生效 |

> ⚠️ **git 安装没有版本门控**：lockfile 里钉的是具体 commit，`dsh plugin --profile web update`
> 会重解析到分支最新提交——等于「push 即发布」。也就是说 **main 分支就是发布通道**。
> 本插件未发布到 npm，所以 DSH 侧没有按版本号升级的途径。

装完后**重启该 profile**（`patchReload: live` 只监听用户 patch 文件，不会重新 `apply()`）。
本仓库没有 `prepare` 脚本，两种形态都**不需要** `allowBuilds` 构建授权。

升级 / 卸载：

```bash
dsh plugin --profile web update dsh-agentforge     # 拉到 main 最新提交（或所钉分支/tag）
dsh plugin --profile web remove dsh-agentforge     # 卸载
```

> `dsh-agentforge` 是**包名**（`package.json` 的 `name`），不管用哪种 spec 装，
> 依赖键都是它，所以升级/卸载都用这个名字。

**验证装配**（不启动模型，只看组合后的插件树）：

```bash
dsh --profile web --dump-config | grep -A2 agentforge
```

> 已经用 `link:` 或 npm 装过的，先 `dsh plugin --profile web remove dsh-agentforge`
> 再按上面的 GitHub 方式重装，否则 profile 里会同时留着旧记录。

---

## 装什么

| 技能 | 作用 |
|---|---|
| `worktree` | add 从本地或远端基线创建分支与分层目录；remove 检查未提交和忽略内容后移除工作树，保留分支 |
| `wiki` | 独立面向开发人员，按当前代码讲清架构、业务实现、部署与运维；维护来源、新鲜度及跨模块一致性 |
| `pm` | 按需澄清需求并产出 PRD：问题与目标、范围、业务规则、用户故事、验收标准与开放问题；默认交付可阅读的 HTML 文件 |
| `prototype` | 将 PRD 或明确页面需求转为可离线走查的 HTML 原型与页面、字段、交互状态清单 |
| `architecture-design` | 比较方案并由用户决定关键取舍，完成整体与专项设计、适用图示和风险验证；复杂专项按需委派，独立交付含可见图示的 HTML 设计文档 |
| `research` | 多步取证、交叉验证与方案比较；默认对话交付，按需保存报告 |
| `test-design` | 按业务规则与项目已有测试设施设计用例、评估场景和断言缺口、制定验证办法；独立交付 HTML 测试设计 |
| `bug-debugging` | 复现与根因验证；展示原因、证据和方案，用户同意后修复并回归验证 |
| `architecture-scout` | 用户主动发起的架构机会调查；按需并行取证，允许零候选 |
| `implementation-workflow` | 拆分任务、串行或并行实施、集成验证与按风险审计 |
| `diff-review` | Correctness / Standards / Spec 三轴独立评审 |
| `complexity-audit` | 复杂度与覆盖率风险审计；数据不足时明确降级 |
| `mutation-testing` | 使用现有突变测试工具查找存活突变体和测试漏洞 |

Wiki 初始化同时评估架构、部署环境与运维排障；已有架构和发布手册优先复用。专用模板按需显式选型，环境状态保留观察时间与证据，仓库配置不代表实际部署。重要结论还需核对证据范围、配置实际生效链和本页来源映射，避免局部观测扩大为整体结论。

PM、架构设计、测试设计与实施编排独立使用，没有固定前置技能或调用顺序，也不自动相互调用。用户可选用任意材料并自由组合，包括只凭明确需求直接实施；缺少文档本身不是阻塞，只有影响本次结果的关键问题才需澄清。

## 如何协作

Skill 规定任务怎样拆分、每个子任务怎样执行、结果怎样汇总。需要委派时，由主 Agent 调用宿主实际提供的通用子 agent 工具，创建独立上下文；相互独立的任务可以并行。

不需要注册自定义 agent，不指定固定模型、工具白名单或权限。每次派发提供目标目录、范围、约束、技能资源绝对路径和返回格式。独立上下文并不隔离文件系统，因此同文件修改、共享构建产物等仍需安排互斥。

宿主没有通用派发能力时，技能仍可在主上下文中执行，但会明确说明没有独立上下文或多 agent 并行。Skill 中写“委派”本身不会为宿主增加派发工具。

Codex、Claude Code 与 Qoder 通过插件发现技能；DSH 的桥接入口仅注册 skill provider，依赖 `skills` 服务。审计的“只报告，不改码”是工作约定，不是工具层权限限制。

### 使用示例

```text
用 wiki 为这个项目整理知识索引，并注明事实来源与未确认项。
用 wiki 检查暂存改动影响哪些文档，先给出同步建议。
用 pm 把这些已明确的需求整理成 PRD，标出假设和待确认项。
用 prototype 根据这份 PRD 设计页面，生成 HTML 原型和字段／状态清单。
用 architecture-design 根据 PRD 和原型做技术方案，先比较可行方案和优缺点，由我决定关键路线，再完成整体与专项设计，提供架构图、流程图和 ER 图及实施交接包。
用 research 调查这个错误的调用链，给出证据和未确认项。
用 test-design 为这项功能设计测试用例，检查业务边界、异常和状态变化是否覆盖充分。
用 bug-debugging 排查这个异常，先说明原因和修复方案，等我同意后再改。
用 implementation-workflow 实现这个功能，独立模块可以并行。
用 diff-review 评审当前改动，分别报告三条轴的结果。
用 architecture-scout 检查这个模块是否有值得提炼的边界。
/agentforge:worktree add dev feature/login
/agentforge:worktree remove feature/login
```

Claude Code 可显式使用 `/agentforge:research` 等技能命令。`architecture-scout` 的触发说明要求用户主动提出架构调查；Codex、DSH 与生成的 Qoder 包另有平台策略配置。

`bug-debugging` 可根据具体错误或修复请求自动选用。它在诊断后等待用户确认具体方案，批准后继续修复；初始“帮我修好”不代表批准尚未展示的方案。复杂调查可复用 `research`，只抽查影响结论的关键证据；复杂实施交给 `implementation-workflow`，沿用同一批准范围。

`test-design` 独立调用，默认生成 test-design.html，输出“业务规则 → 用例 → 验证入口 → 已有断言”的对应关系、缺口及验证办法。它只需当前可用的业务依据，不要求架构方案，不编写或执行测试，也不调用下一技能。测试方式沿用项目现有设施，缺少设施的场景明确记为验证缺口。`mutation-testing` 专门运行已有突变工具，业务场景设计与充分性检查由 `test-design` 负责。

`worktree add <from分支> <新分支>` 创建工作树，例如 `add dev feature/login`，目录为 `<项目主工作树根>/worktree/feature/login/`。add 询问 from 使用本地还是远端，默认检查 origin（无 origin 时使用唯一远端）；目标分支在本地或该远端已存在就停止。`worktree remove <分支>` 核对路径和实际分支，检查未提交、未跟踪及忽略内容后移除工作树，保留分支和提交；存在数据风险时先停止等待处理。remove 不查询远端，两种操作都不自动推送或删除分支。

### 项目 Wiki

Wiki 可由用户或 agent 独立调用，支持阅读、检查、创建、维护与同步；其他技能可以参考已有文档，但不调度 Wiki，不在执行或收尾时夹带检查、更新正文或保存复核记录。下面的新鲜度与同步命令是 AgentForge 仓库自身已启用的项目约定，不是其他技能对用户项目的隐式步骤。

AgentForge 自身的知识入口见 [项目 Wiki](docs/wiki/README.md)，覆盖技能职责、发现适配、Wiki 工具和分发验证。

`wiki` 复用目标项目既有文档目录、术语与模块划分，不要求固定语言、业务角色或四文件布局。知识保存在目标项目，技能资源随插件安装；检查命令必须显式传入目标项目根目录，不依赖插件安装位置；只有 review 命令会按明确复核声明写入项目记录。

读取、初始化与维护由宿主 Agent 按证据执行；`check` 检查文档结构和本地链接，`changes` 收集暂存区、工作区或分支改动并按可选配置映射模块。机械检查通过不代表业务语义一致，也不代表已上线。命令、配置及覆盖限制见 [Wiki 检查协议](skills/wiki/references/tools.md)。

无既有约定的新知识库可采用小型或多模块默认骨架，配套入口、概念、模块、规则、代码映射、依赖和通用主题模板。默认规范检查必需文档、章节、文档信息、未替换占位符及入口导航；已有项目保持原约定，可显式声明自己的必需文件和章节。使用方法见 [Wiki 模板与目录](skills/wiki/references/templates.md)。

Wiki 面向开发人员与编码 Agent，以当前代码、配置和工程脚本为主要依据，讲清职责、流程、条件、依赖和修改边界，关键结论附来源；不等待 PRD 或产品批准。模块按开发理解与修改问题组织，与源码多对多关联。实质性多模块任务采用模块编写与独立复审，主 Agent 整合跨模块关系；小修正直接完成。方法见 [初始化与模块来源设计](skills/wiki/references/initialization.md) 和 [模块协作](skills/wiki/references/module-workflow.md)。

`npm run wiki:mapping` 查看路径覆盖；加 `-- --document docs/wiki/modules/wiki-tooling/README.md` 可直接列所选页的覆盖、缺口与歧义，无需解析嵌套字段。来源清单辅助代码核实，正文由模块编写与独立复审保证质量；不要求逐段记录。初始化交付与持续同步/强制门分别说明，沿用项目已有约定。

读取 Wiki 前运行 `npm run wiki:freshness`；开发收尾核对实际变更后，用 `npm run wiki:review -- ...` 保存更新、无需更新或冲突结论。交付前运行 `npm run wiki:check` 和 `npm run wiki:gate`；PR 工作流会检查提交树中的同步状态。新鲜度按来源与文档指纹判断，命令不会自动证明语义正确。使用方式见 [新鲜度与收尾同步](docs/wiki/freshness.md)。

## 项目结构

```text
.claude-plugin/       Claude Code 插件与市场清单
.codex-plugin/        Codex 插件清单
.qoder-plugin/        Qoder 插件清单；安装前通过打包转换调用策略
.agents/plugins/      Codex 仓库 marketplace
skills/              十三个技能及各自 references / scripts
src/index.js         DSH 技能提供者
cordis.patch.yml      DSH bundle 装配
tools/              结构检查与发布工具
tests/              技能提供者回归测试与调试行为评估 fixture
docs/               架构、发布说明与历史调查
```

## 开发与验证

```bash
node tools/doctor.mjs
npm test
npm run package:qoder
```

结构检查覆盖四端清单、版本、技能引用与 DSH 发布资产；运行时测试覆盖技能发现、按需读取、资源路径、调用策略和动态重扫；Qoder 打包测试检查 ZIP 布局、运行资源及策略转换。真实宿主的派发工具及其并发策略由宿主负责。

调试行为需另行在隔离副本中评估，场景与判据见 [调试技能验收](skills/bug-debugging/references/evaluation-cases.md)；`npm test` 不执行模型行为评估。

设计见 [架构说明](docs/architecture.md)，发布见 [发布流程](docs/releasing.md)。
