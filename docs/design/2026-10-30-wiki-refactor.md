# Wiki 技能重构方案：从治理工具到知识生成

> 状态：实施中（第一期）。第 11 节第 6 项已确认；第 1–5 项暂按推荐执行，可随时调整。

## 1. 背景与目标

wiki 技能的初衷是参考 Qoder Repo Wiki 和 zread：为仓库产出一套知识文档，既供 Agent 参考，也给人阅读。当前实现的重心落在治理上，包括模块映射、复核账本、self-attested review、staged 三步流程和 gate；生成本身没有流水线，全靠 Agent 照模板逐页填写。本仓库的结果是 `verification.md` 有 389 行按日期追加的日志，`reviews.json` 有 32KB，维护流程的产出多于知识本身。

重构目标：

1. **生成是主线**：一次调用产出完整、可读、带导航的 Wiki。
2. **增量更新自动化**：根据 git diff 定位受影响的页面并修订，指纹自动刷新，不需要手写复核声明。
3. **给 Agent 稳定入口**：固定的目录文件，每页带摘要和来源，Agent 先读目录再按需打开页面。
4. **保留差异化**：知识以代码为准、关键结论附来源、文档提交在仓库、跨宿主可用。

非目标：不做浏览界面或静态站点（先输出 Markdown，GitHub 和编辑器可直接渲染）；不做语义正确性的自动证明；不在本轮支持非 Git 项目的增量更新。

## 2. 产物结构

默认输出目录仍为 `docs/wiki/`，已有项目沿用其现有路径。

```text
docs/wiki/
├── README.md              # 项目概览 + 完整导航（由 catalog 生成导航部分）
├── catalog.json           # 目录真源：页面树、每页来源与摘要
├── .state.json            # 机器维护：生成基线 commit、每页来源指纹
├── 系统架构/…             # 按 catalog 分组的页面；目录名随 pathLanguage，
├── 核心模块/…             # pathLanguage 为 en 时为 architecture/、modules/ 等
└── 关键流程/…
```

`catalog.json` 示例：

```json
{
  "version": 2,
  "title": "AgentForge",
  "language": "zh-CN",
  "pathLanguage": "zh-CN",
  "pages": [
    {
      "id": "architecture",
      "title": "系统架构",
      "path": "系统架构/README.md",
      "summary": "技能真源、四种宿主的发现方式与资源读取路径。",
      "sources": ["src/index.js", "cordis.patch.yml", ".claude-plugin", "tools/package-qoder.mjs"],
      "children": ["系统架构/宿主适配.md"]
    }
  ]
}
```

设计要点：

- **来源映射下沉到页面级**。每页自己声明 `sources`，替代现在 `wiki.config.json` 里的模块级 `sources/docs`。改动只会让真正引用它的页面过期，不再一改共享文件就让四个模块全部 stale。
- **`.state.json` 只由脚本写**，记录 `baseCommit` 和每页来源的内容指纹。Agent 不手填核验基线和时间。
- **catalog 是唯一结构真源**：导航、页面列表和覆盖报告都从它派生，不再另配 `structure.documents`。
- **语言写进 catalog**：`language` 决定目录标题、摘要、正文、章节标题和图表文字的语言；`pathLanguage` 决定新建文件和目录的命名语言。规则见第 2.1 节。

### 2.1 语言

问题：项目是中文的，但模型容易按模板、技能文档或训练习惯生成英文的目录、标题和正文。语言必须作为显式决策，在规划目录前确定，并贯穿后续每一步。

**确定顺序**（取第一个有结论的）：

1. 用户本次明确指定的语言。
2. 已有 catalog 的 `language`（更新时沿用，不因对话语言改变）。
3. 项目已有文档的主要语言：README、`docs/` 下的 Markdown。
4. 项目内的其他文字信号：代码注释、提交信息、界面文案。
5. 当前对话语言。

`scan` 统计第 3、4 步的语言信号（按文件类别统计中文字符与英文单词的占比），输出建议值和依据；Agent 在展示 catalog 时一并说明"将以简体中文生成"及理由，用户可在确认目录时改。

**作用范围**：

| 内容 | 规则 |
|---|---|
| 目录标题、页面标题、摘要、正文、章节标题 | 使用 `language` |
| Mermaid 图的节点和说明文字 | 使用 `language`；节点 ID 用 ASCII |
| 代码标识符、文件路径、命令、配置键、错误信息原文 | 保持原样，不翻译 |
| 专业术语 | 首次出现可附原文，如"工作树（worktree）"；之后沿用同一译法，项目已有译法优先 |
| 新建的文件和目录名 | 使用 `pathLanguage` |
| 固定名称 `README.md`、`catalog.json`、`.state.json` | 不翻译 |

**路径语言** `pathLanguage`：用户指定了文档语言而未单独指定路径语言时，路径随之使用该语言；否则默认与项目已有文档路径的命名风格一致；项目没有可参考的文档路径时，与 `language` 一致，例如中文项目生成 `核心模块/订单.md`。用户也可以选 `en` 得到 ASCII 路径，以避开中文路径在 URL 编码、部分终端和工具里的不便。已有页面路径不随语言设置自动重命名；用户改变路径语言时，列出将改名的页面和外部入链，确认后改名并同步。

**模板**：模板只提供结构和写作要求，章节标题按 `language` 写出。技能内置中英两套章节名对照，其他语言由模型按同样结构翻译。check 不再按固定章节名校验（见第 8 节），因此语言选择不会影响检查结果。

**混合语言项目**：整个 Wiki 只用一种 `language`，不按页面切换。需要多语言版本时作为后续扩展，本轮不做。

## 3. 生成流水线（generate）

由 Agent 执行，脚本只负责机械步骤（扫描、指纹、导航、校验）。四个阶段：

| 阶段 | 执行者 | 输入 → 输出 |
|---|---|---|
| 1. 扫描 | 脚本 `scan` | 仓库 → 文件清单、编程语言分布、文档语言建议、入口候选（manifest、main、路由、CLI、Dockerfile、CI）、目录体量 |
| 2. 规划目录 | Agent | 扫描结果 + 读入口代码和已有文档 → `catalog.json`（文档语言、页面树、每页来源与一句话摘要） |
| 3. 逐页生成 | Agent（可并行） | 单个 catalog 条目 + 其来源 + `language` → 页面正文 |
| 4. 收尾 | 脚本 `finalize` | 全部页面 → 写入 README 导航、`.state.json` 指纹、运行 check |

规划目录的默认骨架（按项目实际裁剪，无适用内容就不建）：

1. 项目概览：做什么、给谁用、技术栈、如何运行
2. 快速上手：本地启动、测试、常用命令
3. 系统架构：组件、数据流、外部依赖（含 Mermaid 图）
4. 核心模块：每个能力一页，按开发问题划分，而非照搬目录
5. 关键流程：跨模块的主链路（请求生命周期、发布流程等，含时序图）
6. 部署与运维：构建产物、环境配置、排障入口
7. 开发指南：约定、扩展点、测试方法

阶段 2 完成后先把 catalog 展示给用户确认，再进入阶段 3；展示时写明文档语言、路径语言及其依据。派发子 Agent 时必须传入 `language`，子 Agent 不自行判断语言。大仓库生成成本高，确认目录比生成后返工便宜得多。用户明确要求一次完成时跳过确认。

并行：宿主支持子 Agent 时，每个子 Agent 领一个或几个 catalog 条目，只写自己的页面；不支持时串行执行。不再在技能里规定并发名额和退避细节，交给宿主。

## 4. 页面模板

去掉每页的"文档信息"表格、"依据与核验""待确认项"必需章节。统一为叙述型结构：

````markdown
# 订单模块

> 负责下单、支付回调和状态流转；不负责库存扣减（见[库存模块](inventory.md)）。

## 概述
……

## 核心流程
```mermaid
sequenceDiagram
  ……
```
……

## 关键实现
| 职责 | 位置 |
|---|---|
| 下单入口 | [OrderController.create](../../src/order/controller.ts#L42) |

## 修改须知
……

<details><summary>来源</summary>

- src/order/controller.ts
- src/order/service.ts
</details>
````

规则：

- 开头一行引用块是摘要，与 catalog 的 `summary` 一致，Agent 只读首段就能判断是否需要打开。
- 关键结论就近链接到源码文件和行号；页尾折叠列出全部来源，与 catalog 的 `sources` 一致。
- 架构、流程类页面至少一张 Mermaid 图。
- 推断和未验证内容就近标注，不再单独设"待确认项"章节；确有开放问题时可选加"未解决问题"。
- 保留现有的写作原则：以代码为准，不把测试代码写成测试通过，不把部署脚本写成已上线。

模板从 13 个收敛为 4 个：`overview`、`architecture`、`module`、`guide`（流程、部署、运维、开发指南都用 guide，按需加小节）。

## 5. 增量更新（update）

```text
wiki.mjs status          → 按页报告 fresh / stale / missing-source / uncatalogued
Agent 读 stale 页 + 对应 diff → 修订原句（不追加补丁段）
wiki.mjs finalize        → 重算这些页的指纹、刷新导航、运行 check
```

- `status` 比较 `.state.json` 的指纹与当前工作区，列出过期页面及其变化的来源文件；同时列出未被任何页面引用的新增文件（`uncatalogued`），供 Agent 判断是加入现有页、新建页还是忽略。
- 基线默认取 `.state.json` 的 `baseCommit`，也可用 `--since <ref>` 指定。
- 页面级映射使影响面收窄：改一个共享配置，只有引用它的两三页过期。
- 新增能力较大时，Agent 先修改 catalog（加页或拆页），再生成新页。
- `finalize` 自动刷新指纹，**不要求手写 reason、reviewer、evidence**。刷新指纹的含义是"这些页已按当前来源重新生成或修订过"，由执行更新的 Agent 负责，与现在 review 的保证等价，但没有逐模块签认的负担。

接入持续同步：`init` 时输出一段可粘进 AGENTS.md / CLAUDE.md 的片段，例如：

```markdown
## 项目知识
- 理解代码前先读 docs/wiki/README.md 和 catalog.json 中相关页面。
- 完成功能开发后，运行 `<wiki 脚本> status`；有 stale 页时以独立任务调用 wiki 技能更新。
```

这样解决"技能独立调用"与"收尾同步"的矛盾：触发写在项目指令里，由主 Agent 发起独立的 wiki 任务。

## 6. 命令行重设计

| 命令 | 作用 | 状态 |
|---|---|---|
| `scan` | 输出仓库扫描结果（供规划目录） | 新增 |
| `status` | 页面级新鲜度 + 未收录文件 | 新增，替代 freshness / changes / mapping |
| `finalize` | 刷新导航与指纹，然后 check | 新增 |
| `check` | 链接、锚点、catalog 与文件一致性、摘要存在；页面主要语言与 catalog `language` 不一致时报告 | 保留，简化结构检查 |
| `gate` | CI 用：指定 range 内，被修改来源对应的页面必须在同一范围内被 finalize | 保留为可选严格模式 |
| `review` | 手写复核声明 | 移除 |
| `freshness` / `changes` / `mapping` | — | 合并进 status 后移除 |

参数默认值：`--root` 默认为当前目录所在的 Git 根；`--wiki` 默认读 `docs/wiki/catalog.json` 所在目录，找不到再要求显式传入。阅读任务不再要求先跑命令，读 catalog 时脚本输出的 stale 列表只作提示。

`gate` 降级的理由：自写自签的复核声明证明力有限，staged 三步流程成本高。保留 range 模式给需要合并门禁的团队，在 CI 里检查"改了来源却没更新对应页"，默认不启用；本地 staged 流程删除。

## 7. 技能文档结构

SKILL.md 压缩到约 40 行，只写三个入口和核心原则，细节下放：

| 文件 | 内容 |
|---|---|
| `SKILL.md` | 何时使用；generate / update / read 三个入口各 3～5 步；写作原则 5 条；语言确定顺序一句话（细则在 writing.md） |
| `references/generate.md` | 扫描、规划目录的骨架与裁剪规则、并行分工、用户确认点 |
| `references/writing.md` | 页面模板及中英章节名对照、语言与术语规则、来源链接、Mermaid 图、以代码为准的核对方法（由现 content-verification 精简而来） |
| `references/update.md` | status 结果的处理方式、修订原则、catalog 调整、AGENTS 接入片段 |
| `references/tools.md` | 命令与参数 |
| `references/strict-mode.md` | 可选的 CI gate 接入 |

删除 `module-workflow.md` 的并发调度细则、`initialization.md`、`freshness.md`（内容拆入 update 与 strict-mode）、`evaluation-cases.md`（改为测试用例）。

frontmatter description 改为以生成为主，补充"项目文档、知识库、代码导读、架构说明"等触发词，并写明与 lark-wiki（飞书知识库）、zread（`.zread/wiki`）的区别。

## 8. 代码处置

| 现有文件 | 处置 |
|---|---|
| `snapshot.mjs` | 保留，按页计算指纹；修复 CRLF/filemode 跨 scope 不一致（只保留 worktree 与 range 两种 scope 后影响缩小） |
| `wiki.mjs` 的 check、links、anchors | 保留；补引用式链接、setext 标题、%00 等已知缺陷 |
| `structure.mjs` + `schema.json` | 大幅简化：只检查 catalog 与文件一致、每页有标题和摘要；删除元数据字段与必需章节体系 |
| `freshness.mjs` | 重写为 `status` + `finalize` + 可选 `gate`；删除 review、ledger 锁、staged 逻辑 |
| `mapping.mjs`、`document-review.mjs` | 删除，功能由 status 的 uncatalogued 和 catalog 的页面来源覆盖 |
| 新增 `scan.mjs` | 文件清单、语言统计、入口候选、目录体量；只读，不调用模型 |
| 测试 | 按新命令重写；保留链接、路径安全、指纹相关用例 |

`wiki.config.json` 与 `reviews.json` 进入兼容期：检测到旧配置时，`status` 提示运行 `migrate`；新版本不再读取它们。

## 9. 迁移

**本仓库**：

1. 运行 `migrate`：由旧 `modules[].docs/sources` 生成初版 catalog（每个旧 doc 一页，sources 继承模块来源），写 `.state.json`。
2. 用新流程重新生成 Wiki：重新规划目录，按新模板重写页面。`verification.md` 拆分：当前有效的验证方法进开发指南，历史记录移到 CHANGELOG 或删除。
3. 删除 `wiki.config.json`、`reviews.json`；AGENTS.md 的 Wiki 段替换为第 5 节的接入片段；CI 的 Wiki job 改为 `check` + 可选 range `gate`；`package.json` 的 `wiki:*` 脚本相应更新。

**外部用户**：这是破坏性变更，作为 0.15.0 发布。CHANGELOG 写清迁移步骤；`migrate` 只生成新文件，不删除旧文件，由用户确认后自行删除。

## 10. 实施分期

| 期 | 内容 | 验收 |
|---|---|---|
| 一 | `scan`（含语言建议）、catalog 格式、新页面模板、generate 流程与 SKILL.md | 在两个真实仓库（本仓库 + 一个中型业务项目）从零生成完整 Wiki，人工评估可读性与来源准确性；中文项目在对话为英文时仍生成中文目录与正文，指定 `en` 时生成英文 |
| 二 | `status`、`finalize`、update 流程、AGENTS 接入片段 | 构造代码改动，确认只有引用页 stale，修订后 finalize 恢复 fresh |
| 三 | `migrate`、本仓库迁移、删除旧命令与旧测试 | 本仓库 Wiki 按新结构运行，`npm test` 与 CI 通过 |
| 四（可选） | 范围模式 `gate`、`strict-mode.md` | PR 中修改来源而未更新页面时 gate 失败 |

第一期完成后先评估生成质量，再决定是否进入后续各期。如果生成质量不够，方向需要重新判断，治理侧不应先动。

## 11. 待决策

1. **默认输出目录**：沿用 `docs/wiki/`（推荐，与现有项目兼容），还是改为类似 `.qoder/repowiki`、`.zread/wiki` 的隐藏目录。隐藏目录更像缓存，不利于人在仓库里浏览。
2. **gate 是否保留**：推荐保留为可选的 range 模式；也可以完全删除，只留 status 提示。
3. **生成前是否必须确认目录**：推荐默认确认、用户明确要求时跳过。
4. **兼容期长度**：推荐 0.15.0 只提供 migrate，不再读旧配置；如果已有外部用户依赖旧命令，可以保留一个版本的只读兼容。
5. **是否需要浏览界面**：本方案不做。若需要，可在第四期之后评估生成静态站点（如 VitePress 配置）。
6. **中文项目的默认路径语言**（已确认）：跟随项目已有文档路径风格，没有可参考路径时用中文。

## 12. 风险

- **生成质量依赖模型**：脚本不生成知识，页面质量取决于宿主模型与来源阅读深度。缓解办法是第一期用真实仓库人工评估，再决定是否继续。
- **大仓库成本**：全量生成读取量大。缓解办法是目录确认、按页并行，以及允许分批生成、在 catalog 中标记未生成页。
- **保证变弱**：取消手写复核后，"fresh"只表示页面在来源变化后被重新处理过，不表示有人逐条核对过。文档中如实说明，需要更强保证的团队启用 strict mode。
- **破坏性变更**：现有接入项目（包括本仓库）需要迁移；migrate 只生成新文件，降低误删风险。
