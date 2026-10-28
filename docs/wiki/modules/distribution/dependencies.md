# 宿主与发布依赖

## 文档信息

| 字段 | 内容 |
|---|---|
| 适用范围 | 技能内容、provider、工具和外部宿主之间的依赖关系 |
| 事实状态 | 部分核验 |
| 核验基线 | 历史功能基线 3e5341d；本轮 ee58dfd 后开发工作区的来源与文档按复核指纹核验 |
| 核验时间 | 2026-10-27 |

## 上下游关系

| 上游 | 使用方 | 依赖内容 |
|---|---|---|
| skills 下的技能真源 | Codex、Claude Code、DSH provider | 名称、描述、调用策略和技能正文 |
| src/index.js 与 cordis.patch.yml | DSH 宿主 | provider 注册；宿主需提供 skills 服务 |
| 技能 references/scripts/assets | 读取技能的 Agent | 方法、检查/复核脚本和模板，必须保留安装资源路径 |
| 用户目标项目 | Wiki 与其他工程技能 | 既有规范、源码、Git 和测试设施 |
| 宿主工具与授权 | 主 Agent 与子 Agent | 文件操作、执行、上下文隔离及实际委派 |
| 项目包清单及 CHANGELOG | doctor 与发布脚本 | 版本一致性、打包资产和发布说明 |
| 标签推送 | release.yml | 创建 GitHub Release，和 npm 分开 |

## 接口与契约

包内 JavaScript 只使用 Node 内置模块，package.json 无 dependencies。Wiki 的 changes、mapping、freshness、review 和 gate 另依赖本机 Git；其他审计技能依赖目标项目已有的相应分析工具，不能将“包零依赖”理解成全部任务不需要外部工具。

[三端插件信息](../../../architecture.md) 规定共享技能与宿主提供执行能力。[CI 配置](../../../../.github/workflows/validate.yml) 声明 Node 22/24 矩阵；本次只在本机 Node v24.15.0 验证，不将配置存在写成两条运行时都通过。

[发布约定](../../../releasing.md) 与 [npm 发布说明](../../../npm-publishing.md) 是流程来源；这里不复制安装命令或凭据设置，外部服务当前状态仍待核实。

## 依据与核验

2026-10-27 静态交叉核对 [包清单](../../../../package.json)、[DSH 入口](../../../../src/index.js)、[装配 patch](../../../../cordis.patch.yml)、[Claude Code 清单](../../../../.claude-plugin/plugin.json)、[Codex 清单](../../../../.codex-plugin/plugin.json) 和 [Codex marketplace](../../../../.agents/plugins/marketplace.json)。

## 待确认项

最低支持 Node 版本没有由 package.json engines 统一声明；CI 的版本矩阵只代表配置。宿主和外部发布服务的兼容性需另外验证。
