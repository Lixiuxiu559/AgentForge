# 安装与更新

AgentForge 支持 Codex、Claude Code 与 DeepSeek Harness。安装后可直接用自然语言指定技能；日常用法见[产品介绍](../README.md)。

## Codex

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

## Claude Code

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

## DeepSeek Harness

DSH 有两种形态，安装入口不同：

| 形态 | 安装入口 | profile |
|---|---|---|
| **桌面版 App** | 侧栏 **插件** → **添加插件** | 固定的 `desktop` |
| Web / CLI（`dsh web`） | `dsh plugin --profile <name> add …` | 自选，下文以 `web` 为例 |

### 桌面版

侧栏打开**插件**，点**添加插件**（右侧箭头是「选择添加插件方式」），在输入框里填下面任一 spec：

| 装法 | 填入 | 升级语义 |
|---|---|---|
| GitHub 简写 | `github:Lixiuxiu559/AgentForge` | 钉 commit；升级要卸载后按同一 spec 重装，跟到 main 最新提交 |
| 钉 tag | `github:Lixiuxiu559/AgentForge#v0.16.0` | 钉该 tag 的 commit，不受分支变动影响 |
| 本地目录（开发用） | `/path/to/AgentForge` | 直接读磁盘，改动立即生效 |

点**安装**之后：

- Host 先检查 spec（是否已装、各安装源能否查到、有没有 bundle patch、`engines.dsh` 是否兼容）。不通过会直接在输入框下说明原因，spec 保留可继续修改。
- 通过后执行安装，完成页点**立即启用**；直接关闭则装好但保持关闭。
- 桌面端启用了 HMR，多数情况刷新页面即生效；页面提示需要重启时再重启 App。
- 升级 / 卸载都在插件页的组合包详情里；本插件未发布到 npm，所以没有显式「更新」按钮，升级 = 卸载后按上面的 spec 重装。
- 安装日志在 `~/.dsh/profiles/desktop/.plugin-manager/logs`。

> 桌面版由 App 自己管理 `desktop` profile，App 运行期间 `dsh plugin` CLI 不会改它；App 自带 Node 与 pnpm，不需要另装。若已从 CLI 装过 `web` profile，那份与桌面版互不影响。

### Web / CLI

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
| 钉 tag | `dsh plugin --profile web add github:Lixiuxiu559/AgentForge#v0.16.0` | 钉该 tag 的 commit，不受分支变动影响 |
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
