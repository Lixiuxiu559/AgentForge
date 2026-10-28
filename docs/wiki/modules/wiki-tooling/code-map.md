# Wiki 工具代码映射

## 文档信息

| 字段 | 内容 |
|---|---|
| 适用范围 | 初始化方法、模板来源和确定性检查的代码入口 |
| 事实状态 | 部分核验 |
| 核验基线 | 历史功能基线 3e5341d；本轮 ee58dfd 后开发工作区的来源与文档按复核指纹核验 |
| 核验时间 | 2026-10-28 |

## 实现入口

- [技能入口](../../../../skills/wiki/SKILL.md)
- [维护方法](../../../../skills/wiki/references/knowledge-maintenance.md)
- [目录与模板约定](../../../../skills/wiki/references/templates.md)
- [CLI](../../../../skills/wiki/scripts/wiki.mjs)
- [结构检查](../../../../skills/wiki/scripts/structure.mjs)
- [新鲜度与复核](../../../../skills/wiki/scripts/freshness.mjs)
- [来源映射报告](../../../../skills/wiki/scripts/mapping.mjs)
- [Git 候选快照](../../../../skills/wiki/scripts/snapshot.mjs)
- [默认结构 schema](../../../../skills/wiki/assets/schema.json)

## 职责映射

| 概念 | 实现职责 |
|---|---|
| CLI 参数与配置 | wiki.mjs 的 args/config，校验显式 root、scope、模块映射及 structure |
| 项目路径边界 | wiki.mjs 的 local/safe，检查相对路径与符号链接实际目标 |
| 文档与链接 | markdownFiles、prose、links、anchors、check，保留语法覆盖限制 |
| 新鲜度与复核 | freshness.mjs 读取指纹及声明，判定状态、显式原子写记录并检查变更覆盖 |
| 候选文件快照 | snapshot.mjs 从工作区、索引或提交树读取文件集合、内容和模式，避免混用候选 |
| 项目接入 | tools/wiki-project.mjs 固定 AgentForge 目标根和配置，提供 npm 命令入口 |
| 模块来源覆盖 | mapping.mjs 的 inspectMapping 按 Git 可见工作区报告来源、文档、共享比例、缺失项及未映射候选；只测路径，不读取源正文 |
| Git 变更 | git、revision、parseChanges、changes，分别处理索引、工作区及分支范围 |
| 项目结构配置 | structure.mjs 的 structureConfig，校验 preset、entry、documents 与显式 type |
| 默认内容契约 | assets/schema.json 的 common 和 types，供结构检查读取 |
| 模板填充 | assets/templates 的十三份文件，由 Agent 按证据填充，不是脚本自动生成 |
| 正文与证据 | references/content-verification.md 指导 Agent 核对结论范围、配置生效链、反向来源映射与跨页一致性；不是脚本语义检查 |
| 文档结构 | checkDocument 检查章节、共同及类型额外元数据、状态、日期及未替换占位符 |
| 入口可达性 | checkStructure 与导航图，以普通本地 Markdown 链接检查可达页面 |
| 运行时证据 | tests/wiki.test.mjs、wiki-templates.test.mjs、wiki-freshness.test.mjs、wiki-mapping.test.mjs 的隔离 fixture 与 CLI 断言；含新规则三分类及旧规则兼容 |

## 依据与核验

2026-10-27 按本轮开发工作区静态读取上列方法与 [默认模板](../../../../skills/wiki/assets/templates/index-modular.md)；资源迁移、只读性和失败状态由 [模板测试](../../../../tests/wiki-templates.test.mjs) 及 [基础测试](../../../../tests/wiki.test.mjs) 的实际运行佐证。

## 待确认项

函数和路径映射只对应本页基线；工具内部改动后应重新核对，不能仅刷新日期。
