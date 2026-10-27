# 技能方法与协作

## 文档信息

| 字段 | 内容 |
|---|---|
| 适用范围 | 十个技能的职责选择、交接和授权边界 |
| 事实状态 | 部分核验 |
| 核验基线 | d64c4c5 基础提交 + 本次工作区；项目复核记录保存来源与文档内容指纹 |
| 核验时间 | 2026-10-27 |

## 用途与边界

技能定义执行方法，主 Agent 结合用户请求选用；它们不会注册固定模型或统一的自定义角色。审计的“只报告”、调试的修复确认等属于技能行为约定，不是工具层权限机制。

| 技能 | 主要交付与边界 |
|---|---|
| [pm](../../../../skills/pm/SKILL.md) | 按需澄清并交付 PRD；不自动进入架构设计和实施 |
| [research](../../../../skills/research/SKILL.md) | 多步取证与比较；简单定位和常规信息确认不启动完整调查 |
| [test-design](../../../../skills/test-design/SKILL.md) | 设计用例及验证办法；不编写或运行测试 |
| [bug-debugging](../../../../skills/bug-debugging/SKILL.md) | 具体症状取证、根因和方案；具体方案获同意后修复 |
| [architecture-scout](../../../../skills/architecture-scout/SKILL.md) | 用户主动发起架构机会调查；允许没有候选 |
| [implementation-workflow](../../../../skills/implementation-workflow/SKILL.md) | 评估依赖、组织实施、集成验证及按风险审计 |
| [diff-review](../../../../skills/diff-review/SKILL.md) | Correctness、Standards、Spec 三轴独立评审 |
| [complexity-audit](../../../../skills/complexity-audit/SKILL.md) | 复杂度与覆盖率风险报告；工具不足如实降级 |
| [mutation-testing](../../../../skills/mutation-testing/SKILL.md) | 用已有突变工具审计测试漏洞；不提交业务或测试修复 |
| [wiki](../../../../skills/wiki/SKILL.md) | 项目知识阅读、初始化、维护、机械检查和同步分析 |

## 主要流程

1. 依据请求选择技能，复用现有需求、调查和验证证据。
2. 只在需要独立上下文、且宿主确有派发工具时委派；并行任务必须无未解决依赖、无同文件或产物冲突。
3. 实施者负责代码和实际测试；测试设计与审计分别交付其约定结果。
4. 调试保留方案确认边界；已有批准不重复询问，部署和外发仍受实际授权约束。
5. 项目已配置 Wiki 复核时，引用前检查新鲜度；开发收尾核对受影响知识，实际更新或说明无需更新后保存复核声明，未解决冲突保留 blocked。
6. 主 Agent 核对返回产物、实际执行证据及缺口后交付；技能交付不自动触发下个阶段。

## 阅读导航

[公共术语](../../concepts.md)、[技能发现适配](../skill-provider/README.md)、[项目知识维护工具](../wiki-tooling/README.md)。

## 依据与核验

2026-10-27 核对上表所链接的十份技能正文与 [架构中的委派协议](../../../architecture.md)；[技能发现测试](../../../../tests/skill-provider.test.mjs) 已在本机通过，只证明发现和读取等契约，不证明每个技能的模型行为质量。

## 待确认项

当前上下文中没有十技能全量跨宿主行为评测证据。全生命周期讨论稿尚不能作为自动编排的实现承诺。
