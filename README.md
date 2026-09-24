# AgentForge

> 通用 agent 工作流与工程技能集，作为可安装的 Claude Code 插件。
> **零外部依赖** —— 不使用 MCP，不依赖网络，不依赖项目预装工具。

[![validate](https://github.com/Lixiuxiu559/AgentForge/actions/workflows/validate.yml/badge.svg)](https://github.com/Lixiuxiu559/AgentForge/actions/workflows/validate.yml)

---

## 安装

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

---

## 装什么

### 技能（4）

| 技能 | 作用 |
|---|---|
| `research` | 调研与调查：技术研究、代码库调查、日志排查、证据链与研究报告 |
| `implementation-workflow` | 实施编排：评估任务、拆分依赖、串行/并行调度 `implementer`、集成验证、按风险调用审计 agent |
| `complexity-audit` | 复杂度风险审计：用 CRAP 定位「复杂且测试保护不足」的函数，支持 Java / Python / Go / JS / TS |
| `mutation-testing` | 测试有效性审计：用突变测试找出存活突变体与无覆盖代码，支持 Java / Python / Go / JS / TS |

### 子 agent（4）

| Agent | 职责 | 工具边界 |
|---|---|---|
| `researcher` | 技术调研、代码调查、日志排查、证据收集与研究报告 | Read / Glob / Grep / Edit / Write / Bash / WebSearch / WebFetch |
| `implementer` | 阅读代码、修改实现、编写测试、局部验证 | Read / Glob / Grep / Edit / Write / Bash |
| `complexity-auditor` | 复杂度与覆盖率风险审计 | **只读**：Read / Glob / Grep / Bash |
| `mutation-auditor` | 突变测试与测试有效性审计 | **只读**：Read / Glob / Grep / Bash |

两个审计 agent **只报告、不改码**，从工具层面保证「发现风险」和「实施修复」解耦。
`researcher` 默认只调查不修改，用户要求长报告时才写入 `docs/research/`。

### token 成本

实测（`claude plugin details`）：

```text
Always-on:  ~190 tok   # 8 个组件的 description 总和，加到每个会话
```

技能正文与子 agent 定义按需加载，例如 `implementation-workflow` 触发时约 +660 tok。

---

## 四个 agent 如何配合

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
      ├─ 按风险 → complexity-auditor
      └─ 按风险 → mutation-auditor
      ↓
  implementer 修复
      ↓
  重新验证
```

**审计 agent 不是每次都跑**，按风险选择性调用：

| 变更类型 | complexity-auditor | mutation-auditor |
|---|---|---|
| 文档 / 配置 / 样式 | 跳过 | 跳过 |
| 普通业务逻辑 | 建议运行 | 通常跳过 |
| 复杂逻辑 / 大型重构 | 建议运行 | 视测试情况 |
| 权限 / 状态机 / 金额 / 规则 | 建议运行 | 建议运行 |
| 测试专项 | 可选 | 优先运行 |

---

## 典型用法

```text
# 调研
/research 对比一下几个 Java 的 mutation testing 工具

# 实施
/implementation-workflow 给用户模块加上导出功能

# 单独审计
/complexity-audit 检查一下这次改动
/mutation-testing 验证 task 模块的测试有效性
```

技能也会按 `description` 自动触发，不必显式调用。

---

## 目录结构

```text
AgentForge/
├── .claude-plugin/
│   ├── plugin.json                  # 插件清单（version 是发版开关）
│   └── marketplace.json             # 市场清单（source: "./"）
│
├── skills/                          # 插件自动发现
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
├── agents/                          # 插件自动发现
│   ├── researcher.md
│   ├── implementer.md
│   ├── complexity-auditor.md
│   └── mutation-auditor.md
│
├── tools/
│   ├── doctor.mjs                   # 结构与资产校验（零依赖）
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

检查 8 项：

| 检查 | 抓什么 |
|---|---|
| `manifest` | 插件/市场清单缺失、JSON 非法、name 非 kebab-case、市场未声明插件 |
| `layout` | 组件目录被误放进 `.claude-plugin/`（不会被发现） |
| `skills` | frontmatter 缺失、name 与目录名不一致、嵌套技能、`references/` 悬空引用 |
| `agents` | frontmatter 缺失、name 与文件名不一致 |
| `agents` | 只读 agent 却声明了 Edit/Write |
| `agents` | 任何 `mcp__*` 依赖（本插件承诺零外部依赖） |
| `paths` | 硬编码绝对路径（应用 `${CLAUDE_PLUGIN_ROOT}`） |

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
