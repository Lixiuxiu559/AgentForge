# AgentForge

> 通用 agent 工作流与工程技能集，作为可安装的 Claude Code 插件与 DeepSeek Harness 插件。
> **零外部依赖** —— 不使用 MCP，不依赖网络，不依赖项目预装工具。

[![validate](https://github.com/Lixiuxiu559/AgentForge/actions/workflows/validate.yml/badge.svg)](https://github.com/Lixiuxiu559/AgentForge/actions/workflows/validate.yml)

**一份真源，两端原生可用**：`skills/` 与 `agents/` 在磁盘上只有一份。
Claude Code 走原生自动发现，DSH 走包内桥接插件（`src/index.js`）。

---

## 安装

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
dsh plugin --profile web add /path/to/AgentForge
```

装完后**重启该 profile**（`patchReload: startup` 的 profile 必须重启，`live` 的会自动重载）。
卸载：

```bash
dsh plugin --profile web remove agentforge
```

**验证装配**（不启动模型，只看组合后的插件树）：

```bash
dsh --profile web --dump-config | grep -A2 agentforge
```

---

## 装什么

### 技能（5）

| 技能 | 作用 |
|---|---|
| `research` | 调研与调查：技术研究、代码库调查、日志排查、证据链与研究报告 |
| `diff-review` | 三轴代码评审：Correctness（有 bug 吗）+ Standards（符合本仓库编码规范吗）+ Spec（忠实实现需求吗），各轴独立报告。**能力自包含，不依赖任何宿主** |
| `implementation-workflow` | 实施编排：评估任务、拆分依赖、串行/并行调度 `implementer`、集成验证、按风险调用审计 agent |
| `complexity-audit` | 复杂度风险审计：用 CRAP 定位「复杂且测试保护不足」的函数，支持 Java / Python / Go / JS / TS |
| `mutation-testing` | 测试有效性审计：用突变测试找出存活突变体与无覆盖代码，支持 Java / Python / Go / JS / TS |

### 子 agent（5）

| Agent | 职责 | 工具边界 |
|---|---|---|
| `researcher` | 技术调研、代码调查、日志排查、证据收集与研究报告 | Read / Glob / Grep / Edit / Write / Bash / WebSearch / WebFetch |
| `diff-reviewer` | 三轴评审执行者（Correctness + Standards + Spec） | **只读**：Read / Glob / Grep / Bash |
| `implementer` | 阅读代码、修改实现、编写测试、局部验证 | Read / Glob / Grep / Edit / Write / Bash |
| `complexity-auditor` | 复杂度与覆盖率风险审计 | **只读**：Read / Glob / Grep / Bash |
| `mutation-auditor` | 突变测试与测试有效性审计 | **只读**：Read / Glob / Grep / Bash |

三个只读 agent（`diff-reviewer` / `complexity-auditor` / `mutation-auditor`）**只报告、不改码**，从工具层面保证「发现问题」和「实施修复」解耦。
`researcher` 默认只调查不修改，用户要求长报告时才写入 `docs/research/`。

### 同一个插件在两端的形态

| 组件 | Claude Code | DeepSeek Harness |
|---|---|---|
| 技能（5） | 自动发现 `skills/<name>/SKILL.md` | 桥接插件注册为 skill provider，模型目录与 `/` 命令面板都可见 |
| 子 agent（5） | 自动发现 `agents/<name>.md` | 桥接插件注册**一个** `agentforge` 工具，用 `agent` 参数枚举选择 |
| 工具边界 | agent frontmatter 的 `tools:` 白名单 | 同一份白名单，经 CC→DSH 工具名映射后由 `toolFilter` 强制 |
| 系统提示词 | agent 正文即子 agent 的系统提示词 | 同一份正文作为 `persona` 传入 |

**只有一个工具**：DSH 侧不注册 5 个同名工具，而是注册 1 个 `agentforge`，
工具描述里列出全部 agent 与职责，`agent` 参数用 enum 约束。新增 agent 只需加一个
markdown 文件，不用改 YAML —— 但**要重载插件**：工具描述与 enum 在 `apply()` 时固定，
不像技能那样按需重扫。

> 工具名不叫 `subagent`：DSH 的 dsh-base 已经注册了 `subagent` / `subagent_fork`，
> 重名会让插件装载直接失败。可用 patch 行的 `config.toolName` 改名。

### DSH 侧的两端差异（已适配）

| 差异 | 处理方式 |
|---|---|
| 工具名两套命名（`Read` vs `read`） | 桥接插件做映射；未映射的名字会被丢弃并记 warning |
| `model: haiku` / `sonnet` 是 Claude Code 别名 | DSH 侧默认忽略（子 agent 继承父会话路由）；需要固定路由时用 `config.agents.<name>` |
| `maxTurns` 是 CC 专属 | DSH 无对应物，忽略 |
| `${CLAUDE_PLUGIN_ROOT}` 是 CC 的变量 | 注册技能正文 / 子 agent persona 时展开成真实包路径 |
| agent 正文里的 `skills/...` 相对路径 | 子 agent persona 前置一段「AgentForge 资源位置」，写明插件根目录 |
| CC 的 `hooks/hooks.json` | **未实现**（本仓库当前没有 hooks 资产，不做空桥） |

### token 成本

实测（`claude plugin details agentforge`，v0.2.1）：

```text
Always-on:  ~308 tok   # 10 个组件的 description 总和，加到每个会话
```

技能正文与子 agent 定义按需加载，几个参考值：

| 组件 | on-invoke |
|---|---|
| `diff-reviewer` | ~1.1k |
| `implementation-workflow` | ~790 |
| `diff-review` | ~740 |
| `complexity-audit` | ~640 |
| `research` | ~540 |
| `mutation-testing` | ~530 |

DSH 侧的常驻成本是 5 个技能的 description 加 1 个 `agentforge` 工具签名
（工具描述里列出 5 个 agent 的职责，比 5 个独立工具省下 4 份签名）。

---

## 五个 agent 如何配合

```text
  researcher                    ← 上游：获取事实与证据
      │                            技术调研 / 代码调查 / 日志排查
      ↓
  结论 + 证据链
      │
      ↓
  implementation-workflow       ← 中游：实施编排
      ├─ 评估规模与风险
      ├─ 拆分任务、判断串行/并行
      ├─ 派发 implementer
      ├─ 集成 + 统一验证
      ├─ 按风险 → diff-reviewer
      ├─ 按风险 → complexity-auditor
      └─ 按风险 → mutation-auditor
      ↓
  implementer 修复
      ↓
  重新验证
```

**质量门不是每次都跑全套**：按变更风险在 `diff-reviewer` / `complexity-auditor` /
`mutation-auditor` 之间选择；跳过任何一个都要在报告里说明原因，缺工具时如实降级。

判定表以 [`skills/implementation-workflow/references/quality-gates.md`](skills/implementation-workflow/references/quality-gates.md)
为准 —— 本文件不再复制一份，避免两处漂移。

---

## 典型用法

**Claude Code**：

```text
# 调研
/research 对比一下几个 Java 的 mutation testing 工具

# 实施
/implementation-workflow 给用户模块加上导出功能

# 提交前三轴评审
/diff-review 看一下这次改动

# 单独审计
/complexity-audit 检查一下这次改动
/mutation-testing 验证 task 模块的测试有效性
```

**DeepSeek Harness**：技能同样按 `description` 触发，也可以直接点名。

```text
用 research 技能对比一下几个 Java 的 mutation testing 工具

用 agentforge 工具，agent=researcher，去查清 task 模块的测试覆盖情况
用 agentforge 工具，agent=diff-reviewer，三轴评审这次改动
用 agentforge 工具，agent=complexity-auditor，审计这次改动
```

DSH 侧的子 agent 通过 `agentforge` 工具调用；`implementation-workflow` 技能里的
「派发 implementer」「调用 diff-reviewer」在两端都指向同一份 agent 定义。
`diff-review` 技能与 `diff-reviewer` agent 同源：技能由主 Agent 自己执行，
agent 用隔离上下文执行同一套三轴方法。

---

## 目录结构

```text
AgentForge/
├── .claude-plugin/
│   ├── plugin.json                  # CC 插件清单（version 是发版开关）
│   └── marketplace.json             # CC 市场清单（source: "./"）
│
├── package.json                     # DSH bundle 清单 + npm 元数据
├── cordis.patch.yml                 # DSH layer：挂一行桥接插件
├── src/index.js                     # ★ 唯一代码：DSH 桥接插件（零依赖纯 JS）
│
├── skills/                          # ★ 真源，两端读同一份
│   ├── research/SKILL.md
│   ├── implementation-workflow/
│   │   ├── SKILL.md                 # 编排入口
│   │   └── references/              # 拆分 / 并行 / 质量门 / 任务卡模板
│   ├── complexity-audit/
│   │   ├── SKILL.md
│   │   ├── scripts/crap.js          # Java + JaCoCo 的 CRAP 计算器
│   │   └── references/              # 五语言适配
│   └── mutation-testing/
│       ├── SKILL.md
│       └── references/              # 五语言适配
│
├── agents/                          # ★ 真源：CC 自动发现，DSH 由桥接插件注册
│   ├── researcher.md
│   ├── implementer.md
│   ├── complexity-auditor.md
│   └── mutation-auditor.md
│
├── tools/
│   ├── doctor.mjs                   # 结构与资产校验 + DSH 适配校验（零依赖）
│   └── release.mjs                  # 发版脚本
├── .github/workflows/validate.yml   # push 时校验，不发版
├── CHANGELOG.md
└── docs/
    ├── architecture.md              # 架构决策与实测结论
    └── releasing.md                 # 发布流程
```

---

## 校验

```bash
node tools/doctor.mjs
```

检查以下几类；其中 `dsh` 组是双端适配校验（CC 侧改坏、DSH 侧静默失灵都能抓到）：

| 检查 | 抓什么 |
|---|---|
| `manifest` | 插件/市场清单缺失、JSON 非法、name 非 kebab-case、市场未声明插件 |
| `layout` | 组件目录被误放进 `.claude-plugin/`（不会被发现） |
| `skills` | frontmatter 缺失、name 与目录名不一致、嵌套技能、`references/` 悬空引用 |
| `agents` | frontmatter 缺失、name 与文件名不一致 |
| `agents` | 只读 agent 却声明了 Edit/Write |
| `agents` | 任何 `mcp__*` 依赖（本插件承诺零外部依赖） |
| `paths` | 硬编码绝对路径（应用 `${CLAUDE_PLUGIN_ROOT}`） |
| `dsh` | `dsh.bundle.patch` 缺失/指向不存在的文件、patch 里没出现包名 |
| `dsh` | `src/index.js` 缺失或无法加载、未导出映射表 |
| `dsh` | agent 声明的工具在 DSH 无对应物（会被静默丢弃） |
| `dsh` | 桥接插件的工具名与 DSH 保留名冲突 |
| `dsh` | CC 专属字段（`model` / `maxTurns`）在 DSH 被忽略（info） |

`dsh` 组直接 import `src/index.js` 读取工具名映射表，不抄第二份，避免漂移。

退出码非 0 表示存在 error，已接进 CI。

也可以用官方校验器：

```bash
claude plugin validate .
```

---

## 发版

**`version` 就是发版开关。** 不 bump 它，用户收不到任何更新——所以日常 push 和发版是解耦的。

```bash
# 日常开发：随便 push，用户无感知
git push

# 发版：显式动作
node tools/release.mjs patch      # 0.1.1 → 0.1.2
git push --follow-tags
```

`release.mjs` 会依次检查工作区、分支、校验、tag 冲突、CHANGELOG，然后 bump 版本、更新 CHANGELOG、提交、打标签。支持 `--dry-run` 和 `--push`。

版本号判据是**「对使用者是否破坏」**：重命名或删除技能/agent 属 MAJOR，新增能力属 MINOR，措辞与脚本修复属 PATCH。

完整规范见 [`docs/releasing.md`](docs/releasing.md)，版本历史见 [`CHANGELOG.md`](CHANGELOG.md)。

---

## 设计约束

1. **零外部依赖** —— 不使用 MCP，不依赖网络，不依赖项目预装工具。
2. **只读边界** —— 审计类 agent 不持有 Edit/Write，从工具层面保证「只报告不改码」。
3. **调查可追溯** —— `researcher` 必须区分事实、推断、未确认项和置信度；长报告保存到 `docs/research/`。
4. **技能是方法，agent 是角色** —— 技能承载可复用流程，agent 承载执行边界与权限。
5. **详细规则下沉** —— 主 `SKILL.md` 只留决策入口，细节放 `references/`，避免上下文膨胀。
6. **一份真源，两侧适配** —— `skills/`、`agents/` 只有一份；两端差异（工具名、路径变量、
   模型别名）全部收在 `src/index.js` 的桥接层里解决，不往内容里塞条件分支。
