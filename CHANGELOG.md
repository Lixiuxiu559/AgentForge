# Changelog

本文件记录 AgentForge 的**已发布版本**。

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循[语义化版本](https://semver.org/lang/zh-CN/)。

> **注意**：只有 bump `.claude-plugin/plugin.json` 的 `version` 并打标签才算发版。
> 日常 push 不改变用户看到的版本。发版时 `release.mjs` 会**同步 bump
> `.codex-plugin/plugin.json`、`.qoder-plugin/plugin.json` 与 `package.json`**，四处漂移会被 `doctor` 判为 error。
> 详见 [`docs/releasing.md`](docs/releasing.md)。

---

## [Unreleased]

### Changed

- `wiki check`：页面宽度按 `sources` 展开后的文件加正文链接到的代码文件去重计算（不计 Markdown 与 README）；超过 30 报 `page-too-broad`、退出码 1，必须拆为子页或收窄来源，16～30 仍列入 `coverage.catalog.oversized` 作提示。阈值固定，不放进 catalog。
- `wiki`：更新后报 `page-too-broad`（含更新前已超出的页面）时须在本次更新里拆页，不靠删链接或收窄来源过关。
- `wiki`：精简技能文档：`SKILL.md` 只保留任务入口与边界，写作原则不再与 `writing.md` 重复；`generate.md`、`writing.md` 合并重复的语言、粒度与链接说明；`tools.md` 的 catalog 检查改为问题代码表；删除未被引用的 `references/evaluation-cases.md`。

### Removed

- `wiki`：移除旧版 `wiki.config.json` 结构的全部支持：`changes`、`mapping`、`freshness`、`review`、`gate` 命令与 `--config` 参数，structure 检查、`assets/templates/` 与 `schema.json`，以及 `freshness`、`templates`、`initialization`、`module-workflow`、`content-verification` 参考文档。`check` 现在要求 `catalog.json`，没有时以退出码 2 报错；旧 Wiki 需按生成流程重新生成。
- 仓库：移除 `npm run wiki:*` 脚本、`tools/wiki-project.mjs` 和 PR 上的 Wiki gate 任务。本仓库 `docs/wiki/` 仍是旧结构，暂停维护，待重新生成。

---

## [0.15.1] - 2026-10-31

### Changed

- `wiki`：用户指定文档语言而未单独指定路径语言时，`pathLanguage` 随之使用该语言，优先于已有 catalog 和 `scan` 按已有路径给出的建议；路径语言改变时，规划阶段列出将改名的页面与 Wiki 外入链，确认后改名并同步。

- `wiki`：页面粒度改在规划阶段确定：写好 catalog 后先运行 `check`，超过 15 个来源文件的页面在确认目录前拆为子页或收窄来源，保留时须说明理由；页面数随项目规模增长。

### Added

- `wiki check`：页面与 README 的标题、来源折叠块残留模板“中文 / English”双语时报告 `bilingual-heading`；模板注释同步说明只保留 `language` 一种。

### Fixed

- `wiki check`：未传 `--root` 时与 `scan` 一样默认使用当前 Git 根，不再直接报错。

---

## [0.15.0] - 2026-10-30

### Added

- `wiki`：改为以生成为主线。新增 `scan` 命令（只读输出文件清单、语言分布、入口候选、目录体量与文档语言建议）、`catalog.json`（version 2）目录真源及其 `check` 检查（页面、来源、标题与摘要、正文语言、未收录与不可达页面），以及 `assets/pages/` 四个页面模板和 `references/generate.md`、`references/writing.md`。语言按用户指定 > 已有 catalog > `scan` 建议 > 对话语言确定，新建路径跟随项目已有文档的路径风格。没有 `catalog.json` 的旧 Wiki 继续按原流程维护。
- `wiki check`：来源超过 15 个文件的页面列入 `coverage.catalog.oversized`，作为拆页提示，不影响退出码。

### Changed

- `wiki`：写作规则要求来源本身是文档时不转述原文，只写跨文件关系、生效位置与修改时需同步之处；关键实现写到判定条件、失败表现与边界。

### Fixed

- `worktree`：远端名按不可信输入校验（必须在 `git remote` 中、不能以 `-` 开头），fetch/ls-remote 将远端放在 `--` 之后，防止 `--upload-pack=<命令>` 类远端名注入 Git 选项；所有仓库命令显式使用 `git -C "$root"`，不依赖当前目录。
- `complexity-audit`：`crap.js` 改名为 `crap.cjs`，修复其在源码、npm/DSH 与 Codex/Claude Code 安装形态下因上层 `type: module` 启动即报 `require is not defined` 的问题；Qoder 包不再额外生成 `package.json`。
- `wiki check`：指向源码等非 Markdown 文件的行号锚点不再记为覆盖受限，避免带源码链接的正常页面整体降为 partial、退出码 1。
- Wiki gate：worktree 范围下同一路径同时存在暂存与未暂存改动时，报告 `divergent` 并降为 partial，避免工作区快照放行未复核的索引内容。

---

## [0.14.1] - 2026-10-30

### Changed

- 移除架构与实施技能中的 Wiki 新鲜度检查、收尾同步和复核记录要求；Wiki 允许用户或 agent 独立调用，其他技能不调度或夹带 Wiki 更新；阅读／检查不顺带写入。
- Wiki 维护要求通读受影响整页，将新增知识融入对应章节，整理过时描述、重复内容和格式；明确结构／链接脚本不代替整页复核，避免只在末尾追加版本补丁。

---

## [0.14.0] - 2026-10-29

### Added

- PM、架构、测试设计与实施编排解除固定调用和回流依赖，按任意可用材料独立执行，由用户决定组合与顺序；test-design 默认交付离线 HTML，保留规则、具体用例、覆盖缺口及实际执行限制。
- PM 与统一架构设计默认交付离线 HTML 正本（prd.html／spec.html），提供阅读导航、分层细节与可见图示；原型和实施工作流直接读取 HTML，不强制维护重复 Markdown。
- 新增统一 architecture-design 技能：比较可行方案并由用户决定关键取舍，完成整体与专项设计、适用图示、质量目标及风险验证；复杂专项按需委派，独立交付完整设计和使用说明，不绑定后续技能。
- 新增 prototype 技能：承接 PRD 或明确页面需求，按全量／局部范围交付离线 HTML 原型及页面、字段、交互状态清单；复用目标项目视觉规范，按需澄清，不自动进入生产实施。同步十三技能发现、四端说明与 Qoder 打包校验。

---

## [0.13.0] - 2026-10-29

### Added

- 新增 Qoder 插件适配：共用 11 个技能，生成独立 ZIP 并转换架构侦察的主动调用策略；补充四处版本同步、清单与打包检查、Release 附件及安装说明。真实宿主调用与升级另行验证。
- worktree技能的固定目录由项目主工作树根下的`.worktree/`改为`worktree/`，保留分支层级；已有旧工作树不自动迁移或删除，旧忽略规则保留兼容。

---

## [0.12.2] - 2026-10-29

### Added

- Wiki文件和目录按项目现有命名语言与风格生成，保留modules、README.md、reviews.json和wiki.config.json；modular概念页可通过显式type选择实际路径，兼容原concepts.md并保留内容检查。

---

## [0.12.1] - 2026-10-28

### Added

- Wiki 多模块任务默认最多并发3个子Agent，编写/复审/返工共用上限，由主Agent排队调度；限流时降低并发，避免未停止的超时任务与重试叠加。

---

## [0.12.0] - 2026-10-28

### Added

- 新增 worktree 技能：add 接受 from 与新分支两个参数，选择本地或远端基线，检查本地和远端重名，在项目根 `.worktree/` 下保留分支层级创建工作树；remove 核对目录、分支与未提交/忽略内容后移除工作树并保留分支，不自动推送、删除分支或恢复。
- Wiki 单页包直接提供覆盖、缺口、歧义及未解析路径清单，保留带行号正文和原始候选，减少自行解析嵌套字段。

### Changed

- 合并重复的Wiki参考，将编写/证据/系统知识统一，精简初始化和模板手册；移除尚未发布的逐段JSON验收功能，保留来源清单、模块独立复审及现有新鲜度/检查接口。

- Wiki 整体定位为开发知识：按当前代码、配置和工程脚本讲清实际实现，不要求产品确认或默认逐段台账；多模块任务采用模块编写、独立复审与主 Agent 整合。新规则模板使用当前实现规则/条件与边界，兼容旧两代标题及既有项目约定。

---

## [0.11.0] - 2026-10-28

### Added

- Wiki 新增 mapping --document 单页核对包，提供带行号正文、同名路径候选与本页来源覆盖；入口改为逐页取证、修正文、读回复核三步，降低对长指令执行的依赖。

---

## [0.10.2] - 2026-10-28

### Added

- Wiki 增量核对落实到正文断言的追源、修正与读回，反查本页来源映射和现行依据冲突，并交代实际语义处置范围；仅补分类标签或免责声明不能算完成复核。

---

## [0.10.1] - 2026-10-28

### Added

- Wiki 补充正文证据范围、实际配置生效链、来源反向映射与跨页一致性核对，防止局部观测或渠道策略被扩大为整体结论。

- Wiki 明确待确认项的准入、归位与退出规则：保留影响当前结论或操作的未决问题，已知边界、未执行验证及未来设想不机械形成待办。

---

## [0.10.0] - 2026-10-28

### Added

- Wiki 初始化覆盖架构、部署环境与运维排障，新增五类按需模板和显式文档类型检查；环境状态要求时间与证据，已有项目布局保持优先。

- 优化 Wiki 知识分类、模板语义和初始化交付标准，按业务或能力组织模块并说明来源证据；保留已有项目约定和旧规则标题的结构兼容。
- 新增只读 mapping 报告，展示跨目录来源覆盖、共享文件比例与未映射候选，辅助核对 Agent 生成的映射质量。

---

## [0.9.0] - 2026-10-27

### Added

- Wiki 增加读取前新鲜度检查、显式复核记录和候选同步检查门；按来源/知识内容指纹检测失效，接入开发收尾与本仓库 PR 检查。

- 新增 `wiki`：跨项目知识阅读、初始化与增量维护，提供零依赖的只读链接检查和 Git 变更映射工具；明确机械覆盖、语义未验证、来源及版本边界。
- Wiki 提供小型与多模块默认骨架、八类文档模板及对应结构检查；已有项目约定优先，可配置自己的必需文档、章节和入口导航。

- 新增 `pm`：按需澄清需求并产出 PRD，覆盖问题与目标、范围、业务规则、用户故事、验收标准与开放问题；默认对话交付，保存位置由用户或项目约定决定。

### Changed

- 三端插件说明、README、架构说明与技能发现测试同步为十个技能。
- 精简 research 职责与结果契约，避免与普通查询和其他技能重复调查。

---

## [0.8.1] - 2026-10-16

### Changed

- 收紧 `research` 的自动触发范围，简单查询和其他技能中的常规信息确认直接处理；默认在对话中交付，临时证据使用系统临时目录，仅在明确需要文件交付时保存正式报告，子 agent 沿用同一规则。

---

## [0.8.0] - 2026-10-09

### Added

- 新增 `test-design`：按业务规则和项目已有测试设施设计用例，评估场景、边界与断言缺口，并交付验证办法；只产出设计，不编写或执行测试。

### Changed

- 实施工作流与任务卡接收测试设计产物，复用已有用例并组织后续编写和执行；`research` 限定为补充调查，`mutation-testing` 的触发条件收紧为实际突变审计，避免与业务场景评估重叠。
- 三端插件说明与技能发现测试同步为八个技能。

---

## [0.7.0] - 2026-09-30

### Added

- 新增 `bug-debugging`：复现或取证、验证根因、展示修复方案，用户确认后实施并回归验证；支持偶发、性能及无法复现的问题。补充按需参考、行为验收场景和隔离测试 fixture。

### Changed

- `research` 与 `implementation-workflow` 接入调试交接与修复前确认规则，复用已有证据和批准范围；技能发现测试及插件说明同步为七个技能。

---

## [0.6.0] - 2026-09-29

### Added

- 新增 Codex 技能插件清单与仓库 marketplace，复用现有六个 Skill；`architecture-scout` 在 Codex 使用独立调用策略、在 DSH 保留显式调用限制，Claude Code 依靠技能说明约束触发。版本同步、结构检查、安装说明和发布文档扩展到第三端。

### Fixed

- **`docs/releasing.md` 的版本规则与实际冲突**。规则原文说「删除技能或 agent → MAJOR」，
  而 0.5.0 删了 5 个子 agent 却走 MINOR。按 semver 对 `0.y.z` 的定义
  （「初始开发阶段，任何东西都可能随时变化，公开 API 不应被视为稳定」），
  0.x 期间用 MINOR 承载破坏性变更是惯例。文档改为：上表列的是 1.0 之后的严格语义，
  **0.x 期间破坏性变更用 MINOR，`MAJOR` 从 `1.0.0` 起启用**。

---

## [0.5.0] - 2026-09-29

### Fixed

- **只有 git tag、没有 GitHub Release**。原因是两件事叠在一起：GitHub 上 tag 与
  Release 是两个对象（推 tag 不会自动生成 Release），而唯一会 `gh release create`
  的步骤被塞在 `publish.yml` 里——npm 一停用、那个工作流改成仅手动触发，
  就再也没人建 Release 了。现在拆出独立的 `.github/workflows/release.yml`，
  由 tag 推送触发、**与 npm 无关**，正文取自 CHANGELOG 对应段落。
  `publish.yml` 相应移除该步骤，权限也从 `contents: write` 收窄为 `contents: read`。

- **README 与 `docs/releasing.md` 里关于 npm 安装的说法已失效**。0.4.2 从 npm
  下架后，`dsh plugin --profile web add dsh-agentforge` 会让全新安装直接失败
  （`ERR_PNPM_NO_VERSIONS`），而 README 还把它标为「推荐」。改为以
  `github:` 装法为主，并在两处标注 npm 分发当前不可用。
- `docs/releasing.md` 开头的表格还留着早先那句错话（「git 或 registry 安装时
  pnpm 按 semver 解析」）——git 安装钉的是 commit，与版本号无关，正文早已修正，
  表格漏改。

### Added

- **发布流程的供应链加固**，与 OIDC 发布配套：

  - 两个 workflow 的第三方 action 一律**钉 commit SHA**（不用可移动的 tag），
    并新增 `.github/dependabot.yml` 每周把 pin 往前推——
    **钉死不会自己更新，没有 Dependabot 就是烂在原地**，拿不到安全修复。
  - **幂等发布**：发布前查该版本是否已存在于 npm，存在就跳过。
    重跑工作流、或 tag 被重新推送时不会撞「版本已存在」而红掉。
  - **并发互斥**：同一个 tag 只允许一个发布在跑，且 `cancel-in-progress: false`
    （已开始的发布不该被后来的取消）。
  - **自动创建 GitHub Release**，正文取自 CHANGELOG 对应段落，
    避免 Release 页和 CHANGELOG 各说各话。新增 `tools/changelog-section.mjs`
    负责抽取，并在 `validate.yml` 里提前验一次，免得发布当天才发现抽不出来。
  - `publish.yml` 权限收敛为 `contents: write`（建 Release）+
    `id-token: write`（OIDC），其余不授。
  - **CI 运行时升到仍受支持的 LTS**：`validate.yml` 原先只测 Node 20，
    而它已于 2026-04-30 EOL。改为测 `22` / `24` 两条 LTS 线
    （本项目零依赖，跑一遍十几秒，矩阵成本可忽略）。
  - 顺带把两个 action 从 v4 升到当前版本（`checkout` v7.0.1、
    `setup-node` v7.0.0）。后者尤其相关：**v7 移除了 v4 会导出的占位
    `NODE_AUTH_TOKEN`**，而那正是 OIDC 可信发布里可能干扰认证的东西。

- **新增 `dev` 分支**：`main` 作为发布通道，`dev` 作为开发通道。
  起因是不发 npm 之后 `main` 就是用户看到的版本——`dshmarket` 判断更新用的是
  `钉住的 commit !== HEAD`，所以 main 上推什么、用户点一次更新就拿到什么。
  「攒两三个功能再发版」只能靠分支实现。`validate.yml` 的 push 触发相应
  加上 `dev`，否则日常开发完全没有 CI。详见 `docs/releasing.md`。

### Changed

- **技能统一承载执行与委派方法**：六个技能使用宿主通用子 agent 能力，传入自包含任务和资源路径，保留独立上下文与独立任务并行；缺少派发能力时明确降级。
- **移除自定义 agent（破坏性变更）**：删除五个 agent 定义、DSH 的 `agentforge` 派发工具、
  工具白名单映射与模型/provider 配置；桥接层仅注册技能。

  旧调用改为「加载对应技能，再用宿主的通用派发能力」：

  | 旧 agent | 方法入口 |
  |---|---|
  | `researcher` | `research` |
  | `implementer` | `implementation-workflow` 的实施任务卡 |
  | `diff-reviewer` | `diff-review` |
  | `complexity-auditor` | `complexity-audit` |
  | `mutation-auditor` | `mutation-testing` |

  DSH patch 里旧的 `config.toolName`、`config.provider`、`config.agents` 不再生效，
  应一并移除；更新插件后重启宿主 / profile 让旧注册失效。
- 更新结构校验并添加技能提供者运行时测试，覆盖动态发现、资源路径和调用策略。

- **npm 发布改为 CI/CD（OIDC 可信发布），移除本机发布路径**。新增
  `.github/workflows/publish.yml`：tag 推送触发，用 GitHub 的 id-token 换短时效
  凭据发布，自动附带 provenance；`release.mjs` 的 `--publish` 相应移除，
  它现在只负责 git 侧（bump → 提交 → 打标签 → 推送）。

  这么改是因为 npm 的 auth **按 registry 而非按账号**存储：实测同一个
  `registry.npmjs.org` 写两行 token 只有一行生效，按 scope 配 `@a:registry` /
  `@b:registry` 也不行（token 键仍是同一个）。两个 npmjs.com 账号无法同时生效，
  只能切换——而 `npm publish` 不可逆，切错就发错账号。交给 CI 后本机不需要任何
  npm 长期凭据。

  ⚠️ 已知限制：**OIDC 无法发布包的第一个版本**（可信发布者配置挂在包自己的设置页上，
  包必须先存在）。首次发布需一次性引导，步骤见 `docs/npm-publishing.md`。

---

## [0.4.2] - 2026-09-25

### Changed

- **npm 包名改为 `dsh-agentforge`**。原打算用 `agentforge`，被 npm 拒绝：
  `403 Package name too similar to existing package agent-forge`（两者只差一个连字符，
  命中防误植规则）。改名后 `package.json` 的 `name`、`cordis.patch.yml` 里 insert 的
  `name`、`src/index.js` 导出的 Cordis 插件名三处必须一致（doctor 会校验）。
  `id: agentforge`、技能 provider 名与工具名 `agentforge` 均未变。
- README 的 DSH 安装章节改为以 **npm 为主**，git / tag / 本地路径列为备选，
  并逐条写明各自的升级语义。

### Fixed

- **`tools/release.mjs` 的 `--push` 一直是坏的**：`git()` 辅助函数对
  `execFileSync` 的返回值无条件 `.trim()`，而 `stdio: 'inherit'`（push 用的）
  不捕获 stdout、返回 `null`，于是 push 成功之后脚本立刻崩在
  `Cannot read properties of null (reading 'trim')`。改为容忍 `null`。
  这个 bug 让 `--publish` 永远走不到，是 v0.4.1 只发到 git、没发到 npm 的原因。

---

## [0.4.1] - 2026-09-25

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
