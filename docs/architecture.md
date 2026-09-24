# AgentForge 架构

**状态**：v1.0 定稿；DSH 适配层已实装并端到端验证（见 §4、附录 A.5）
**范围**：Claude Code 插件 + DSH 插件，两端原生可用

> **本文档的读法**：§1–§6 是设计（已落地）；§7、§8 里带「计划」标注的内容是
> **尚未实装的路线**，不要当成现状。实际能力清单见 §7「当前实装」。

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
│
├── src/
│   └── index.js                  # DSH 桥接插件（纯 JS，本项目唯一的代码）
├── tools/
│   └── doctor.mjs                # 双端一致性体检
└── docs/
```

**没有 `hooks/`**：本仓库当前不含任何 hooks 资产，也不挂 `dsh-hooks-claude-code` 桥 ——
空桥只会增加一个加载失败点。等真有 hooks 需求时再加（那时 §4.3 才成立）。

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
| **技能** | 插件机制自动发现 `skills/` | 桥接插件读包内 `skills/`，注册为 skill provider | **1** |
| **子 agent** | 原生自动发现 `agents/*.md` | 桥接插件读 `agents/*.md`，注册**一个** `agentforge` 工具 | **1** |
| **工具白名单** | agent frontmatter `tools:` 直接生效 | 同一份 `tools:`，经名字映射后作为 `toolFilter` 传入 | **1** |
| **钩子** | `hooks/hooks.json` | 未实装（无 hooks 资产） | — |
| **工作流入口** | `skills/<name>/SKILL.md`（`user-invocable`） | 同左 | **1** |

**关键点**：磁盘上每个技能、每个 agent 都只有一份文件。
Claude Code 走原生机制，DSH 走桥接插件，两者读的是同一批文件。

---

## 4. 桥接插件职责（`src/index.js`）

这是本项目**唯一需要写的代码**，约 150 行纯 JS。三个注册动作：

### 4.1 注册技能

读包内 `skills/*/SKILL.md`，解析 frontmatter，`ctx.skills.registerProvider()` 注册一个
provider（`list` / `get` 两方法，与 `dsh-skill-filesystem` 形状一致）。

用 `import.meta.url` 定位自己的包目录 —— **这是不使用 `!!js` 路径表达式的原因**（见附录 A.1）。

`get()` 里做一件两端适配：把正文中的 `${CLAUDE_PLUGIN_ROOT}` 展开成真实包路径。
DSH 没有这个变量，不展开的话技能里的脚本命令在 DSH 上就是死链。

### 4.2 注册子 agent

读包内 `agents/*.md`，解析 frontmatter，注册**一个**工具（实现在 `src/index.js` 的
`createAgentTool`）：

```js
ctx.tools.register({
  name: 'agentforge',                    // 不能用 subagent：dsh-base 已占用
  description: '委派任务给 AgentForge 预定义子 agent……\n\n' +
    agents.map((a) => `- ${a.name}: ${a.description}`).join('\n'),
  parameters: {                          // 标准 JSON Schema（手写，不用 defineTool）
    type: 'object',
    properties: {
      agent:       { type: 'string', enum: [...names] },
      prompt:      { type: 'string' },
      description: { type: 'string' },
    },
    required: ['agent', 'prompt', 'description'],
    additionalProperties: false,
  },
  output: {
    schema: { type: 'object', properties: { agent: {...}, output: {...} }, ... },
    render: (_args, value) => [{ type: 'text', text: value.output }],
  },
  isConcurrencySafe: () => true,         // 允许并行派发多个子 agent
  async execute(args, exec) {
    const run = await ctx.get('subagents').start(config.provider ?? 'spawn', {
      label: args.description,
      prompt: [{ type: 'text', text: args.prompt }],
      parent: exec.agent,                // 官方实现同样要求非空
      signal: exec.signal,
      persona: buildPersona(agent),      // 正文即系统提示词（+ 资源位置说明）
      toolFilter: resolveToolFilter(ctx, agent),  // 调用期与真实工具表求交集
      agentOptions: resolveAgentOptions(config, agent.name),
    })
    return { agent: agent.name, output: await collectRun(run) }
  },
})
```

**四个必须解释的设计点**（都是实测踩出来的，见附录 A.2 / A.3）：

1. **工具名不叫 `subagent`** —— dsh-base 的 `@deepseek-ai/dsh-tool-subagent` 已注册
   `subagent` / `subagent_fork`；重名会让 `apply()` 直接抛错。默认名 `agentforge`，
   可用 patch 行的 `config.toolName` 改。
2. **不做 `defineTool`，手写 `ToolDefinition`** —— 零依赖的直接后果。参数用标准 JSON Schema，
   `execute` 自己校验，`output.schema` 只用 DSH 支持的关键字子集
   （`type` / `properties` / `required` / `additionalProperties` / `enum`），
   注册期由 `assertSupportedJsonSchema` 校验。
3. **工具白名单要翻译，且要在调用期求交集** —— 两端工具名是两套命名
   （`Read` vs `read`），直接透传会让 `tools.restrict({ allow })` 因「未知工具名」抛错；
   `apply()` 时其它行可能还没注册完，所以交集只能在 `execute` 里算，
   交集为空时**不传** `toolFilter`（空 filter 同样抛错）。
4. **agentOptions 默认不发** —— `model: haiku` / `sonnet` 是 CC 别名，DSH 不认识；
   默认让子 agent 继承父会话路由，需要固定路由时用 patch 行的
   `config.agents.<name>.{provider,model,reasoningEffort}`。

**一个工具覆盖全部子 agent**，靠 `agent` 参数枚举选择。新增 agent 只需加一个 markdown 文件 ——
但**需要重载插件**：工具 description 里的清单在 `apply()` 时一次性固定（技能可以按需重扫，
工具不行）。

> 为什么不用官方的 `@deepseek-ai/dsh-tool-subagent`：它的 `persona` / `toolFilter`
> 是**挂载期配置**，每个 agent 要一行独立工具；而且它的**工具描述不可配置**，
> 多个 agent 会得到完全相同的描述，模型无法区分。自研工具两个问题都解决。

### 4.3 钩子桥（未实装）

**计划**：挂 `@deepseek-ai/dsh-hooks-claude-code`，`configPath` 用 `import.meta.url`
定位到包内 `hooks/hooks.json`。该桥只支持 7 个事件
（`SessionStart` / `UserPromptSubmit` / `PreToolUse` / `PostToolUse` / `Stop` /
`SubagentStart` / `SubagentStop`），不在其中的会被**静默跳过**。

**现状**：本仓库没有 `hooks/` 目录、没有 hook 脚本，所以没有挂这个桥。
`tools/doctor.mjs` 也没有 hooks 检查项。等真有 hooks 资产时再实装。

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

### 当前实装

**技能（4，两端共用同一份）**

| 技能 | 作用 | `user-invocable` |
|---|---|---|
| `research` | 调研与调查：技术研究、代码库调查、日志排查、证据链与研究报告 | ✅ |
| `implementation-workflow` | 实施编排：评估任务、拆分依赖、串行/并行调度 `implementer`、集成验证、按风险调用审计 agent | ✅ |
| `complexity-audit` | 复杂度风险审计：CRAP 定位「复杂且测试保护不足」的函数，五语言适配 | ✅ |
| `mutation-testing` | 测试有效性审计：存活突变体与无覆盖代码，五语言适配 | ✅ |

**子 agent（4，两端同一份定义）**

| Agent | 职责 | 工具白名单（CC 名 → DSH 名） |
|---|---|---|
| `researcher` | 技术调研、代码调查、日志排查、证据收集与研究报告 | `Read→read` `Glob→glob` `Grep→grep` `Edit→edit` `Write→write` `Bash→bash` `WebSearch→web_search` `WebFetch→web_fetch` |
| `implementer` | 阅读代码、修改实现、编写测试、局部验证 | 同上去掉 WebSearch / WebFetch |
| `complexity-auditor` | 复杂度与覆盖率风险审计 | `Read` `Glob` `Grep` `Bash`（**只读**） |
| `mutation-auditor` | 突变测试与测试有效性审计 | `Read` `Glob` `Grep` `Bash`（**只读**） |

### 计划（未实装，勿当现状）

早期设计里的 `grilling` / `implement` / `code-review` / `tdd` / `design` / `feature`
等技能，以及 `coder` / `cleaner` / `reinforcer` / `architect` / `pm` 等子 agent，
**都不在本仓库中**。保留此段仅为记录设计意图；要落地时按 §4 的桥接层扩即可
（技能加目录、agent 加 markdown，不用改 `cordis.patch.yml`）。

### 钩子

**未实装**（仓库内无 hooks 资产，见 §2 与 §4.3）。

---

## 8. 通用工作流（设计目标）

> **状态**：下表是目标形态，当前实装的是 `implementation-workflow` 技能所描述的四 agent
> 协作流程（见 §7）。`feature` / `pm` / `architect` 等尚未落地。

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
| 子 agent | `agents/<name>.md` 自动发现 | **无对应物**，须自研（本插件注册 `agentforge` 工具） |
| 斜杠命令 | `commands/*.md`（官方标为遗留，等同技能） | 须 `ctx.commands.register()`（JS）；`user-invocable` 技能会进人类命令面板 |
| 钩子 | `hooks/hooks.json` | `dsh-hooks-claude-code` 桥读同一份，但只支持 7 个事件 |
| 分发 | marketplace → `/plugin install` | `dsh plugin add` → `dsh.bundle.patch` |
| 工具名 | `Read` `Glob` `Grep` `Edit` `Write` `Bash` `WebSearch` `WebFetch` | `read` `glob` `grep` `edit` `write` `bash` `web_search` `web_fetch` |
| 路径变量 | `${CLAUDE_PLUGIN_ROOT}` | **无**；`resourceBase` 给出技能目录，子 agent 需自己注入 |
| 模型名 | `haiku` / `sonnet` / `opus` 别名 | 真实 provider/model id，别名无效 |

**技能格式两端逐字相同**，这是唯一能零转换共享的资产格式；
**agent 格式也逐字相同**，但工具名、模型名、路径变量三项要翻译 —— 全在桥接层做。

### A.3 DSH 子 agent 的能力边界（实测）

- `spawn` provider 声明 `capabilities = { agentOptions: true, outputSchema: true,
  depthLimit: true, toolFilter: true, persona: true }`
- `SubagentStartRequest` 带 `persona?` 和 `toolFilter?` —— **调用期**可传，
  这是「一个工具覆盖 N 个 agent」可行性的基础
- 官方 `dsh-tool-subagent` 的工具行是**挂载期静态配置**，且工具描述不可配置
- `ToolRestriction = { allow?: readonly string[], deny?: readonly string[] }`
- `tools.restrict()` 的硬约束：**空 filter、未知工具名、scope-local 名、保留名都会抛错**，
  所以白名单必须在**调用期**与真实工具表求交集，不能拿 CC 的名字硬传
- `ctx.tools.register(definition)` **不校验 `parameters`**（那是 `defineTool` 干的活），
  只校验 `output.schema`（`assertSupportedJsonSchema`）与 `output.render` 是函数；
  手写定义时要自己校验参数
- `ctx.tools.get(name)` 已存在同名工具时 `register` 是静默覆盖，不是报错 ——
  所以桥接插件自己在 `apply()` 里做了一次重名检查
- dsh-base 已占用 `subagent` / `subagent_fork`；`run_code` 是注册期保留名
- 子 agent 的非 `completed` 结束（`aborted` / `error` / `max-tokens` / `refusal`）
  不会自动变成工具错误，要自己转成抛出

### A.4 位置约束

- CC 的 `.claude-plugin/marketplace.json` **必须**在市场根
- CC 的**插件目录可以是子目录**（官方 254 个插件里 51 个在子目录）
- DSH bundle 包**可以是任意目录**，作为 npm 依赖安装
- 纯 YAML bundle 能被 `dsh plugin add` 正确识别并进入 `dsh.profile.bundles`
- `dsh plugin --profile <name> add <本地路径>` 在 profile 不存在时会**自动按同名模板初始化**
  （`web` / `headless` / `tui` / `acp` / `sdk`），并把它加进 `dsh.profile.bundles`

### A.5 验证方法

**通用方法**：造最小 bundle 包（`package.json` + `cordis.patch.yml` + 一个探针技能），
装进**隔离的 `DSH_HOME`**（不碰现有 profile），端到端启动确认技能出现在模型可见目录中。

**本插件的实测步骤**（可复现）：

```bash
export DSH_HOME=/tmp/af-verify                       # 隔离 home，不碰 ~/.dsh
dsh plugin --profile headless add /path/to/AgentForge # 自动初始化 headless profile
dsh --profile headless --dump-config | grep -A2 agentforge   # 只看组合，不启动模型
cp ~/.dsh/.credentials.yaml $DSH_HOME/               # 真跑一次需要凭据
dsh --profile headless "必须调用一次 agentforge 工具，agent=complexity-auditor，……"
```

**已验证到的结论**：

1. `agentforge` 工具与 `complexity-audit` / `implementation-workflow` / `mutation-testing` /
   `research` 四个技能都出现在模型可见目录中，启动无插件错误；
2. 委派给 `researcher` 时，子 agent 拿到的工具恰好是 8 个映射后的 DSH 工具
   （`bash` `edit` `glob` `grep` `read` `web_fetch` `web_search` `write`），
   够不到 `subagent` / `workflow` / `ralph`；
3. 委派给 `complexity-auditor` 时，子 agent 只有 `bash` `glob` `grep` `read` ——
   **只读边界在 DSH 侧同样被工具层面强制**；
4. 子 agent 能正确复述 persona 里注入的插件根目录，说明 `${CLAUDE_PLUGIN_ROOT}`
   展开与资源位置说明都生效。

**注意**：验证用的隔离 home 里要重启 profile 才能看到改动（`patchReload: startup`）；
`live` 的 profile 会自动重载 patch 层。
