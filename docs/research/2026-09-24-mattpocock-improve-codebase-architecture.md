# 研究报告：mattpocock-skills 的 `improve-codebase-architecture` 技能是否值得引入 AgentForge

- 日期：2026-09-24
- 研究范围：
  - 主目标 `/Users/lixiuxiu/development_tool/projects/mattpocock-skills/skills/engineering/improve-codebase-architecture/`
    （`SKILL.md` 71 行 / 5993 B + `HTML-REPORT.md` 123 行 / 6641 B + `agents/openai.yaml` 5 行 / 166 B = 199 行 / 12800 B，目录 `du -sh` = 20K）
  - 对照目标 `/Users/lixiuxiu/development_tool/projects/AgentForge`（`README.md`、`docs/architecture.md`、`skills/*/SKILL.md`、`skills/implementation-workflow/references/quality-gates.md`、`agents/*.md`、`src/index.js`、`tools/doctor.mjs`）
  - 旁证：mattpocock 仓库 `docs/engineering/improve-codebase-architecture.md`（人类文档页，101 行）、`README.md`、`CHANGELOG.md`、`.agents/invocation.md`、`.claude-plugin/plugin.json`、`skills/engineering/codebase-design/{SKILL.md,DEEPENING.md}`、`skills/productivity/grilling/SKILL.md`、`skills/engineering/domain-modeling/SKILL.md`
  - mattpocock 仓库 HEAD = `c55ee46`（`git log --oneline -3` 实测首行），与任务给出的一致
- 研究状态：final
- 方法：纯静态阅读（read / grep / `git log -S` / `wc` / `find`）。**未运行该技能**（需要 Claude Code 与人类交互），未调用模型，未修改任何文件（本报告除外）。

---

## 结论

### 1. 定位

**事实**：该技能解决「**既有代码库里哪些地方该被重构得更"深"**」的问题，方式是扫描代码库找出 **deepening opportunities**（深化机会）——把 shallow module 变成 deep module 的重构机会，目标是**可测试性**与**AI 可导航性**（`skills/engineering/improve-codebase-architecture/SKILL.md:9`）。

- **触发条件**：**用户手动触发**。`SKILL.md:4` 有 `disable-model-invocation: true`，`agents/openai.yaml:4-5` 有 `policy.allow_implicit_invocation: false`，人类文档页写明 "You invoke this by typing `/improve-codebase-architecture`; the agent will not reach for it on its own."（`docs/engineering/improve-codebase-architecture.md:11`）。
- **使用场景**（4 类，`docs/engineering/improve-codebase-architecture.md:15-20`）：例行维护（每几天跑一次）、大改动之前（把它指向 spec，问 "how can we make this change easy?"，文档称这是**最有效的提示词**）、brownfield 审计（大型无结构/vibe-coded 仓库）、legacy 补测试之前先找缺失的 seam。
- **目标用户**：mattpocock-skills 全套流程的使用者。定位是 **periodic maintenance**——「sits outside the build loop: it is not a step in the main loop but something you run periodically to queue up more work」（`docs:13`、`docs:101`）。
- **关键边界**：**它从不改代码**。整次运行只产出「OS 临时目录里的一个 HTML 文件 + 一段对话」，重构本身留到另一个会话走正常 build flow（`docs:5`）。这使它成为 **survey 而非 refactoring tool**（`docs:5`）。

### 2. 结构

**事实**：

- **frontmatter 只有 3 个字段**（`SKILL.md:1-5`）：

  ```yaml
  name: improve-codebase-architecture
  description: Scan a codebase for deepening opportunities, present them as a visual HTML report, then grill through whichever one you pick.
  disable-model-invocation: true
  ```

  没有 `tools`、没有 `license`、没有 `version`。description 是**人类面向**的（一行摘要、无 "Use when the user says…" 触发列表），符合仓库规范 `.agents/invocation.md:5`。

- **正文分 2 层、4 个部分**：
  1. 无标题引言（`SKILL.md:7-14`）：目标 + 两处词汇来源（`codebase-design` 的架构词汇、`CONTEXT.md` 的领域语言）
  2. `## Process`（`SKILL.md:16`）下的三个子节：
     - `### 1. Explore`（`SKILL.md:18-35`）
     - `### 2. Present candidates as an HTML report`（`SKILL.md:37-60`）
     - `### 3. Grilling loop`（`SKILL.md:62-71`）
  正文在 71 行处结束，**没有收尾章节**。

- **完整工作流程**：

| 步 | 动作 | 关键判据/约束 | 行号 |
|---|---|---|---|
| 1a | **先限定范围再扫描（YAGNI）** | 用户点名了方向（模块/子系统/痛点）→ 直接采用并跳过推断；否则 `git log --oneline` 往回走一大段找 hot spots；改动分散无热点则扩大范围 | `SKILL.md:20-23` |
| 1b | 读 `CONTEXT.md` 与 `docs/adr/` | 先读领域词汇表与相关 ADR | `SKILL.md:25` |
| 1c | **spawn 一个 sub-agent 走代码库** | 明令 "Don't follow rigid heuristics; explore organically and note where you experience friction"，给 5 个引导问题 | `SKILL.md:27-33` |
| 1d | 对疑似 shallow 的模块跑 **deletion test** | 「删掉它，复杂度是集中了还是只是转移了？」只有"集中"才是想要的信号 | `SKILL.md:35` |
| 2a | **写自包含 HTML 到 OS 临时目录** | `$TMPDIR` → `/tmp` → `%TEMP%`；文件名 `<tmpdir>/architecture-review-<timestamp>.html`（每次新文件）；理由写死："so nothing lands in the repo" | `SKILL.md:39` |
| 2b | 用 **Tailwind CDN + Mermaid CDN** 渲染 | Mermaid 用于图形化关系，手写 div/SVG 用于"更 editorial"的视觉；每个候选都要有 before/after 可视化 | `SKILL.md:41` |
| 2c | 每张候选卡渲染 6 个字段 | Files / Problem / Solution / Benefits（用 locality 与 leverage 表述 + 测试怎么变好）/ Before-After 并排图 / Recommendation strength badge | `SKILL.md:45-50` |
| 2d | 结尾 **Top recommendation** | 先做哪个、为什么 | `SKILL.md:52` |
| 2e | **ADR 冲突处理** | 候选与既有 ADR 矛盾时，只在摩擦真实到值得重开 ADR 时才提，并在卡上明确标出（amber callout）；不要列每一个 ADR 禁止的理论重构 | `SKILL.md:56` |
| 2f | **停下** | "Do NOT propose interfaces yet. After the file is written, ask the user: 'Which of these would you like to explore?'" | `SKILL.md:60` |
| 3a | **grilling loop** | 用户选定后，调 Skill 工具用 `"grilling"` 走决策树：约束、依赖、深化后模块的形状、seam 后面放什么、哪些测试能存活 | `SKILL.md:64` |
| 3b | 边聊边落副作用 | 新概念 → 加进 `CONTEXT.md`（不存在就惰性创建）；术语变清晰 → 就地更新；用户以"承重理由"拒绝候选 → **提议记一条 ADR**（仅当未来探索者真的需要它才不会重复建议）；想探索替代接口 → 调 `"codebase-design"` 的 design-it-twice 并行 sub-agent 模式 | `SKILL.md:66-71` |

### 3. `HTML-REPORT.md` 的作用

**事实（它是按需资源，不是内联）**：

- `SKILL.md:58` 用 **markdown 相对链接**引用它：`See [HTML-REPORT.md](HTML-REPORT.md) for the full HTML scaffold, diagram patterns, and styling guidance.`
- 它**不是** `references/` 子目录布局，也**没有**被内联进 `SKILL.md`。它是同目录旁文件，靠链接按需加载 —— 与 `codebase-design/{DEEPENING.md,DESIGN-IT-TWICE.md}` 同一手法（`codebase-design/SKILL.md:113-114`）。
- 体积：123 行 / 6641 字节，是 `SKILL.md`（5993 B）的 1.1 倍。

**事实（它定义的输出格式）**：

| 部分 | 内容 | 行号 |
|---|---|---|
| Scaffold | 完整 HTML 骨架：`<script src="https://cdn.tailwindcss.com">` + Mermaid ESM CDN（`mermaid@11`，`theme: "neutral"`，`securityLevel: "loose"`）+ 仅 3 个自定义 class（`.seam` 虚线、`.leak` 红、`.deep` 深色渐变） | `HTML-REPORT.md:7-34` |
| Header | 仓库名、日期、紧凑图例（实线框=module，虚线=seam，红箭头=leakage，深色粗框=deep module）。**"No introduction paragraph. Straight into the candidates."** | `HTML-REPORT.md:36-38` |
| Candidate card | 一个 `<article>`：Title（短、命名这次深化）/ Badge row（`Strong`=emerald、`Worth exploring`=amber、`Speculative`=slate，外加依赖类别 tag：`in-process` / `local-substitutable` / `ports & adapters` / `mock`）/ Files（`font-mono text-sm`）/ Before-After 并排图（"the centrepiece"）/ Problem 一句 / Solution 一句 / Wins 项目符号 ≤6 词 / ADR callout（amber 底一行） | `HTML-REPORT.md:40-55` |
| Diagram patterns | 5 种，明令混用："Pick the pattern that fits the candidate. Mix them. Don't make every diagram look the same."：① Mermaid graph/flowchart（依赖与调用流的主力）② 手搭盒子+SVG 箭头（Mermaid 布局打架时）③ 横截面（分层 shallowness）④ 质量图（interface 矩形 vs implementation 矩形的高度对比）⑤ 调用图折叠 | `HTML-REPORT.md:57-92` |
| Style guidance | editorial 而非 corporate-dashboard；留白充足；颜色克制（一个 accent + 红=泄漏 + amber=警告）；图高约 320px 以便并排；模块标签用 `text-xs uppercase tracking-wider`；**唯一的脚本就是两个 CDN**，报告本身静态 | `HTML-REPORT.md:94-100` |
| Top recommendation | 一张更大的卡：候选名 + 一句为什么 + 锚点链接。"That's it." | `HTML-REPORT.md:102-104` |
| Tone | 只用 codebase-design 词汇：**use exactly** module / interface / implementation / depth / deep / shallow / seam / adapter / leverage / locality；**never substitute** component / service / unit / API / signature / boundary / layer / wrapper。Wins 必须用词汇表术语命名收益，禁止写 "easier to maintain" 或 "cleaner code" | `HTML-REPORT.md:106-123` |

**事实（为什么用 HTML 而不是 Markdown）**：

- 报告的主要信息载体是**图形化对比**，不是散文。`SKILL.md:41` 写 "Each candidate gets a **before/after visualisation**. Be visual."；`HTML-REPORT.md:42` 写 "The diagrams carry the weight. Prose is sparse"。
- 明确要求 Mermaid 与手绘 CSS/SVG **混用**，理由是纯 Mermaid 会显得套路化："don't lean on Mermaid for everything, it'll start to look generic"（`HTML-REPORT.md:3`）。
- 报告刻意写进 OS 临时目录、"so nothing lands in the repo"（`SKILL.md:39`）。HTML 的"重"（CDN、非版本化、需要浏览器）之所以可接受，是因为它是一次性、可丢弃的**展示层**，不是仓库资产。
- 报告写完即被打开（`open` / `xdg-open` / `start`，`SKILL.md:39`），说明它被设计成**给人当场看**的产物，而非给 agent 读的文档。

**推断（值得借鉴还是过度设计）**：

- **HTML 这一层对 AgentForge 是过度设计**，因为它与 AgentForge 的硬约束正面冲突（见问题 6 冲突点 1）：需要网络（两个 CDN）、需要外部命令（`open`）、产物落在临时目录而非仓库。而且 mattpocock 自己的文档承认这是**未修的 open issue**："The report loads Tailwind and Mermaid from CDNs, so it needs network access when you open it, and it breaks silently when something blocks those scripts… Offline and locked-down environments hit the same wall. The agent cannot see this, because it never renders the page."（`docs:60`）
- **但 `HTML-REPORT.md` 里有与渲染无关、可以直接搬到 Markdown 的"信息密度纪律"**，这才是真正值得借鉴的部分：
  - Wins 项目符号 **≤6 词**，且必须用词汇表术语命名收益，禁止 "cleaner code" 这类无信息量的词（`HTML-REPORT.md:52, 121`）
  - "If the diagram needs a paragraph to be understood, redraw the diagram."（`HTML-REPORT.md:55`）
  - "If a sentence could be a bullet, make it a bullet. If a bullet could be cut, cut it."（`HTML-REPORT.md:123`）
  - 固定字段清单（不自由发挥结构）
  - 图例先行、不要引言段落（`HTML-REPORT.md:38`）
- **推断**：一个 Markdown 版本的等价物（固定卡片字段 + 强制引用词汇表术语 + 字数上限）能拿到这份文档约 70% 的价值，代价是失去 before/after 并排图。若要保留可视化，AgentForge 需要另外的可视化机制（见「未确认项」里关于 `archify` 的一条）。

### 4. `agents/openai.yaml` 的内容

**事实（全文 5 行，逐字读出）**（`skills/engineering/improve-codebase-architecture/agents/openai.yaml:1-5`）：

```yaml
interface:
  display_name: "Improve Codebase Architecture"
  short_description: "Find and grill architecture improvements"
policy:
  allow_implicit_invocation: false
```

**事实（它承载什么）**：依据仓库自己的规范文件 `.agents/invocation.md:10`：

> Every skill also carries an `agents/openai.yaml` beside its `SKILL.md`. It holds **Codex UI metadata**: `interface.display_name` and `interface.short_description` for the skill picker, and, for user-invoked skills, the `policy.allow_implicit_invocation: false` that pairs with `disable-model-invocation`.

即：**Codex 侧的技能选择器元数据**；对"用户调用型"技能还额外承载 `policy.allow_implicit_invocation: false`（Codex 侧的 `disable-model-invocation: true` 等价物）。

**事实（是否带 `policy` 块）**：**带**。因此该技能是 **user-invoked（用户触发）**，模型不能自行触发。这一点有三类独立证据互相印证：

1. `agents/openai.yaml:4-5` 有 `policy.allow_implicit_invocation: false`
2. `SKILL.md:4` 有 `disable-model-invocation: true`（`.agents/invocation.md:5` 规定两者必须同步："a skill is user-invoked in both harnesses or neither"）
3. `README.md:192` 的 `**User-invoked**` 分组下、`README.md:197` 列出该技能；人类文档页 `docs:11` 也明说模型不会自己伸手拿它

**事实（仓库统计）**：仓库共 **38** 个 `agents/openai.yaml`，其中 **22** 个带 `policy` 块（grep 实测）。

**事实（AgentForge 侧无消费者）**：AgentForge 两端都不读这个文件 —— DSH 桥接插件只扫 `skills/*/SKILL.md`（`src/index.js:227` 起），doctor 同样只扫技能目录（`tools/doctor.mjs:135-149`）。**该文件在 AgentForge 里是零消费者资产，引入时应直接丢弃。**

### 5. 核心方法论

**事实（判据：什么算"架构需要改进"）**：

- **总判据 = shallow → deep**。"A deep module puts a lot of behaviour behind a small, stable interface. A shallow one leaks its implementation through an interface nearly as wide as the code beneath it."（`docs:36`；定义源在 `codebase-design/SKILL.md:20`）
- **过滤器 1：deletion test**（唯一的硬门）。"Apply the **deletion test** to anything you suspect is shallow: would deleting it concentrate complexity, or just move it? A 'yes, concentrates' is the signal you want."（`SKILL.md:35`）。人类文档页补充说明它是**防止报告退化成通用清理建议**的两道过滤之一："Only the 'concentrates' cases earn a card."（`docs:7`）
- **过滤器 2：YAGNI 热点偏置**。"Deepening a module pays off by making future changes to it easier, so put extra weight on the parts of the codebase that have recently changed."（`SKILL.md:20`；`docs:7` 补：否则就是 "a refactor you will never cash in"）。这一条由 #533 加入，实现细节是"读最近约 20 条 commit message"（`CHANGELOG.md:94`）。
- **shallowness 的三种形态**（`docs:36`，对应 `SKILL.md:29-33`）：① 纯函数只为可测性被抽出，但真 bug 藏在**调用方式**里（没有 **locality**）② 紧耦合的模块**跨 seam 泄漏** ③ 理解一个概念必须来回跳五个小模块。
- **输出侧的判据 = recommendation strength 三档**（`SKILL.md:50`），含义由人类文档页定义（`docs:42-44`）：`Strong` = deletion test 清楚通过且摩擦真实（要认真对待）；`Worth exploring` = 深化合理但回报取决于代码接下来往哪走；`Speculative` = 为了完整性列出，大多数可以安全忽略。

**事实（如何定位改进机会）**：

- 定位方式**刻意不是规则式的**：spawn 一个 sub-agent 走代码库，明令 "Don't follow rigid heuristics; explore organically and note where you experience friction"（`SKILL.md:27`），配 5 个引导问题（`SKILL.md:29-33`）：
  1. 理解一个概念要在很多小模块之间来回跳的地方在哪？
  2. 哪些模块是 **shallow** 的，interface 复杂度几乎等于 implementation？
  3. 哪些纯函数只是为了可测性被抽出，而真正的 bug 藏在它们的调用方式里（没有 **locality**）？
  4. 哪些紧耦合模块**跨自己的 seam 泄漏**？
  5. 代码库的哪些部分没有测试，或难以通过当前 interface 测试？
- 范围推断优先于扫描：用户给了方向就用用户的；否则从 commit history 反推热点（`SKILL.md:20-23`）。

**事实（如何组织改进过程：两段式，带交互）**：

- **不是一次性报告，是"报告 → 选一个 → 逐决策 grilling"三段式**。
- 阶段 2 明确**禁止提前设计**："**Do NOT propose interfaces yet.**"（`SKILL.md:60`），写完文件后停下问 "Which of these would you like to explore?"（`SKILL.md:60`）。
- 阶段 3 才进入 grilling：调 `"grilling"` 技能走**决策树**（约束、依赖、深化后模块的形状、seam 后面放什么、哪些测试能存活，`SKILL.md:64`）。`grilling` 本身的工作方式是"按 **frontier** 轮次提问：每轮问所有前置已定的问题，编号 + 给出推荐答案，然后等用户回答再重算 frontier"（`skills/productivity/grilling/SKILL.md`）。该技能的产物是**决策，不是 diff**（`docs:50`）。
- **副作用在 grilling 中就地发生**（`SKILL.md:66-71`）：4 条规则 —— 新概念写进 `CONTEXT.md`（惰性创建）、术语就地精化、以承重理由被拒的候选提议记 ADR（且明确排除"暂时不值得"这类临时理由和自明理由）、探索替代接口时用 `codebase-design` 的 design-it-twice。

**事实（已知缺陷，仓库自己写出来的）**：

- **grilling loop 是"最响的抱怨"**："One user put it bluntly: they liked it as 'a convenient way to get a thorough analysis of improvements,' and after the grilling loop was added found it 'borderline unusable,' reporting sessions where it proposed a single solution and then asked '10's or 100's of questions.'"（`docs:56`）。设计意图是报告先行、只在用户选定后才 grill，但**弱模型会跳过报告直接开始面试第一个想法**；文档承认 "it is an open issue: the skill does not yet have a documented no-grill mode."（`docs:56`）
- **它很少说"代码没问题"**："The skill is built to output findings, so the framing pushes it toward producing candidates rather than concluding that nothing is wrong. The strength badges are the defence: a report where everything is `Speculative` is the skill telling you it found nothing, in the only way it knows how."（`docs:78-80`）
- **大型 legacy 仓库效果打折**：用户报告 "helped a little but still doesn't seem to cut it"，八年 legacy 仓库上模型会绕圈（`docs:70-72`）
- **TypeScript 落地无答案**：反复被要求一个给出具体文件/模块布局的 `TYPESCRIPT.md`，"and it does not exist"（`docs:86-88`）
- **一次一个候选**：文档建议**一个会话只处理一个候选**，其余转成 ticket；"This is a recurring question with no documented workflow in the skill itself."（`docs:62-64`）

### 6. 能力边界对比

**先给结论：与 AgentForge 现有 5 个技能全部正交或互补，无重叠；它与 `codebase-design` 是明确的配套关系，但方向是"ICA 是 driver、codebase-design 是 reference"，不是两个对等技能。真正的引入障碍不在能力重叠，而在 4 个硬约束冲突。**

| 对照 | 关系 | 依据 |
|---|---|---|
| `complexity-audit`（CRAP 复杂度风险） | **正交，无重叠** | `complexity-audit` 是**定量**的：CRAP 公式 + 阈值 30 + 五语言工具链 + 四级降级等级（`skills/complexity-audit/SKILL.md:21-52`），输入是**可执行工具的输出**（JaCoCo / radon / gocyclo / ESLint / c8），输出是数值与风险排序。ICA **不计算任何指标、不看覆盖率、不跑任何分析工具**，全文只调 git 与文件系统。`complexity-audit/SKILL.md:130` 显式写"不与突变测试、行为验收、通用代码评审重复"——注意它**没有**排除"架构评审"，因为写这条时该维度尚不存在 |
| `diff-review`（三轴代码评审） | **正交，无重叠；时间方向相反** | `diff-review` 的评审对象是**一个 diff**（`skills/diff-review/SKILL.md:11-15`），回答"这段**已发生的改动**有没有 bug / 符不符合规范 / 有没有实现需求"。ICA 不看 diff，看**整个代码库的形状**，产出的是**尚未发生的重构机会**。一个向后看改动，一个向前提机会。唯一表面交集：`diff-review` 的 Standards 轴会读"架构文档里的约定章节"（`skills/diff-review/references/standards-baseline.md:11`），但那是"**符合**已文档化的架构约定"，不是"**提出新的**架构改进" |
| `mutation-testing`（测试有效性） | **正交，但用途互补** | `mutation-testing` 只回答"把生产代码改错，测试会不会失败"（`skills/mutation-testing/SKILL.md:13`），输入是突变工具报告（PIT / mutmut / go-mutesting / Stryker）。ICA 完全不评估测试有效性。互补点：ICA 的 4 个使用场景之一就是"legacy 测试工作——先找缺失的 seam，再对着不可测代码写测试"（`docs:20`），而 `mutation-testing` 报出的"无覆盖代码"发现的正是"没有 seam 可锁"的症状 |
| `implementation-workflow`（实施编排） | **互补，无重叠** | `implementation-workflow` 的 6 项集成检查（`skills/implementation-workflow/SKILL.md:89-96`）全是**编排正确性**（改动是否越界、是否同文件冲突、接口命名是否一致、是否遗漏集成代码、测试是否覆盖真实集成路径、子 agent 报告是否可信）；三轴审计表（`SKILL.md:112-120`）也没有架构维度。AgentForge 的目标流水线 `docs/architecture.md:251-261` 里，阶段 4 是"**架构设计**（产出 Spec + ADR）"——那是**设计新东西**，阶段 7 是"代码评审"，且 `docs/architecture.md:234` 已注明"`code-review` 的位置已由 `diff-review` 占据"。**对既有代码形状做架构审查，AgentForge 5 个技能里一个都没有** |
| `research` | 无关 | — |

**事实（与 `codebase-design` 的配套关系：成立，但是非对称的）**：

- `SKILL.md:13` 明确要求调 Skill 工具用 `"codebase-design"` 取词汇表（**module**、**interface**、**depth**、**seam**、**adapter**、**leverage**、**locality**）与原则（deletion test、"the interface is the test surface"、"one adapter = hypothetical seam, two = real"），并明令 "Use these terms exactly in every suggestion, and don't drift into 'component,' 'service,' 'API,' or 'boundary.'"
- `SKILL.md:54` 报告正文要用它的词汇写；`SKILL.md:71` 想探索替代接口时调它的 design-it-twice 并行 sub-agent 模式。
- 人类文档页给出了两者关系的准确措辞（`docs:24`）："For designing one module you have already chosen, use `codebase-design`: **that is the bench, this is the survey that finds what to put on it.**"
- 且方向不可反转（`docs:76`）："`/codebase-design` is a reference, not a session driver… Pointing a fresh agent at `/codebase-design` as the thing to 'do' is a known failure: with no process of its own to follow, the agent invents one, re-explores code and runs for a very long time before asking you anything. **Drive with this skill; consume that one.**"
- 历史来源（`CHANGELOG.md:235`）："New `codebase-design` skill — the deep-module vocabulary… The language that previously lived in `improve-codebase-architecture/LANGUAGE.md` now lives here, generalized for reuse across skills."
- **本任务假设的"一个找机会、一个做设计"成立，但需要修正为**：ICA 是**会话驱动者**（找机会 + grill 决策），codebase-design 是**被消费的参考**（词汇 + 原则 + 深化手法）。若只引入 ICA 而不引入 codebase-design，ICA 的判据语言必须重写。
- 另外两个配套依赖：`grilling`（`SKILL.md:64`，用户选定后的决策树访谈）与 `domain-modeling`（`SKILL.md:66`，边聊边更新 `CONTEXT.md` 与 ADR）。三者都是 **model-invoked**（`README.md:204-211, 228-230`），因此按 `.agents/invocation.md:8` 的规则"user-invoked 技能可以调 model-invoked 技能"是合法的——**依赖结构本身没问题，问题在于 AgentForge 里这三个技能都不存在**。

**事实（4 个必须处理的冲突点，按严重度排序）**：

1. **网络依赖 —— 硬冲突**。ICA 的报告依赖 Tailwind CDN + Mermaid ESM CDN（`SKILL.md:41`；`HTML-REPORT.md:3, 13-17`）。AgentForge 的设计约束第 1 条是"**零外部依赖** —— 不使用 MCP，不依赖网络，不依赖项目预装工具"（`docs/architecture.md:17`；`README.md:4`）。而且 mattpocock 自己记录了它**静默失败**且 agent 察觉不到（`docs:60`）。
2. **写入行为 —— 硬冲突**。ICA 的 grilling loop 会写 `CONTEXT.md`（不存在就创建）、提议并可能创建 ADR（`SKILL.md:66-70`）。AgentForge 的审计角色是"**只报告、不改码**，从工具层面保证'发现问题'和'实施修复'解耦"（`README.md:91`），且 AgentForge **没有 `CONTEXT.md` / `docs/adr/` 约定**（`docs/architecture.md:16-22` 的"装完即用、零配置"）。
3. **产物位置 —— 冲突**。ICA 刻意把报告写进 OS 临时目录 "so nothing lands in the repo"（`SKILL.md:39`）；AgentForge 的设计约束是"**产物落盘** —— PRD / Spec / ADR / 报告都写进文件，不只在对话里。对话会被压缩，文件不会"（`docs/architecture.md:269`），研究类报告明确进 `docs/research/`（`README.md:316`）。两者对"报告该不该留在仓库里"的判断**完全相反**。
4. **技能依赖与派发机制 —— 实装成本**。① ICA 依赖 3 个 AgentForge 不存在的技能（grilling / codebase-design / domain-modeling）。② `SKILL.md:27` 只说 "spawn a sub-agent"（harness 中立写法，grep 实测全文 **0** 处 `subagent_type` / `Agent tool` / `Explore`），而 AgentForge 的 DSH 侧只有**一个枚举式** `agentforge` 工具（`docs/architecture.md:96-128`），**无法派发匿名 sub-agent** —— 要落地必须新增一个只读 agent（如 `architecture-scout`），或退化为"主 Agent 自己走"。

**顺带澄清两点（与任务预期的偏差，属于事实修正）**：

- **ICA 不依赖 issue-tracker 约定，也不依赖 `.scratch/` 或 `/setup-matt-pocock-skills`**。grep 实测：`.scratch` / `setup-matt` / `issue-tracker` 在 `SKILL.md` 与 `HTML-REPORT.md` 中**均 0 命中**。ICA 只读 `CONTEXT.md` 与 `docs/adr/`，且两者都是"有就用、没有也跑"（`docs:30` 明说 "Prerequisites: None to run it."）。**在这一点上 ICA 比同仓库的 `code-review` 干净得多**（后者才依赖 `docs/agents/issue-tracker.md` 与 `.scratch/`）。
- **ICA 是 user-invoked，而 AgentForge 现有 5 个技能全部 `user-invocable: true`**（`skills/complexity-audit/SKILL.md:4`、`skills/diff-review/SKILL.md:4`、`skills/implementation-workflow/SKILL.md:4`、`skills/mutation-testing/SKILL.md:4`、`skills/research/SKILL.md` 同理）。**这一点一致，不是冲突**。但字段名不同：mattpocock 用 `disable-model-invocation: true`，AgentForge 用 `user-invocable: true`；AgentForge 的桥接层**两者都解析**（`src/index.js:239-242`），移植时按 AgentForge 惯例写 `user-invocable: true` 即可。

### 7. 可复用性

**可以直接复用（与平台、生态无关）**：

- **deletion test** 作为唯一的硬门（`SKILL.md:35`），以及"只有'集中复杂度'的案例才配得上一张卡"这条反噪音规则（`docs:7`）
- **YAGNI 热点偏置**：用户给了方向就采用、否则 `git log --oneline` 反推热点（`SKILL.md:20-23`）。这条对 AgentForge 尤其有价值，因为 AgentForge 现有审计技能的范围确定逻辑是"用户指定 → git 基线 → 询问用户"（`complexity-audit/SKILL.md:60-65`），**没有"热点推断"这一档**
- **5 个"摩擦在哪"的探索问题**（`SKILL.md:29-33`），可以近乎逐字移植
- **recommendation strength 三档 badge 及其含义**（`SKILL.md:50`；`docs:42-44`）—— 这是一种"如何诚实地报告低价值发现"的机制，比"全部当问题报"更克制
- **候选卡的固定字段清单**（`SKILL.md:45-50`）—— 去掉 before/after diagram 后剩下 Files / Problem / Solution / Benefits(locality+leverage+测试怎么变好) / Strength 五段式
- **ADR 冲突处理规则**（`SKILL.md:56`）：只在摩擦真实到值得重开 ADR 时才提，不列每一个理论重构
- **报告与设计分离**："Do NOT propose interfaces yet" + 写完停下问用户（`SKILL.md:60`）—— 这是 ICA 结构上最值得学的一条
- **报告写作纪律**（`HTML-REPORT.md:52, 55, 121-123`）：wins ≤6 词、必须用词汇表术语命名收益（禁 "cleaner code"）、if a bullet could be cut, cut it、if the diagram needs a paragraph, redraw it
- **人类文档页的 `## It's working if` 自检清单**（`docs:90-97`，6 条，全部"不打开 SKILL.md 也能核对"）
- **把已知缺陷公开写进人类文档页**（`docs:54-88`）—— 包括"最响的抱怨"、CDN 静默失败、"很少说代码没问题"、"TS 落地无答案"。这个做法本身就是可借的资产

**依赖 mattpocock 生态（必须改写或直接删除）**：

- **`agents/openai.yaml`（5 行）** —— Codex UI 元数据，AgentForge 两端都不读（`src/index.js:227` 起、`tools/doctor.mjs:135-149`）。**直接丢弃**
- **`CONTEXT.md` + `docs/adr/`** —— ICA 读它们取领域词汇（`SKILL.md:14, 25, 54`），并在 grilling 中写它们（`SKILL.md:66-70`）。AgentForge 无此约定 → 删掉读取（改为"读项目自己的术语文档，没有就用代码里的名字"）与**全部写入**
- **`grilling` / `codebase-design` / `domain-modeling` 三个技能调用**（`SKILL.md:13, 64, 66, 71`）—— 必须内联最小词汇表，或整段裁掉
- **Tailwind CDN + Mermaid CDN + `open`/`xdg-open`/`start`**（`SKILL.md:39, 41`；`HTML-REPORT.md:3, 13-17`）—— 与"零外部依赖/不依赖网络"冲突
- **OS 临时目录产物约定**（`SKILL.md:39`）—— 与"产物落盘"冲突
- **英文 description 与正文** —— AgentForge 现有 5 个技能全部中文（`complexity-audit/SKILL.md:3` 等），需中文化
- **无 em-dash 规则**（仓库级，`CLAUDE.md` 有该约束）—— 语言特定，不适用

**引入代价（估计，未实测）**：

- 新增 1 个技能目录（中文改写后 `SKILL.md` 约 90-120 行）；若保留固定报告格式，建议再放 1 个 `references/report-format.md`
- 若保留 sub-agent 探索：新增 1 个只读 agent（如 `agents/architecture-scout.md`，白名单 `Read, Glob, Grep, Bash`）。**注意 doctor 的只读校验**：若 description 或正文出现"只报告/只读分析/不修改代码"等字样却声明了 Edit/Write，会报 **error**（`tools/doctor.mjs:212-216`）
- 若技能正文用 `` `references/xxx.md` `` 反引号引用旁文件，文件必须真实存在，否则 doctor 报 error（`tools/doctor.mjs:167-169`）
- 常驻 token：+1 个技能 description
- on-invoke：`SKILL.md` 5993 B ≈ 1.5k tok；若一并搬 `HTML-REPORT.md` 再 +6641 B ≈ 1.7k tok
- 版本：按 AgentForge 判据"新增能力属 MINOR"（`README.md:306`）

**收益**：

- 填上 AgentForge **唯一完全缺失的能力维度**：对**既有代码形状**的架构审查。现有 5 个技能中，`complexity-audit` 看"函数风险高不高"、`mutation-testing` 看"测试有没有效"、`diff-review` 看"这次改动对不对"、`implementation-workflow` 管编排、`research` 管取证 —— **没有任何一个回答"这段代码的模块边界该不该重新划"**
- 与现有审计技能**互补而非重叠**：ICA 找"该在哪里加 seam"，`complexity-audit` / `mutation-testing` 回答"这里风险高不高 / 测试有没有效"。三者组合起来，正好覆盖"在哪里改"（ICA）→"改哪里最危险"（CRAP）→"改完测试够不够"（突变）的链条
- 引入的是**判据 + 输出结构**，不是工具链 —— 与"零外部依赖"天然兼容（前提是砍掉 CDN 那一层）

---

## 关键证据

1. ICA frontmatter 3 字段（含 `disable-model-invocation: true`） —— `skills/engineering/improve-codebase-architecture/SKILL.md:1-5`
2. 目标定位（deepening opportunities、testability + AI-navigability） —— `SKILL.md:9`
3. 词汇来源与领域语言来源 —— `SKILL.md:11-14`
4. YAGNI 范围限定 + `git log --oneline` 热点推断 —— `SKILL.md:20-23`
5. 读 `CONTEXT.md` 与 ADR —— `SKILL.md:25`
6. spawn sub-agent + "explore organically" + 5 个探索问题 —— `SKILL.md:27-33`
7. deletion test —— `SKILL.md:35`
8. HTML 报告写 OS 临时目录（"so nothing lands in the repo"）+ `$TMPDIR` 回退 + `open`/`xdg-open`/`start` —— `SKILL.md:39`
9. Tailwind CDN + Mermaid CDN + before/after 可视化 + "Be visual" —— `SKILL.md:41`
10. 候选卡 6 字段 + strength badge 三档 —— `SKILL.md:45-50`
11. Top recommendation 章节 —— `SKILL.md:52`
12. 用 CONTEXT.md 词汇 + codebase-design 词汇 —— `SKILL.md:54`
13. ADR 冲突处理规则 —— `SKILL.md:56`
14. HTML-REPORT.md 的引用方式（markdown 相对链接） —— `SKILL.md:58`
15. "Do NOT propose interfaces yet" + 停下问用户 —— `SKILL.md:60`
16. Grilling loop（调 `"grilling"`） —— `SKILL.md:62-64`
17. 4 条 grilling 副作用规则（写 `CONTEXT.md`、提议 ADR、design-it-twice） —— `SKILL.md:66-71`
18. HTML-REPORT.md 全文（scaffold / header / card / 5 种 diagram pattern / style / tone） —— `HTML-REPORT.md:1-123`
19. Tailwind + Mermaid CDN 与 `securityLevel: "loose"` —— `HTML-REPORT.md:3, 13-17`
20. 自定义 CSS 层只有 3 个 class —— `HTML-REPORT.md:18-24`
21. "No introduction paragraph" —— `HTML-REPORT.md:38`
22. 卡片字段与 badge 配色、依赖类别 tag —— `HTML-REPORT.md:44-53`
23. "If the diagram needs a paragraph to be understood, redraw the diagram." —— `HTML-REPORT.md:55`
24. 5 种 diagram pattern 与"必须混用" —— `HTML-REPORT.md:57-92`
25. 唯一脚本是两个 CDN，报告本身静态 —— `HTML-REPORT.md:100`
26. 词汇表强制（use exactly / never substitute）+ wins 必须用术语 —— `HTML-REPORT.md:106-121`
27. 极简纪律（sentence→bullet、bullet→cut） —— `HTML-REPORT.md:123`
28. `agents/openai.yaml` 全文 5 行，**带** `policy.allow_implicit_invocation: false` —— `skills/engineering/improve-codebase-architecture/agents/openai.yaml:1-5`
29. openai.yaml 的作用定义（Codex UI 元数据 + policy 块与 `disable-model-invocation` 配对） —— `.agents/invocation.md:10`
30. 用户触发 vs 模型触发的规则与 description 写法差异 —— `.agents/invocation.md:5-6`
31. user-invoked 技能不能调另一个 user-invoked 技能，但可调 model-invoked —— `.agents/invocation.md:8`
32. 依赖用"调 Skill 工具"表达 —— `.agents/invocation.md:16`
33. README 把 ICA 列在 `**User-invoked**` —— `README.md:192, 197`
34. README 把 `grilling` / `codebase-design` / `domain-modeling` 列在 `**Model-invoked**` —— `README.md:204-211, 228-230`
35. README 推荐"每几天跑一次" + "It is a survey, not a rescue" —— `README.md:178`
36. 人类文档页：它从不改代码，产物只有 temp HTML + 一段对话 —— `docs/engineering/improve-codebase-architecture.md:5`
37. 人类文档页：两道过滤器（deletion test + 热点偏置） —— `docs:7`
38. 人类文档页：模型不会自己触发 —— `docs:11`
39. 人类文档页：4 个使用场景表 —— `docs:15-20`
40. 人类文档页：与 `codebase-design` / `wayfinder` / `diagnosing-bugs` 的分工 —— `docs:22-26`
41. 人类文档页：Prerequisites = None；只读 `CONTEXT.md` / `docs/adr/`；写 temp HTML + `CONTEXT.md` + ADR —— `docs:30-32`
42. 人类文档页：depth 的定义 + shallowness 三形态 —— `docs:34-36`
43. 人类文档页：badge 三档含义表 —— `docs:40-44`
44. 人类文档页：报告后停下问用户 —— `docs:46`
45. 人类文档页：grilling 的产物是决策不是 diff —— `docs:50`
46. 人类文档页：**grilling loop 是"最响的抱怨"**（"borderline unusable"、"10's or 100's of questions"、无 no-grill 模式） —— `docs:54-56`
47. 人类文档页：**CDN 静默失败是 open issue**（SRI hash 案例、离线/受限环境、agent 看不到） —— `docs:58-60`
48. 人类文档页：一个会话只处理一个候选；无文档化工作流 —— `docs:62-64`
49. 人类文档页：提示词建议（"how can we make this change easy?"） —— `docs:66-68`
50. 人类文档页：大型 legacy 仓库效果打折 —— `docs:70-72`
51. 人类文档页：**"Drive with this skill; consume that one"** + codebase-design 单独驱动是 known failure —— `docs:74-76`
52. 人类文档页：**它很少说代码没问题**（框架逼它产出 finding；badge 是唯一防线） —— `docs:78-80`
53. 人类文档页：Codex/其他 harness 部分可用（声称探索步依赖 `Agent` + `subagent_type=Explore`） —— `docs:82-84`（**该条与 HEAD 的 `SKILL.md:27` 不一致，见「未确认项」**）
54. 人类文档页：TS 落地无 `TYPESCRIPT.md` —— `docs:86-88`
55. 人类文档页：`## It's working if` 6 条自检清单 —— `docs:90-97`
56. 人类文档页：定位为 periodic maintenance、产出是 idea —— `docs:99-101`
57. `codebase-design` 词汇表（module/interface/depth/seam/adapter/leverage/locality）+ 禁止替代词 —— `skills/engineering/codebase-design/SKILL.md:10-28`
58. `codebase-design` 原则：deletion test / interface is the test surface / one adapter vs two —— `codebase-design/SKILL.md:62-65`
59. `codebase-design` 的旁文件引用方式（`DEEPENING.md` / `DESIGN-IT-TWICE.md`） —— `codebase-design/SKILL.md:111-114`
60. `DEEPENING.md`：4 个依赖类别（in-process / local-substitutable / ports & adapters / mock）+ seam 纪律 + replace-don't-layer —— `codebase-design/DEEPENING.md:5-37`
61. `grilling` 的 frontier 轮次机制 —— `skills/productivity/grilling/SKILL.md`（全文）
62. `domain-modeling` 是 model-invoked，主动改写 `CONTEXT.md` 与 ADR —— `skills/engineering/domain-modeling/SKILL.md:1-4`
63. CHANGELOG：subagent 派发指令已剥离 CC 工具名（#781，涉及 code-review / codebase-design / ICA） —— `CHANGELOG.md:13`
64. CHANGELOG：YAGNI 范围过滤器加入 ICA 的 Explore 步（#533，读最近约 20 条 commit） —— `CHANGELOG.md:94`
65. CHANGELOG：`codebase-design` 的词汇原本住在 `improve-codebase-architecture/LANGUAGE.md` —— `CHANGELOG.md:235`
66. CHANGELOG：ICA 现在从 `/codebase-design` 取架构词汇、从 `/domain-modeling` 取领域模型 —— `CHANGELOG.md:237`
67. CHANGELOG：`policy.allow_implicit_invocation: false` 是 `disable-model-invocation: true` 的 Codex 等价物 —— `CHANGELOG.md:31`
68. CHANGELOG：该字段在 Codex 侧确实生效的反向证据（#766 从 writing-for-agents 删掉它） —— `CHANGELOG.md:21-23`
69. ICA 在插件清单中（promoted） —— `.claude-plugin/plugin.json:26`
70. 仓库共 38 个 `openai.yaml`，22 个带 `policy` 块（grep 实测） —— 本报告实测
71. ICA 全文 0 处 `.scratch` / `setup-matt` / `issue-tracker`（grep 实测） —— 本报告实测
72. ICA 全文 0 处 `subagent_type` / `Agent tool` / `Explore`（grep 实测，仅命中 `### 1. Explore` 标题） —— 本报告实测
73. ICA 三个文件 71 + 123 + 5 = 199 行 / 12800 B，目录 `du -sh` = 20K（实测） —— 本报告实测
74. "Grilling loop" 首次出现在 `62f43a1`（2026-04-28，"Add new skills for TDD, issue management, PRD creation, and productivity tools"） —— `git log -S "Grilling loop"` 实测
75. AgentForge 技能清单（5 个，全部 `user-invocable: true`） —— `docs/architecture.md:204-214`、`README.md:71-79`
76. AgentForge 子 agent 清单（5 个，3 个只读） —— `docs/architecture.md:216-224`、`README.md:81-89`
77. AgentForge 只读边界承诺 —— `README.md:91`、`docs/architecture.md:221-224`
78. AgentForge 零外部依赖 / 不依赖网络 —— `docs/architecture.md:17`、`README.md:4`
79. AgentForge 装完即用、零配置 —— `docs/architecture.md:16-22`
80. AgentForge 产物落盘约束 —— `docs/architecture.md:269`
81. AgentForge 目标流水线 9 阶段（阶段 4 架构设计、阶段 7 代码评审） —— `docs/architecture.md:251-261`
82. AgentForge 阶段 7 的位置已由 `diff-review` 占据 —— `docs/architecture.md:234`
83. `complexity-audit` 的 CRAP 判据与四级降级 —— `skills/complexity-audit/SKILL.md:21-52`
84. `complexity-audit` 的范围确定逻辑（无热点推断档） —— `skills/complexity-audit/SKILL.md:60-65`
85. `complexity-audit` 显式排除"通用代码评审" —— `skills/complexity-audit/SKILL.md:130`
86. `mutation-testing` 的目标问题与显式排除项 —— `skills/mutation-testing/SKILL.md:13, 127`
87. `diff-review` 三轴定义与不合并规则 —— `skills/diff-review/SKILL.md:11-23`
88. `diff-review` Standards 轴读"架构文档里的约定章节" —— `skills/diff-review/references/standards-baseline.md:11`
89. `implementation-workflow` 阶段 6 的 6 项集成检查 —— `skills/implementation-workflow/SKILL.md:89-96`
90. `implementation-workflow` 三轴质量门表（无架构维度） —— `skills/implementation-workflow/SKILL.md:112-120`、`references/quality-gates.md:60-90`
91. AgentForge 技能/agent 目录结构与 `references/` 约定 —— `README.md:225-243`
92. doctor 的技能校验（frontmatter、name 与目录名一致、`references/` 悬空） —— `tools/doctor.mjs:135-169`
93. doctor 的只读 agent 校验（声称只读却声明写工具 = error） —— `tools/doctor.mjs:212-216`
94. 桥接层同时解析 `disable-model-invocation` 与 `user-invocable` —— `src/index.js:239-242`
95. DSH 侧只有一个枚举式 `agentforge` 工具（无匿名 sub-agent 通道） —— `docs/architecture.md:96-128`、`README.md:103-106`
96. AgentForge 版本号判据（新增能力 = MINOR） —— `README.md:306`
97. 前次同类研究报告（`code-review` 的引入评估） —— `docs/research/2026-09-23-mattpocock-code-review.md`

---

## 分析

**事实如何支持"值得引入方法论骨架、不值得整包引入"这个结论**：

1. **能力空位是真实的，而且比 `code-review` 那次更彻底。** `code-review` 那次填的是"评审一个 diff"的空位，而 ICA 填的是"审查既有代码的**形状**"。逐条核对 AgentForge 现有 5 个技能：`research` 取证、`implementation-workflow` 编排、`diff-review` 评审 diff 三轴、`complexity-audit` 定量 CRAP、`mutation-testing` 测试有效性 —— **没有任何一个产出"这段代码的模块边界该重新划"这类判断**。`docs/architecture.md:251-261` 的目标流水线里，阶段 4 是"架构设计（产出 Spec + ADR）"，即**设计新东西**；对既有代码的架构复查在流水线里**根本没有位置**。→ 引入填的是设计空位，不是新增冗余。

2. **正交性可以从"输入/输出/时间方向"三层论证，不只是措辞。** `complexity-audit` 与 `mutation-testing` 都建立在**可执行工具的输出**上（JaCoCo / radon / PIT / Stryker），产出数值与统一状态映射；`diff-review` 建立在**一个 diff**上，产出带引用的定性 finding。ICA 的输入是**整个代码库的形状 + commit 历史热点**，产出是**带 before/after 图的未来重构候选**，且全文不调用任何分析工具（只调 git 与文件系统）。三者的输入、输出、时间方向都不同。→ 无重叠。

3. **配套依赖关系可硬证明，且方向被文档明确钉死。** `SKILL.md:13` 是"调 Skill 工具用 `codebase-design`"的**操作性指令**（符合 `.agents/invocation.md:16` 的依赖表达规范），`docs:24` 用 "that is the bench, this is the survey" 定位两者，`docs:76` 用 "Drive with this skill; consume that one" 钉死方向，`CHANGELOG.md:235` 记录词汇原本就住在这个技能里。→ "一个找机会、一个做设计"成立，但**非对称**：ICA 是 driver，codebase-design 是可被消费的 reference。移植时若只搬 ICA，必须补一份最小词汇表，否则 `SKILL.md:13` 与 `SKILL.md:54` 的词汇要求会指向空。

4. **冲突点集中在"约束层"，不在"方法论层"，这决定了引入形态。** 4 个冲突点（网络依赖、写入 `CONTEXT.md`/ADR、产物落 temp dir、3 个不存在的技能依赖）全部位于**运行环境与生态约定**，而 ICA 的**判据本身**（deletion test、热点偏置、5 个探索问题、badge 三档、卡片字段、ADR 冲突规则、报告/设计分离）**零外部依赖**。→ 正确的动作是"换一层壳"，不是"改判据"。这也解释了为什么 mattpocock 自己在 `docs:60` 给出同样的对策："The workaround is to ask for inline CSS and hand-built SVG diagrams instead of the CDN scaffold."

5. **`HTML-REPORT.md` 的价值需要分层看：渲染层是过度设计，纪律层是可移植资产。** 渲染层（Tailwind CDN + Mermaid CDN + `open` 命令 + temp dir）与 AgentForge 的零依赖/落盘约束正面冲突，且 mattpocock 承认它**静默失败且 agent 察觉不到**（`docs:60`）——这是一个"设计者无法观测自己产物"的结构性缺陷。但纪律层（固定字段、wins ≤6 词、必须用术语命名收益、if a bullet could be cut cut it、if the diagram needs a paragraph redraw it）是**平台无关的信息密度约束**，而且它解决的是一个 AgentForge 报告体系同样面对的问题：审计报告容易退化成啰嗦的散文。→ 该文件"值得借鉴约 30%，其余是过度设计"。

6. **"它很少说代码没问题"这一条是最需要引进来的元规则。** `docs:78-80` 直白承认："The skill is built to output findings, so the framing pushes it toward producing candidates rather than concluding that nothing is wrong. The strength badges are the defence." 这对 AgentForge 有直接价值：`complexity-audit` / `mutation-testing` / `diff-review` 都是"被要求跑就必须产出 finding"的结构，**只有 `diff-review` 有一条"宁少勿多——不确定就不报"（`diff-review/SKILL.md:49`）和"diff 为空就报告无内容可评审"（`SKILL.md:68`）**。ICA 用 **strength badge 三档**给出了另一种、更结构化的诚实降级机制。→ 这条机制可以独立于 ICA 移植进现有审计技能。

7. **grilling loop 是负资产，应明确不引入。** `docs:56` 记录它是"the loudest complaint"、有用户称加进来后 "borderline unusable"、弱模型会跳过报告直接开始面试第一个想法、且"the skill does not yet have a documented no-grill mode"。同时它在 AgentForge 里还有额外成本：依赖不存在的 `grilling` 技能 + 会写 `CONTEXT.md`/ADR（违反只读边界）+ 依赖匿名 sub-agent。→ 引入时应把阶段 3 整段裁掉，只保留"报告写完停下问用户选哪个"（`SKILL.md:60`）这个**交互点**，把后续决策交给 AgentForge 已有的 `implementation-workflow`。

8. **`archify` 这个旁证需要单独标注。** 本会话的技能目录里存在一个 `archify` 技能（"Create polished, validated architecture, workflow, sequence, data-flow, and lifecycle/state diagrams as explorable standalone HTML…"），它能承担 ICA 报告里的可视化部分且输出**独立 HTML**。但它**不在 AgentForge 仓库文件树里**（`find` 实测只有 5 个技能目录）。→ 它可能是一个现成的替代渲染层，但归属未确认，列入「未确认项」。

9. **一次事实修正：ICA 比预期干净。** 任务描述预期它依赖 "issue-tracker 约定、`.scratch/`、`/setup-matt-pocock-skills`"，但 grep 实测三者在 `SKILL.md` 与 `HTML-REPORT.md` 中**均 0 命中**。它的 Prerequisites 是 "None to run it."（`docs:30`），只读 `CONTEXT.md` 与 `docs/adr/` 且"有就用没有也跑"。→ 这**降低了引入代价**（不需要裁剪 issue-tracker 依赖，那是 `code-review` 的问题），也说明该技能在 #781 那轮 harness 中立化里被清理得比较彻底。

10. **另一处需要记录的文档漂移（不是技能缺陷）。** `docs:84` 声称 "The exploration step names Claude Code's `Agent` tool with `subagent_type=Explore` directly"，但 HEAD 的 `SKILL.md:27` 只写 "Then spawn a sub-agent to walk the codebase"，全文 grep `subagent_type` / `Agent tool` / `Explore` **0 命中**（除 `### 1. Explore` 标题）。结合 `CHANGELOG.md:13`（#781 已合并，"Drop Claude Code's tool and agent-type names…"），可判定**技能已修好、人类文档页这一条已过期**。→ 该技能的 harness 中立性比文档自述的更好，这是引入的**有利**证据。

---

## 置信度

**高**（对问题 1、2、3、4、6 的结论）。

原因：

- 主目标全部 199 行（71 + 123 + 5）已**逐行读取**，所有引用都能定位到具体行号。
- 问题 4（openai.yaml 的用途与触发类型）有**三类独立证据**交叉验证：仓库规范文件（`.agents/invocation.md:5, 10`）+ 文件自身内容（`agents/openai.yaml:1-5`）+ README 分组（`README.md:192, 197`）。不是从文件名或命名习惯猜的。
- 问题 3（HTML 报告是内联还是按需）是**直接观察**：`SKILL.md:58` 是 markdown 相对链接，且 `HTML-REPORT.md` 是独立文件（实测 123 行 / 6641 B）。
- 问题 6 的边界判断同时有正面证据（ICA 的判据内容、`docs:24` / `docs:76` 的配套定位）和反面证据（AgentForge 两个审计技能各自显式排除代码评审、`diff-review` 的 Standards 轴只管"符合已文档化的架构约定"、`docs/architecture.md:251-261` 流水线里没有既有代码架构复查阶段）。

**中**（对问题 5 中"已知缺陷严重程度"、问题 7 中"引入代价"的量化部分）。

原因：

- 已知缺陷（grilling loop 是"最响的抱怨"、CDN 静默失败、很少说代码没问题、legacy 仓库效果打折）全部来自**仓库自述的用户反馈转述**，本报告未回溯原始 issue 或用户原帖，属二手证据。这些描述影响的是"该不该引入 grilling loop"与"该不该保留 HTML 层"这两个**已经由硬约束冲突独立支持**的判断，所以不改变核心结论。
- 引入代价的量化（常驻 token 增量、中文改写后的实际篇幅、doctor 是否需要新增校验项、DSH 侧工具描述膨胀）**全部没有实测**，只有结构性推断。

**低**：无。

原因：本报告未做出任何低置信度结论。唯一一个证据薄弱点（`docs:84` 与 `SKILL.md:27` 的矛盾）已经通过 grep + CHANGELOG 交叉验证判定为"文档漂移"，结论可靠；若仍有疑虑，已列入「未确认项」。

---

## 未确认项

- **未运行该技能**。本机没有 Claude Code 交互环境，全部结论来自静态阅读。以下行为无法实测：HTML 报告在浏览器里的实际观感、grilling loop 在真实会话中的节奏、`SKILL.md:27` 的 "spawn a sub-agent" 在 Claude Code 里是否真的会派发 sub-agent（还是主 Agent 自己走）。
- **`docs:84` 与 `SKILL.md:27` 的矛盾未做官方核验**。本报告判定为"人类文档页过期、技能已 harness 中立"，依据是 `CHANGELOG.md:13`（#781 已合并）+ grep 0 命中。未做的一步：回溯 PR #781 的 diff 确认它确实删掉了 `subagent_type=Explore`。
- **`grilling` 与 `docs:56` 的时间线未完全对齐**。`git log -S "Grilling loop"` 显示 "Grilling loop" 一词首次出现在 `62f43a1`（2026-04-28），但 `docs:56` 把它描述为"后加的功能"并称是最响的抱怨。本报告未能定位"grilling loop 被加入 ICA"的确切提交与其对应的 CHANGELOG 条目。
- **`agents/openai.yaml` 的字段语义无法仅从文件本身确定**。该文件只有 5 行 YAML，无注释、无 schema、无版本声明。本报告采用的"Codex UI 元数据 + policy 块 = user-invoked"结论来自 `.agents/invocation.md:10` 与 `CHANGELOG.md:21-23, 31`——**是仓库自述，不是官方规范核验**。未做的一步：查 Codex 官方文档确认 `interface.display_name` / `interface.short_description` / `policy.allow_implicit_invocation` 的确切语义与生效范围。（附注：无论 Codex 行为如何，AgentForge 两端都不读该文件，所以都应丢弃。）
- **未实测 HTML 报告在无网络/受限环境下的具体失败形态**。结论完全依赖 `docs:60` 的自述（SRI hash 案例、离线环境、agent 无法察觉）。
- **`archify` 技能的归属未确认**。它出现在本会话的可用技能目录中，描述与 ICA 的可视化层高度重合（独立 HTML、inline SVG、dark/light 主题、导出），但**不在 AgentForge 仓库文件树里**（`find` 实测只有 5 个技能目录）。若它可被 AgentForge 复用，则 ICA 的"可视化"部分有现成替代方案；若不可复用，则该部分需自行实现或放弃。
- **未评估 `codebase-design` 是否也应一并引入**。它是 ICA 的词汇来源与深化手法来源（`DEEPENING.md` 的 4 个依赖类别、seam 纪律、replace-don't-layer 测试策略）。不引入它，ICA 的判据语言必须重写；引入它，则要评估它是否**自身可被独立驱动**（`docs:76` 说不能——"known failure"）。这是一个独立的研究题目，超出本次范围。
- **未评估 AgentForge 引入后的实测成本**：常驻 token 增量（`claude plugin details`）、doctor 是否需要新增校验项、DSH 侧 `agentforge` 工具描述膨胀的影响、中文改写后的实际篇幅，均未实测。
- **未核对全部 38 个 `openai.yaml` 的 policy 块与 README 的 User-invoked / Model-invoked 列表是否一一对应**。只核对了 ICA 这一个（带 policy ↔ `README.md:192, 197` 列在 User-invoked）。
- **未评估 mattpocock 仓库其他技能**（`wayfinder`、`diagnosing-bugs`、`to-spec`、`to-tickets`、`domain-modeling`、`codebase-design`）是否同样值得引入——超出本次范围。
- **未验证 `docs` 页中"12 个候选""50-plus agents"等用户报告的真实性**——它们来自该仓库文档转述的 issue/用户反馈，本报告未回溯原始 issue。

---

## 建议

### 是否引入

**建议引入，但只引入「判据 + 报告结构」，不引入 HTML 渲染层、不引入 grilling loop、不引入 `CONTEXT.md`/ADR 写入。** 理由：

- 它填的是 AgentForge **唯一完全缺失**的能力维度：对**既有代码形状**的架构审查。现有 5 个技能没有一个回答"模块边界该不该重新划"。
- 它的**判据层零外部依赖**（只调 git 与文件系统），与 AgentForge"零外部依赖"天然兼容。
- 4 个冲突点全部位于约束层而非方法论层，用"换壳"即可解决，不需要改判据。
- 反面：整包照搬会带进网络依赖、写入 `CONTEXT.md`/ADR、temp dir 产物、3 个不存在的技能依赖，以及一个被作者自己称为"最响的抱怨"的 grilling loop。

### 如何引入（推荐方案 A：独立技能 + 只读 agent）

**内容裁剪**：

- **保留**：deletion test 作为唯一硬门；YAGNI 热点偏置（`git log --oneline` 反推热点）；5 个"摩擦在哪"的探索问题；recommendation strength 三档 badge 及其含义；候选卡固定字段（Files / Problem / Solution / Benefits(locality+leverage+测试怎么变好) / Strength）；ADR 冲突处理规则；"报告写完停下问用户选哪个"这个交互点；报告写作纪律（wins ≤6 词、必须用术语命名收益、if a bullet could be cut cut it）。
- **删除**：Tailwind CDN + Mermaid CDN + `open`/`xdg-open`/`start`；`CONTEXT.md` / `docs/adr/` 的**全部写入**（读取可保留为"若项目已有术语文档则采用其命名，否则用代码里的名字"）；`grilling` / `domain-modeling` / `codebase-design` 三个技能调用（改为内联一份最小词汇表）；`agents/openai.yaml`；英文 description 与正文。
- **改写**：报告产物从 `<tmpdir>/architecture-review-<timestamp>.html` 改为 **Markdown 落盘到 `docs/research/YYYY-MM-DD-架构深化机会.md`**（对齐 AgentForge 的"产物落盘"约束 `docs/architecture.md:269` 与 `README.md:316`）；before/after 并排图改为**文字化的 before/after 对照**（如"改前：interface 4 个方法 / 改后：1 个方法，3 个 wrapper 吸收进实现"）或 Mermaid 源码块（不依赖 CDN 渲染）；frontmatter 用 `user-invocable: true`（与现有 5 个技能一致，`src/index.js:239-242` 两者都解析）。
- **命名**：不要沿用 `improve-codebase-architecture`（英文长名与现有中文命名风格不一致）。建议 `architecture-review` 或 `architecture-deepening`。

**必须解决的 2 个适配点**：

1. **派发机制**：`SKILL.md:27` 的 "spawn a sub-agent" 在 DSH 侧无对应物（`docs/architecture.md:96-128` 只有一个枚举式 `agentforge` 工具）。建议新增只读 agent `agents/architecture-scout.md`（白名单 `Read, Glob, Grep, Bash`，形如 `agents/complexity-auditor.md:4`），由技能通过 `agentforge` 工具调用；或在技能里写明"环境无可用子 agent 时由主 Agent 串行探索，不要假装已委派"（照 `implementation-workflow/SKILL.md:85` 的既有写法）。
2. **词汇表**：不引入 `codebase-design` 的前提下，必须在技能内联一份最小词汇表（module / interface / depth / deep / shallow / seam / adapter / leverage / locality + 禁止替代词），否则 `SKILL.md:13` 与 `SKILL.md:54` 的词汇要求会指向空。建议放 `references/vocabulary.md`（注意 `tools/doctor.mjs:167-169` 会校验反引号 `references/xxx.md` 引用是否悬空）。

**方案 B（零新增常驻成本）**：只把 deletion test + YAGNI 热点偏置 + 5 个探索问题 + strength badge 三档做成 `skills/complexity-audit/references/architecture-deepening.md`，并在 `complexity-audit/SKILL.md` 里加一行指针。好处：零新增技能与 agent、零新增常驻 token；坏处：无法独立使用、与复杂度审计强绑定（而两者的判据维度其实不同）、且 `complexity-audit/SKILL.md:130` 明确声明"不与……通用代码评审重复"，把架构审查塞进去会造成边界模糊。

**落地形态建议**：采用**方案 A**。理由是 `docs/architecture.md:270` 的设计约束 4 明确"用户只要求单阶段时（如「只评审」）只跑那一段"——架构审查是一个可独立请求的诉求（"看看这个仓库的结构"），不应绑在复杂度审计上。

### 下一步动作

1. 由主 Agent 决策方案 A / B，以及是否接受新增 1 个只读 agent。
2. 若走方案 A，需同时决定：报告落盘路径（`docs/research/` vs 其他）、是否保留可视化（若保留，先确认 `archify` 是否可复用，见「未确认项」）。
3. 决策后交给 `implementer` 落地；落地时必须跑 `node tools/doctor.mjs`（校验 frontmatter、name 与目录名一致、`references/` 悬空引用、只读 agent 白名单，见 `tools/doctor.mjs:135-216`）。
4. 按 AgentForge 版本判据，这是一次 **MINOR** 变更（`README.md:306`），需同步 `CHANGELOG.md`、`README.md` 技能表与 token 成本表、`docs/architecture.md` §7「当前实装」清单。
5. 若决定引入 `codebase-design` 的深化手法（`DEEPENING.md` 的 4 个依赖类别），需先单独研究它能否被独立驱动——`docs:76` 说不能。

### 不建议做的事

- **不要整包照搬**（会带进 CDN 网络依赖、`CONTEXT.md`/ADR 写入、temp dir 产物、3 个不存在的技能依赖）。
- **不要引入 grilling loop**（`SKILL.md:62-71`）。它是作者自己承认的"最响的抱怨"（`docs:56`），且在 AgentForge 里额外违反只读边界。保留"报告后停下问用户"这一个交互点即可，后续决策交给 `implementation-workflow`。
- **不要保留 HTML + CDN 渲染层**。mattpocock 自己承认它**静默失败且 agent 察觉不到**（`docs:60`），而 AgentForge 的约束是"不依赖网络"（`docs/architecture.md:17`）。若确实需要可视化，用 Markdown 表格/代码块，或先确认 `archify` 的可用性。
- **不要把"它很少说代码没问题"这个缺陷一起搬进来**。应把 strength badge 三档作为**正向机制**引入，并要求"全部为 `Speculative` 时必须在报告开头明确说明'本次未发现值得做的深化'"（对齐 `diff-review/SKILL.md:68` 的"无内容可评审"降级写法）。
- **不要让它写任何文件到仓库之外**。AgentForge 的产物约定是落盘可追溯（`docs/architecture.md:269`），不是"so nothing lands in the repo"（`SKILL.md:39`）。

---

## 参考来源

- mattpocock-skills 仓库（HEAD `c55ee46`）：
  - 主目标：`skills/engineering/improve-codebase-architecture/{SKILL.md, HTML-REPORT.md, agents/openai.yaml}`（全文逐行读取）
  - `docs/engineering/improve-codebase-architecture.md`（人类文档页，全文逐行读取）
  - `README.md`、`CHANGELOG.md`、`CLAUDE.md`、`.claude-plugin/plugin.json`、`.agents/invocation.md`
  - `skills/engineering/codebase-design/{SKILL.md, DEEPENING.md}`、`skills/productivity/grilling/SKILL.md`、`skills/engineering/domain-modeling/SKILL.md`
- AgentForge 仓库：
  - `README.md`、`docs/architecture.md`、`docs/research/2026-09-23-mattpocock-code-review.md`
  - `skills/{research, implementation-workflow, diff-review, complexity-audit, mutation-testing}/SKILL.md`
  - `skills/implementation-workflow/references/quality-gates.md`、`skills/diff-review/references/standards-baseline.md`
  - `agents/*.md`、`src/index.js`、`tools/doctor.mjs`
- 本报告**未使用网络来源**；所有结论均来自上述本地文件的静态阅读与 `git log -S` / `grep` / `wc` / `find` / `du` 实测。
