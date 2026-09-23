# AgentForge

> 通用 agent 工作流与工程技能集，作为可安装的 Claude Code 插件。
> **零外部依赖** —— 不依赖 MCP、不依赖网络、不依赖项目预装工具。

---

## 装什么

### 技能（3）

| 技能 | 作用 |
|---|---|
| `implementation-workflow` | 实施编排：评估任务、拆分依赖、串行/并行调度 `implementer`、集成验证、按风险调用审计 agent |
| `complexity-audit` | 复杂度风险审计：用 CRAP 定位「复杂且测试保护不足」的函数，支持 Java / Python / Go / JS / TS |
| `mutation-testing` | 测试有效性审计：用突变测试找出存活突变体与无覆盖代码，支持 Java / Python / Go / JS / TS |

### 子 agent（3）

| Agent | 职责 | 工具边界 |
|---|---|---|
| `implementer` | 阅读代码、修改实现、编写测试、局部验证 | Read / Glob / Grep / Edit / Write / Bash |
| `complexity-auditor` | 复杂度与覆盖率风险审计 | **只读**：Read / Glob / Grep / Bash |
| `mutation-auditor` | 突变测试与测试有效性审计 | **只读**：Read / Glob / Grep / Bash |

两个审计 agent **只报告、不改码**。这个边界让「发现风险」和「实施修复」解耦。

---

## 安装

```bash
/plugin marketplace add /path/to/AgentForge
/plugin install agentforge@agentforge
```

安装后可用：

- `/implementation-workflow` —— 启动实施编排
- `/complexity-audit` —— 单独跑复杂度审计
- `/mutation-testing` —— 单独跑测试有效性审计
- 3 个技能按 `description` 自动触发
- 3 个子 agent 可被 Task 工具调用

---

## 三个 agent 如何配合

```text
implementation-workflow
        │
        ├─ 拆分任务
        ├─ 并行/串行派发 implementer
        ├─ 集成 + 统一验证
        ├─ 按风险 → complexity-auditor
        └─ 按风险 → mutation-auditor
                ↓
        implementer 修复
```

**不是每次都全跑。** 审计 agent 按风险选择性调用：

| 变更类型 | complexity-auditor | mutation-auditor |
|---|---|---|
| 文档 / 配置 / 样式 | 跳过 | 跳过 |
| 普通业务逻辑 | 建议运行 | 通常跳过 |
| 复杂逻辑 / 大型重构 | 建议运行 | 视测试情况 |
| 权限 / 状态机 / 金额 / 规则 | 建议运行 | 建议运行 |
| 测试专项 | 可选 | 优先运行 |

---

## 目录结构

```text
AgentForge/
├── .claude-plugin/
│   ├── plugin.json                  # 插件清单
│   └── marketplace.json             # 市场清单（source: "./"）
│
├── skills/                          # 插件自动发现
│   ├── implementation-workflow/
│   │   ├── SKILL.md                 # 编排入口
│   │   └── references/              # 拆分/并行/质量门/任务卡模板
│   ├── complexity-audit/
│   │   ├── SKILL.md
│   │   ├── scripts/crap.js          # Java + JaCoCo 的 CRAP 计算器
│   │   └── references/              # 五语言适配说明
│   └── mutation-testing/
│       ├── SKILL.md
│       └── references/              # 五语言适配说明
│
├── agents/                          # 插件自动发现
│   ├── implementer.md
│   ├── complexity-auditor.md
│   └── mutation-auditor.md
│
├── tools/doctor.mjs                 # 结构与资产校验（零依赖）
└── docs/architecture.md             # 架构与实测结论
```

---

## 校验

```bash
node tools/doctor.mjs
```

检查 8 项：插件/市场清单、组件目录位置、技能 frontmatter 与目录名一致性、
子 agent frontmatter 与文件名一致性、只读 agent 是否声明了写工具、
是否有 MCP 外部依赖、技能内 `references/` 引用是否存在、是否有硬编码绝对路径。

退出码非 0 表示存在 error，可直接接进 CI。

---

## 设计约束

1. **零外部依赖** —— 不使用 MCP，不依赖网络，不依赖项目预装工具。
2. **只读边界** —— 审计类 agent 不持有 Edit/Write，从工具层面保证「只报告不改码」。
3. **技能是方法，agent 是角色** —— 技能承载可复用流程，agent 承载执行边界与权限。
4. **详细规则下沉** —— 主 `SKILL.md` 只留决策入口，细节放 `references/`，避免上下文膨胀。
