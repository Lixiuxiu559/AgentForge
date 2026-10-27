# DSH 技能发现与资源读取

## 文档信息

| 字段 | 内容 |
|---|---|
| 适用范围 | src/index.js 的目录扫描、按需读取与 provider 装配 |
| 事实状态 | 部分核验 |
| 核验基线 | d64c4c5 基础提交 + 本次工作区；项目复核记录保存来源与文档内容指纹 |
| 核验时间 | 2026-10-27 |

## 用途与边界

包名为 dsh-agentforge，provider 名为 agentforge，仅依赖宿主 skills 服务。它负责发现技能及读取正文，执行与委派由宿主完成。包根由模块文件位置确定，不从当前工作目录或目标项目推导。

当前解析器只支持本仓库使用的 YAML frontmatter 子集：顶层键、单行标量及块标量；不是通用 YAML 解析器。

## 主要流程

1. [bundle patch](../../../../cordis.patch.yml) 装配包，apply 注册 provider。
2. list 每次扫描 skills 的直接子目录 SKILL.md 与顶层 Markdown，跳过隐藏、嵌套或不可读取的候选。缺少可解析的 name 或 description 时不进入候选列表。
3. Candidate 带调用策略、定位和优先级；正文尚未加载。
4. get 按 locator 读当前正文，返回绝对 path 和 resourceBase，并在正文中展开插件根占位符；引用文件不会由此自动模板化。
5. architecture-scout 在 DSH 中通过 frontmatter 禁用模型隐式调用，Codex 对应技能内 policy；其余行为仍取决于宿主。

provider 下次读取会反映磁盘变化；宿主可能另有缓存，桥接入口变更后仍应按项目说明重启 profile。

## 阅读导航

[源码](../../../../src/index.js)、[发现与迁移测试](../../../../tests/skill-provider.test.mjs)、[宿主与分发依赖](../distribution/dependencies.md)。

## 依据与核验

2026-10-27 静态读取 [provider 源码](../../../../src/index.js)、[架构约定](../../../architecture.md)、[Codex 调用策略](../../../../skills/architecture-scout/agents/openai.yaml)；本机已执行 [provider 测试](../../../../tests/skill-provider.test.mjs) 的发现、调用策略、资源路径及迁移重扫场景。

## 待确认项

本次没有启动 DSH、Codex 或 Claude Code 的真实安装副本；未验证宿主缓存与 UI 展示。
