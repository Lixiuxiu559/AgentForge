# AgentForge for Qoder

AgentForge 提供 13 个工程技能：worktree、wiki、pm、prototype、architecture-design、research、test-design、bug-debugging、architecture-scout、implementation-workflow、diff-review、complexity-audit 和 mutation-testing。技能覆盖需求、原型与架构设计、调查、开发、评审与项目知识维护；不依赖必需 MCP 服务或自定义 Agent。

## 获取插件包

在 AgentForge 仓库执行：

```bash
npm run package:qoder
```

构建使用 Node.js 22/24 和系统 `zip` 命令，输出 `dist/qoder/agentforge-<version>.zip`；版本取自插件清单，需与其他宿主清单和 package.json 一致。项目没有 npm 运行依赖，不会自动安装构建或审计工具。正式发布后也可从 [GitHub Releases](https://github.com/Lixiuxiu559/AgentForge/releases) 获取对应 Qoder ZIP；尚未发布的工作区改动需自行构建。

使用生成的 ZIP 或其解压目录安装。仓库根的清单是构建输入，直接安装仓库根不会完成 Qoder 调用策略转换。

## 在 Qoder 中安装

新版界面在 **Extensions → Plugins → Add Plugins → Upload Plugin** 导入 ZIP。提供本地文件夹导入的 IDE 版本，先将 ZIP 内容解压到名为 `agentforge` 的目录，再从 **Settings → Plugins → Marketplace** 的创建插件入口导入本地目录。ZIP 内直接包含 `.qoder-plugin/plugin.json` 和 `skills/`，解压时保留隐藏目录。

使用 Qoder CLI 时，在仓库构建后执行：

```bash
QODER_VERSION=$(node -p "require('./package.json').version")
unzip "dist/qoder/agentforge-${QODER_VERSION}.zip" -d /path/to/agentforge
qoder plugins validate /path/to/agentforge
qoder plugins install /path/to/agentforge
```

将示例中的 `/path/to/agentforge` 换成实际保存位置；本地目录安装后保留该目录。安装后重新开启会话，CLI 也可使用 `/plugins reload`。输入 `/` 查看技能列表并选择对应技能，或描述具体任务让宿主选择适用技能。架构侦察须用户主动提出架构调查并选择 `architecture-scout`。

## 更新与卸载

ZIP/本地目录安装不依赖市场自动更新。升级时获取新版本 ZIP，在新的 `agentforge` 目录解压，用当前客户端插件管理入口替换或重新导入。CLI 可先 `qoder plugins uninstall agentforge`，再从新解压目录执行 `qoder plugins install /path/to/agentforge`；重启或 `/plugins reload` 后检查版本、技能清单和实际资源路径。卸载使用客户端插件管理入口，CLI 使用 `qoder plugins uninstall agentforge`。

## 运行环境与能力边界

- Wiki 与复杂度计算脚本需要可用的 Node.js；涉及 Git 变更、历史及 worktree 操作还需 Git。建议使用项目验证的 Node.js 22/24。审计所需覆盖率、复杂度和突变工具沿用目标项目现有设施。
- 技能目录用于读取方法与配套资源；目标项目目录用于分析、修改和生成结果。运行脚本时显式传入目标项目，不能把插件安装目录当成工作项目。
- 子 Agent、独立上下文与并发由 Qoder 提供。派发时传入必要目标、约束及技能资源路径；宿主无派发能力时在主上下文串行执行，并说明缺少上下文隔离。
- `bug-debugging` 展示原因、证据和具体修复方案后等待确认；`architecture-scout` 只在用户主动要求时运行，交付候选报告；审计类技能保持只报告边界。

## 打包策略与验证范围

构建保留全部技能正文及 references、assets、脚本。仅在临时副本为 `architecture-scout` 添加 `disable-model-invocation: true` 和 `user-invocable: true`，移除 DSH 调用策略字段与 Codex 的 `agents/openai.yaml`。共享源文件保持原样。包内不包含其他宿主插件清单、DSH 桥接代码或仓库本地状态。

ZIP 根额外生成最小 `package.json`，仅含插件名称、版本、`private: true` 和 `type: commonjs`，使 CommonJS 脚本 `crap.js` 不受解压目标项目的 `type: module` 影响；`.mjs` 工具仍按 ES module 执行。这不是原 DSH 包配置，不包含 `src/`、桥接入口或 npm 依赖。

静态清单、ZIP 内容和包内脚本检查只证明对应产物契约。真实客户端的技能加载、主动调用限制、子 Agent 交接与升级缓存还需宿主实测；不能用打包成功或目录校验替代模型执行证据。建议导入后先用只读任务验证技能与 reference 可读，再验证实际使用的开发流程。

插件机制、目录和导入要求见 [Qoder 插件格式](https://docs.qoder.cn/en/qoder-plugins)、[Qoder CLI 插件](https://docs.qoder.com/cli/plugins) 和 [Qoder IDE 插件](https://docs.qoder.com/extensions/plugins)；调用策略参考 [Qoder SDK Skills](https://docs.qoder.com/cli/sdk/skills)。不同客户端版本的入口和能力以实际客户端为准。
