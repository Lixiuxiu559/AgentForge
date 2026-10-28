# 本次生成验证与复验

## 文档信息

| 字段 | 内容 |
|---|---|
| 适用范围 | AgentForge 自用 Wiki 的模板、新鲜度复核、候选隔离与机械检查 |
| 事实状态 | 部分核验 |
| 核验基线 | 历史功能基线 3e5341d；本轮 ee58dfd 后开发工作区的来源与文档按复核指纹核验 |
| 核验时间 | 2026-10-27 |

## 内容

本页保留功能基线 3e5341d 及 v0.9.0 发布准备阶段的历史本地核验；新增的当前副本结果单独列出。以下旧记录不是本轮重跑证据；来源和文档另以内容指纹追溯。所有命令从仓库根执行；此页不自动追踪后续远端发布与 CI 状态。

### 架构、部署与运维扩展验证（2026-10-28）

本轮在 AgentForge 开发工作区应用新初始化标准：入口逐项说明五个知识面的覆盖；既有 docs/architecture.md 增补组件与数据流，docs/releasing.md 路径及正文保持原样；新增 environments.md 和 operations.md，未重组四个能力模块。两篇新页面显式选择专用类型，外部架构/发布手册仅检查其既有章节。

| 验证 | 实际范围与结果 |
|---|---|
| npm test | Node v24.15.0，71/71 通过；provider 2、Wiki 基础 17、模板 23、新鲜度 22、mapping 7 |
| 专用模板 | 五类模板显式选型可通过，空必需章节、未填占位符和环境证据字段缺失均失败；具体未知可通过，不伪造部署结果 |
| 既有约定兼容 | project 的自定义英文页与专用页面并存；small 默认 Wiki 可引用外部旧架构而不强加元数据，缺既有必需章节仍失败；不要求创建新目录 |
| 自用结构检查 | 13 篇 Wiki、129 个链接、15 个结构文档通过，含两份外部既有手册；入口可达，legacyDocuments 为空 |
| 路径与资产 | doctor 与 mapping 通过，无缺失来源或未映射文件；共享来源按本次环境/运维解释范围维护 |

源码静态核对包括 provider、清单、bundle、发布脚本和三个工作流。未访问远端或真实用户宿主，清单版本 0.9.0 只作为声明值；没有把发布配置写成实际上线或健康状态。未安装、发布、重启、回退或恢复数据，自营数据库/监控对插件不适用，用户项目数据仍由其自身流程管理。

本轮独立只读 Correctness、Standards、Spec 评审无可操作发现。改动集中于模板、方法和结构检查，未另装复杂度或突变测试工具。

首次自用检查暴露外部既有手册被强加默认元数据的问题，已修改为只有选型页面才应用模板契约，并增加针对性回归。语义由主 Agent 对照上述来源核对，机械检查继续 semantic: not_run；不声称脚本证明架构或部署事实。

### 跨文档一致性自查（2026-10-28）

主 Agent 串行检查技能入口、初始化/维护/模板/工具说明、schema、检查器和自用知识，未新增检查器缺陷发现。补齐五个表达缺口：维护内容包括系统知识；Git 工具的适用前提；持续同步的实际触发而非常驻自动化；structure.documents 不自动建立 modules 指纹映射；旧运行观察不能因 fresh 升级为当前健康。普通未知与 blocked 的边界也与初始化约定对齐。

13 类模板逐一核对共同/类型章节和额外字段，与 schema 一致。临时非 Git 项目的显式环境页（状态未知）通过 check，changes 明确返回执行错误，未初始化 Git；模板选型没有自动创建模块映射。临时目录已清理。71 项回归、doctor、mapping 和结构链接检查重新通过；本轮不涉及生产或宿主运行核验。

### 当前副本的实际核验（2026-10-27）

技术项目独立验证使用以 ee58dfd 为基础的开发工作区隔离副本，未修改源码或 CI，没有访问真实外部服务。初次 freshness 报告 skill-methods、wiki-tooling、distribution 为 stale，skill-provider 为 fresh；已先回到来源再更新知识。

| 命令或人工核对 | 本轮实际结果与范围 |
|---|---|
| npm test | Node v24.15.0，66/66 通过：provider 2、基础 Wiki 17、模板 18、新鲜度 22、mapping 7 |
| node tools/doctor.mjs | 插件结构与资产校验通过；没有执行发布 |
| npm run wiki:mapping | 初次 passed 但有 7 个未映射路径：6 个调试 fixture 文件和映射测试。人工修订为技能方法的演练依据及 Wiki 映射回归；缩小 skill-methods 对 Wiki 的映射并补齐共享触发来源 |
| npm run wiki:check | passed；11 篇 Markdown、106 个链接、11 篇结构检查，导航已检查，legacyDocuments 为空，无 coverage limitations |
| npm run wiki:freshness 与 npm run wiki:gate | 四模块实际复核后全部 fresh；worktree gate passed，unmapped 为空。没有执行 staged 或 range gate，不声称提交候选通过 |
| 人工语义核对 | 对照 SKILL、维护/初始化/知识分类/模板协议、mapping/structure/CLI 实现和回归，新增 mapping 边界、规则分类与兼容说明；检查入口与四模块能力边界，保留有效旧内容 |

隔离副本的独立验收记录保存在本机临时验证目录；本仓库的最终复验结果见下方。后续复验继续运行下列项目命令并查看 findings 与 coverage。本轮没有复做下方历史故障演练、PR YAML 解析、打包预览或外部安装验证；自动回归中的隔离 fixture 已随 npm test 执行。

### 真实业务材料的独立验证（2026-10-27）

来源为 kuavodatahubai 的 a2b36b10261d80f6f5ba4ad1674be1502b353e46：只选取“交付内容配置”能力相关的 8 份前后端源码与测试，逐文件 SHA-256 固定并复核。隔离副本不包含完整应用、原项目 Wiki 或部署资料。另以受控夹具预置 handbook 入口与手工备注，验证已有约定优先；该备注不冒充原项目知识。

| 验收点 | 实际结果 |
|---|---|
| 真实产物 | 沿用 handbook/README.md，生成能力页、维护说明、项目配置和首份复核记录；完整保留手工备注 |
| 分类与语义 | 静态核对前后端、模型、枚举和测试；名称/深度/叶子限制为实现观察。明确同名去重、FILE 子节点、未知类型及 trim 的跨端差异；没有从注释推出 ADR 已批准或执行侧已接入 |
| 模块与映射 | 1 个跨前后端能力模块映射全部 8 份材料及快照/维护配置；说明整文件内无关段落也会触发复核，没有把后端与前端目录各当一个业务模块 |
| 交付程度 | 启用本地新鲜度检测、真实首份复核、读取前与开发收尾的手动触发；未配置 CI 或不可绕过的门 |
| 机械与变化检测 | 3 篇文档、15 个链接检查通过；mapping、freshness、worktree gate 通过。主 Agent 再次修改隔离源码确认 stale，还原后 fresh |
| 重复维护 | 独立执行者再次核对相同请求，文档指纹不变，未无故刷新记录 |

主 Agent 对照规范化器及前端约束代码复核了关键边界，复验文件哈希与手工标记、结构、映射、新鲜度和本地 gate。首次检查发现复核文件尚未生成的链接、配置尚未映射，已在实际交付中修正；不把首次失败隐去。未运行业务应用测试：隔离材料没有构建描述、完整依赖与运行入口；读取测试不记为运行通过。Provider、完整调用链、ADR 效力与部署版本保持局部未知。

业务原仓库保持干净，未改源文件、未提交、未部署。本轮是一个真实业务能力加 AgentForge 技术仓库的样本验证，不能据此宣称所有业务项目或模型执行都可靠。

### 主仓库收尾复验

本轮开发工作区已通过 66 项自动测试、doctor，以及 Wiki 结构/来源映射检查；重要结论经主 Agent 对照来源核对后保存复核记录，并执行 worktree freshness 与 gate。未暂存或验证本轮 staged/range 候选，未提交或发布。Correctness、Standards、Spec 只读核对均无可操作发现；本轮以方法、模板和只读路径报告为主，无现成复杂度/突变工具链，未额外引入这两类审计工具。skill-creator 的 quick_validate.py 因系统与捆绑 Python 均缺少 PyYAML 未能运行；未安装新依赖，技能元数据、资源与模板由项目 doctor、provider 回归和 Wiki 回归实际检查。

### 历史已执行证据

| 验证 | 实际结果与范围 |
|---|---|
| npm test | 本机 Node v24.15.0，该历史轮次 56/56 通过；含 provider 2 项、Wiki 基础 17 项、模板 15 项、新鲜度 22 项 |
| node tools/doctor.mjs | 三端清单、版本、技能资源和 DSH 装配结构通过 |
| 本次 Wiki 生成 | 沿用 modular 骨架的四模块与按需拆分页，该历史轮次增加新鲜度指南，并同步相关知识和架构说明 |
| 配置驱动的 Wiki 检查 | passed；11 篇 Markdown、102 个链接和 11 篇结构检查，入口导航全部可达，无覆盖限制；语义自动检查仍为 not_run |
| 新鲜度与工作区同步 | 该历史轮次 gate 检查所有已配置模块的复核快照与变更映射；初次未建立记录时为 unknown，显式复核后为 passed，unmapped 为空 |
| PR YAML | 使用本机 Ruby YAML 解析器读取并核对 job、完整历史及 range 命令；远端工作流未执行 |
| 发布包内容 | npm pack dry-run 确认包含 freshness、snapshot、协议与模板资产；未发布 |

### 项目配置与命令

[wiki.config.json](wiki.config.json) 选择 modular，并声明四模块的源码与文档映射。相对路径均基于仓库根，后续检查必须继续显式传入配置。

```bash
node skills/wiki/scripts/wiki.mjs check --root "$PWD" --wiki docs/wiki --config docs/wiki/wiki.config.json
npm run wiki:freshness
npm run wiki:gate
```

check 检查目录、必需 H2、元数据状态和日历日期、未替换占位符、文件链接与入口可达性。freshness 检查来源与知识指纹，gate 再核对所选候选的变化覆盖。检查暂存内容时使用 scope staged，分支比较使用 scope range 及明确 base；按实际范围读取配置、记录和内容。成功采集或通过检查均不等于文档语义已自动审查。

### 负向验证方法

本次已在完整项目的隔离临时副本执行以下场景，结束后清理副本，真实 Wiki 未被破坏：

| 输入变化 | 实际结果 |
|---|---|
| 删除 concepts.md | issues，包含 missing-structure-document |
| 删除技能方法模块 README | issues，包含 missing-structure-document |
| 核验基线残留行内代码占位符 | issues，包含 unresolved-placeholder |
| 删除适用范围字段 | issues，包含 missing-document-field |
| 核验日期改为 2026-02-30 | issues，包含 invalid-verification-date |
| 新增完整但未导航的主题页 | issues，包含 unreachable-document |
| 新建沿用英文标题和 Scope 章节的 project 知识目录 | passed，没有强加默认元数据或模块目录 |
| 删除该 project 配置声明的 Scope 章节 | issues，包含 missing-section |

这些负向场景均以退出码 1 结束；兼容场景退出码 0。现有自动回归另验证了空章节借用附录正文及图片充当导航会被拒绝。

### 新鲜度闭环的实际故障演练

2026-10-27 在隔离 Git 副本上执行；只复制真实仓库的 Git 可见工作区文件，避免把原本忽略的 Finder 元数据当成新来源。副本的所有源码与文档指纹最初与项目记录一致。随后实际修改 provider 源码、写复核记录、暂存和提交，结果如下：

| 场景 | 实际结果 |
|---|---|
| 相同 Git 可见内容在隔离仓库保持 fresh | passed |
| 无未处理变化时 gate 通过 | passed |
| 来源变更后读取检查 stale | issues |
| 未复核来源变更被 gate 拦截 | issues |
| 有依据 no-change 复核后恢复通过且知识页未改 | passed |
| 未映射新文件不能通过 | partial |
| blocked 声明持续阻断 | issues |
| 工作区补记录不能掩盖不同暂存来源 | issues |
| 暂存复核记录尚未加入索引时仍拦截 | issues |
| 暂存复核记录后索引候选通过 | passed |
| 已复核提交树的 range gate 通过 | passed |
| 工作区新记录不能掩盖旧提交树 | issues |
| 复核记录进入新提交后 range gate 恢复通过 | passed |

no-change 恢复时对 provider 知识页计算哈希，确认文档没有被强行改动。blocked 是明确标注的隔离模拟，并不表示真实 provider 存在该冲突。索引与提交树演练直接生成候选提交，证明工作区新记录无法替代旧候选。副本已清理，可通过新鲜度回归中的对应 Git fixture 重复验证。

### 结果边界

checker 的 coverage.semantic 为 not_run。review 记录是执行者的明确复核声明；项目复核记录见配置 freshness.records，不自动证明业务语义。本文的部分核验来自本次人工阅读源码与实际工具执行；机器通过不能证明来源真实性、业务正确性、已发布或三端已安装。后续变更后应按实际范围重验，不自动刷新所有页面的核验日期。

## 依据与核验

来源为 [provider 测试](../../tests/skill-provider.test.mjs)、[Wiki 基础回归](../../tests/wiki.test.mjs)、[模板回归](../../tests/wiki-templates.test.mjs)、[doctor](../../tools/doctor.mjs)、[新鲜度回归](../../tests/wiki-freshness.test.mjs) 与 [检查协议](../../skills/wiki/references/tools.md)；该历史轮次 npm test、doctor、YAML 解析、打包预览以及真实 Wiki 正向检查和隔离故障验证均已执行。功能实现和项目 Wiki 已在 3e5341d 提交；本页记录的是发布准备阶段的本地证据，不将其当作远端 CI 或 Release 成功的证明。

## 待确认项

三端宿主完整行为、Node 22 的本次执行以及远端 CI 结果未核实；skill-creator 的独立 quick_validate 因运行环境缺少 PyYAML 未完成，没有计作通过；无复杂度或突变分析报告，不据此宣称代码质量已全面证明。
