# AgentForge 项目结构设计

**状态**：v1.0 草案（双端插件 + 零外部依赖）
**前置**：[`diagnosis.md`](diagnosis.md) · [`design.md`](design.md)

---

## 0. 目标与约束

| 项 | 要求 |
|---|---|
| **形态** | Claude Code 插件 + DSH 插件，**直接可用** |
| **依赖** | **零外部依赖** —— 不依赖 MCP 服务、不依赖网络、不依赖项目预装工具 |
| **真源** | 单仓 + 共享目录，两端只是不同入口（改一次两边生效） |
| **DSH 子 agent** | 写桥接插件，让无 MCP 依赖的 agent 在 DSH 可用 |
| **命令入口** | 用 `user-invocable` 技能代替斜杠命令（两端都免写 JS） |
| **工具白名单** | 重写 agent，去掉所有 `mcp__*` 依赖 |

---

## 1. 两端机制对照（实测结论）

| 能力 | Claude Code | DSH | 能否共享 |
|---|---|---|---|
| **技能** | `skills/<name>/SKILL.md` 自动发现 | 扫 `.dsh/skills`、`.agents/skills`、`~/.dsh/skills`、`~/.agents/skills` | ✅ **格式逐字相同** |
| **子 agent** | `agents/<name>.md` 自动发现 | **无对应物** | ❌ 需桥接插件 |
| **斜杠命令** | `commands/<name>.md` | 必须 `ctx.commands.register()`（JS） | ❌ 但可用 `user-invocable` 技能绕过 |
| **钩子** | `hooks/hooks.json` | `dsh-hooks-claude-code` 桥读同一份 | ✅ 配置共享 |
| **分发** | marketplace → `/plugin install` | `dsh plugin add <npm包>` → `dsh.bundle.patch` | ❌ 各写各的清单 |
| **包形态** | 纯文件 | **可纯 YAML**（`dsh-base` 的 `lib/index.js` 只有 11 字节 `export {};`） | — |

### 三条硬约束

**约束 1：DSH 没有 `.claude/agents/*.md` 加载器。**
这是唯一的真空。`coder`/`reinforcer`/`architect` 等 6 个无 MCP 依赖的 agent 可以桥过去，
带项目级 MCP 白名单的（原 `qa`）桥不过去 —— 而「零 MCP 依赖」这条要求正好消解了这个矛盾。

**约束 2：官方 `dsh-tool-subagent` 的工具行是静态的，但底层 API 支持调用期动态指定。**

这里有个容易误判的地方，值得写清楚。两条原文看起来矛盾：

- `dsh-tool-subagent` README：*"another persona, tool filter, or depth cap requires another
  distinctly named tool."* —— 说的是**官方工具行**的配置是挂载期固定的。
- `dsh-subagent` 类型定义：`SubagentStartRequest` **带有** `persona?` 和 `toolFilter?` 字段，
  且 `spawn` provider 声明了 `capabilities = { persona: true, toolFilter: true, ... }`。

**结论：调用期能力是有的，只是官方那个薄工具层没有把它暴露给模型。**

```ts
// dsh-subagent/lib/types/types.d.ts
export interface SubagentStartRequest {
  readonly prompt: ContentBlock[]
  readonly parent: Agent
  readonly persona?: string            // 需要 capabilities.persona
  readonly toolFilter?: ToolRestriction // 需要 capabilities.toolFilter
  readonly agentOptions?: AgentOptions  // 需要 capabilities.agentOptions
  ...
}
```

→ **桥接插件不必为每个 agent 预注册工具行**。它注册**一个**工具，让模型传
`agent` 参数（枚举值 = `agents/` 下的 agent 名），插件在 handler 里查表得到 persona 与
toolFilter，再调 `ctx.subagents.start()`。**一个工具覆盖 N 个 agent。**

这比预注册 N 个工具好得多：新增 agent 只需加一个 markdown 文件，不用改 YAML、不用重启。

**约束 3：官方工具的描述文案不可配置，但自研工具可以。**
`dsh-tool-subagent` 的 description 是内部 `wording` 常量拼接的，没有 `description` 配置项。
但桥接插件是**自己调 `ctx.tools.register()`**，描述由自己写 —— 可以把每个 agent 的
`description` 字段拼进工具描述，让模型准确选择。

**代价**：桥接插件要自己实现 `defineTool` 的参数 schema 和 handler，
不能直接复用官方 `dsh-tool-subagent` 的行为（`run_in_background`、结果收集、错误映射等）。
这是本项目唯一需要认真写的 JS。

---

## 2. 仓库结构

```
AgentForge/
├── .claude-plugin/
│   ├── marketplace.json        # Claude Code 市场清单（source: "./"）
│   └── plugin.json             # Claude Code 插件清单
├── package.json                # DSH bundle 清单（dsh.bundle.patch）
├── cordis.patch.yml            # DSH bundle 补丁（纯 YAML，无 JS）
│
├── shared/                     # ★ 唯一真源
│   ├── skills/                 #   技能 —— 两端逐字共用
│   │   └── <name>/SKILL.md
│   ├── agents/                 #   子 agent 定义 —— CC 直读，DSH 由桥接插件读
│   │   └── <name>.md
│   └── hooks/
│       ├── hooks.json          #   两端共用同一份
│       └── scripts/
│
├── plugins/
│   ├── claude-code/            # CC 入口：薄壳，全部指向 shared/
│   │   ├── skills   → ../../shared/skills
│   │   ├── agents   → ../../shared/agents
│   │   ├── hooks    → ../../shared/hooks
│   │   └── commands/           #   仅此处有 CC 专属的斜杠命令（可选）
│   └── dsh/                    # DSH 入口
│       ├── package.json        #   dsh.bundle.patch
│       ├── cordis.patch.yml    #   挂载技能根 + hooks 桥 + agent 桥
│       └── src/                #   ★ 唯一需要写 JS 的地方：agent 桥
│
├── presets/<项目>/             # 约定专属资产，项目自持，不参与自动发现
├── tools/doctor.mjs            # 双端体检
└── docs/
```

### 为什么 `shared/` 而不是各自 `skills/`

Claude Code 的自动发现要求技能在**插件根**的 `skills/`。
若把真源放在 `shared/skills`，CC 插件根就必须有 `skills/` —— 用**软链**指过去：

```bash
plugins/claude-code/skills -> ../../shared/skills
```

**风险**：软链在 Windows 和 git 上都不稳（`core.symlinks` 默认关闭时会变成文本文件）。
三个备选：

| 方案 | 优点 | 缺点 |
|---|---|---|
| **A. 软链** | 零构建，真源唯一 | Windows/git 不稳 |
| **B. `forge link` 脚本** | 跨平台，可校验 | 多一个命令要跑 |
| **C. 真源直接放 `plugins/claude-code/skills/`**，DSH 侧用 `customSkillDirs` 指过去 | **零链接、零构建、真源唯一** | DSH 需要绝对路径或 `!!js` 表达式 |

**推荐 C**：既然 DSH 的 `dsh-skill-filesystem` 支持 `customSkillDirs`，
就让 **Claude Code 侧当"真源宿主"**（它必须叫 `skills/`），DSH 侧配置指过去：

```yaml
# plugins/dsh/cordis.patch.yml
- id: skill-filesystem
  config:
    customSkillDirs:
      - !!js require('node:path').join(require('node:path').dirname(require.resolve('agentforge/package.json')), '../claude-code/skills')
```

这样 `shared/` 这一层可以去掉，结构更扁：

```
AgentForge/
├── .claude-plugin/{marketplace,plugin}.json
├── skills/                     # ★ 真源（CC 自动发现，DSH 配置指向）
├── agents/                     # ★ 真源（CC 自动发现，DSH 桥接插件读取）
├── hooks/
├── plugins/dsh/                # DSH 入口：清单 + patch + agent 桥 JS
├── presets/
├── tools/doctor.mjs
└── docs/
```

---

## 3. DSH 侧的三个挂载动作

DSH bundle 是纯 YAML patch，插三行：

### 3.1 技能根

```yaml
- id: skill-filesystem
  config:
    customSkillDirs:
      - !!js <解析到 AgentForge 的 skills 目录>
```

### 3.2 钩子桥

```yaml
- insert:
    - id: hooks-claude-code
      name: '@deepseek-ai/dsh-hooks-claude-code'
      config:
        configPath: !!js <解析到 AgentForge 的 hooks/hooks.json>
```

> **必须校验事件子集**：`dsh-hooks-claude-code` 只支持 7 个事件
> （`SessionStart` / `UserPromptSubmit` / `PreToolUse` / `PostToolUse` / `Stop` / `SubagentStart` / `SubagentStop`）。
> 不在其中的会被**静默跳过**。所以 `tools/doctor.mjs` 必须把这件事报出来。

### 3.3 子 agent 桥（唯一的 JS）

**一个工具覆盖 N 个 agent**（依据约束 2 的验证结论）：

```ts
// plugins/dsh/src/bridge.ts —— 骨架
import fs from 'node:fs'
import path from 'node:path'
import type { Context } from '@deepseek-ai/cordis'

export const name = 'agentforge-subagent-bridge'
export const inject = ['subagents', 'tools']

/** 解析 agents/*.md 的 frontmatter（只取 name/description/tools/model）。 */
function readAgents(dir: string) { /* ... */ }

export function apply(ctx: Context, config: { agentsDir: string; provider?: string }) {
  const agents = readAgents(config.agentsDir)   // Map<name, {description, persona, toolFilter, model}>

  ctx.tools.register({
    name: 'subagent_agentforge',
    description:
      'Delegate a self-contained task to a named AgentForge subagent.\n\n' +
      [...agents].map(([n, a]) => `- ${n}: ${a.description}`).join('\n'),
    parameters: {
      agent:  { type: 'string', required: true, enum: [...agents.keys()],
                description: 'Which subagent to run.' },
      prompt: { type: 'string', required: true,
                description: 'A complete, standalone task for the subagent.' },
      description: { type: 'string', required: true,
                description: 'A short (3-5 word) label for display.' },
    },
    async execute({ agent, prompt }, exec) {
      const a = agents.get(agent)
      return ctx.subagents.start({
        provider: config.provider ?? 'spawn',
        parent: exec.agent,
        signal: exec.signal,
        prompt: [{ type: 'text', text: prompt }],
        persona: a.persona,          // ← 调用期传入，spawn provider 支持
        toolFilter: a.toolFilter,    // ← 同上
        agentOptions: a.model ? { model: a.model } : undefined,
      })
    },
  })
}
```

对应的 `cordis.patch.yml` 只有一行：

```yaml
- insert:
    - id: agentforge-subagent-bridge
      name: 'agentforge-dsh-subagent-bridge'
      config:
        agentsDir: !!js <解析到 AgentForge 的 agents 目录>
```

**待验证的细节**（见 §5）：`defineTool` 的确切签名、`exec.agent` 是否可用、
`toolFilter` 的 `ToolRestriction` 具体形状（是白名单数组还是别的结构）。

---

## 4. 工作流入口

按你选的方案：**用 `user-invocable` 技能代替斜杠命令**。

```yaml
---
name: feature
description: 通用功能开发工作流 —— 研究→澄清→PRD→原型→架构→实施→质量门→评审→提交
user-invocable: true
---
```

- **Claude Code**：技能可手动调用（`/feature` 或由模型自主触发）
- **DSH**：`user-invocable: true` 让它在命令面板出现，直接调用

**代价**：失去了 `commands/*.md` 的 `allowed-tools` 权限预授权和 `argument-hint`。
如果 Claude Code 侧想要更好的体验，可以在 `plugins/claude-code/commands/` 放一个薄壳命令，
正文只有一句「调用 feature 技能」——这样两端入口都在，真源仍只有技能。

---

## 5. 落地前必须验证的三件事

| # | 风险 | 状态 | 验证方式 |
|---|---|---|---|
| 1 | **`spawn` provider 支持调用期 `persona` / `toolFilter`** | ✅ **已验证** | 类型定义 + `capabilities = {persona:true, toolFilter:true}` |
| 2 | **`defineTool` 的确切签名、`exec.agent` 可用性、`ToolRestriction` 形状** | ⬜ 待验证 | 读 `dsh-tools` 的类型定义与一个真实工具包（如 `dsh-tool-todo`）的实现 |
| 3 | **`!!js` 表达式能否稳定解析到包内路径** | ⬜ 待验证 | 在 `cordis.patch.yml` 里用 `require.resolve` 试跑，`dsh --dump-config` 确认输出 |
| 4 | **纯 YAML bundle 能否被 `dsh plugin add` 识别** | ⬜ 待验证 | 造最小 npm 包（只有 `package.json` + `cordis.patch.yml`），`dsh plugin --profile web add` 后确认进入 layer stack |

**风险 2/3/4 都不通过的话**，退路是：DSH 侧只共享技能，子 agent 用「技能化的角色扮演」替代
（把 coder 的方法论写成一个技能，两端都能用，但没有工具隔离和模型覆盖）。

---

## 6. 待决问题

1. **`presets/` 里的项目专属资产怎么被项目消费？** 复制、软链，还是也做成 npm 包？
2. **`tools/doctor.mjs` 现在是 Node 脚本，DSH 侧怎么调用？** 它需要能被 DSH 的 Bash 工具直接跑
   （应该没问题，但要确认 Node 在 DSH 的 shell 环境里可用）。
3. **两个插件要不要拆成两个 npm 包？** 还是 AgentForge 一个包同时声明
   `dsh.bundle.patch` 和作为 CC 插件目录？
4. **版本同步**：CC 插件用 `plugin.json` 的 `version`，DSH 用 `package.json` 的 `version`，
   要不要用脚本强制一致？
