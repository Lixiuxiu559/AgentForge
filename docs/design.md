# AgentForge 架构设计

**状态**：v0.3（Claude Code 单端 + 三层归属 + 约定层）
**前置阅读**：[`diagnosis.md`](diagnosis.md)

---

## 1. 范围决策

**只适配 Claude Code。** DSH / Codex / Qoder 暂不处理。

这个收敛有依据：项目 A 的四端漂移里，`.claude` 侧是内容最全、质量最高的那一份（34 个技能中 33 个 frontmatter 合法），
其余三端都是它的劣化拷贝。**先把真源做好，再谈分发**。

DSH 侧的调研结论保留在[附录](#附录dsh-适配调研结论备查)，需要时可重启。

---

## 2. 设计原则

### 原则一：插件是消除拷贝的唯一正解

项目 A 的问题不是「拷贝麻烦」，而是**没有唯一真源**。手工拷贝必然漂移，且漂移是静默的。

Claude Code 插件的三个能力正好对症：

1. **一次安装，全局生效** —— 技能装在插件目录，所有项目共享，项目内零拷贝。
2. **约定式自动发现** —— `skills/` `agents/` `commands/` `hooks/` 放在插件根即自动加载。
3. **可移植路径** —— `${CLAUDE_PLUGIN_ROOT}` 让 hook 脚本和命令不依赖绝对路径。

### 原则二：三层归属，不是「通用 vs 专属」二分

迁移时做了一次耦合度扫描，发现二分法不够用。实际是三层：

| 层 | 判据 | 归属 |
|---|---|---|
| **① 通用能力** | 不引用任何项目的目录结构、产品名、服务地址 | AgentForge 插件 `skills/` |
| **② 方法通用，约定专属** | 方法论可复用，但正文编码了项目的文档目录/模板结构 | `presets/<项目>/skills/`，项目自持 |
| **③ 项目专有** | 依赖项目的服务、包名、分支流程 | 项目 `.claude/skills/` |

**第 ② 层是本次设计最重要的发现。** 一开始按「有没有 kuavo 字样」划分，把 `pm`/`prototype`/`arch-*` 归进了通用层 ——
实测耦合计数后发现是错的：

| 技能 | `assets/docs` | `projects/` | 产品名 | 合计 |
|---|---|---|---|---|
| `prototype` | 20 | 8 | 9 | **37** |
| `arch-spec` | 13 | 2 | 2 | **17** |
| `arch-backend` | 7 | 0 | 6 | **13** |
| `arch-frontend` | 10 | 0 | 0 | **10** |
| `pm` | 10 | 0 | 0 | **10** |

这些技能塞进通用插件后，会对着别的项目去找 `projects/frontend/kuavodatahubweb/apps/datahub/src/pages/device/Gesture.jsx`
—— **而且不报错**，只是产出错误的结果。这类「静默错配」比报错危险得多。

所以判据不是「有没有项目名」，而是**「换个项目还能不能用」**。

### 原则三：约定层解耦「方法」与「项目实例」

第 ② 层引出一个机制：项目用 `<项目根>/.claude/agentforge-conventions.md` 声明自己的约定，技能读它适配。

```yaml
prd-dir: assets/docs/prd/
spec-dir: assets/docs/architecture/specs/
base-branch: dev
coding-rules: assets/docs/development/backend-coding-rules.md
verify: ["mvn test", "pnpm test"]
coverage-report: target/site/jacoco/jacoco.xml
```

**关键约束：文件不存在时技能不能失败。** 必须退回通用默认值，并**明确告知**「未找到项目约定文件，正在使用默认路径」。
所有降级都要可见 —— 这是原则四的延伸。

### 原则四：不允许静默失效

Claude Code 对很多配置错误**不报错**：

- hook matcher 写成非法正则 → 不报错，hook 永不触发（项目 A 的 6 个 hook 全中此坑）。
- 技能缺 frontmatter → 不报错，技能不出现。
- 子 agent 引用不存在的 MCP 服务 → 不报错，工具静默不可用。
- 插件技能耦合了别的项目的路径 → 不报错，产出错误结果。

所以 `tools/doctor.mjs` 必须在这些地方**主动报错**。这是本项目存在的一半理由。

### 原则五：密钥永不进仓库

插件与预设只存 `${ENV_VAR}` 引用。`doctor` 负责检出明文凭据和 git 跟踪状态。

---

## 3. 插件结构

严格遵循 Anthropic 官方 `plugin-structure` 规范：

```
AgentForge/
├── .claude-plugin/
│   ├── marketplace.json      # 本仓库同时是 marketplace（source: "./"）
│   └── plugin.json           # 插件清单
├── skills/<name>/SKILL.md    # 组件目录必须在插件根，不能嵌进 .claude-plugin/
├── agents/<name>.md
├── commands/<name>.md
├── hooks/hooks.json
├── scripts/                  # 辅助脚本（官方约定的目录）
├── presets/<项目>/skills/    # ② 约定专属技能，不参与插件自动发现
├── tools/                    # doctor（非官方组件目录，不参与自动发现）
└── docs/
```

**关键约束**（`doctor` 强制校验）：

- `.claude-plugin/plugin.json` 必须存在，`name` 为 kebab-case。
- 组件目录（`commands`/`agents`/`skills`/`hooks`）**必须在插件根**，嵌进 `.claude-plugin/` 不会被发现。
- 插件内**不允许硬编码绝对路径**，必须用 `${CLAUDE_PLUGIN_ROOT}`。

**marketplace 与 plugin 同仓**：`marketplace.json` 里 `source: "./"` 指向仓库根，
本地开发时 `/plugin marketplace add <本地路径>` 即可安装，无需先发布。

**`presets/` 的定位**：它不是官方组件目录，**不会被加载**。它只是一个仓库内的存放位置，
用来保留第 ② 层技能的参考实现。项目要用，就复制或软链到自己的 `.claude/skills/`。

---

## 4. 各组件规范

### 4.1 技能 `skills/<name>/SKILL.md`

```yaml
---
name: <kebab-case，必须与目录名一致>
description: <必填。写清「做什么」+「什么时候用」，触发词要具体>
---
```

- `name` 必须等于目录名 —— Claude Code 以目录名索引，不一致会导致引用错乱。
- `description` 是**唯一的触发依据**，必须包含用户会说的具体词（如「PRD」「重构」「提交」），
  不要写「帮助处理代码相关任务」这种空泛描述。
- 技能包内可有 `references/` `scripts/` `assets/` 子目录，不限层级。
- **不允许嵌套技能**（`skills/a/b/SKILL.md` 不会被发现）。
- **不允许引用具体项目的路径或产品名**（`doctor` 的 `coupling` 检查强制）。

### 4.2 子 agent `agents/<name>.md`

```yaml
---
name: <kebab-case>
description: <必填。写清职责 + 触发场景 + 明确不做什么>
tools: Read, Glob, Grep, Edit, Write, Bash, mcp__<server>__*
model: haiku | sonnet | opus | inherit
maxTurns: <正整数>
color: <可选，UI 标识色>
---
```

- `tools` 是**白名单**：不列出的工具子 agent 拿不到。只读型 agent（如 `cleaner`）**不要给 Edit/Write**。
- `tools` 里引用的每个 `mcp__<server>__*` **必须**在项目或用户级 MCP 配置中存在（`doctor` 强制）。
  项目 A 的 `qa` agent 违反了这条 —— 引用了 `dbhub` / `redis-dev` 两个不存在的服务。
- `model: haiku` 适合机械型任务（跑脚本、按模板产出），`sonnet` 适合需要判断的任务。

### 4.3 命令 `commands/<name>.md`

```yaml
---
description: <必填，斜杠命令列表里显示的说明>
argument-hint: "[参数说明]"
allowed-tools: ["Bash(node:*)", "Read", "Glob", "Grep"]
---
```

- 按 `<插件名>:<命令名>` 命名空间调用，即 `/agentforge:feature`。
- 正文里 `$ARGUMENTS` / `$1` `$2` 会被替换为调用参数。
- ` ```! ` 代码块会**真实执行 bash** 并把输出注入上下文 —— 这是跑脚本的方式。
- `allowed-tools` 必须覆盖 `!` 块里用到的命令，否则执行会被权限拦截。

### 4.4 Hook `hooks/hooks.json`

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [{ "type": "command", "command": "bash \"${CLAUDE_PLUGIN_ROOT}/hooks/scripts/xxx.sh\"" }]
      }
    ]
  }
}
```

**最容易踩的坑**：`matcher` 是**对工具名的正则**，不是文件路径 glob，也不是权限规则。
`"Edit(*application.yml)"` 这种写法永远匹配不上（项目 A 的 6 个 hook 全中此坑）。
**路径判断必须在脚本里读 stdin 的 `tool_input.file_path`。**

插件 hook 与项目 hook 会**同时生效**，重复注册同一个 hook 会跑两次（幂等脚本无妨）。

---

## 5. 通用工作流设计

### 5.1 载体：命令做编排，技能做执行

- **命令**（`commands/feature.md`）定义**阶段顺序和门禁**，是唯一需要读全流程的地方。
- **技能**承载每个阶段的**具体做法**，模型按 `description` 自主触发。
- **子 agent** 承载**需要隔离上下文或不同模型**的执行环节。
- **约定文件**提供项目实例化参数。

这样分层的理由：技能可以被单独调用（用户说「只评审」就直接走 `code-review`），
命令只在需要全流程编排时引入，不会把技能绑死在流水线上。

### 5.2 阶段与门禁

见 README 阶段表。四条设计要点：

1. **门禁不可跳过** —— 阶段 1/2/3/4/8 标了「等用户确认」。
   命令里显式写了「若用户说『你决定就好』，给出推荐并取得明确确认，不要默认通过」，
   因为模型最容易在这里自问自答。
2. **质量门不可裁剪** —— 阶段 6（`cleaner` + `reinforcer`）和阶段 7（`code-review`）即使小改动也要跑，
   因为这两步恰恰是小改动最容易省掉、又最容易出问题的。可降级为「只报告不修复」，但必须显式说明。
3. **产物落盘** —— 每阶段产物写进仓库文件（PRD、Spec、ADR、报告），不只在对话里。
   对话会被压缩，文件不会。
4. **缺件要明说** —— 阶段 2/3/4 的技能来自项目预设。未安装时，
   要么用通用方法完成并放到约定目录，要么**如实告知技能未安装**，不能假装按模板产出了。

### 5.3 与官方 `feature-dev` 插件的差异

Anthropic 官方的 `feature-dev` 是 7 阶段（Discovery → Exploration → Questions → Architecture → Implementation → Review → Summary），
思路一致但更轻。我们的版本多了：

| 差异 | 理由 |
|---|---|
| 显式的研究阶段（`research`） | 涉及第三方 API/库版本时，先查一手来源再设计 |
| 独立的质量门（`cleaner` + `reinforcer`） | 官方版只有 review，没有「测试是否真的在验证逻辑」这一层 |
| 交付物落盘（PRD / Spec / ADR） | 官方版主要靠对话推进，长任务下上下文会丢 |
| 约定层 | 官方版不假设项目结构，我们的版本要落地到具体目录 |
| `git-commit` 收尾 | 提交规范由技能固化，不靠临场发挥 |

---

## 6. 路线图

### 阶段一：插件骨架 + 通用资产（当前，已完成）

- [x] 诊断项目 A，量化漂移与配置错误
- [x] 体检工具 `tools/doctor.mjs`（8 个检查维度）
- [x] 耦合度扫描，确立三层归属（17 / 5 / 12）
- [x] 迁移 17 个通用技能 + 4 个子 agent
- [x] 抽出约定层：`docs/conventions.md` 模板
- [x] 工作流命令 `/agentforge:feature`
- [x] 插件清单 + 市场清单，可本地安装
- [x] `doctor` 支持插件自检、耦合检测、插件/项目漂移检测

### 阶段二：项目 A 收编

- [ ] 在项目 A 安装插件，**删除 `.claude/skills` 下 17 个重复拷贝**
- [ ] 为项目 A 创建 `.claude/agentforge-conventions.md`（填真实目录与验证命令）
- [ ] 把 `presets/kuavo-datahub/skills/` 的 5 个技能放回项目 `.claude/skills/`
- [ ] 修复 6 个 hook 的 matcher，配置同步提醒改写成脚本（读 `tool_input.file_path`）
- [ ] 处置明文密钥（轮换 → 改 `${ENV_VAR}` → 清理 git 历史）
- [ ] 修正 `qa` agent 的 MCP 引用
- [ ] 收敛 `.codex` / `.qoder` / `.agents` 三端拷贝

### 阶段三：能力补强

- [ ] 把第 ② 层的 5 个技能改为**读约定文件**，使其可跨项目复用（升级为第 ① 层）
- [ ] 为工作流加命令变体：`/agentforge:spec`（只到 Spec）、`/agentforge:review`（只评审）
- [ ] `doctor` 增加 CI 模式（JSON 输出 + 退出码），接进 GitLab CI
- [ ] `doctor` 的耦合模式库改为可配置（不同项目有不同的约定特征）

---

## 7. 已知风险

| 风险 | 说明 | 缓解 |
|---|---|---|
| **插件技能被项目拷贝遮蔽** | 项目 `.claude/skills` 里的同名技能会覆盖插件版本，且不报错 | `doctor` 的 `plugin-drift` 检查专门检出 |
| **插件 hook 与项目 hook 重复** | 两边都注册会跑两次 | 收编时从项目 `settings.json` 删掉重复 hook |
| **约定文件缺失导致错配** | 技能退回默认路径，可能与项目实际结构不符 | 命令第一步就检查并**显式告知**；`doctor` 可加检查 |
| **第 ② 层技能仍需人工同步** | `presets/` 与项目 `.claude/skills` 之间是复制关系，会再漂移 | 阶段三把它们改为读约定文件，彻底升到第 ① 层 |
| **`cleaner` 依赖 `scripts/crap.js`** | 脚本随插件分发，可能依赖项目的覆盖率产物 | 约定文件的 `coverage-report` 字段声明路径 |
| **耦合模式库可能误报** | 如 `projects/pages` 这类英文散文会被误判 | 已收紧为要求路径分隔符；阶段三改为可配置 |

---

## 8. 不做的事

- ❌ **不改写技能的方法论内容** —— AgentForge 是搬运、校验、解耦和编排，不是重新创作。
- ❌ **不做 DSH / Codex / Qoder 适配**（当前范围）。
- ❌ **不把第 ② 层技能强行通用化后塞进插件** —— 那会让它们充满配置项，或在别的项目静默错配。
- ❌ **不引入新的技能格式** —— 用 Claude Code 原生格式，否则失去插件自动发现这个最大优势。

---

## 附录：DSH 适配调研结论（备查）

范围收敛前已完成的调研，记录在此以免重复劳动。

**核心结论：Claude Code 与 DSH 不是不兼容，而是错位。**

| 能力 | Claude Code | DSH | 差距 |
|---|---|---|---|
| 技能 | `.claude/skills/`、`~/.claude/skills/` | `.dsh/skills`、`.agents/skills`、`~/.dsh/skills`、`~/.agents/skills` | **格式 100% 相同**，只有扫描根不同 |
| 项目指令 | `CLAUDE.md` | `AGENTS.md`/`CLAUDE.md` 链 + `~/.dsh/AGENTS.md` | DSH 原生读 `CLAUDE.md`，仅全局层路径不同 |
| Hooks | `settings.json` 的 `hooks` | `@deepseek-ai/dsh-hooks-claude-code`（`configPath` 指向同一文件） | 官方桥已存在，但只支持 7 个事件 |
| MCP | `.mcp.json` | `cordis.patch.yml` 手写 YAML 行 | 无自动发现，必须生成 |
| 子 Agent | `.claude/agents/*.md` | `dsh-agent-presets` + `dsh-subagent` | **DSH 无 `.claude/agents` 加载器** |

**两个实测证据**：

1. `~/.claude/skills/` 下的 `hook-development`、`mcp-config`、`permissions-development` 三个技能
   在 DSH 会话目录中**不可见**，而 `~/.agents/skills/` 下的 30 个 `lark-*` 技能可见
   → DSH 不扫描 `~/.claude/`，`~/.agents/` 才是共享根。
2. DSH 拉起 stdio MCP 子进程前会清洗环境变量，凡名字匹配 `/KEY|PASSWORD|SECRET|TOKEN/i` 的继承变量一律丢弃
   → 密钥必须显式写在 cordis 行的 `env:` 下，`!!js process.env.X` 不可用。

**若将来重启 DSH 适配**：优先做 `.claude/agents/*.md` 的加载器插件（这是唯一的真空），
其余能力靠 `dsh-skill-filesystem` 的 `bundledSkillDir` + hooks 桥即可覆盖。
