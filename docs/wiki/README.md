# AgentForge 项目 Wiki

## 文档信息

| 字段 | 内容 |
|---|---|
| 适用范围 | 当前仓库的技能边界、技能发现、Wiki 工具和分发验证；不代表四端已发布状态 |
| 事实状态 | 部分核验 |
| 核验基线 | 历史功能基线 3e5341d；本轮 ee58dfd 后开发工作区的来源与文档按复核指纹核验 |
| 核验时间 | 2026-10-28 |

## 项目概览

AgentForge 是一份技能真源、多宿主使用的工程方法集合。当前工作区含十一个技能，分别维护在 skills 的直接子目录；Codex 和 Claude Code 通过各自插件清单发现技能，DSH 通过包内 provider 暴露候选和正文；Qoder 使用从共用技能生成的独立 ZIP，打包副本转换平台调用策略。宿主提供执行、独立上下文和并行能力。

仓库目前提供需求定义、调查、实施、评审和知识维护等方法。完整的需求到上线闭环仍有[设计讨论稿](../design/2026-10-16-lifecycle-workflow.md)，不能据此认为已有自动部署、持久调度或失败恢复引擎。

## 阅读导航

- [公共术语](concepts.md)
- [技能方法与协作](modules/skill-methods/README.md)
- [DSH 技能发现与资源读取](modules/skill-provider/README.md)
- [Wiki 生成与检查](modules/wiki-tooling/README.md)
- [分发与发布验证](modules/distribution/README.md)
- [本次实际验证与复验办法](verification.md)
- [读取前新鲜度与收尾同步](freshness.md)

## 知识覆盖

本 Wiki 使用 modular 骨架，按四个能力模块组织，保留原有架构和发布文档作为详细来源。规则、代码映射及依赖只在需要时拆分，不为每个模块固定生成四文件。

历史 Wiki 单页核对能力提交为 e9b7e7c，其版本准备提交为 e06f1c2；最终知识与来源以复核指纹为基线；来源及文档指纹保存在项目复核记录中，旧页的 3e5341d 保留为历史功能基线。当前三份插件清单与 package.json 版本均为 0.12.2，Qoder 适配记录在 CHANGELOG 的 Unreleased；旧提交号仅保留历史定位。关键源码、清单与技能边界已核对，实际本地验证结果见验证页。远端 Release、CI 和实际安装副本的状态须分别核对，不能从本地清单版本推导。

### 模块与来源维护

本次沿用四个能力边界：技能选择与交接、DSH 发现与读取、Wiki 知识维护、分发与发布。已达到可持续维护并沿用既有持续同步机制：读取前 freshness、开发收尾实际复核后 review，交付运行 check 和 gate。现有 PR Wiki 检查门沿用原约定；本轮 CI 增加 Qoder ZIP 构建，Release 增加附件上传，远端保护未核查。

| 模块 | 来源边界与相邻能力 |
|---|---|
| skill-methods | 十个非 Wiki 技能目录、Wiki 技能入口、架构、设计/研究材料和调试演练 fixture；理解技能职责与交接。Wiki 模板及检查引擎属于 wiki-tooling，不再随整个 skills 目录重复纳入 |
| skill-provider | src、装配 patch、provider 测试，以及架构和 architecture-scout 的调用策略；不承担宿主执行 |
| wiki-tooling | Wiki 技能、资源及四份 Wiki 测试，另映射项目快捷命令、包脚本、AGENTS 与实施技能中的同步触发约定 |
| distribution | 插件/市场清单、CI、发布工具、包配置及发布说明；保留整份 tools 目录以覆盖发布与校验入口 |

共享映射是有意的：Wiki 的 SKILL.md 同时定义总览边界和维护方法；架构同时约束方法、provider 和分发；architecture-scout 的声明同时影响方法选择和候选策略；实施技能同时说明协作和 Wiki 收尾。package.json、AGENTS.md、tools/wiki-project.mjs 同时关联 Wiki 接入和分发。分发模块新增 Qoder 清单、独立安装说明与两份分发回归的来源映射，另映射 provider、bundle 与 Wiki 工具来源，以支撑环境和运维页的加载/检查故障说明。verification.md 同时承载 Wiki 和分发验证。目录映射仍是能力范围而非逐段语义依赖，新目录和共享文件改动需人工判断。

运行 npm run wiki:mapping 查看 Git 可见路径、共享来源、缺失映射和未映射候选；该报告只评估路径覆盖，不能证明模块语义合理。本轮补齐映射测试与调试 fixture；没有用全仓来源或 ignore 清空报告。新增文件先判断归属，再改配置、核查受影响模块并保存新记录。

### 架构、部署与运维覆盖

| 知识面 | 覆盖情况与入口 |
|---|---|
| 项目概览 | 本页与公共概念已覆盖 |
| 业务/能力 | 四个能力模块已覆盖，项目不是业务服务，不虚构订单等业务模块 |
| 系统架构 | 沿用 [既有架构](../architecture.md)，补组件职责、数据流与宿主边界，不复制为另一套架构文档 |
| 部署与环境 | 沿用 [发布手册](../releasing.md)，补 [环境状态](environments.md)；安装与发布方式已静态核对，用户/远端实际运行状态未知 |
| 运维排障 | 新增 [维护入口](operations.md)，本地检查与故障路径已说明，真实宿主回退未演练；自营数据库/监控不适用 |

本轮不迁移原有文档或强制新增目录。环境与运维页面显式选择对应模板类型；原架构/发布手册只声明其既有章节要求，不强加中文元数据。

## 依据与核验

2026-10-27 对照 [项目说明](../../README.md)、[架构约定](../architecture.md)、[包清单](../../package.json) 和 [变更记录](../../CHANGELOG.md) 建立索引；结构与链接的实测记录见 [验证页](verification.md)。

## 待确认项

四端安装后的真实调用、缓存刷新及全生命周期交付能力仍需专项验证；本地提交与测试通过不能代替发布记录。引用本页或模块知识前先运行 npm run wiki:freshness，失效或未知时回到来源核实。
