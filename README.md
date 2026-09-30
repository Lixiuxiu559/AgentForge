# AgentForge

> 通用 agent 工作流与工程技能集，可安装到 Codex、Claude Code 与 DeepSeek Harness。
> 包内 JavaScript 零 dependencies，无必需 MCP 服务；审计复用项目已有工具，独立上下文和并行依赖宿主的通用子 agent 能力。

[![validate](https://github.com/Lixiuxiu559/AgentForge/actions/workflows/validate.yml/badge.svg)](https://github.com/Lixiuxiu559/AgentForge/actions/workflows/validate.yml)

**一份真源，三端共用**：七个技能统一维护在 `skills/`。
Codex 与 Claude Code 加载技能目录，DSH 使用包内桥接插件（`src/index.js`）。

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

Codex 桌面端可在 Plugins Directory 选择 AgentForge 安装；安装后开启新任务验证技能。仓库的 `.agents/plugins/marketplace.json` 指向根目录插件，`.codex-plugin/plugin.json` 声明七个技能。`architecture-scout` 在 Codex 侧也只接受主动调用，其技能目录内的 `agents/openai.yaml` 是调用策略元数据，不是自定义子 agent。

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

### DeepSeek Harness

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
| 钉 tag | `dsh plugin --profile web add github:Lixiuxiu559/AgentForge#v0.4.2` | 钉该 tag 的 commit，不受分支变动影响 |
| 本地目录（开发用） | `dsh plugin --profile web add /path/to/AgentForge` | 直接读磁盘，改动立即生效 |

> ⚠️ **git 安装没有版本门控**：lockfile 里钉的是具体 commit，`dsh plugin --profile web update`
> 会重解析到分支最新提交——等于「push 即发布」。也就是说 **main 分支就是发布通道**。
> 本插件未发布到 npm，所以 DSH 侧没有按版本号升级的途径。

装完后**重启该 profile**（`patchReload: live` 只监听用户 patch 文件，不会重新 `apply()`）。
本仓库没有 `prepare` 脚本，任何装法都**不需要** `allowBuilds` 构建授权。

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
| `research` | 调研取证、代码与日志调查、证据链和报告 |
| `bug-debugging` | 复现与根因验证；展示原因、证据和方案，用户同意后修复并回归验证 |
| `architecture-scout` | 用户主动发起的架构机会调查；按需并行取证，允许零候选 |
| `implementation-workflow` | 拆分任务、串行或并行实施、集成验证与按风险审计 |
| `diff-review` | Correctness / Standards / Spec 三轴独立评审 |
| `complexity-audit` | 复杂度与覆盖率风险审计；数据不足时明确降级 |
| `mutation-testing` | 使用现有突变测试工具查找存活突变体和测试漏洞 |

## 如何协作

Skill 规定任务怎样拆分、每个子任务怎样执行、结果怎样汇总。需要委派时，由主 Agent 调用宿主实际提供的通用子 agent 工具，创建独立上下文；相互独立的任务可以并行。

不需要注册自定义 agent，不指定固定模型、工具白名单或权限。每次派发提供目标目录、范围、约束、技能资源绝对路径和返回格式。独立上下文并不隔离文件系统，因此同文件修改、共享构建产物等仍需安排互斥。

宿主没有通用派发能力时，技能仍可在主上下文中执行，但会明确说明没有独立上下文或多 agent 并行。Skill 中写“委派”本身不会为宿主增加派发工具。

Codex 与 Claude Code 通过插件发现技能；DSH 的桥接入口仅注册 skill provider，依赖 `skills` 服务。审计的“只报告，不改码”是工作约定，不是工具层权限限制。

### 使用示例

```text
用 research 调查这个错误的调用链，给出证据和未确认项。
用 bug-debugging 排查这个异常，先说明原因和修复方案，等我同意后再改。
用 implementation-workflow 实现这个功能，独立模块可以并行。
用 diff-review 评审当前改动，分别报告三条轴的结果。
用 architecture-scout 检查这个模块是否有值得提炼的边界。
```

Claude Code 可显式使用 `/agentforge:research` 等技能命令。`architecture-scout` 的触发说明要求用户主动提出架构调查；Codex 与 DSH 另有平台策略约束。

`bug-debugging` 可根据具体错误或修复请求自动选用。它在诊断后等待用户确认具体方案，批准后继续修复；初始“帮我修好”不代表批准尚未展示的方案。复杂调查可复用 `research`，只抽查影响结论的关键证据；复杂实施交给 `implementation-workflow`，沿用同一批准范围。

## 项目结构

```text
.claude-plugin/       Claude Code 插件与市场清单
.codex-plugin/        Codex 插件清单
.agents/plugins/      Codex 仓库 marketplace
skills/              七个技能及各自 references / scripts
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
```

结构检查覆盖三端清单、版本、技能引用与 DSH 发布资产；运行时测试覆盖技能发现、按需读取、资源路径、调用策略和动态重扫。真实宿主的派发工具及其并发策略由宿主负责。

调试行为需另行在隔离副本中评估，场景与判据见 [调试技能验收](skills/bug-debugging/references/evaluation-cases.md)；`npm test` 不执行模型行为评估。

设计见 [架构说明](docs/architecture.md)，发布见 [发布流程](docs/releasing.md)。
