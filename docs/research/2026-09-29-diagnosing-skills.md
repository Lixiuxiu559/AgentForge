# 研究报告：三个调试/诊断类技能的对比与引入评估

- 日期：2026-09-29
- 研究范围：
  - **mattpocock/skills** HEAD `c55ee46073ed923f86ce59a5eb3b6d895095d1b7`（v1.2.3，2026-09-18）→ `skills/engineering/diagnosing-bugs/`（`SKILL.md` 138 行 + `scripts/hitl-loop.template.sh` 44 行 + `agents/openai.yaml` 3 行）、人类文档页 `docs/engineering/diagnosing-bugs.md`（93 行）、`.agents/invocation.md`
  - **obra/superpowers** HEAD `8ca22dba9a94f28898bbce59f2537ff4d87c747d`（v6.4.2，2026-09-25）→ `skills/systematic-debugging/`（1247 行）、`skills/diagnosing-superpowers/`（857 行）
  - 对照目标：AgentForge 工作区（本报告未改动 AgentForge 任何文件）
- 方法：静态阅读（read / grep / wc / git log）+ GitHub API 核验 issue 与 PR 的实际状态。**未运行任何技能，未调用模型。**
- 研究状态：final

---

## 摘要

用户把三个技能放在一起问，但它们**不是同一类东西**：

| 技能 | 诊断对象 | 同类可比 |
|---|---|---|
| mattpocock `diagnosing-bugs` | **代码缺陷**（一个已知症状） | 与下一行同类 |
| superpowers `systematic-debugging` | **代码缺陷**（任意 bug / 测试失败） | 与上一行同类 |
| superpowers `diagnosing-superpowers` | **agent 会话本身**（为什么这次会话重复劳动、忽略计划、超时烧钱） | 独立类别，无同类 |

前两者是"怎么找到并锁死一个 bug"的方法论，第三者是"怎么复盘一次 agent 会话并产出可提交的证据包"。把第三者和前两者当同类讨论会得出错误结论。

**mattpocock `diagnosing-bugs` 的核心是一个硬门**：没有"能对这个 bug 变红的一条命令"，就不许进入 Phase 2，也不许开始读代码猜原因。它用六阶段 + 阶段间门把"读代码 → 猜原因 → 改一版试试"这条默认路径物理挡住。作者自己把 Phase 1 称为"the skill"，其余五阶段是机械的。

**对 AgentForge 的直接结论**：AgentForge 六个技能里**没有任何一个回答"这个 bug 的根因是什么"**。最接近的 `research` 有"异常排查"一节（列根因假设 + 可验证下一步），但它没有"必须先有一条能变红的命令"这个门——它允许直接开始推断。`implementation-workflow` 的 description 覆盖"修复 Bug"，但它的九个步骤里没有复现与根因阶段，它以"你已经知道要改什么"为前提。

---

## 结论

### 1. 三个技能的定位（事实）

**mattpocock `diagnosing-bugs`**

- frontmatter 只有 `name` 与 `description`（`skills/engineering/diagnosing-bugs/SKILL.md:1-4`），无 `disable-model-invocation`；`agents/openai.yaml` 只有 `interface.display_name` / `short_description` 三行，无 `policy` 块（`skills/engineering/diagnosing-bugs/agents/openai.yaml:1-3`）。按该仓库自己的判定规则（`.agents/invocation.md:4-6, 10-12`），它是**模型可触发**技能。
- 人类文档页确认这一点并给出触发词："Type `/diagnosing-bugs`, or the agent reaches for it on its own… it is model-invoked, and fires on 'diagnose' / 'debug this'"（`docs/engineering/diagnosing-bugs.md:9`）。
- 自称定位是"重"技能："It is heavy by design, and the wrong tool for a question you want answered in one message."（`docs/engineering/diagnosing-bugs.md:11`）
- 人类文档页把明确不适用的情况列成表（`docs/engineering/diagnosing-bugs.md:13-21`）：无具体症状的"瓶颈在哪"不做（那不是诊断，是审计）；未确认的原始 bug 报告先走 `triage`。
- 命名历史：`/diagnose` 在 v1.0.0 改名为 `/diagnosing-bugs`（`CHANGELOG.md:250-252`）。

**superpowers `systematic-debugging`**

- frontmatter 只有 `name` + `description`（`skills/systematic-debugging/SKILL.md:1-4`），description 是 "Use when encountering any bug, test failure, or unexpected behavior, before proposing fixes"；全仓 14 个技能的 frontmatter 都只有这两字段，**没有任何调用抑制字段** → 它是模型可触发，而且是该仓库里最容易被触发的技能之一。
- 它自陈的定位是"任何技术问题"的通用流程（`SKILL.md:24-30` "Use for ANY technical issue"，含时间压力场景 `:32-37`），并被仓库的路由技能列为"Fix this bug"的第一站（`skills/using-superpowers/SKILL.md:31`）。
- **没有显式的不适用章节**。唯一的合法提前出口在 `SKILL.md:266-275`：能证明是环境性/时序性/外部因素时，可"完成过程 + 记录 + 处置 + 加监控"收尾——但紧跟着一句警告：`":275"` 95% 的"找不到根因"其实是调查不完整。
- 核心原则与铁律：`SKILL.md:10` "ALWAYS find root cause before attempting fixes. **Symptom fixes are failure.**"；`:12` "Violating the letter of this process is violating the spirit of debugging."；`:14-18` 铁律块 `NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST`；`:20` 未完成 Phase 1 不得提出修复。
- 四个阶段（`SKILL.md:44-46` "You MUST complete each phase before proceeding to the next"）：Phase 1 根因调查（读错误 → 确认可复现 → 查近期变更 → 多组件系统逐边界取证 → 反向追数据流，`:48-118`）；Phase 2 模式分析（找可工作范例 → **完整读参考实现每一行** → 列**每一处**差异 → 理解依赖与假设，`:120-141`）；Phase 3 假设与验证（`:143-166`）；Phase 4 实施（`:168-212`）。
- **量化约束只有一条：修复尝试次数。** `SKILL.md:191-196`：修复无效 → STOP → 计数 → <3 次回 Phase 1 重新分析，**≥3 次必须停下质疑架构**，且 "DON'T attempt Fix #4 without architectural discussion"；架构病症与"先与人讨论"在 `:198-212`。**技能全文没有任何时间盒**——时间压力是被刻意设计为"抵抗对象"的（`CREATION-LOG.md:38-42`）。
- **它明令禁止列一堆假设**：`SKILL.md:145-150` 的小节标题就是 "Form Single Hypothesis"，要求写成 "I think X is the root cause because Y" 并写下来；`:152-155` 一次只改一个变量；`:157-160` 失败后**换新假设**而不是在旧假设上叠加修复。这与 `diagnosing-bugs` 的"先出 3–5 个排序假设"**正好相反**（见下文对比，两者防的是不同失败模式）。
- 两条**宿主专有交叉引用**：`SKILL.md:177` "Use the `superpowers:test-driven-development` skill for writing proper failing tests"、`:189` "Use the `superpowers:verification-before-completion` skill before claiming success"。这违反 AgentForge 的"零宿主依赖"约束，属于移植时必须改写的地方。
- 三份配套技术文档（打包在技能目录内）：
  - `root-cause-tracing.md`（169 行）给出**具体的 5 步反向追踪算法**（`:32-64`，含一个完整的真实调用链案例：从 `execFileAsync('git', ['init'], {cwd: projectDir})` 一路回溯到 `setupCoreTest()` 返回 `{tempDir: ''}`），并用两张 DOT 图表达决策（`:11-24`、`:132-152`），死路落到标着 "NEVER fix just the symptom" 的红色八边形（`:154`）。追不动时的插桩规则很具体：`new Error().stack` + 在危险操作**之前**记录，且**测试中必须用 `console.error()` 而不是 logger（logger 可能被吞）**（`:85, 158`）。
  - `defense-in-depth.md`（122 行）：**恰好四层**（入口校验 / 业务逻辑校验 / 环境守卫 / 调试埋点，`:20-85`），论点是"单点修复 = We fixed the bug，多层防御 = We made the bug impossible"（`:11-12`），并要求**逐层测试**——试着绕过 L1 以确认 L2 能抓住（`:87-94`）。
  - `condition-based-waiting.md`（115 行）：用条件轮询替代任意 sleep，给了**可直接抄的量化参数**——`timeoutMs = 5000`、`setTimeout(r, 10)` 每 10ms 轮询、超时错误必须带描述（`:65, 77`），并列出"轮询过快（1ms）/ 没有超时 / 用陈旧数据"三类常见错误与修正（`:84-93`）。配套 `condition-based-waiting-example.ts`（158 行）是 **TypeScript + Lace 项目专有**的实现样例（`import type { ThreadManager } from '~/threads/thread-manager'`，`:5-6`），脱离该项目不可运行。
- `find-polluter.sh`（72 行）：找出哪个测试文件制造了污染。它的真实依赖是**写死的 `npm test <单个测试文件>`**（`:51`，排查建议里也是 `:64`），因此只对 npm 生态的 JS/TS runner 有效；文件名与 `RELEASE-NOTES.md:919` 都称它为 "Bisection script"，但代码是**串行线性扫描 + 首次命中即停**（`:38-68`），没有二分逻辑。

**它的"已验证"是弱的（本报告认为这是选择时最该注意的一点）**

- 目录里的 4 个 probe 文件（`test-academic.md` 14 行 + `test-pressure-1/2/3.md` 共 195 行）是**给 subagent 执行的提示词探针，不是自动化测试**：全仓 grep 除文件自身外**零引用**（唯一命中是 `.git/index` 二进制），没有任何 runner 或 CI 调用它们；它们的路径仍然写着历史位置 `skills/debugging/systematic-debugging`（`test-academic.md:3`），与现状 `skills/systematic-debugging/` 不符。
- 三个压力测试都是"真实场景 + 必须当场选 A/B/C"，且**文件内没有标准答案或评分标准**（`test-pressure-1.md:56-58` 等）。
- `tests/systematic-debugging/` 下**只有一个文件** `test-find-polluter.sh`，它验的是那个 shell 脚本的 glob 行为（含对应 issue #2008 的回归、`./` 前缀、`**/` 折叠、空输入不能报 1），**不验方法论**。我抽查确认了这个目录只有这一个文件。
- `CREATION-LOG.md`（119 行）自称四个探针"**All tests passed.** No rationalizations found."（`:75`），并给出四项逐条结果（`:59-73`），但**这是作者单次会话的自述**，在本仓不可复现；同仓的演进也印证技能行为测试已迁往外部 `evals/`，而该 checkout 里**没有** `evals/` 目录。
- 所有绩效数字（"1847 tests passed"、flaky 60%→100%、快 40%）同样是单次会话自述，`root-cause-tracing.md:163-169`、`defense-in-depth.md:112`、`condition-based-waiting.md:109-115`、`condition-based-waiting-example.ts:158` 都是同一批来源。

**结论**：superpowers 的 `systematic-debugging` 是**方法论密度很高、但外部验证很弱**的技能。它值得借鉴的是四份技术文档里的**具体算法与参数**（5 步反向追踪、四层防御、10ms/5000ms 轮询、3 次阈值 + 架构质疑），而不是它的"已验证"叙事。

**superpowers `diagnosing-superpowers`**

- 诊断对象**不是代码，是会话**：frontmatter 原句是 "Use when a **superpowers session went wrong** and your human partner wants to know why — repeated work, ignored plans, stumbles, poor results, a skill that didn't fire, 'it took too long', 'why is it so expensive', 'what is it doing'…"（`skills/diagnosing-superpowers/SKILL.md:3`）。
- 它把"报告"和"诊断"切开，并且**明确拒绝**做归因：`SKILL.md:12-13` "You report; you do not diagnose superpowers. Whoever triages the bundle or the issue decides whether superpowers changes."；`SKILL.md:96-100` "**No superpowers diagnosis.** Report §7 states involvement and stops. Never name a defect in a skill or propose a change."，连给用户建议也禁（`:99-100`）。
- 报告里关于 superpowers 的结论只允许三档：`not indicated | possible | likely`（`templates/report.md:65-70`）。
- 公开定位（`README.md:327`、`RELEASE-NOTES.md:23, 27`）：会话出问题时让 agent "figure out what went wrong with superpowers in this session"，支持当前会话或按 id / 路径指定的历史会话，并声明 "on any harness"。
- **它把"某个技能没有触发"列为一等分析维度**（`SKILL.md:84` → `prompts/skill-timeline.md`），判据是把每轮请求文本与该技能 frontmatter 的 `description` 比对，报"匹配触发条件但该轮没调用""晚了一轮以上才调用"，并被明令**不下对错判断**（`prompts/skill-timeline.md:17-30`）。另有单列一节记录非 superpowers 的插件/技能/MCP/hook（`templates/report.md:63`）。
- 形态：7 步流程（`SKILL.md:19-70`）、11 个 prompt 子 agent 作业（7 个维度分析 + scrub / scrub-audit / similar-session，共 313 行）、4 个模板（274 行）、4 份 reference（134 行），**共 20 个文件 857 行，全部 Markdown，不含任何可执行脚本**（"Pure prose skill for v1. No shipped scripts."，设计文档 `docs/superpowers/specs/2026-08-27-diagnosing-superpowers-design.md:22-24`）。
- 依赖：GitHub 步骤用 `gh`，并规定降级链 `gh` → `curl` → 只把 URL 交给用户（`references/github-issues.md:3-5`）；**其余六步完全本地离线**（设计文档 `:335-336` "Local machine only."）。
- 实测：其结构测试脚本我在本地实跑，**46 PASS / 0 FAIL，exit 0**（`tests/diagnosing-superpowers/test-skill-structure.sh`）。

**一个与本仓库直接相关的先例（落盘位置）**

该技能把全部中间产物写到**用户家目录**，而不是任何仓库目录：`~/.superpowers/diagnosing-superpowers/<session-id>/`（`SKILL.md:33-35`、`templates/case.md:3`、`templates/report.md:3`）。理由被设计文档写死：

> "The workspace is `~/.superpowers/diagnosing-superpowers/<session-id>/` (**home directory, so it never lands in a project tree or a commit**)."
> —— `docs/superpowers/specs/2026-08-27-diagnosing-superpowers-design.md:154-155`

这与 AgentForge 于 2026-09-29 刚确定的落盘规则（`skills/research/SKILL.md`：先复用仓库既有报告目录，兜底 `docs/research/`）**取向相反**。两者不是对错之争，而是产物归属不同：superpowers 的 case/report/bundle 是"用户自己的会话数据 + 中间工作记录"，天然不该进任何仓库；AgentForge 的调研报告是"给这个仓库的结论"，落在仓库里才可复核。这条差异值得记住——它给出了"中间产物不入仓库"的一个成熟先例（见「建议」）。

**四组可移植机制（本报告认为最有价值的部分）**

1. **上下文安全规则**（`references/context-safety.md`，22 行）：读任何会话文件之前先量 `wc -lc` 与长行；**:15-19 明令"绝不 `cat` 或 `grep` 取内容**"，先拿行号与计数，再从具体行取小字段"；单条记录超 500 字符必须收窄（`:20-21`）；会话文件**只读**（`:22`）。理由是"One transcript record can exceed a megabyte… Printing one whole record can overflow the context of the session doing the diagnosis."（`:3-6`）。
2. **脱敏 + 独立审计的双 agent 循环**（`prompts/scrub.md` 29 行 + `prompts/scrub-audit.md` 33 行）：scrub 改写 bundle 内每个文件并写 `scrub-log.md`（只记占位符→类别→计数，**绝不把原值或明文映射写进 log**）；audit 由**另一个** agent 全文重读并只回 `CLEAN` 或 `MISSED`，循环到 CLEAN 才归档（`SKILL.md:60-61`）。脱敏策略本身也成文：8 类占位符表 + 一份**必须保留**的白名单（session id、工具/技能名、install root 相对路径、模型 id、行号），理由是"the bundle is useless without them"（`references/redaction-policy.md:6-19`），并规定"若脱敏抽掉了 finding 的支撑就记录该限制，**不得为通过证据检查而保留敏感值**"（`:27-29`）。
3. **"证据不足即无 finding" 的派发契约**：7 个分析 agent 共用 `prompts/analyst-common.md`，返回格式被写死，且"**The dispatcher discards any finding without a `path:line`**"（`:36-38`），引文限 200 字符（`:29`）。这与 AgentForge `diff-review` 的触发路径硬门槛同源同思路。
4. **落盘 → 审批 → 外发的闸门链**：归档前必须让用户看过 scrub log 与文件清单；发 issue 前必须展示精确文本并获批（`SKILL.md:101-103`）；标签会因无 push 权限被静默丢弃、落款才是耐久标记（`references/github-issues.md:34-36`）。

**与本仓库技能写作规范的对照（值得单独注意）**

它的结构测试是**硬断言**而非建议（`tests/diagnosing-superpowers/test-skill-structure.sh`，151 行，46 条）：`name` 必须与目录名一致；`description` 必须以 `Use when` 开头、≤1024 字符、且**不得含 `dispatch` / `then` / `step` 这类工作流词**（`:31-48`）；正文词数 ≤1000（实测 991，`:50-56`）；必须存在 `## Hard rules` 与 `## Red Flags` 两节（`:58-65`）；已删除的 harness 参考文件必须**保持不存在**且正文不得再引用（`:109-129`）；技能与测试文件里不得出现 `/Users/`、`/home/` 或维护者名字（`:131-138`）；全部 Markdown 不得出现 "the user"，只能说 "your human partner"（`:140-147`）。

对照 AgentForge：`tools/doctor.mjs:259-272` 已经校验 frontmatter 存在、`name` 与目录名一致、`references/xxx` 反引号引用不悬空；`tests/skill-provider.test.mjs:36-38` 也会逐个读取 `references/` 引用。**尚未校验**的是：description 的长度与措辞约束、正文词数预算、必备章节、以及"被删文件不得复活"这类回归断言。前三条正是 superpowers 用测试锁住的东西。

### 2. `diagnosing-bugs` 的机制（事实）

六阶段，阶段之间是**门**不是清单："The phases are gates, not a checklist."（`docs/engineering/diagnosing-bugs.md:44`）

**Phase 1：造一个反馈环**（`SKILL.md:18-66`）

- 该阶段被显式认定为核心："**This is the skill.** Everything else is mechanical."（`SKILL.md:20`）
- 反直觉的要求："Spend disproportionate effort here. **Be aggressive. Be creative. Refuse to give up.**"（`SKILL.md:22`）
- 给了 10 级阶梯（`SKILL.md:24-35`），按偏好排序：① 失败测试 ② curl/HTTP 脚本 ③ CLI + fixture 与已知good快照 diff ④ headless 浏览器脚本 ⑤ 重放抓取的 trace ⑥ 一次性 harness ⑦ property/fuzz 循环 ⑧ bisect harness（可交给 `git bisect run`）⑨ 差分循环（新旧版本同输入 diff）⑩ **HITL bash 脚本，最后手段**（`SKILL.md:35`）。
- 环本身要"收紧"（`SKILL.md:39-47`）：更快、信号更锐、更确定；并给了量化对比——"A 30-second flaky loop is barely better than no loop; a 2-second deterministic one is tight"（`SKILL.md:47`）。
- 非确定性 bug 的目标被重新定义（`SKILL.md:49-51`）：**不要干净复现，要提高复现率**；"A 50%-flake bug is debuggable; 1% is not, so keep raising the rate until it's debuggable."
- 造不出环时的规定动作（`SKILL.md:53-55`）：停下并明说，列出试过什么，向用户要三样之一——(a) 能复现的环境访问权 (b) **脱敏后**的抓取产物（HAR / 日志 / core dump / 带时间戳的录屏）(c) 允许在生产加临时埋点。并且明确禁止："Do **not** proceed to hypothesise without a loop."
- 完成判据是一张四条勾选表（`SKILL.md:59-64`）：Red-capable（断言用户描述的**那个**症状，不是"没报错"）/ Deterministic / Fast（秒级不是分钟级）/ Agent-runnable（人在环里只能通过 `hitl-loop.template.sh`）。
- **硬门**（`SKILL.md:66`）："If you catch yourself reading code to build a theory before this command exists, **stop: jumping straight to a hypothesis is the exact failure this skill prevents.** No red-capable command, no Phase 2."

**Phase 2：复现 + 最小化**（`SKILL.md:68-86`）

- 必须先确认复现的是**用户描述的那个失败**，不是顺路撞见的另一个失败（`SKILL.md:74`："Wrong bug = wrong fix."）
- 最小化是**一次砍一个**元素、每砍一次重跑，只留 load-bearing 的（`SKILL.md:80`）；完成判据是"去掉任何一个剩余元素环就变绿"（`SKILL.md:84`）
- 门（`SKILL.md:86`）："Do not proceed until you have reproduced **and** minimised."

**Phase 3：假设**（`SKILL.md:88-98`）

- 必须先出 **3–5 个排序假设**再测任何一个，理由是单假设会锚定在第一个看起来合理的想法上（`SKILL.md:90`）
- 每个假设必须**可否证**，并写出预测，格式被规定死（`SKILL.md:94`）："If `<X>` is the cause, then `<changing Y>` will make the bug disappear / `<changing Z>` will make it worse."
- 没预测的假设被直接否定（`SKILL.md:96`）："If you cannot state the prediction, the hypothesis is a vibe: discard or sharpen it."
- **这是全技能唯一的人机检查点**：测之前把排序表给用户看（`SKILL.md:98`），但不阻塞——用户不在就按自己的排序继续。

**Phase 4：埋点**（`SKILL.md:100-112`）

- 每个探针必须映射到 Phase 3 的某个具体预测（`SKILL.md:102`），一次只改一个变量
- 工具偏好是名次而非并列（`SKILL.md:104-108`）：① 调试器 / REPL ② 在能区分假设的边界加定向日志 ③ **绝不"打一堆日志再 grep"**
- 日志标记法（`SKILL.md:110`）：每条调试日志带唯一前缀如 `[DEBUG-a4f2]`，于是"清理变成一次 grep"——"Untagged logs survive; tagged logs die."
- 性能分支单独规定（`SKILL.md:112`）：日志通常是错的工具，要先建立基线测量（timing harness / profiler / query plan）再 bisect，"Measure first, fix second."

**Phase 5：修复 + 回归测试**（`SKILL.md:114-128`）

- 回归测试写在修复之前，**但仅在存在"正确的接缝"时**（`SKILL.md:116`）
- 接缝的定义（`SKILL.md:118`）：测试必须能覆盖 bug 在调用点实际发生的模式；太浅的接缝（单调用方测试、无法复现触发链的单测）只会给**虚假信心**
- 没有正确接缝时，这本身就是发现（`SKILL.md:120`）："**If no correct seam exists, that itself is the finding.**"——并注明架构在阻止这个 bug 被锁死
- 有接缝时的五步（`SKILL.md:124-128`）：最小复现转失败测试 → 看它失败 → 修 → 看它通过 → **回到 Phase 1 的原始（未最小化）场景重跑**

**Phase 6：清理**（`SKILL.md:130-138`）

五条必须全部满足：原始复现不再出现 / 回归测试通过（或没有接缝这件事已被记录）/ `[DEBUG-...]` 埋点全部删除（grep 前缀）/ 一次性原型删除或移到明确标记的调试位置 / **正确的那个假设写进 commit 或 PR 消息**（`SKILL.md:138`），理由是"so the next debugger learns"。

**脱敏（`SKILL.md:12-16`）**

- 该节要求展示任何命令、输出、抓取产物前先脱敏，写成 `<REDACTED>`；环要构建在环境变量之上，让凭据留在环境里而不是出现在展示内容里；抓取产物只引带信号的那几行。
- 带一个逃生口（`SKILL.md:16`）："If the redacted output is not enough to diagnose the bug, say so and ask the user."

**配套脚本（44 行）**

`scripts/hitl-loop.template.sh` 只提供两个助手函数：`step`（显示指示、等回车）与 `capture`（提问、把回答读进变量），最后把捕获值打成 `KEY=VALUE` 供 agent 解析（`scripts/hitl-loop.template.sh:11-12, 41-44`）。脚本无框架依赖，纯 `read -r -p`。人类文档页指出 `capture` 会把值回显到终端（agent 正是从那里读），所以约定"capture 用于观察，登录这类动作留给 step"（`CHANGELOG.md:9` 的第三条）。

**模型可触发带来的一手缺陷（事实 + 外部核验）**

- 人类文档页把"在快速提问上误触发"列为**该技能被报告最多的问题**（`docs/engineering/diagnosing-bugs.md:59`），并引用了用户原话与 issue 号。
- GitHub API 核验：issue #578 确实存在且**仍开放**（标题 "Does anyone here use this project's skills with the new gpt-5.6-sol?"，state=open，6 条评论，3 个 👍，2026-07-15 创建）。正文原话与文档页引用**逐字一致**（"the model triggers the rather formal diagnosing-bugs skill instead… This results in considerable reply delays."）——文档页的引用不是转述失真。
- 同一节还承认修复方案（先轻后重地"graduated"）**尚未落地**，临时对策是用户明说"just answer this, don't diagnose"或在自己的 harness 里关掉模型触发。
- 文档页称"Four separate people reported the same shape"（`docs/engineering/diagnosing-bugs.md:59`）——issue 正文作者只有 1 人（bash99），"4 人"这一计数**未核验**（见「未确认项」）。

**其他已核验的未闭合问题**

- issue #124 核验：**仍开放**，标题 "Add user confirmation checkpoint between Phase 4 and Phase 5"，标签 `enhancement` + `ready-for-agent` + `ai-drafted-feedback`。正文指出 Phase 4→5 之间没有暂停，agent 会在用户同意根因之前就写代码；并指出 Phase 3 已有同类门（`docs/engineering/diagnosing-bugs.md:65` 与 issue 正文互相印证）。也就是说：**Phase 3 有人机检查点，Phase 4→5 没有**。
- issue #431（主动式性能扫描）已关闭，当前**没有**对应技能（`docs/engineering/diagnosing-bugs.md:62`）。

### 3. 两处文档漂移（事实，且是本报告独立发现）

**漂移 A：人类文档页说脱敏"未实现"，但技能里已实现**

- 文档页：`docs/engineering/diagnosing-bugs.md:71` 称 issue #674 "It is open and unimplemented. Treat redaction as your job for now."
- issue #674 核验：**确实仍 open**（state=open，0 评论，标签 `ai-drafted-feedback`，2026-07-27 由 geret1 提交，附第三方 fork 分支）。
- 但修复由**另一个** PR 落地：`CHANGELOG.md:7` 记录 v1.2.3 的 PR #779 "Make `diagnosing-bugs` redact secrets"；GitHub API 核验 PR #779 **merged: true**（2026-08-06 合并，3 文件 +20/−2，merge_commit `bb8fdc3`），标题 "fix: make diagnosing-bugs redact secrets"。
- 结论：**代码已修（`SKILL.md:12-16` 的 `## Redact` 段就是它的产物），issue 没关，文档页没改。** 三方状态不一致，其中"未实现"这一说法被 PR #779 与 SKILL.md 同时证伪。

**漂移 B：人类文档页描述了一条已被删除的跨技能交接**

- 文档页仍称：没有正确接缝时"this is what routes the post-mortem to `improve-codebase-architecture`"（`docs/engineering/diagnosing-bugs.md:21`），"it is what routes the post-mortem to `improve-codebase-architecture`"（`:54`），"`improve-codebase-architecture` takes the handoff…"（`:91`）。
- 但技能正文里**完全不含** `improve-codebase-architecture` 字样（全仓 grep 仅命中 `SKILL.md:2` 的 name 行）；Phase 5 只剩一句"Flag this for the next phase"（`SKILL.md:120`），Phase 6 只有清理清单。
- 变更记录给出原因：`improve-codebase-architecture` 是**用户调用**技能（其 frontmatter 有 `disable-model-invocation: true`，`agents/openai.yaml` 有 `policy.allow_implicit_invocation: false`），而"no other skill can call it"是该仓库的不变量；这条交接又"rarely fired in practice"，于是被**整体删除**而非软化（`.changeset/user-invoked-skill-invocation.md:8`）。
- 结论：**技能已按不变量收敛，人类文档页的 3 处描述已过期。**

### 4. 两个代码缺陷诊断技能的机制对比

| 维度 | mattpocock `diagnosing-bugs`（138 行） | superpowers `systematic-debugging`（283 行 + 4 份 reference） |
|---|---|---|
| 进门条件 | **硬门**：必须先有一条"已运行过一次、能对这个 bug 变红"的命令，否则不许进 Phase 2、不许开始猜（`SKILL.md:57-66`） | 原则式要求：必须逐阶段完成（`:44-46`），但**没有可检验的完成物** |
| 复现 | 整个技能的中心：10 级构造阶梯 + 四条量化判据（red-capable / deterministic / fast / agent-runnable） | 只要求"确认可复现"；不可复现时"收集更多数据，不要猜"（`:58-62`） |
| 最小化复现 | 独立阶段，**一次砍一个元素**、每砍一次重跑，直到"去掉任何一个剩余元素就变绿"（`:78-86`） | 只要求"最简单的复现"（`:173`），无系统化削减算法 |
| 假设数量 | **3–5 个排序假设**，每个必须可否证并写出预测；防"锚定在第一个念头上"（`:88-98`） | **单一假设**，明令写下来、失败即换新假设；防"霰弹式乱改"（`:145-160`） |
| 失败重试 | 未规定上限 | **3 次为硬阈值**，≥3 次必须停下质疑架构，禁止第 4 次（`:191-196`） |
| 插桩纪律 | 一次一变量；日志带唯一前缀 `[DEBUG-a4f2]`，**清理变成一次 grep**（`:100-112`） | 一次一变量；多组件系统逐边界取证；测试中必须 `console.error()`（`:70-106`） |
| 与人类交互 | **仅 Phase 3 一个检查点**（展示排序表，不阻塞）；Phase 4→5 无门（issue #124 仍开放） | 多处："先与人讨论"（`:210`）、人类信号 "Stop guessing" / "Ultra-think this" → STOP（`:233-242`） |
| 回归测试 | 修复前写，**但只在"正确接缝"存在时**；没有接缝本身即发现，并转交架构改进（`:114-128`） | 修复前 **MUST** 有失败测试（`:172-176`）；无"接缝不足"逃生口 |
| 清理 | 独立 Phase 6 五条清单，含埋点清除、原型删除、**正确假设写进 commit 消息**（`:130-138`） | 无独立清理阶段 |
| 性能问题 | 显式分支：先建基线测量再 bisect，"Measure first, fix second"（`:112`） | 无专门性能分支（`condition-based-waiting` 面向的是 flaky 等待，不是性能回归） |
| 宿主中立性 | 中立（只说 "your human partner"，只用 git / 常规命令） | **不中立**：硬引 `superpowers:test-driven-development`、`superpowers:verification-before-completion`（`:177, 189`） |
| 配套资产 | 1 个 44 行 HITL 脚本（最后手段） | 3 份技术文档 + 1 个 TS 样例 + 1 个 shell 脚本 + 4 个未接线的探针 + 1 份 CREATION-LOG |
| 外部验证 | 无自动化；作者在人类文档页主动披露 4 个未闭合缺陷（含误触发） | 无自动化；4 个探针未接线、路径失效；绩效数字为单次自述 |

**两者最大的分歧是"假设要几个"，但这不是矛盾，而是针对两种不同的失败模式。** `diagnosing-bugs` 防的是**锚定**（agent 抓住第一个看起来合理的念头不放）；`systematic-debugging` 防的是**霰弹**（agent 一次改好几处、在失败假设上叠加修复）。正确的合成分层是：

> **发散阶段列 3–5 个可否证候选并按预测排序（防锚定）→ 收敛阶段只挑一个、一次只改一个变量去验证（防霰弹）。**

两者共有的硬核是同一句：**先拿到可观察的证据，再允许形成理论**。区别在于 mattpocock 把它做成了**可检验的完成物**（一条已跑过的红命令、一张四格判据表），而 superpowers 停留在原则表述（铁律、"MUST complete each phase"）。就"能否真的挡住 agent 直接猜原因"而言，**可检验的完成物明显更强**——这是本报告认为 `diagnosing-bugs` 的骨架更值得作为移植底座的首要原因。

**superpowers 三个可单独摘取的机制**（细节见上文）：

1. **3 次失败 → 质疑架构**（`SKILL.md:191-196`）。`diagnosing-bugs` 没有这条，而它恰好补上"修了三次还在原地打转"这个真实场景的出口，并且产出物是"架构问题"而不是"第四个补丁"。
2. **5 步反向追踪算法**（`root-cause-tracing.md:32-64`）。`diagnosing-bugs` 只说"instrument"，没给"从症状沿调用链上溯"的具体步骤；这份文档把算法、栈插桩位置、"测试里用 console.error 而不是 logger"这类踩坑细节都写清了。
3. **可抄的量化参数**（`condition-based-waiting.md:65, 77`：timeout 5000ms、每 10ms 轮询、超时必须带描述）。这是三个技能里唯一给出可直接使用的数值的地方。

---

## 分析

### 1. AgentForge 的空白是真实的，而且缺的正好是"门"

AgentForge 现有六个技能逐一对照："给我一个症状，锁死它的根因"这个诉求**没有任何技能承载**：

| 现有技能 | 为什么它不覆盖 |
|---|---|
| `research` | 最近的一个。它的 description 含"日志异常"（`skills/research/SKILL.md:23`），正文也有异常排查段（`:99`）："先确定时间、版本与影响范围，再对照日志、最近变更和调用链，**列出根因假设**及可验证的下一步"。但它是**面向查明事实**的：它允许在没有任何可观察信号的情况下直接进入"列根因假设"——这恰恰是 `diagnosing-bugs` 的 `SKILL.md:66` 要挡住的动作（"jumping straight to a hypothesis is the exact failure this skill prevents"）。 |
| `implementation-workflow` | description 覆盖"修复 Bug"（`skills/implementation-workflow/SKILL.md:3`），但九个步骤从"理解任务"（`:13`）直接到"拆分任务"（`:27`）和"统一验证"（`:67`），**前提是"你已经知道要改什么"**。它的 step 7 是"按项目实际工具运行测试"，属于验证修复，不是定位根因。 |
| `diff-review` | Correctness 轴能发现 bug，但它的对象是**一个已知 diff**，判据是"没有触发路径就不报"（`references/correctness-checks.md:9`）——它评的是改动，不是运行时的症状。 |
| `complexity-audit` / `mutation-testing` | 定量审计（CRAP、存活突变体），与根因定位正交。 |
| `architecture-scout` | 找的是"值得深化的模块边界"，不是某个缺陷的成因；它本身还依赖"已经有一个症状"才会被想起。 |

**缺的不是"检查清单"，而是门与完成物。** AgentForge 已有的纪律（`diff-review` 的触发路径硬门槛）与 superpowers 的 `analyst-common`（无 `path:line` 即丢弃）同源——说明这套"证据不足即无结论"的思路在本仓库已经成立，只是没有用在"诊断一个运行时症状"上。

### 2. 边界归属建议（避免第七个"什么都能干"的技能）

若要新增，边界应这样切，并且写进 description：

- **`research`**：查明事实与证据链（"这个库/配置/日志到底是什么行为"），可以没有症状。
- **新技能（建议名 `bug-diagnosis`）**：给定**一个已描述的缺陷或性能回归**，产出"能变红的命令 + 最小复现 + 已验证的根因"，并锁上回归测试。**只报告根因，不实施修复。**
- **`implementation-workflow`**：拿到根因后实施修复与集成。
- **`diff-review`**：评审修复的 diff（Correctness / Standards / Spec）。

这样切开后，`research` 与它的差异是可判定的：**有没有一个可以变红的命令**。

### 3. 三条来自外部的教训（比机制本身更该记住）

**(a) 模型可触发 + 重流程 = 误触发，这是已被报告最多的缺陷。** mattpocock 的 `diagnosing-bugs` 是模型可触发的，作者在人类文档页把它列为"该技能被报告最多的问题"（`docs/engineering/diagnosing-bugs.md:59`），并在 issue #578（我核验：**仍开放**，6 条评论、3 个 👍）里记录了用户原话，连"修复方案尚未落地"都写明了。**AgentForge 如果照抄模型可触发，就会复现这个缺陷**；`architecture-scout` 已经给出了本仓库的解法（`dsh-model-invocable: false` + Codex `allow_implicit_invocation: false`，见 `docs/architecture.md:29, 31`）。

**(b) 文档漂移是这类"重文档技能"的默认状态。** 我在 `diagnosing-bugs` 上独立发现两处：人类文档页说脱敏"仍未实现"，而 PR #779 已合并（我核验 merged=true）且 `SKILL.md:12-16` 就是它的产物；文档页还描述了一条已被删除的跨技能交接。superpowers 的 `diagnosing-superpowers` 同样有：spec/plan 仍在描述三份已被删除的 harness 参考文件，而测试反过来断言它们必须不存在。**结论：技能正文 + 人类文档 + issue 追踪三者会各自漂移，选择引入时必须明确"以哪个为准"**——AgentForge 的既有做法是 `docs/architecture.md:54`："历史 CHANGELOG 和研究报告保留原时点事实；当前行为以本文件与技能为准"。

**(c) 绩效数字不能当验证。** superpowers 的 4 个探针没有接线、路径失效，`tests/systematic-debugging/` 只验 shell 脚本；"1847 tests passed""60%→100%"都是单次会话自述。**引入时应引它的算法与参数，而不是它的效果叙事。**

### 4. 成本与约束（落地时会被卡住的地方）

- **新增技能会被两个校验点拦住**：`tests/skill-provider.test.mjs:21-24` 断言技能名列表正好是那六个；`tools/doctor.mjs:259-272` 校验 frontmatter 存在、`name` 与目录名一致、`references/xxx` 反引号引用不悬空。新增技能必须同步测试与文档，否则 CI 直接红。
- **AgentForge 不接受宿主专有交叉引用**。`systematic-debugging` 的 `SKILL.md:177, 189` 直接点名 `superpowers:test-driven-development` / `superpowers:verification-before-completion`，这类写法在本仓库不可用（`docs/architecture.md:5, 48`）。
- **`agents/openai.yaml` 只对 Codex 有意义**，Claude Code 与 DSH 都不读；且本仓库不用 `disable-model-invocation`（Codex 校验器不接受，见 `docs/architecture.md:31`），所以"仅用户调用"要靠 `dsh-model-invocable: false` + `allow_implicit_invocation: false` 这一对。
- **中间产物不该落进仓库**。superpowers 把全部工作区放在家目录，理由写得很直白："home directory, so it never lands in a project tree or a commit"（设计文档 `:154-155`）。诊断过程会产生复现脚本、日志片段、临时 harness、`[DEBUG-xxxx]` 埋点——这些**不应该进 `docs/`**，只应把"结论 + 复现命令 + 根因"写进报告。这与 AgentForge 刚定的落盘规则不冲突，而是它的补充：**落盘规则管"报告"，不管"调试中间产物"。**

---

## 置信度

**高**（对三个技能的定位、流程、机制、参数、配套资产与引用关系）。

依据：

- 三个主技能正文（138 + 283 + 120 行）全部逐行读取；superpowers 两个技能的 19 个配套文件由子 agent 逐行读取，我另行抽查了 8 处关键证据，**全部命中**：`diagnosing-superpowers` 的 prompts 实际是 11 个（`ls prompts/` 与 `SKILL.md:3, 12-13, 96-100`、`spec:154-155`）、其结构测试我**亲自重跑**得到 46 PASS / 0 FAIL；`systematic-debugging` 的铁律（`SKILL.md:10-20`）、四阶段（`:44-46`）、单一假设（`:145-150`）、3 次阈值（`:191-196`）、宿主专名交叉引用（`:177, 189`）、probe 零引用与失效路径（`test-academic.md:3`）、`tests/systematic-debugging/` 只有脚本测试、`find-polluter.sh:51` 写死 `npm test`。
- `diagnosing-bugs` 的已知缺陷不是我从文档转述的：issue #578（open，6 评论，3 👍）、#124（open，含 `ready-for-agent` 标签）、#674（open）与 PR #779（merged，2026-08-06，+20/−2）均由 GitHub API 直接核验；文档页引用的用户原话与 issue 正文**逐字一致**。
- 两处文档漂移都是我交叉三方（技能正文 / 变更记录或 PR / issue 状态）后判定的，不是单一来源。

**中**（对"该不该引入"的成本量化部分）。

依据：常驻 token 增量、中文改写后的实际篇幅、doctor 是否要新增校验项、以及技能在真实会话里能否真的挡住"直接猜原因"，**全部没有实测**，只有结构性推断。superpowers 侧"方法论是否有效"在可见范围内**不可证**（探针未接线、`evals/` 不在 checkout），所以我也无法借它来支撑效果判断。

**低**：无。唯一证据薄弱点是 mattpocock 文档页"4 人报告同一形态"的计数，已列入「未确认项」，且它不影响任何结论（结论依赖的是"该问题被作者列为最多报告项"与 issue #578 本身）。

---

## 未确认项

- **未运行任何技能**。本报告全部结论来自静态阅读与 issue/PR 元数据；Phase 1 的"造环"压力在真实会话里是否真的能挡住"直接猜原因"、`[DEBUG-...]` 标记法在长会话里是否真被遵守，均未实测。
- **superpowers 方法论的外部有效性不可证**。4 个 probe 文件在仓内零引用、路径仍指向历史目录 `skills/debugging/systematic-debugging`，`tests/systematic-debugging/` 只验 shell 脚本；技能行为测试据称迁往 `evals/`，但该 checkout 里**没有** `evals/` 目录（浅克隆，`git log` 仅 1 条，无法判定是"从未接线"还是"后续移出仓库"）。
- **所有绩效数字不可复现**："1847 tests passed"、flaky 60%→100%、快 40% 均出自同一次会话的作者自述。
- **"Four separate people reported the same shape"（`docs/engineering/diagnosing-bugs.md:59`）未核验**。issue #578 正文作者只有 1 人；未逐条读它的 6 条评论去数独立报告者。
- **Snyk 结论存在张力，未完全调和**。PR #779 正文说它关掉的是一个 **W007 / HIGH / confidence 0.80** 的 "insecure credential handling" 发现，并把三条凭据泄漏路径讲得很具体；而人类文档页（`:74`）把 Snyk 的告警称为**误报**，理由是扫描器在评估"能力面"（随包发布的 `.sh` + 运行指令 + 出站 HTTP）。两者可能指**不同的发现**，但本报告没有拿到 Snyk 报告原文，无法确认是同一条还是两条。
- **未评估 `triage` 技能**。文档页承认 `triage` 的 step 3 是"diagnosing-bugs Phase 1–2 的一个浅的有界实例"，且两个文件互不提及（`:68`）。若考虑引入，`triage` 是否也该一并评估，未做。
- **未评估 superpowers 其余 13 个技能**（`using-superpowers` 的路由、`writing-skills` 的技能写作规范、`verification-before-completion`、`test-driven-development` 等）是否值得借鉴——超出本次范围。特别是 `writing-skills` 可能与"技能写作规范"这一独立课题强相关。
- **未实测 AgentForge 侧的引入成本**：常驻 token 增量、中文改写后的篇幅、doctor 新增校验项的代价、以及新技能与 `research` 在实战中的边界是否真的可判定。
- **推送状态未处理**：`diagnosing-bugs` 的 PR #779 已合并进 main（v1.2.3）而 issue #674 仍开放，issue 与代码状态长期不一致的原因（是漏关还是有意保留）未确认。

---

## 建议

### 是否引入

**建议引入，但只引入"诊断纪律 + 可检验的门"，落成一个独立、只报告、仅用户主动调用的新技能；不要整包照搬任何一个。** 理由：

- 它填的是 AgentForge **唯一完全缺失**的动作：从"一个已描述的症状"到"已验证的根因"。现有六个技能没有一个承载它（见「分析」§1）。
- 两个源技能的核心方法**零外部依赖**（只用 git / 文件系统 / 常规命令），与 AgentForge 的约束天然兼容；不需要引入网络、CDN 或宿主专有工具。
- 反面：照搬会带进宿主专名交叉引用、失效探针、项目专有 TS 样例、写死 npm 的脚本，以及最要紧的——**模型可触发导致的误触发**（已被报告最多的缺陷）。

### 如何引入（推荐方案 A：独立技能 `bug-diagnosis` + 仅用户调用 + 只报告）

**骨架取自 `diagnosing-bugs`**（因为它的门是可检验的完成物，而不是原则表述）：

- Phase 1 的**硬门**：必须先给出一条**已运行过**、能对这个症状变红的命令，附脱敏后的调用与输出；没有它不许进入下一阶段、不许开始读代码猜原因。
- 10 级构造阶梯（失败测试 → curl → CLI+fixture → headless 浏览器 → 重放抓取 → 一次性 harness → fuzz → bisect harness → 差分 → HITL 脚本）。HITL 脚本可以移植，但要**中文化并声明它是最后手段**。
- 四条完成判据（red-capable / deterministic / fast / agent-runnable）；非确定性缺陷的目标是**提高复现率**而非干净复现。
- 最小化：一次砍一个元素、每砍一次重跑，直到"去掉任何一个剩余元素就变绿"。
- **3–5 个可否证排序假设 + 展示给用户**（唯一的人机检查点）。
- 插桩：一次一变量、调试器优先、日志带唯一前缀、收尾靠一次 grep 清除。
- 性能分支：先建基线测量再 bisect（"Measure first, fix second"）。
- "没有正确接缝"本身作为发现，作为架构问题的输入，**但不自动调用 `architecture-scout`**——本仓库的 `architecture-scout` 是仅用户调用的，与 mattpocock 删掉那条交接的理由完全一致（`.changeset/user-invoked-skill-invocation.md:8`）。
- 收尾清单五条，含"把正确的假设写进 commit 消息"。

**补 `systematic-debugging` 独有、而 `diagnosing-bugs` 缺的两条**：

- **3 次失败 → 停下质疑架构**，禁止第 4 次补丁。
- 从 `root-cause-tracing.md` 摘**5 步反向追踪算法**与插桩细节（在危险操作**之前**记录、测试中用 `console.error` 而非 logger）。

其中与"假设数量"的冲突按上文合成分层处理：**发散时列 3–5 个候选并排序，收敛时一次只验证一个。**

**必须改写或删除的部分**：

- 删除/改写一切 `superpowers:*` 宿主专名交叉引用（`SKILL.md:177, 189`），改为内联最小要求。
- DOT/GraphViz 图改为文字或表格（该仓库无渲染脚本，AgentForge 也不引入新依赖）。
- `condition-based-waiting-example.ts` 删除（依赖 Lace 项目内部路径）；只保留 `condition-based-waiting.md` 的量化参数（5000ms / 10ms / 超时须带描述）。
- **不要**移植 `find-polluter.sh`：它名不副实（称 bisection，实为线性扫描）且写死 `npm test`，只在 npm 生态有效。
- **不要**移植那 4 个未接线的 probe 文件与 `CREATION-LOG.md`；它们不是可运行的验证。
- 脱敏段保留（与 AgentForge 的"证据"纪律一致，且本仓库的 `research` 已经要求如实记录查询范围）。

**落地约束（硬性）**：

1. **调用策略必须是"仅用户主动调用"**：`dsh-model-invocable: false`（对齐 `skills/architecture-scout/SKILL.md:4`）+ `agents/openai.yaml` 里 `policy.allow_implicit_invocation: false`（对齐 `skills/architecture-scout/agents/openai.yaml:4-5`）。依据就是 issue #578——这是该技能被报告最多的问题。
2. **中间产物不进仓库**：复现脚本、日志片段、临时 harness、`[DEBUG-xxxx]` 埋点都应放在调用方指定的临时位置并在收尾时删除；只有"结论 + 复现命令 + 根因 + 未确认项"落盘，位置按 AgentForge 的落盘规则（先复用仓库既有报告目录，兜底 `docs/research/`）。这一点是 superpowers 家目录先例与 AgentForge 落盘规则的**互补**，不是替代。
3. **只报告，不修代码**：修复交 `implementation-workflow`，评审交 `diff-review`。description 里必须写清与 `research` 的分界（有没有"能变红的命令"）。
4. **同步四处**：`tests/skill-provider.test.mjs:21-24` 的技能名列表、`README.md` 技能表、`docs/architecture.md`、`CHANGELOG.md`（按仓库规则这是 MINOR）。

**方案 B（零新增常驻成本）**：只把"红命令门 + 最小化 + 3–5 排序假设 + 日志前缀"做成 `skills/research/references/anomaly-diagnosis.md`，在 `skills/research/SKILL.md:99` 的异常排查段加一行指针。好处是零新增技能与常驻 token；坏处是 `research` 是**模型可触发**的，会把重流程带进日常提问——正是 issue #578 的形态——而且 `research` 的定位是"查明事实"，塞进"锁死缺陷"会让边界变模糊。

**落地形态建议**：采用**方案 A**。诊断是一个可以独立请求的诉求（"这个 bug 为什么会出现"），不应绑在调研技能上；而"仅用户调用 + 只报告"这两个约束正好抵消了方案 A 的主要代价。

### 可选：把技能写作规范变成校验（独立于是否引入）

superpowers 用测试锁住了几件 AgentForge 目前不校验的事，成本很低、收益独立（`tests/diagnosing-superpowers/test-skill-structure.sh`）：

- `description` 必须与目录名的 `name` 一致（AgentForge 已有，`tools/doctor.mjs:265`）；
- `description` **不得含工作流词**（`dispatch` / `then` / `step`）——这正是 `RELEASE-NOTES.md:948` 记的 "Description Trap"：描述只该写触发条件，不该写流程；
- 正文词数预算（该技能用 ≤1000，它实测 991）；
- 必备章节（它要求 `## Hard rules` 与 `## Red Flags`）；
- "已删除的文件不得复活"这类回归断言（它断言三份 harness 参考必须不存在）。

前三条与 AgentForge"description 是模型触发技能的唯一依据"（`tools/doctor.mjs:261`）直接相关，建议单独作为一个课题评估。

### 下一步动作

1. 由你决定：方案 A / B；若走 A，决定技能名（建议 `bug-diagnosis` 或 `root-cause-diagnosis`，与现有英文 kebab-case 一致）。
2. 决定是否同时采纳「可选」里的 description 校验（可独立落地，不依赖 A）。
3. 落地时同步上文"落地约束"第 4 条的四处，并跑 `node tools/doctor.mjs` 与 `npm test`。
4. 若采用 A，建议在 `references/` 内放三份文件：`loop-ladder.md`（10 级构造阶梯 + 四条判据）、`hypothesis-and-instrumentation.md`（假设分歧/收敛 + 插桩纪律 + 日志前缀）、`backward-tracing.md`（5 步反向追踪 + 3 次失败阈值）。注意 `tools/doctor.mjs:270-272` 会校验反引号里的 `references/xxx.md` 必须存在。

### 不建议做的事

- **不要整包照搬 superpowers**：会带进宿主专名交叉引用、失效探针、项目专有 TS 样例、写死 npm 的脚本。
- **不要引入那个"HITL 之外的自动化脚本"**：`find-polluter.sh` 名不副实且生态绑定。HITL 模板可以移植，它是纯 `read -r -p`，无依赖。
- **不要把它做成模型可触发**。这会直接复现 `diagnosing-bugs` 被报告最多的缺陷（issue #578 仍开放）。
- **不要保留"列根因假设"作为起始动作**——那是 `research` 现在的写法（`skills/research/SKILL.md:99`），不是诊断纪律。诊断必须先把"能变红的命令"拿到手。
- **不要把调试中间产物提交进仓库**，也不要让技能写 `CONTEXT.md` / ADR 之类项目文件。
- **不要把 superpowers 的"已验证"叙事当证据**引用（探针未接线、绩效数字为自述）。
- **不要在无 spec / 无参照实现时假装能定位**：`systematic-debugging` 的 Phase 2 依赖"找可工作范例并完整读参考实现"，在没有参照的仓库里该步必须如实降级，而不是编造差异清单。

---

## 参考来源

- mattpocock/skills HEAD `c55ee46073ed923f86ce59a5eb3b6d895095d1b7`（v1.2.3）：
  - `skills/engineering/diagnosing-bugs/{SKILL.md, scripts/hitl-loop.template.sh, agents/openai.yaml}`（逐行读取）
  - `docs/engineering/diagnosing-bugs.md`（93 行，逐行读取）、`.agents/invocation.md`、`.changeset/user-invoked-skill-invocation.md`、`CHANGELOG.md`、`README.md`
- GitHub API（2026-09-29 查询）：`repos/mattpocock/skills/issues/578`（open）、`/issues/124`（open）、`/issues/674`（open）、`/pulls/779`（merged）
- obra/superpowers HEAD `8ca22dba9a94f28898bbce59f2537ff4d87c747d`（v6.4.2）：
  - `skills/systematic-debugging/` 全部 11 个文件（1247 行，逐行读取）
  - `skills/diagnosing-superpowers/` 全部 20 个文件（857 行，逐行读取）
  - `docs/superpowers/specs/2026-08-27-diagnosing-superpowers-design.md`、`docs/superpowers/plans/2026-08-27-diagnosing-superpowers.md`、`tests/diagnosing-superpowers/test-skill-structure.sh`（本地实跑 46/0）、`tests/systematic-debugging/test-find-polluter.sh`、`tests/explicit-skill-requests/`、`RELEASE-NOTES.md`、`README.md`、`docs/testing.md`、各插件清单
- AgentForge 工作区：`docs/architecture.md`、`skills/*/SKILL.md`、`skills/diff-review/references/correctness-checks.md`、`src/index.js`、`tools/doctor.mjs`、`tests/skill-provider.test.mjs`
- **抽查记录**：superpowers 两个技能由子 agent 逐行读取，主 Agent 另抽查 8 处并全部命中（`SKILL.md:3, 12-13, 96-100`、`spec:154-155`、结构测试实跑、`SKILL.md:10-20, 44-46, 145-150, 191-196, 177, 189`、probe 零引用、`find-polluter.sh:51`）。抽查过程中发现并纠正了主 Agent 的一处计数错误（`diagnosing-superpowers` 的 prompt 文件是 **11** 个，不是 14 个；`ls prompts/` 与实际断言一致）。
