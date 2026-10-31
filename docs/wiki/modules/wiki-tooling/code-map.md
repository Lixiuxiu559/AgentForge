# Wiki 工具代码映射

## 文档信息

| 字段 | 内容 |
|---|---|
| 适用范围 | 生成方法、模板来源和确定性检查的代码入口 |
| 事实状态 | 部分核验 |
| 核验基线 | 历史功能基线 3e5341d；本轮 ee58dfd 后开发工作区的来源与文档按复核指纹核验 |
| 核验时间 | 2026-10-30 |

## 实现入口

- [技能入口](../../../../skills/wiki/SKILL.md)
- [生成流程](../../../../skills/wiki/references/generate.md)
- [页面写法](../../../../skills/wiki/references/writing.md)
- [仓库扫描](../../../../skills/wiki/scripts/scan.mjs)
- [catalog 解析与检查](../../../../skills/wiki/scripts/catalog.mjs)
- [页面模板](../../../../skills/wiki/assets/pages)
- [模块编写与独立复审](../../../../skills/wiki/references/module-workflow.md)
- [正文核对](../../../../skills/wiki/references/content-verification.md)
- [目录与模板约定](../../../../skills/wiki/references/templates.md)
- [CLI](../../../../skills/wiki/scripts/wiki.mjs)
- [结构检查](../../../../skills/wiki/scripts/structure.mjs)
- [新鲜度与复核](../../../../skills/wiki/scripts/freshness.mjs)
- [来源映射报告](../../../../skills/wiki/scripts/mapping.mjs)
- [单页核对包](../../../../skills/wiki/scripts/document-review.mjs)
- [Git 候选快照](../../../../skills/wiki/scripts/snapshot.mjs)
- [默认结构 schema](../../../../skills/wiki/assets/schema.json)

## 职责映射

| 概念 | 实现职责 |
|---|---|
| CLI 参数与配置 | wiki.mjs 的 args/config，校验 root、scope、模块映射及 structure；scan 与 check 的 root 默认当前 Git 根，check 的 wiki 默认 docs/wiki |
| 仓库扫描 | scan.mjs 的 scan 读取 Git 可见文件，统计语言、入口候选与目录体量；tokens/verdict 判定中英文，按类别最多抽样 200 个文件，无提交时跳过提交信息 |
| catalog | catalog.mjs 的 parseCatalog 按字段白名单校验 version 2、路径唯一且不越出 wiki 目录、来源合法；非法 catalog 以执行错误退出 |
| catalog 检查 | checkCatalog 检查来源、页面、标题与摘要、正文语言、未收录与不可达页面，并把来源超过 15 个文件的页面列入 coverage.catalog.oversized；wiki 目录有 catalog.json 时代替 checkStructure |
| 项目路径边界 | wiki.mjs 的 local/safe，检查相对路径与符号链接实际目标 |
| 文档与链接 | markdownFiles、prose、links、anchors、check，保留语法覆盖限制；指向非 Markdown 文件的行号锚点只计入 coverage.nonMarkdownAnchors，不降级结果 |
| 新鲜度与复核 | freshness.mjs 读取指纹及声明，判定状态、显式原子写记录并检查变更覆盖 |
| 候选文件快照 | snapshot.mjs 从工作区、索引或提交树读取文件集合、内容和模式，避免混用候选 |
| 项目接入 | tools/wiki-project.mjs 固定 AgentForge 目标根和配置，提供 npm 命令入口 |
| 模块来源覆盖 | mapping.mjs 的 inspectMapping 按 Git 可见工作区报告来源、文档、共享比例、缺失项及未映射候选；只测路径，不读取源码正文 |
| 单页核对包 | mapping --document 调用 document-review.mjs，列正文段落/行号和字面路径候选及本页模块覆盖，不读源码正文，不自动判定语义 |
| Git 变更 | git、revision、parseChanges、changes，分别处理索引、工作区及分支范围 |
| 项目结构配置 | structure.mjs 的 structureConfig校验preset、entry、documents与显式type；checkStructure按concepts类型声明选择modular概念页，未声明时使用concepts.md，不依据文件名猜语言 |
| 默认内容契约 | assets/schema.json 的 common 和 types，供结构检查读取 |
| 模板填充 | 新结构用 assets/pages 的 overview、architecture、module、guide 四份模板；旧结构用 assets/templates 的十三份文件；均由 Agent 按证据填充，不是脚本自动生成 |
| 正文与证据 | references/content-verification.md 指导 Agent 核对结论范围、配置生效链、反向来源映射与跨页一致性；不是脚本语义检查 |
| 文档结构 | checkDocument 检查章节、共同及类型额外元数据、状态、日期及未替换占位符 |
| 入口可达性 | checkStructure 与导航图，以普通本地 Markdown 链接检查可达页面 |
| 运行时证据 | tests/wiki-scan.test.mjs、wiki-catalog.test.mjs 覆盖语言判定与 catalog 检查；tests/wiki.test.mjs、wiki-templates.test.mjs、wiki-freshness.test.mjs、wiki-mapping.test.mjs 的隔离 fixture 与 CLI 断言；含当前实现规则/条件边界及旧两代规则兼容 |

## 依据与核验

2026-10-27 按本轮开发工作区静态读取上列方法与 [默认模板](../../../../skills/wiki/assets/templates/index-modular.md)；资源迁移、只读性和失败状态由 [模板测试](../../../../tests/wiki-templates.test.mjs) 及 [基础测试](../../../../tests/wiki.test.mjs) 的实际运行佐证。


核验边界：函数和路径映射只对应本页基线；工具内部改动后应重新核对，不能仅刷新日期。

## 待确认项

无已知待确认项。
