# Changelog

本文件记录 AgentForge 的**已发布版本**。

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循[语义化版本](https://semver.org/lang/zh-CN/)。

> **注意**：只有 bump `.claude-plugin/plugin.json` 的 `version` 并打标签才算发版。
> 日常 push 不改变用户看到的版本。发版时 `release.mjs` 会**同步 bump
> `package.json`**（DSH / npm 侧版本），两者漂移会被 `doctor` 判为 error。
> 详见 [`docs/releasing.md`](docs/releasing.md)。

---

## [Unreleased]

### Added

- **npm 分发**：`package.json` 补 `repository` / `homepage` / `bugs`，`release.mjs` 新增
  `--publish`。registry 安装按 semver 解析，版本号这才真正成为 DSH 侧的发版开关——
  在此之前 DSH 只能从 git 安装，而 git 依赖钉的是 commit，`pnpm update` 会重解析到
  分支最新提交，等于「push 即发布」。

### Fixed

- **`docs/releasing.md` 关于 git 安装的说明有误**。原文称「git 安装时 pnpm 按 semver
  解析，需 bump `package.json`」，实测不成立：`pnpm add github:owner/repo` 在 lockfile 里
  钉的是**具体 commit**，`pnpm update` 会重解析到分支新 commit，全程与 `version` 字段无关
  （实测 `7c35415…` → `5d143c6…`，装完版本号仍显示 `0.4.0`）。钉 tag 安装
  （`github:owner/repo#v0.4.0`）则 `pnpm update` 报 `Already up to date`，不受影响。

### Changed

- README 的 DSH 安装章节原本只写本地路径，改为官方 `dsh plugin add github:` 装法，
  并说明 `dsh plugin` 是对 pnpm 的透传、按已安装状态 reconcile `dsh.profile.bundles`。
- 留档 `awesome-dsh-plugin` 投稿条目（[PR #5910](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/pull/5910)）。

---

## [0.4.0] - 2026-09-24

### Removed

- **移除全部 5 个子 agent 的 `maxTurns`**。该字段超限时把输出**静默标记为 partial**
  （CC <2.1.246 连标记都没有），对只读审计 agent 会产生「看起来完整、实则被截断」的
  假阴性；`implementer` 被截断则产生半完成编辑。而 DSH 侧**没有任何对应机制**
  （grep `maxSteps`/`maxTurns`/`turnLimit` 全为空），造成不可降级的两端行为分歧。
  实测：唯一运行过的 `researcher` 两次分别用 19 / 29 回合（原上限 60），
  且都跑在无上限的 DSH 上**自然结束** —— 上限在任何一端都没触发过。

### Added

- `tools/doctor.mjs` 的 `agents` 组新增拦截：agent 声明 `maxTurns` 即报 warn，
  避免该字段被无意加回。理由与实测数据记入 `docs/architecture.md` §A.6。

---

## [0.3.1] - 2026-09-24

### Fixed

- 修正插件与市场清单里的描述：补充 `architecture-scout`，并把组件数量更正为「6 个技能与 5 个子 agent」。

---

## [0.3.0] - 2026-09-24

### Added

- **两端同步发版** —— `tools/release.mjs` 现在一次 bump 两个版本文件：
  `.claude-plugin/plugin.json`（Claude Code 的发版开关）与 `package.json`（DSH / npm 侧）。
  `doctor` 新增 `version` 检查组，两端漂移直接判 error 并阻止发版。
- 新增用户主动调用的 `architecture-scout` 技能：开工前或定期调查值得深化的模块边界，
  按规模由主 Agent 自查或并行委派最多四个 `researcher` 收集结构、历史、测试约束与反证。
  候选需通过真实摩擦、删除测试、最小替代、反证和迁移风险门槛；允许零候选。
  默认生成 `docs/research/` 下的 Markdown 报告，只调查，不修改代码或 ADR。
- 新增架构侦察的判据、研究简报、候选报告及正反例验收文档。
- **DSH 侧新内容复验** —— `diff-review` / `diff-reviewer` 加入后，桥接层
  （`src/index.js`、`tools/doctor.mjs`）**零改动**即通过：`agentforge` 的
  `agent` 取值自动变成 5 个，`diff-review` 自动出现在技能目录，
  `diff-reviewer` 的只读边界（`bash` `glob` `grep` `read`）在 DSH 侧同样被强制。
- 新增实测事实：**bundle 内容变化必须重启 profile**。`patchReload: live`
  只监听两个用户 patch 文件，且 `Entry.update()` 在选项无 diff 时直接返回、
  不会重新 `apply()` —— 所以新增 `agents/*.md` 不会被热重载拾取
  （技能不受影响，`list()` 每次重扫）。

### Changed

- `docs/releasing.md` 补 DSH 侧的版本机制：`dsh plugin` 是 pnpm 透传，
  **没有独立版本开关** —— `link:` 安装直接读磁盘、版本号不参与更新；
  只有 git / registry 安装时 `package.json` 的版本才起作用。
- `implementation-workflow` 在理解任务阶段可建议用户**开工前**独立运行 `architecture-scout`，
  但不把全仓架构扫描设为实施后的必经质量门。
- `README.md` 的技能清单与目录树同步加入 `architecture-scout`，历史 token 数据明确标为旧版本快照。
- `README.md` 同步到 5 技能 / 5 子 agent：token 成本按 v0.2.1 重新实测
  （always-on ~308 tok，替换过期的 ~190 tok / 8 组件）；补 `diff-review` 用法；
  删掉与 `quality-gates.md` 重复的质量门判定表，改为指向技能，避免两处漂移。
- `docs/architecture.md` §7 内容清单补 `diff-review` / `diff-reviewer`，
  §8 状态改为五 agent 协作。
- `skills/implementation-workflow/SKILL.md` 的 `description` 补上 `diff-reviewer`
  —— 质量门已扩展，但触发描述漏了评审角色。

---

## [0.2.1] - 2026-09-24

### Added

- 

---

## [0.2.0] - 2026-09-24

### Added

- **DSH 插件适配：子 agent 注册** —— `src/index.js` 现在把 `agents/*.md` 注册成一个
  `agentforge` 工具（用 `agent` 参数枚举选择），至此技能与子 agent
  在 DSH 侧全部可用。子 agent 的 persona、工具白名单、模型覆盖都走调用期参数。
- **两端差异适配层**（全部收在桥接插件，内容文件保持单份）：
  - CC→DSH 工具名映射（`Read`→`read`、`WebSearch`→`web_search` …），
    未映射的名字会被丢弃并记 warning
  - 白名单在**调用期**与真实工具表求交集 —— `tools.restrict()` 对未知工具名和
    空 filter 都会抛错，静态判断会误伤未挂载的工具行
  - `${CLAUDE_PLUGIN_ROOT}` 在技能正文与子 agent persona 里展开为真实包路径
  - 子 agent persona 前置「AgentForge 资源位置」，让正文里的 `skills/...`
    相对路径在 DSH 侧也可解析
  - CC 的 `model: haiku/sonnet` 别名与 `maxTurns` 在 DSH 侧忽略（可用
    `config.agents.<name>` 覆盖模型）
- `tools/doctor.mjs` 新增 `dsh` 检查组：bundle 清单、桥接插件可加载性、
  agent 工具名映射完整性、工具名与 DSH 保留名冲突。
  该组直接 import `src/index.js` 读取映射表，不抄第二份，避免漂移。
- `docs/architecture.md` 补齐实测结论：DSH 工具注册契约、`tools.restrict()` 的
  硬约束、隔离 `DSH_HOME` 的端到端验证步骤与结果。
- `diff-review` 技能 + `diff-reviewer` 子 agent —— **三轴代码评审**：

  | 轴 | 回答的问题 |
  |---|---|
  | Correctness | 这段代码有 bug 吗 |
  | Standards | 符合本仓库文档化的编码规范吗 |
  | Spec | 忠实实现了原始需求吗 |

  三条轴各自独立报告、不合并、不重排。Correctness 轴自带 8 类检查清单
  （空值、边界、错误处理、并发时序、资源生命周期、数据完整性、安全、契约破坏），
  以「触发路径」为硬门槛：说不出「什么输入 / 时序导致什么后果」的不作为正式 finding。

  **能力自包含**：三条轴全部由技能自己完成，不依赖 Claude Code 内置 `/code-review`、
  DSH 专属命令或其他宿主能力。可检验标准是「只有 git 和文件系统时是否仍完整可用」。
- `tools/doctor.mjs` 新增 `naming` 检查组：提示与 Claude Code 内置技能同名的插件技能。

### Changed

- `implementation-workflow` 的质量门从两个审计角色扩展为**三个**：新增 `diff-review`。
  仍是按风险选择、不每次全跑，跳过时必须在最终报告说明原因。
- 桥接插件的 `inject` 从 `['skills']` 扩为 `['skills', 'tools']`；
  `subagents` 刻意**不**设为硬依赖（改在调用期 `ctx.get()`），
  避免某个 profile 没挂 subagent provider 时整个插件停在 waiting。
- `package.json` 的 `files` 去掉并不存在的 `hooks`。
- `skills/complexity-audit/references/java-jacoco.md` 补 DSH 侧的脚本定位方式。
- `skills/research/SKILL.md` 补充「委派后主 Agent 的收尾约束」：
  抽查一轮关键引用即应收尾，不得逐条复核（等于重做子 agent 的工作）。

### Fixed

- 修正插件与市场清单里的描述：补充 `diff-review`，并把组件数量从「4 个技能与 4 个子 agent」更正为「5 个技能与 5 个子 agent」。

### Notes

- `hooks/` 仍未实装（仓库内无 hooks 资产），因此没有挂 `dsh-hooks-claude-code` 桥。
- 工具名不叫 `subagent`：dsh-base 已注册 `subagent` / `subagent_fork`，重名会让插件装载失败。
- `diff-review` **刻意不使用 `context: fork`**：那是 Claude Code 专有扩展，
  DSH 不保证识别。隔离执行由 `diff-reviewer` 子 agent 承担；
  没有可用派发通道时，技能在主上下文串行完成三轴，而不是直接失效。

---

## [0.1.1] - 2026-09-24

### Added

- `researcher` 子 agent —— 技术调研、代码库调查、日志排查、证据收集与研究报告
- `research` 技能 —— 调研工作流：定义问题、限定范围、证据优先级、交叉验证、置信度评估
- 发布流程规范与 `tools/release.mjs` 发版脚本
- CI 校验工作流

---

## [0.1.0] - 2026-09-23

首个版本。

### Added

**技能**

- `implementation-workflow` —— 实施编排：评估任务规模与风险、拆分依赖、
  串行/并行调度 `implementer`、集成验证、按风险选择性调用审计 agent。
  详细规则下沉到 `references/`（拆分、并行、质量门、任务卡模板）。
- `complexity-audit` —— 复杂度风险审计：用 CRAP 定位「复杂且测试保护不足」的函数。
  支持 Java、Python、Go、JavaScript、TypeScript 适配；
  内置 `scripts/crap.js`（Java + JaCoCo 的完整 CRAP 计算）。
- `mutation-testing` —— 测试有效性审计：用突变测试找出存活突变体与无覆盖代码。
  支持 Java(PIT)、Python(mutmut)、Go(go-mutesting)、JavaScript/TypeScript(Stryker)。

**子 agent**

- `implementer` —— 实现代码、修改代码、编写测试、局部验证。
- `complexity-auditor` —— 复杂度与覆盖率风险审计，**只读**（无 Edit/Write）。
- `mutation-auditor` —— 突变测试与测试有效性审计，**只读**（无 Edit/Write）。

**工程**

- `.claude-plugin/plugin.json` + `marketplace.json` —— 可作为 Claude Code 插件安装。
- `tools/doctor.mjs` —— 8 项结构与资产校验，零依赖，可接进 CI。

### Notes

- 零外部依赖：不使用 MCP，不依赖网络，不依赖项目预装工具。
- 两个审计 agent 从工具层面保证「只报告不改码」。
