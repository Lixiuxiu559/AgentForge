# AgentForge 架构

**状态**：v1.0 定稿
**范围**：Claude Code 插件 + DSH 插件，两端原生可用

---

## 1. 目标与约束

| 项 | 要求 |
|---|---|
| **形态** | 一个仓库，同时是 Claude Code 插件和 DSH 插件 |
| **可用性** | 两端都是原生机制，装完即用，不需要额外配置 |
| **依赖** | **零外部依赖** —— 不依赖 MCP、不依赖网络、不依赖项目预装工具 |
| **真源** | 技能与子 agent 在磁盘上**只有一份**，两端读同一份 |
| **不做** | 不考虑为其他项目分发；不放项目专属资产 |

**"直接可用"的定义**：装完之后，技能在两端都能被模型看到并触发；子 agent 在两端都能被调用；
不需要用户手工改路径、不需要装 MCP、不需要预装任何命令行工具。

---

## 2. 仓库结构

```
AgentForge/
├── .claude-plugin/
│   ├── marketplace.json          # CC 市场清单（source: "./"）
│   └── plugin.json               # CC 插件清单
├── package.json                  # DSH bundle 清单 + npm 元数据
├── cordis.patch.yml              # DSH layer：挂载桥接插件（一行）
│
├── skills/                       # ★ 真源 —— 技能
│   └── <name>/SKILL.md
├── agents/                       # ★ 真源 —— 子 agent 定义
│   └── <name>.md
├── hooks/
│   ├── hooks.json                # 两端共用同一份
│   └── scripts/
│
├── src/
│   └── index.js                  # DSH 桥接插件（纯 JS，本项目唯一的代码）
├── tools/
│   └── doctor.mjs                # 双端一致性体检
└── docs/
```

**没有 `commands/` 目录**：Claude Code 官方已把 `commands/*.md` 标为遗留格式，
并说明它和 `skills/<name>/SKILL.md` **加载方式完全相同**，只是文件布局不同。
工作流入口用一个 `user-invocable` 的技能即可，DSH 侧也能直接调用。

**没有 `presets/`、`shared/`、`plugins/` 子目录**：
- 不放项目专属资产，所以不需要 `presets/`
- 插件根 = 仓库根，所以不需要 `plugins/claude-code/` 这层壳
- 真源直接就是 `skills/`、`agents/`，所以不需要 `shared/` + 软链

---

## 3. 两端如何加载同一份真源

| 组件 | Claude Code 侧 | DSH 侧 | 磁盘份数 |
|---|---|---|---|
| **技能** | 插件机制自动发现 `skills/` | 桥接插件读包内 `skills/`，逐个 `ctx.skills.register()` | **1** |
| **子 agent** | 原生自动发现 `agents/*.md` | 桥接插件读 `agents/*.md`，注册**一个**子 agent 工具 | **1** |
| **钩子** | `hooks/hooks.json` | 桥接插件挂 `@deepseek-ai/dsh-hooks-claude-code`，指向同一份 | **1** |
| **工作流入口** | `skills/feature`（`user-invocable`） | 同左 | **1** |

**关键点**：磁盘上每个技能、每个 agent 都只有一份文件。
Claude Code 走原生机制，DSH 走桥接插件，两者读的是同一批文件。

---

## 4. 桥接插件职责（`src/index.js`）

这是本项目**唯一需要写的代码**，约 150 行纯 JS。三个注册动作：

### 4.1 注册技能

读包内 `skills/*/SKILL.md`，解析 frontmatter，逐个 `ctx.skills.register()`。

用 `import.meta.url` 定位自己的包目录 —— **这是不使用 `!!js` 路径表达式的原因**（见附录 A）。

### 4.2 注册子 agent

读包内 `agents/*.md`，解析 frontmatter，注册**一个**工具：

```js
ctx.tools.register(defineTool({
  name: 'subagent',
  description: '委派任务给具名子 agent。\n\n' +
    agents.map(([n, a]) => `- ${n}: ${a.description}`).join('\n'),
  parameters: {
    agent:       { type: 'string', required: true, enum: [...agentNames],
                   description: '要运行哪个子 agent。' },
    prompt:      { type: 'string', required: true,
                   description: '给子 agent 的完整、自包含任务。' },
    description: { type: 'string', required: true,
                   description: '3-5 词的短标签，用于展示。' },
  },
  async execute(args, exec) {
    const a = agents.get(args.agent)
    const run = await ctx.subagents.start(config.provider ?? 'spawn', {
      label: args.description,
      prompt: [{ type: 'text', text: args.prompt }],
      parent: exec.agent,            // 官方实现同样要求非空
      signal: exec.signal,
      persona: a.persona,            // 正文作为子 agent 的系统提示词
      toolFilter: a.toolFilter,      // frontmatter 的 tools 白名单
      agentOptions: a.model,         // frontmatter 的 model 覆盖
    })
    return settle(run)               // 收集最终输出
  },
}))
```

**一个工具覆盖全部子 agent**，靠 `agent` 参数枚举选择。新增 agent 只需加一个 markdown 文件，
不用改 YAML、不用重启。

> 为什么不用官方的 `@deepseek-ai/dsh-tool-subagent`：它的 `persona` / `toolFilter`
> 是**挂载期配置**，每个 agent 要一行独立工具；而且它的**工具描述不可配置**，
> 多个 agent 会得到完全相同的描述，模型无法区分。自研工具两个问题都解决。

### 4.3 挂载钩子桥

挂 `@deepseek-ai/dsh-hooks-claude-code`，`configPath` 用 `import.meta.url` 定位到
包内 `hooks/hooks.json`。

**必须校验事件子集**：该桥只支持 7 个事件
（`SessionStart` / `UserPromptSubmit` / `PreToolUse` / `PostToolUse` / `Stop` /
`SubagentStart` / `SubagentStop`），不在其中的会被**静默跳过**。
`tools/doctor.mjs` 负责把这件事报出来。

---

## 5. 命名与版本

| 项 | 值 |
|---|---|
| Claude Code 插件名 | `agentforge` |
| 市场名 | `agentforge` |
| DSH 包名 | `agentforge` |
| CC 版本来源 | `.claude-plugin/plugin.json` 的 `version` |
| DSH 版本来源 | `package.json` 的 `version` |

**两个版本独立演进，不强制同步。** 它们面向不同的分发渠道（Claude Code 插件市场 / npm），
生命周期本来就不同。

---

## 6. 安装

**Claude Code**：

```bash
/plugin marketplace add /path/to/AgentForge
/plugin install agentforge@agentforge
```

**DSH**：

```bash
dsh plugin --profile web add /path/to/AgentForge
```

（`dsh plugin` 是 pnpm 转发器，支持本地路径、git、npm 三种来源。）

---

## 7. 内容清单（AgentForge 装什么）

### 技能

**工作流 / 工程**：`research` `grilling` `implement` `code-review` `tdd`
`systematic-debugging` `codebase-design` `improve-codebase-architecture` `git-commit` `worktree`

**设计**：`design` `design-system` `ui-styling` `ui-ux-pro-max` `brand` `banner-design` `slides`

**工作流入口**：`feature`（`user-invocable`，8 阶段带门禁流水线）

### 子 agent

`coder` `cleaner` `reinforcer` `architect` `backend-architect` `frontend-architect` `pm`

**全部重写，去掉所有 `mcp__*` 工具依赖。** 工具白名单只保留内置工具
（`Read` `Glob` `Grep` `Bash` `Edit` `Write` `WebSearch` 等）。

### 钩子

`CLAUDE.md` ↔ `AGENTS.md` 双向同步。

---

## 8. 通用工作流

`feature` 技能编排一条**带门禁**的流水线（`user-invocable: true`，两端都能直接调用）：

| # | 阶段 | 编排 | 执行者 | 产物 | 门禁 |
|---|---|---|---|---|---|
| 0 | 研究 | `research` | 主 agent | 调研笔记 | — |
| 1 | 需求澄清 | `grilling` | 主 agent | 澄清共识 | **等用户确认** |
| 2 | PRD | `pm` | `pm` 子 agent | PRD 文档 | **等用户审批** |
| 3 | 原型（可选） | — | 主 agent | HTML 原型 | **等用户审批** |
| 4 | 架构设计 | — | `architect` → `backend-architect` / `frontend-architect` | Spec + ADR | **等用户审批** |
| 5 | 实施 | `implement` + `tdd` | `coder` 子 agent | 代码 + 测试 | 测试全绿 |
| 6 | 质量门 | — | `cleaner` + `reinforcer` | 复杂度 / 突变报告 | 无高危项 |
| 7 | 代码评审 | `code-review` | 主 agent | 评审意见 | 无阻塞问题 |
| 8 | 提交 | `git-commit` | 主 agent | 提交 | **等用户确认** |

**四条设计约束**：

1. **门禁不可跳过** —— 标了「等用户确认」的阶段必须真的停下。
   `feature` 技能里显式写了「若用户说『你决定就好』，给出推荐并取得明确确认，不要默认通过」，
   因为模型最容易在这里自问自答。
2. **质量门不可裁剪** —— 阶段 6、7 即使小改动也要跑，可降级为「只报告不修复」但**必须显式说明**。
3. **产物落盘** —— PRD / Spec / ADR / 报告都写进文件，不只在对话里。对话会被压缩，文件不会。
4. **按需裁剪** —— 小改动可从阶段 5 直接进入；用户只要求单阶段时（如「只评审」）只跑那一段。

**技能与子 agent 的分工**：技能承载方法论与编排指令（"这里该派发 `coder`"），
子 agent 承载隔离的执行上下文。两者互补，不是替代关系。

---

## 附录 A：实测事实（踩过的坑）

以下都是**实测结论**，不是推测。保留在此以免重复踩坑。

### A.1 `!!js` 无法自解析包内路径（重要）

`cordis.patch.yml` 里的 `!!js` 表达式**不能用来解析包路径**。三个连锁事实：

1. **`!!js` 在 ESM eval 上下文求值**（`cordis-plugin-loader/lib/index.js:288`）：
   ```js
   const evaluate = new Function("ctx", "expr", `with (ctx) { return eval(expr) }`)
   ```
   `ctx` 是 cordis 的 Context 对象，不是 Node 全局 → **`require` / `__dirname` 不存在**
   （`process` 存在）。实测报错：`ReferenceError: require is not defined`。

2. **`customSkillDirs` 用 `path.resolve()` 解析**（`dsh-skill-filesystem/lib/index.js:79`）：
   ```js
   this.customSkillDirs = (config.customSkillDirs ?? []).map((root) => resolve(root))
   ```
   相对于 **`process.cwd()`**，不是相对于 patch 文件位置。

3. **`dsh --dump-config` 不会求值 `!!js`** —— 只原样打印。错误只在**真实启动**时暴露。

→ **结论**：技能、钩子、子 agent 的注册全部收进桥接插件，用 `import.meta.url` 定位包内路径。
`cordis.patch.yml` 只剩一行挂载。

### A.2 两端的机制对照

| 能力 | Claude Code | DSH |
|---|---|---|
| 技能 | `skills/<name>/SKILL.md` 自动发现 | 扫 `.dsh/skills`、`.agents/skills`、`~/.dsh/skills`、`~/.agents/skills`（**不读 `.claude/`**） |
| 子 agent | `agents/<name>.md` 自动发现 | **无对应物**，须自研 |
| 斜杠命令 | `commands/*.md`（官方标为遗留，等同技能） | 须 `ctx.commands.register()`（JS） |
| 钩子 | `hooks/hooks.json` | `dsh-hooks-claude-code` 桥读同一份，但只支持 7 个事件 |
| 分发 | marketplace → `/plugin install` | `dsh plugin add` → `dsh.bundle.patch` |

**技能格式两端逐字相同**，这是唯一能零转换共享的资产格式。

### A.3 DSH 子 agent 的能力边界

- `spawn` provider 声明 `capabilities = { agentOptions: true, outputSchema: true,
  depthLimit: true, toolFilter: true, persona: true }`
- `SubagentStartRequest` **带 `persona?` 和 `toolFilter?`** —— 调用期可传
- 官方 `dsh-tool-subagent` 的工具行是**挂载期静态配置**，且工具描述不可配置
- `ToolRestriction = { allow?: readonly string[], deny?: readonly string[] }`
- `defineTool` 的 `execute(args, exec: ToolRunContext)`，`exec` 上有 `agent?: Agent` 和 `signal`

### A.4 位置约束

- CC 的 `.claude-plugin/marketplace.json` **必须**在市场根
- CC 的**插件目录可以是子目录**（官方 254 个插件里 51 个在子目录）
- DSH bundle 包**可以是任意目录**，作为 npm 依赖安装
- 纯 YAML bundle 能被 `dsh plugin add` 正确识别并进入 `dsh.profile.bundles`

### A.5 验证方法

上述结论的验证方式：造最小 bundle 包（`package.json` + `cordis.patch.yml` + 一个探针技能），
装进**隔离的 `DSH_HOME`**（不碰现有 profile），端到端启动确认技能出现在模型可见目录中。
