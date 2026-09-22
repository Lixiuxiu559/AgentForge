# AgentForge

> **通用 agent 工作流与工程技能集，作为可安装的 Claude Code 插件。**
> 17 个通用技能 + 4 个专职子 agent + 1 条带门禁的开发流水线，装一次，所有项目可用。

---

## 为什么需要它

你在主力项目 A（`kuavo/worktree/kuavodatahubai-feature-0930-v3.4.0`）里积累了 **34 个技能、4 个子 agent、7 个 hook、4 个 MCP 服务**，
但它们以**手工拷贝**的方式散落在四个目录里：

| 目标端 | 技能数 | 状态 |
|---|---|---|
| `.claude/` | 34 | 主战场，最全 |
| `.agents/` | 34 | 与 `.claude` 内容一致（靠手工维持） |
| `.codex/` | 3 | 严重滞后 |
| `.qoder/` | 22 | **缺 12 个，5 个技能正文已分叉** |

漂移已经到**语义级**：`pm` 技能在 `.claude` 侧是「grilling 追问达成共识 → 一次性落盘 PRD」，
在 `.qoder` 侧还是旧的「多轮对话模式」，两版对 PRD 该怎么写的定义互斥。

**根因不是「拷贝麻烦」，而是「没有唯一真源」** —— 没有任何机制告诉你它们已经不一致了。
插件是 Claude Code 生态里解决这个问题的原生机制：一次安装、全局生效，项目里零拷贝，漂移从结构上消失。

---

## 关键设计：三层归属

迁移过程中做了一次**耦合度扫描**，结论是「通用 / 专属」二分法不够 —— 实际是三层：

| 层 | 数量 | 归属 | 例子 |
|---|---|---|---|
| **① 通用能力** | **17** | AgentForge 插件 | `grilling` `tdd` `code-review` `systematic-debugging` `design` `brand` `slides` … |
| **② 方法通用但约定专属** | **5** | `presets/<项目>/` 由项目自持 | `pm` `prototype` `arch-spec` `arch-backend` `arch-frontend` |
| **③ 项目专有** | **12** | 项目 `.claude/skills` | `kuavo-api-auth` `deploy` `merge-to-dev` `bump-*-version` `db-mcp` … |

**第 ② 层是这个项目最重要的发现。** 它们的方法论完全通用（怎么写 PRD、怎么设计架构、怎么出原型），
但正文里编码了你的目录约定 —— 实测耦合计数：

| 技能 | `assets/docs` | `projects/` | 产品名 | 合计 |
|---|---|---|---|---|
| `prototype` | 20 | 8 | 9 | **37** |
| `arch-spec` | 13 | 2 | 2 | **17** |
| `arch-backend` | 7 | 0 | 6 | **13** |
| `arch-frontend` | 10 | 0 | 0 | **10** |
| `pm` | 10 | 0 | 0 | **10** |

把 `prototype` 硬塞进通用插件，它会对着别的项目去找 `projects/frontend/kuavodatahubweb/apps/datahub/src/pages/device/Gesture.jsx` ——
**而且不报错**。所以它们留在 `presets/kuavo-datahub/`，由项目自己决定用不用。

---

## 约定层：把「方法」和「项目实例」解耦

第 ② 层的存在引出一个机制：项目在 `<项目根>/.claude/agentforge-conventions.md` 声明自己的约定，
技能读它来适配。

```yaml
prd-dir: assets/docs/prd/
spec-dir: assets/docs/architecture/specs/
base-branch: dev
coding-rules: assets/docs/development/backend-coding-rules.md
verify: ["mvn test", "pnpm test"]
coverage-report: target/site/jacoco/jacoco.xml
```

完整模板见 [`docs/conventions.md`](docs/conventions.md)。

**没有这个文件时技能不会失败** —— 它们退回通用默认值，并**明确告知**「未找到项目约定文件，正在使用默认路径」。
所有降级都可见，不静默。

---

## 目录结构

```
AgentForge/
├── .claude-plugin/
│   ├── marketplace.json      # 市场清单（本仓库同时是 marketplace）
│   └── plugin.json           # 插件清单
├── skills/                   # ① 17 个通用技能（插件自动发现）
├── agents/                   # 4 个专职子 agent
├── commands/
│   ├── feature.md            # /agentforge:feature —— 8 阶段开发流水线
│   └── doctor.md             # /agentforge:doctor  —— 配置体检
├── hooks/
│   ├── hooks.json
│   └── scripts/sync-agent-docs.sh
├── scripts/
│   └── crap.js               # cleaner 子 agent 用的 CRAP 计算器
├── presets/
│   └── kuavo-datahub/skills/ # ② 5 个约定专属技能（不参与插件自动发现）
├── tools/
│   └── doctor.mjs            # 体检工具（零依赖）
└── docs/
    ├── diagnosis.md          # 项目 A 现状诊断
    ├── design.md             # 架构设计与路线图
    └── conventions.md        # 项目约定模板
```

> `presets/` 不是官方组件目录，**不会被插件加载** —— 它只是一个存放参考实现的仓库目录。
> 项目要用，就把它们复制（或软链）到自己的 `.claude/skills/`。

---

## 装什么

**插件技能（17）**：

| 类别 | 技能 |
|---|---|
| 工作流 | `research` `grilling` `implement` `code-review` |
| 工程实践 | `tdd` `systematic-debugging` `codebase-design` `improve-codebase-architecture` `git-commit` `worktree` |
| 设计 | `design` `design-system` `ui-styling` `ui-ux-pro-max` `brand` `banner-design` `slides` |

**子 agent（4）**：`coder`（编码）`qa`（Gherkin 行为验收）`cleaner`（CRAP 复杂度体检）`reinforcer`（突变测试）

**`presets/kuavo-datahub/`（5）**：`pm` `prototype` `arch-spec` `arch-backend` `arch-frontend`

---

## 安装

```bash
/plugin marketplace add /Users/lixiuxiu/development_tool/projects/AgentForge
/plugin install agentforge@agentforge
```

装完可用：

- `/agentforge:feature <需求描述>` —— 启动 8 阶段开发流水线
- `/agentforge:doctor` —— 体检当前项目的 Claude Code 配置
- 17 个技能按 `description` 自动触发
- `coder` / `qa` / `cleaner` / `reinforcer` 可被 Task 工具调用

---

## 通用工作流

`/agentforge:feature` 编排一条**带门禁**的流水线：

| # | 阶段 | 使用 | 产物 | 门禁 |
|---|---|---|---|---|
| 0 | 研究 | `research` | 调研笔记 | — |
| 1 | 需求澄清 | `grilling` | 澄清共识 | **等用户确认** |
| 2 | PRD | `pm` ② | PRD 文档 | **等用户审批** |
| 3 | 原型（可选） | `prototype` ② | HTML 原型 + `prototype.md` | **等用户审批** |
| 4 | 架构设计 | `arch-spec` ② → `arch-backend`/`arch-frontend` ② | Spec + ADR | **等用户审批** |
| 5 | 实施 | `implement` + `tdd`，`coder` 子 agent | 代码 + 测试 | 测试全绿 |
| 6 | 质量门 | `cleaner` + `reinforcer` 子 agent | 复杂度/突变报告 | 无高危项 |
| 7 | 代码评审 | `code-review` | 评审意见 | 无阻塞问题 |
| 8 | 提交 | `git-commit` | 提交 | **等用户确认** |

② = 来自项目预设，插件不提供。**未安装时命令会如实告知，不会假装按模板产出了。**

三条设计要点：

- **门禁不可跳过** —— 命令里显式写了「若用户说『你决定就好』，给出推荐并取得明确确认，不要默认通过」，
  因为模型最容易在这里自问自答。
- **质量门不可裁剪** —— 阶段 6、7 即使小改动也要跑，可降级为「只报告不修复」但必须显式说明。
- **产物落盘** —— PRD / Spec / ADR / 报告都写进文件，不只在对话里。对话会被压缩，文件不会。

---

## 体检工具

零依赖 Node 脚本，可单独使用，也可进 CI：

```bash
node tools/doctor.mjs [项目根目录]
```

检查 8 个维度：

| 维度 | 检查内容 |
|---|---|
| `plugin` | 插件结构是否符合官方约定（清单、组件位置、frontmatter、硬编码路径） |
| `coupling` | 插件技能是否耦合了具体项目约定（**就是抓出第 ② 层的那个检查**） |
| `plugin-drift` | 项目 `.claude/skills` 是否与插件版本分叉或被无谓重复 |
| `skills` | frontmatter 合法性、name 与目录名一致性、嵌套技能 |
| `hooks` | matcher 是否为合法工具名正则、非标准键 |
| `agents` | 子 agent 引用的 `mcp__*` 服务是否真实存在 |
| `drift` | 各目录拷贝之间的技能/脚本漂移 |
| `secrets` | MCP 配置中的明文凭据 + git 跟踪状态 |

---

## ⚠️ 项目 A 当前有 14 个 error，三类必须优先处理

1. **明文生产密钥已入库** —— `.mcp.json`、`.codex/config.toml`、`.agents/config.toml` 三个文件都被 git 跟踪，
   内含明文阿里云 AccessKey 和 Bearer/Basic 凭据。**先轮换密钥，再清理文件**（历史提交里仍有）。
2. **6 个 hook 从未触发过** —— `"matcher": "Edit(*application.yml)"` 用的是权限规则语法，
   而 hook matcher 是**工具名正则**，这些 hook 永远匹配不上。
3. **`qa` agent 引用了不存在的 MCP 服务** —— `mcp__dbhub__*` / `mcp__redis-dev__*` 在项目中未定义，
   工具静默不可用。

详见 [`docs/diagnosis.md`](docs/diagnosis.md)。
