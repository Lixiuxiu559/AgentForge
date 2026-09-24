# 研究报告：mattpocock-skills 的 `code-review` 技能是否值得引入 AgentForge

- 日期：2026-09-23
- 研究范围：
  - 主目标 `/Users/lixiuxiu/development_tool/projects/mattpocock-skills/skills/engineering/code-review/`（`SKILL.md` 87 行 + `agents/openai.yaml` 3 行，共 12K）
  - 对照目标 `/Users/lixiuxiu/development_tool/projects/AgentForge`（README / docs/architecture.md / skills/*/SKILL.md / agents/*.md / src/index.js / tools/doctor.mjs）
  - 旁证：mattpocock 仓库的 `README.md`、`CLAUDE.md`、`CONTEXT.md`、`.agents/invocation.md`、`.agents/adr/*`、`.agents/writing-docs.md`、`CHANGELOG.md`、`docs/engineering/code-review.md`、`skills/engineering/{implement,to-spec,ask-matt}/SKILL.md`、`skills/productivity/writing-for-agents/SKILL-MECHANICS.md`、`.claude-plugin/plugin.json`
  - mattpocock 仓库 HEAD = `c55ee46073ed923f86ce59a5eb3b6d895095d1b7`（Fri Sep 18 11:12:29 2026 +0100，"Modified the PR body template to make it easier to scan"），与任务给出的 `c55ee46` 一致（`git log -1`）
- 研究状态：final
- 方法：纯静态阅读（读文件、grep、`git log`、`wc`、`find`）。未运行任何技能、未调用模型、未修改任何文件（本报告除外）。

---

## 摘要

`code-review` 是一个 **87 行的纯文本方法论技能**，没有脚本、没有模板文件，把"代码评审"拆成**两条互不合并的轴**：Standards（是否遵守本仓库文档化的编码规范）与 Spec（是否忠实实现了原始 issue/spec），各由一个 sub-agent 并行执行，最后由技能本身**逐字聚合、不重排**。

它最值得引入 AgentForge 的部分是 **Standards 轴的两级判据**（仓库文档优先 + 12 条 Fowler smell 兜底基线 + 每条 finding 必须带引用）和 **两轴分离、拒绝跨轴选冠军** 的结构。这两点填的正是 AgentForge `docs/architecture.md` §8 里被标注为"未实装"的阶段 7（`architecture.md:226`、`architecture.md:253`），且与现有 `complexity-audit`（定量 CRAP）、`mutation-testing`（测试有效性）**正交不重叠**——两个审计技能各自都在边界里显式排除了"通用代码评审"（`complexity-audit/SKILL.md:130`、`mutation-testing/SKILL.md:127`）。

它的 **Spec 轴依赖 mattpocock 生态**（`docs/agents/issue-tracker.md` + `/setup-matt-pocock-skills` + `.scratch/` 约定），在 AgentForge"零外部依赖、零配置"的约束下默认不可用，只能降级为"无 spec 时明说"。它的 `agents/openai.yaml` 是 **Codex 的 UI 元数据**，AgentForge 两端（Claude Code / DSH）都不读，属于直接丢弃的部分。

结论：**值得引入，但引入的是 Standards 轴 + 两轴骨架，不是整个技能**。详见"建议"。

---

## 结论

### 1. 定位

**事实**：该技能解决"这个 diff 是不是既做对了、又做对了事"的问题，方式是沿两条轴评审 `HEAD` 与用户给定固定点之间的 diff：

- Standards：代码是否遵守**本仓库文档化的**编码规范
- Spec：代码是否忠实实现了**原始 issue / spec**

（`skills/engineering/code-review/SKILL.md:6-9`）

- **目标用户**：使用 mattpocock-skills 全套流程的工程师。人类文档页把它定位为构建链的**尾环**：`grill-with-docs → to-spec → to-tickets → implement → code-review`（`docs/engineering/code-review.md:88`），也可以对任意分支/PR 单独使用。
- **使用场景**：分支/PR/进行中改动的评审；`implement` 技能的收尾评审（`skills/engineering/implement/SKILL.md:13`、`docs/engineering/code-review.md:90`）。
- **触发条件**：**模型可触发**（model-invoked）。frontmatter 只有 `name` 与 `description`，没有 `disable-model-invocation`（`SKILL.md:1-4`），`agents/openai.yaml` 也没有 `policy` 块（`agents/openai.yaml:1-3`）。description 内写了触发短语："Use when the user wants to review a branch, a PR, work-in-progress changes, or asks to \"review since X\"."（`SKILL.md:3`）。同时人类可 `type /code-review`（`docs/engineering/code-review.md:9`）。
- **前置条件**：Standards 轴无前置；Spec 轴需要能找到 spec（`docs/engineering/code-review.md:22-33`）。**用户必须提供固定点**，不给就反问而不是猜（`SKILL.md:19`）。

### 2. 结构

**事实**：

- **frontmatter 字段只有 2 个**：`name: code-review`、`description: "..."`（`SKILL.md:1-4`）。没有 `disable-model-invocation`、没有 `tools`、没有 `license`、没有 `version`。
- **正文分 3 个部分**：
  1. 无标题引言（`SKILL.md:6-13`）：两轴定义 + 并行 sub-agent 的理由 + 一句 setup 指针
  2. `## Process`，5 步（`SKILL.md:15-78`）
  3. `## Why two axes`（`SKILL.md:80-87`）：为什么两轴不能合并
- **完整工作流程**：

| 步 | 动作 | 关键判据/失败条件 | 行号 |
|---|---|---|---|
| 1 | 钉住固定点 | `git diff <fixed-point>...HEAD`（**三点**，对 merge-base 比较）+ `git log <fixed-point>..HEAD --oneline`；先 `git rev-parse` 确认 ref 可解析、diff 非空 | `SKILL.md:17-23` |
| 2 | 找 spec 来源 | 4 级顺序：commit message 里的 issue 引用（经 `docs/agents/issue-tracker.md`）→ 用户传的路径 → `docs/`/`specs/`/`.scratch/` 下匹配分支名的文件 → 问用户；都没有则 Spec 轴跳过并报 "no spec available" | `SKILL.md:25-32` |
| 3 | 找规范来源 | 仓库文档（`CODING_STANDARDS.md`、`CONTRIBUTING.md` 等）**加上**固定的 12 条 Fowler smell 基线 | `SKILL.md:34-56` |
| 4 | 并行 spawn 两个 sub-agent | 各自的 prompt 必须内联：diff 命令 + commit 列表 + 完整判据材料 + brief；两份 brief 都写死 **"Under 400 words"** | `SKILL.md:58-72` |
| 5 | 聚合 | 只放进 `## Standards` / `## Spec` 两个 heading，逐字或轻度清理；**不合并、不重排**；结尾一行总结"每轴各多少条 + 每轴最严重的一条"，**拒绝跨轴选冠军** | `SKILL.md:74-78` |

### 3. 跨工具适配（重点）

**事实**：

- `agents/openai.yaml` 全文只有 3 行：

  ```yaml
  interface:
    display_name: "Code Review"
    short_description: "Review a diff on standards and spec"
  ```

  （`skills/engineering/code-review/agents/openai.yaml:1-3`）

- **它的作用**（依据是仓库自己的文档，不是文件本身）：`.agents/invocation.md:10` 写明——

  > Every skill also carries an `agents/openai.yaml` beside its `SKILL.md`. It holds **Codex UI metadata**: `interface.display_name` and `interface.short_description` for the skill picker, and, for user-invoked skills, the `policy.allow_implicit_invocation: false` that pairs with `disable-model-invocation`.

  即：**Codex 的技能选择器元数据**；对"用户调用型"技能还额外承载 `policy.allow_implicit_invocation: false`（Codex 侧的 `disable-model-invocation` 等价物）。

- **引入背景**：`CHANGELOG.md:31`（1.2.0 / #551）——"Add Codex metadata alongside each skill's Claude Code frontmatter so the set works in both harnesses **without generated copies**."同一 changeset 同时把 `AGENTS.md` 做成指向 `CLAUDE.md` 的软链，让 Codex 读到同一份仓库指令（`CHANGELOG.md:36`）。
- **它说明的适配方式**：**一份正文 + 两套元数据 + 一个通用安装器**，三层：
  1. **Claude Code**：frontmatter（`disable-model-invocation` 等）
  2. **Codex**：`agents/openai.yaml`（UI 元数据 + `policy` 块）
  3. **其他 Agent-Skills 标准 harness**：`npx skills@latest add mattpocock/skills`，把可编辑的技能文件复制进项目（`.agents/adr/0002-ship-as-a-claude-code-plugin.md:3`、`.agents/install-block.md`）
- **正文本身被写成 harness 中立**：`CHANGELOG.md:13`（1.2.3 / #781）——"**Drop Claude Code's tool and agent-type names** from the subagent-dispatch instructions in `code-review`, `codebase-design`, and `improve-codebase-architecture`, so the step is followable on Codex and other harnesses."这解释了为什么 `SKILL.md:58` 只写 "Spawn both sub-agents in parallel"，全文 **0 处**提到 `Task`/`Agent` 工具名或 `subagent_type`（grep 验证：0 命中）。
- **`policy` 块的缺失对 code-review 是有意义的**：仓库共 **38** 个 `agents/openai.yaml`，其中 **22** 个带 `policy: allow_implicit_invocation: false`（grep 统计）。code-review 属于**不带**的那 16 个，与 README 把它列在 **Model-invoked** 一致（`README.md:212`）。
- **该机制被双向验证过**：`CHANGELOG.md:21-23`（1.2.2 / #766）记录了一次反向修正——`writing-for-agents` 需要**删掉** `policy.allow_implicit_invocation: false`，因为 "Codex filtered the skill out of the model-visible skills list, so its description could not trigger it — only an explicit `$writing-for-agents` mention worked."说明这个字段在 Codex 侧确实生效。

### 4. 核心方法论

**事实**：

- **"什么算好/坏代码"= 两级判据，仓库文档优先**：
  - 一级：仓库自己文档化的规范（`CODING_STANDARDS.md`、`CONTRIBUTING.md` 等），**"The repo overrides"**——仓库标准永远压过基线（`SKILL.md:36, 40`）
  - 二级：固定的 **12 条 Fowler code smell 基线**（`Refactoring` ch.3），仓库什么都没写时也生效（`SKILL.md:38`）
  - 设计动机写在人类文档页："A generic review skill that does not know your standards is the thing this design is trying to avoid: it flags what is deliberate in your codebase and misses the invariants your codebase actually depends on."（`docs/engineering/code-review.md:44`）
- **12 条 smell 全文内联在 SKILL.md 里**，每条写成 **"what it is → how to fix"** 两段式（`SKILL.md:43-56`）：Mysterious Name、Duplicated Code、Feature Envy、Data Clumps、Primitive Obsession、Repeated Switches、Shotgun Surgery、Divergent Change、Speculative Generality、Message Chains、Middle Man、Refused Bequest。例：`Feature Envy: a method that reaches into another object's data more than its own. → move the method onto the data it envies.`（`SKILL.md:47`）
- **两条绑定规则防止基线变成噪音**（`SKILL.md:40-41`）：
  1. 仓库标准覆盖基线
  2. 每条 smell 都是**带标签的启发式**（"possible Feature Envy"），**永远不是硬性违规**；工具已经强制的内容一律跳过
- **Spec 轴的判据是三类**（`SKILL.md:70`）：spec 要求但缺失/部分实现的需求；diff 里没被要求的行为（scope creep）；看起来实现了但实现方式可疑的需求。每条必须**引用 spec 原句**。
- **"每条 finding 必须带引用"是可核查性的根**：Standards 的 finding 必须引规范文件+规则，或引 smell 名+代码块；Spec 的 finding 必须引 spec 行（`SKILL.md:64, 70`；`docs/engineering/code-review.md:42`）。
- **审查过程组织**：上下文隔离（两个 sub-agent 不互相污染，`SKILL.md:11`）+ 失败前置（坏 ref / 空 diff 在 spawn 之前就失败，`SKILL.md:23`）+ 篇幅上限（`SKILL.md:64, 70`）+ 不重排（`SKILL.md:76-78`）。
- **明确没有收敛保证**：人类文档页直说 "/code-review and /improve-code-architecture always find new stuff every time… There is no convergence guarantee."，并建议**不要**循环跑到干净（`docs/engineering/code-review.md:70-72`）。

### 5. 设计手法

**事实**（可借鉴的写法，逐条带证据）：

1. **description 的写法 = 做什么 + 两个轴 + 用户原话触发短语**（`SKILL.md:3`）。它把"用户会怎么说"直接写成触发词（"review since X"），而不是抽象描述。仓库层面把这条规则写进了规范：模型触发型 description 保留富触发措辞，人类触发型则**剥掉触发列表**（`.agents/invocation.md:5-6`、`SKILL-MECHANICS.md:9-10`）。
2. **给 sub-agent 的 brief 写死字数上限**："Under 400 words"（`SKILL.md:64, 70`）。这是对"agent 太啰嗦"这一失败模式的直接对策（`README.md:105`）。
3. **输出格式用固定 heading 强制，并明令禁止加工**：两个固定 heading + 逐字聚合 + 拒绝跨轴选冠军（`SKILL.md:76-78`）。理由写成了独立章节 `## Why two axes`（`SKILL.md:80-87`），而不是藏在步骤里——**把"为什么不"交给模型，让它能自己判断边界情况**。
4. **渐进式披露的判据是"读者是谁"，不是"文档要短"**：本技能把 12 条 smell **内联**，并明确给出理由——"the sub-agent has no other access to it"（`SKILL.md:63`）；而同仓库其他技能大量使用 `references/` 式旁文件（`tdd/mocking.md`、`tdd/tests.md`、`prototype/UI.md`、`prototype/LOGIC.md`、`codebase-design/DEEPENING.md`）。**区别在于读者是"拿不到文件的 sub-agent"还是"能读文件的模型"。**
5. **便宜的前置校验放在昂贵操作之前**，并写明动机："A bad ref or empty diff should fail here, not inside two parallel sub-agents."（`SKILL.md:23`）
6. **反过度报告的设计**：仓库标准覆盖基线 + smell 一律 judgement call + 跳过工具已强制项（`SKILL.md:40-41`）。
7. **人类文档页把验收标准写成可自检清单**：`## It's working if` 五条，全部要求"不打开 SKILL.md 也能核对"（`docs/engineering/code-review.md:78-84`），规范里对此有硬门槛——"The bar on each is that the reader can check it without opening `SKILL.md`"（`.agents/writing-docs.md:60`）。
8. **已知缺陷公开写进人类文档**，包括"子 agent 递归 spawn 到 50+ 个 agent"的事故、与 CC 内置 `/code-review` 的命名冲突、以及"评审看不到未提交改动"（`docs/engineering/code-review.md:48-76`）。文档还把用户的吐槽原句当作证据引用（"Same context reviewing itself isn't review, it's confirmation bias with a slash command."，`docs/engineering/code-review.md:60`）。
9. **文档树与技能树分离**：`SKILL.md` 是给模型的 runbook，`docs/<bucket>/<name>.md` 是给人类的选型页，后者**不复制前者的步骤**（`.agents/writing-docs.md:74`）。
10. **统一的措辞风格约束**：全仓库禁用 em-dash，且明确"never do a blind character substitution"（`CLAUDE.md:25`）——思路可借（统一风格约束写进仓库指令），规则本身对中文项目不适用。

### 6. 能力边界对比（与 AgentForge 现有 4 个技能）

**事实 + 判断**：

| 对照 | 关系 | 依据 |
|---|---|---|
| `complexity-audit`（复杂度/CRAP） | **正交，无重叠** | `complexity-audit` 是**定量**的：CRAP 公式 + 阈值 30 + 五语言工具链 + 四级降级等级（`complexity-audit/SKILL.md:21-52`），判据是"复杂度高且测试保护不足"。`code-review` 是**定性**的：不计算任何指标、不看覆盖率、不做工具调用。`complexity-audit/SKILL.md:130` 显式写"**不与突变测试、行为验收、通用代码评审重复**" |
| `mutation-testing`（测试有效性） | **正交，无重叠** | `mutation-testing` 只回答"把生产代码改错，测试会不会失败"（`mutation-testing/SKILL.md:13`），产出存活突变体/无覆盖代码。`code-review` 的 Standards 轴不评估测试有效性。`mutation-testing/SKILL.md:127` 同样写"不与复杂度审计、行为验收、代码评审重复" |
| `implementation-workflow`（实施编排） | **部分重叠，但不是冲突；是它缺的那一块** | 重叠处：`implementation-workflow` 已有阶段 6 选择性质量审计 + 阶段 7 集成检查 6 项清单（`implementation-workflow/SKILL.md:88-97`）。但那 6 项全是**流程与集成**判据（改动是否越界、是否同文件冲突、接口/命名是否一致、是否遗漏集成代码、测试是否覆盖真实集成路径、子 agent 报告是否可信），**没有**"是否符合仓库文档化规范"和"是否实现了原始需求"这两条。AgentForge 自己的架构文档也把 `code-review` 列为阶段 7 并标注**未实装**（`docs/architecture.md:226`、`docs/architecture.md:253`） |
| `research`（调研取证） | 无关 | — |

**三个真实冲突点（必须处理，否则照搬会出问题）**：

1. **Spec 轴在 AgentForge 里默认半残**。`code-review` 的 Spec 轴依赖一个可找到的 spec（`SKILL.md:25-32`），第 1 顺位是经 `docs/agents/issue-tracker.md` 取 issue。AgentForge 没有任何 spec 落盘约定（`implementation-workflow/SKILL.md:39-45` 只说"读取项目指令文件、需求或 Spec"，不生产 spec），也没有 `to-spec`/`to-tickets` 对应物（`docs/architecture.md:224-229` 把它们列为未实装）。→ 引入后 Spec 轴大多数时候会走"no spec available"分支。
2. **diff 基线冲突：评审看不到未提交改动**。`code-review` 用三点 `git diff <fp>...HEAD`，明确**不含** staged / 工作区改动（`SKILL.md:21`；`docs/engineering/code-review.md:74-76` 专门有一条 FAQ 讲这个）。而 AgentForge 的 `implementation-workflow` 流程终点是"统一验证 → 审计 → 汇总"（`implementation-workflow/SKILL.md:99-125`），**没有提交步骤**。直接照搬会出现"刚改完就评审，但评审什么都看不到"。
3. **命名冲突**：Claude Code 自带 `/code-review`，且做的是不同的事（在 diff 里猎 bug）。mattpocock 自己的文档承认这是"the most reported problem with the skill, and it is not fixed"（`docs/engineering/code-review.md:50-52`）。AgentForge 若用同名技能，会撞上同一个问题。

**另一个需要决策的点**：`code-review` 依赖"能 spawn 两个匿名并行 sub-agent"。AgentForge 的 DSH 侧只有一个**枚举式** `agentforge` 工具（`docs/architecture.md:96-128`），无法派发匿名 sub-agent；要落地得新增一个只读 agent 定义（如 `code-reviewer`），或在 CC 侧直接用原生 sub-agent、在 DSH 侧退化为串行。这不是冲突，但是实装成本。

### 7. 可复用性

**可以直接复用（与平台无关，约占技能 80%）**：

- 两轴分离 + **不合并、不重排、拒绝跨轴选冠军** 的结构与理由（`SKILL.md:74-87`）
- 12 条 Fowler smell 基线的全文，及其两条绑定规则（仓库覆盖 / 一律 judgement call / 跳过工具已强制项）（`SKILL.md:38-56`）
- **每条 finding 必须带引用**（规范文件+规则 / smell 名+代码块 / spec 行）——这是"可核查"的根（`SKILL.md:64, 70`）
- 失败前置：先 `git rev-parse` + 确认 diff 非空，再 spawn（`SKILL.md:23`）
- sub-agent brief 的**字数上限**与**固定输出 heading**（`SKILL.md:64, 70, 76`）
- **降级规则**："没有 spec 就明说 no spec available，不臆造需求"（`SKILL.md:32, 72`）
- 人类文档页的 `## It's working if` 可自检清单写法（`docs/engineering/code-review.md:78-84`）

**平台/生态特有（必须改写或直接删除）**：

- `agents/openai.yaml`（3 行）——**Codex** 的 UI 元数据。AgentForge 两端都不读它：DSH 桥接只扫 `skills/*/SKILL.md`（`src/index.js:202-213`），doctor 同样（`tools/doctor.mjs:135-149`）。直接丢弃。
- `docs/agents/issue-tracker.md` + "tell the user to run `/setup-matt-pocock-skills`"（`SKILL.md:13`）——mattpocock 的 per-repo 配置约定。AgentForge 的卖点是"装完即用、零配置"（`docs/architecture.md:16-22`），这条不成立，须删。
- spec 搜索顺序里的 `.scratch/`（`SKILL.md:31`）——mattpocock 的 local-markdown issue tracker 约定。
- "Spawn both sub-agents in parallel" 的泛化措辞（`SKILL.md:58`）——为了 harness 中立而刻意不写工具名。AgentForge 有具体机制可写实（`agentforge` 工具，`docs/architecture.md:96-128`）。
- 无 em-dash 规则（`CLAUDE.md:25`）——语言特定。
- description 里的英文触发短语——需换成中文触发词（对照 AgentForge 现有技能 description 的写法，如 `complexity-audit/SKILL.md:3`）。

**引入代价（估计，未实测）**：

- 新增 1 个技能目录（中文改写后 `SKILL.md` 约 100-130 行）+ 建议新增 1 个只读 `code-reviewer` agent（工具白名单 `Read, Glob, Grep, Bash`，形如 `agents/complexity-auditor.md:4`）。
- 常驻 token：+1 个技能 description（现有 8 个组件合计约 190 tok，`README.md:124`）。具体增量未实测。
- 校验：doctor 对新增技能/agent 无需改动即可通过；但若新增只读 agent，必须声明 `tools` 白名单且不含 Edit/Write，否则 `tools/doctor.mjs:212-216` 会报 error（"声称只读，但 tools 包含写工具"）。
- 版本：按 AgentForge 判据，新增能力属 **MINOR**（`README.md:289`）。
- 需要新增一份 `references/` 文档（若把 smell 基线放 references，须注意 `tools/doctor.mjs:167-169` 会校验正文里 `` `references/xxx.md` `` 反引号引用是否悬空）。

**收益**：

- 补上 `docs/architecture.md` §8 阶段 7 的空位，且是**唯一**缺失的评审维度——现有 4 个技能里没有任何一个判断"是否符合仓库编码规范"或"是否实现了原始需求"。
- 引入的是**判据 + 输出结构**，不是工具链，因此与 AgentForge"零外部依赖"约束天然兼容（`SKILL.md` 全文不调用任何外部工具，只调 git）。
- Standards 轴的"仓库文档优先 + smell 兜底"是可直接照搬的**通用**设计，不依赖任何生态。

---

## 关键证据

1. `code-review` frontmatter 只有 2 个字段、无 `disable-model-invocation` —— `skills/engineering/code-review/SKILL.md:1-4`
2. 两轴定义 —— `skills/engineering/code-review/SKILL.md:6-11`
3. setup 指针（生态依赖） —— `skills/engineering/code-review/SKILL.md:13`
4. 固定点钉法与三点 diff —— `skills/engineering/code-review/SKILL.md:17-23`
5. spec 来源四级顺序（含 `.scratch/`） —— `skills/engineering/code-review/SKILL.md:25-32`
6. 规范来源 + 12 条 smell 基线 + 两条绑定规则 —— `skills/engineering/code-review/SKILL.md:34-56`
7. 12 条 smell 的 "what it is → how to fix" 全文 —— `skills/engineering/code-review/SKILL.md:43-56`
8. 并行 spawn 与两份 brief（含 "Under 400 words"、内联 smell 基线的理由） —— `skills/engineering/code-review/SKILL.md:58-72`
9. 聚合规则：两个固定 heading、逐字、不重排、拒绝跨轴冠军 —— `skills/engineering/code-review/SKILL.md:74-78`
10. `## Why two axes` —— `skills/engineering/code-review/SKILL.md:80-87`
11. `agents/openai.yaml` 全文 3 行，无 `policy` 块 —— `skills/engineering/code-review/agents/openai.yaml:1-3`
12. openai.yaml 的作用定义（Codex UI 元数据 + policy 块配对关系） —— `.agents/invocation.md:10`
13. Codex 元数据的引入动机（"without generated copies"） —— `CHANGELOG.md:31`
14. 正文剥离 CC 工具名以适配 Codex —— `CHANGELOG.md:13`
15. `policy` 块在 Codex 侧确实生效的反向证据 —— `CHANGELOG.md:21-23`
16. 仓库共 38 个 openai.yaml，22 个带 policy（grep 统计，本报告实测）
17. code-review 在 README 中被列为 Model-invoked —— `README.md:212`
18. code-review 在插件清单中（promoted） —— `.claude-plugin/plugin.json:16, 37`
19. `implement` 以 `/code-review` 收尾 —— `skills/engineering/implement/SKILL.md:13`
20. 人类文档页：定位、两轴表、smell 基线说明 —— `docs/engineering/code-review.md:1-5, 35-46`
21. 人类文档页：已知缺陷（命名冲突 / 子 agent 递归 spawn 到 50+ / 不看未提交改动 / findings 未复核 / 无收敛） —— `docs/engineering/code-review.md:48-76`
22. 人类文档页：`## It's working if` 可自检清单 —— `docs/engineering/code-review.md:78-84`
23. 人类文档页：构建链定位 —— `docs/engineering/code-review.md:86-94`
24. 人类文档页规范："可核对性不依赖打开 SKILL.md" —— `.agents/writing-docs.md:60`
25. 人类文档页规范："不复制 SKILL.md 步骤" —— `.agents/writing-docs.md:74`
26. 模型触发 vs 人类触发的 description 写法差异 —— `.agents/invocation.md:5-6`、`skills/productivity/writing-for-agents/SKILL-MECHANICS.md:9-10`
27. 仓库措辞约束（禁 em-dash） —— `CLAUDE.md:25`
28. Codex 原生插件被推迟的原因（bucketed layout vs 单路径 skills 选择） —— `.agents/adr/0002-ship-as-a-claude-code-plugin.md:13-23`
29. skills.sh 作为通用安装器 —— `.agents/adr/0002-ship-as-a-claude-code-plugin.md:3, 22`、`.agents/install-block.md`
30. AgentForge 技能清单与 user-invocable 现状 —— `docs/architecture.md:204-213`
31. AgentForge 阶段 7 `code-review` 标注未实装 —— `docs/architecture.md:226, 253`
32. AgentForge 零外部依赖 / 装完即用约束 —— `docs/architecture.md:16-22`、`README.md:297`
33. AgentForge 只读边界（审计 agent 不持有 Edit/Write） —— `README.md:89, 298`、`docs/architecture.md:221-222`
34. `complexity-audit` 的 CRAP 判据与降级等级 —— `skills/complexity-audit/SKILL.md:21-52`
35. `complexity-audit` 显式排除"通用代码评审" —— `skills/complexity-audit/SKILL.md:130`
36. `mutation-testing` 的目标问题与显式排除项 —— `skills/mutation-testing/SKILL.md:13, 127`
37. `implementation-workflow` 阶段 6/7 的现有检查项 —— `skills/implementation-workflow/SKILL.md:88-97, 107-121`
38. `implementation-workflow` 质量门决策与"跳过必须说明原因" —— `skills/implementation-workflow/references/quality-gates.md:53-62, 87`
39. `implementation-workflow` 子任务卡模板（与 code-review 的 sub-agent brief 结构同类） —— `skills/implementation-workflow/references/task-card-template.md:5-50`
40. DSH 侧只有一个枚举式 `agentforge` 工具（无法派发匿名 sub-agent） —— `docs/architecture.md:96-128`、`README.md:101-106`
41. DSH 桥接与 doctor 都只扫 `skills/*/SKILL.md`（openai.yaml 无消费者） —— `src/index.js:202-213`、`tools/doctor.mjs:135-149`
42. doctor 的只读 agent 校验规则 —— `tools/doctor.mjs:212-216`
43. doctor 的 `references/` 悬空引用校验 —— `tools/doctor.mjs:167-169`
44. AgentForge 版本号判据（新增能力 = MINOR） —— `README.md:289`
45. mattpocock 仓库 HEAD = `c55ee46...`（2026-09-18） —— `git log -1`（本报告实测）
46. `SKILL.md` 全文 0 处提及 `Task`/`Agent` 工具名（grep 实测，0 命中）

---

## 分析

**事实如何支持"值得引入但需裁剪"这个结论**：

1. **能力空位是真实的、且 AgentForge 自己已经承认。** `docs/architecture.md:253` 把"阶段 7 代码评审"写进设计目标流水线，`docs/architecture.md:226` 又把 `code-review` 列入"计划（未实装，勿当现状）"。同时 `complexity-audit/SKILL.md:130` 与 `mutation-testing/SKILL.md:127` 各自显式声明不与"通用代码评审"重复——这说明设计者当时已经意识到这是一个**独立维度**，只是没实装。→ 引入填的是已知空位，不是新增冗余。

2. **正交性可以从判据层面论证，不只是措辞。** 现有两个审计技能都建立在**可执行工具的输出**上（JaCoCo / radon / PIT / Stryker，`complexity-audit/SKILL.md:46-52`、`mutation-testing/SKILL.md:25-31`），产出的是数值与统一状态映射；`code-review` 建立在**仓库文档与人的判断**上，产出的是带引用的定性 finding，且明确禁止把 smell 报成硬性违规（`SKILL.md:41`）。两者的输入、输出、失败模式都不同，不构成重复。

3. **`implementation-workflow` 的阶段 7 检查清单不覆盖规范与规格。** 逐条核对 `implementation-workflow/SKILL.md:88-97` 的 6 项：全部是"改动是否落在声明范围""是否同文件冲突""接口/命名/错误处理是否一致""是否遗漏集成代码""测试是否覆盖真实集成路径""子 agent 报告是否可信"。这些是**编排正确性**，不是**代码质量**或**需求符合性**。→ 无重叠，只有互补。

4. **Spec 轴的生态依赖是可验证的事实，不是猜测。** `SKILL.md:13` 要求 `docs/agents/issue-tracker.md` 存在，`SKILL.md:29` 明确说经该文件取 issue，`SKILL.md:31` 把 `.scratch/` 列为 spec 搜索位置。这三个都是 mattpocock 的 per-repo 配置产物，由 `setup-matt-pocock-skills` 生成（`skills/engineering/setup-matt-pocock-skills/SKILL.md:11-13, 104-112`），而该技能是 user-invoked、必须由人手动跑一次（`.agents/invocation.md:22`）。AgentForge 没有对应机制（`docs/architecture.md:16-22` 的零配置承诺）。→ 裁剪 Spec 轴是必要动作，不是可选优化。

5. **diff 基线冲突是可推导的，且有文档佐证。** `SKILL.md:21` 的三点 diff 排除了工作区改动；mattpocock 自己为此专门写了 FAQ（`docs/engineering/code-review.md:74-76`），并给出对策"Commit first, then review"。AgentForge 的 `implementation-workflow` 流程里没有提交步骤（`SKILL.md:99-125`）。→ 移植时必须改基线或补提交约定，二者必选其一。

6. **`agents/openai.yaml` 不可移植这一点可以硬证明。** 文件本身 3 行、无注释，其含义**只能**从 `.agents/invocation.md:10` 得知（该文件明确说它是 Codex UI 元数据）。而 AgentForge 的两端都不读它：DSH 桥接扫 `skills/*/SKILL.md`（`src/index.js:202-213`），doctor 扫同样的路径（`tools/doctor.mjs:135-149`）。→ 在 AgentForge 里它是零消费者文件，应丢弃。（附带说明：仓库 38 个 openai.yaml 中 22 个带 `policy` 块，code-review 属于不带的那批，与其 Model-invoked 定位一致。）

7. **设计手法中最有迁移价值的一条是"渐进式披露的判据是读者"。** `SKILL.md:63` 之所以把 12 条 smell 内联而不是放 `references/`，理由写得很直白："the sub-agent has no other access to it"。而 AgentForge 的 `implementation-workflow` 用 `references/` 承载拆分/并行/质量门细节（`implementation-workflow/SKILL.md:135-139`），是因为读者是**能读文件的主 Agent**。这两个做法不矛盾，判据不同。→ 移植 code-review 时，如果 AgentForge 用**持久 agent**（`code-reviewer.md`，有 Read/Grep 权限）承载 Standards 轴，smell 基线可以放 `references/`；如果用**匿名 sub-agent + 一次性 prompt**，就必须内联。这是一个实装决策点。

8. **引入的代价集中在"新 agent + 派发机制"，不在内容量。** 技能本体只有 87 行且零脚本、零外部工具依赖（全文只调 git，`SKILL.md:21`），与 AgentForge"零外部依赖"约束兼容。真正的成本是要决定 Standards/Spec 两轴在 DSH 侧怎么落地——因为 `agentforge` 工具是枚举式的（`docs/architecture.md:96-128`），没有匿名 sub-agent 通道。若新增 `code-reviewer` agent，doctor 的只读校验（`tools/doctor.mjs:212-216`）要求白名单不含 Edit/Write。

---

## 置信度

**高**（对问题 1、2、3、4、6 的结论）。

原因：

- 主目标全部 90 行（87 + 3）已逐行读取，所有引用都能定位到具体行号。
- 问题 3（openai.yaml 用途）有**两类独立证据**交叉验证：仓库规范文件（`.agents/invocation.md:10`）+ CHANGELOG 的两次改动记录（引入 #551 / `CHANGELOG.md:31`，反向修正 #766 / `CHANGELOG.md:21-23`）。不是从文件名或命名习惯猜的。
- 问题 6 的边界判断同时有正面证据（`code-review` 的判据内容）和反面证据（AgentForge 两个审计技能各自显式排除代码评审），并且 AgentForge 自己的架构文档承认阶段 7 未实装。

**中**（对问题 7 中"引入代价"的量化部分）。

原因：常驻 token 增量、doctor 改动量、中文改写后的实际篇幅都**没有实测**，只有结构性推断。收益侧的判断（填补空位、维度正交）证据充分，代价侧的估计需要落地时验证。

**低**（对"Codex 是否真的读取 `agents/openai.yaml`"这一条）。

原因：本机没有 Codex 环境，无法实测。结论完全依赖仓库自述文档与 CHANGELOG，属于二手证据。好在这一点**不影响本报告的核心结论**（无论 Codex 读不读，AgentForge 两端都不读，所以都应丢弃该文件）。

---

## 未确认项

- **`agents/openai.yaml` 的字段语义无法仅从文件本身确定。** 该文件只有 3 行 YAML，无注释、无 schema、无版本声明。本报告采用的"Codex UI 元数据"结论来自 `.agents/invocation.md:10` 与 `CHANGELOG.md:21-23, 31`——**是仓库自述，不是官方规范核验**。未做的一步：查 Codex 官方文档确认 `interface.display_name` / `interface.short_description` / `policy.allow_implicit_invocation` 的确切语义与生效范围。
- **未实测 Codex 行为**：本机无 Codex 环境，无法验证带/不带 `policy` 块时技能在模型可见列表中的差异。
- **子 agent 递归 spawn 缺陷在 HEAD `c55ee46` 上是否仍存在，未运行验证。** 文档说 "Neither is in the shipped skill yet"（`docs/engineering/code-review.md:56`），且 `SKILL.md:60-70` 的两份 brief 中确实搜不到任何禁止委派的句子（grep "Do not invoke" 命中 0）——静态证据与文档描述一致，但没有实际触发过。
- **未核对全部 38 个 openai.yaml 的 policy 块与 README 的 User-invoked / Model-invoked 列表是否一一对应。** 只核对了 code-review 这一个（不带 policy ↔ README:212 列在 Model-invoked）。
- **AgentForge 侧引入后的实测成本未测**：常驻 token 增量（`claude plugin details`）、doctor 是否需要新增校验项、DSH 侧 `agentforge` 工具描述膨胀的影响，均未实测。
- **AgentForge 的 `user-invocable: true` 字段与 Claude Code 官方字段（`disable-model-invocation`）的关系未确认。** 观察到 AgentForge 技能用前者（如 `complexity-audit/SKILL.md:4`），mattpocock 用后者（如 `implement/SKILL.md:4`），而 AgentForge 的桥接层**两者都解析**（`src/index.js:239-242`）。这与本次调查相关（影响移植时 frontmatter 怎么写），但属于 AgentForge 自身的设计问题，未深入。
- **未验证 `docs/engineering/code-review.md` 中"50-plus agents"等用户报告的真实性**——它们来自该仓库文档转述的 issue/用户反馈，本报告未回溯原始 issue。
- **未评估 mattpocock 仓库的其他技能**（如 `codebase-design`、`tdd`、`diagnosing-bugs`）是否同样值得引入——超出本次范围。

---

## 建议

### 是否引入

**建议引入，但只引入 Standards 轴 + 两轴骨架，Spec 轴改为可选降级。** 理由：

- Standards 轴是 AgentForge 现有 4 个技能**完全没有**的能力维度，且其判据（仓库文档优先 + smell 兜底 + 每条带引用）不依赖任何平台或生态。
- 两轴分离、拒绝跨轴选冠军的结构是纯方法论，可直接照搬。
- Spec 轴依赖 mattpocock 的 issue-tracker 约定（`SKILL.md:13, 29, 31`），在 AgentForge 零配置约束下不可用；保留其**降级规则**（无 spec 就明说，不臆造需求）即可。

### 如何引入（三条具体动作）

1. **内容裁剪**：
   - 保留：两轴结构、`## Why two axes` 的理由章节、12 条 smell 基线全文及两条绑定规则、"每条 finding 必须带引用"、失败前置校验、sub-agent brief 字数上限与固定输出 heading。
   - 删除：`agents/openai.yaml`、`docs/agents/issue-tracker.md` 指针、`/setup-matt-pocock-skills` 指针、`.scratch/` 搜索位置、英文触发短语。
   - 改写：diff 基线、sub-agent 派发措辞、输出语言中文化。

2. **必须解决的三个适配点**（按优先级）：
   - **diff 基线**：改为覆盖工作区改动（如 `git diff <fixed-point>` 不带三点，或同时给出 `git status --short` + `git diff HEAD`），或者反过来在 `implementation-workflow` 里补一条"评审前先提交/建 fixup"的约定。**二者必选其一，否则评审看不到刚改的东西。**
   - **派发机制**：建议新增只读 agent `agents/code-reviewer.md`（工具白名单 `Read, Glob, Grep, Bash`，形如 `agents/complexity-auditor.md:4`），由技能通过 `agentforge` 工具调用；避免依赖匿名 sub-agent。若坚持两轴并行，需两个 agent（`standards-reviewer` / `spec-reviewer`）或一个 agent 分两轮。
   - **命名**：避免与 Claude Code 内置 `/code-review` 直接冲突（`docs/engineering/code-review.md:50-52` 记录了这个真实问题）。建议改名（如 `code-review-gate` 或 `diff-review`），或在 description 里明确写出与内置命令的分工。

3. **落地形态二选一**：
   - **方案 A（推荐）**：独立技能 `skills/code-review/SKILL.md` + 只读 agent，同时在 `implementation-workflow` 阶段 7 引用它（把 `implementation-workflow/SKILL.md:123` 的"汇总"之前插入一步）。好处：支持"只评审"的独立场景（`docs/architecture.md:263` 提到用户可能只要求单阶段）。
   - **方案 B**：只作为 `implementation-workflow/references/review-gate.md`，不新增技能与 agent。好处：零新增常驻 token；坏处：无法单独使用，且与阶段 7 强绑定。

### 下一步动作

1. 由主 Agent 决策方案 A / B，以及是否接受新增 1-2 个只读 agent。
2. 决策后交给 `implementer` 落地；落地时必须跑 `node tools/doctor.mjs`（校验 frontmatter、`references/` 悬空引用、只读 agent 白名单，见 `tools/doctor.mjs:151-216`）。
3. 按 AgentForge 版本判据，这是一次 **MINOR** 变更（`README.md:289`），需同步 `CHANGELOG.md`、`README.md` 技能表、`docs/architecture.md` §7/§8 的"未实装"标注。
4. 若决定连 Spec 轴一起引入，需先设计 AgentForge 自己的 spec 落盘约定（对应 mattpocock 的 `to-spec`），否则该轴永远走降级分支。

### 不建议做的事

- 不要整包照搬（会带进 openai.yaml、issue-tracker 约定、`.scratch/` 等无效资产）。
- 不要在引入后把 `code-review` 放进"每次都跑"的质量门——mattpocock 自己的文档明确说它**没有收敛保证**，循环跑到干净是不可行的（`docs/engineering/code-review.md:70-72`）。应保持 AgentForge 现有的"按风险选择性调用"原则（`implementation-workflow/SKILL.md:109-119`）。
- 不要采用"同一会话自审"模式。mattpocock 文档明确建议换一个干净会话（`docs/engineering/code-review.md:58-60`）——这条与 AgentForge 的 sub-agent 隔离设计天然一致，但落地时要在技能正文里写出来。

---

## 参考来源

- mattpocock-skills 仓库（HEAD `c55ee46`）：`skills/engineering/code-review/{SKILL.md, agents/openai.yaml}`、`docs/engineering/code-review.md`、`README.md`、`CLAUDE.md`、`CONTEXT.md`、`CHANGELOG.md`、`.agents/{invocation.md, writing-docs.md, install-block.md, adr/0001-*.md, adr/0002-*.md}`、`.out-of-scope/*.md`、`.claude-plugin/plugin.json`、`skills/engineering/{implement, to-spec, ask-matt, setup-matt-pocock-skills}/SKILL.md`、`skills/productivity/writing-for-agents/SKILL-MECHANICS.md`
- AgentForge 仓库（HEAD `916d344`）：`README.md`、`docs/architecture.md`、`skills/*/SKILL.md`、`skills/implementation-workflow/references/{quality-gates.md, task-card-template.md}`、`agents/*.md`、`src/index.js`、`tools/doctor.mjs`、`.claude-plugin/plugin.json`
- 本报告未使用网络来源；所有结论均来自上述本地文件的静态阅读与 `git log` / `grep` / `wc` / `find` 实测。
