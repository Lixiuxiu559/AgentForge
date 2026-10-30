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
| skills 下的技能真源 | Codex、Claude Code、Qoder 打包层、DSH provider | 名称、描述、调用策略和技能正文 |
| src/index.js 与 cordis.patch.yml | DSH 宿主 | provider 注册；宿主需提供 skills 服务 |
| 技能 references/scripts/assets | 读取技能的 Agent | 方法、检查/复核脚本和模板，必须保留安装资源路径 |
| 用户目标项目 | Wiki 与其他工程技能 | 既有规范、源码、Git 和测试设施 |
| 宿主工具与授权 | 主 Agent 与子 Agent | 文件操作、执行、上下文隔离及实际委派 |
| 项目包清单及 CHANGELOG | doctor 与发布脚本 | 版本一致性、打包资产和发布说明 |
| 标签推送 | release.yml | 构建 Qoder ZIP、创建 GitHub Release 并上传附件，和 npm 分开 |
| Qoder 清单与共用 skills | package-qoder.mjs | 临时转换调用策略、复制资源并用系统 zip 打包 |

## 接口与契约

包内 JavaScript 只使用 Node 内置模块，package.json 无 dependencies。Wiki 的 changes、mapping、freshness、review 和 gate 另依赖本机 Git；worktree 技能依赖本机 Git 及所选远端可访问性，用于获取基线或检查远端重名；其他审计技能依赖目标项目已有的相应分析工具，不能将“包零依赖”理解成全部任务不需要外部工具。

[四端插件信息](../../../architecture.md) 规定共享技能与宿主提供执行能力。[CI 配置](../../../../.github/workflows/validate.yml) 声明 Node 22/24 矩阵；本次只在本机 Node v24.15.0 验证，不将配置存在写成两条运行时都通过。

[发布约定](../../../releasing.md) 与 [npm 发布说明](../../../npm-publishing.md) 是流程来源；这里不复制安装命令或凭据设置，外部服务当前状态仍待核实。

技能脚本用扩展名固定模块类型（crap.cjs 为 CommonJS，Wiki 的 .mjs 为 ES module），源码、npm/DSH 安装与 Qoder 包都不依赖额外模块配置，也不包含 DSH main/bundle 或 npm 依赖。Qoder 构建依赖系统 zip，包测试依赖 unzip；用户运行脚本仍需 Node/Git，宿主是否内置这些工具以实际环境为准。

## 依据与核验

2026-10-27 静态交叉核对 [包清单](../../../../package.json)、[DSH 入口](../../../../src/index.js)、[装配 patch](../../../../cordis.patch.yml)、[Claude Code 清单](../../../../.claude-plugin/plugin.json)、[Codex 清单](../../../../.codex-plugin/plugin.json) 和 [Codex marketplace](../../../../.agents/plugins/marketplace.json)。

2026-10-29 补核对 [Qoder 清单](../../../../.qoder-plugin/plugin.json)、[打包脚本](../../../../tools/package-qoder.mjs) 和[包回归](../../../../tests/qoder-package.test.mjs)；现有 provider 未改，整体回归通过。

## 待确认项

最低支持 Node 版本没有由 package.json engines 统一声明；CI 的版本矩阵只代表配置。宿主和外部发布服务的兼容性需另外验证。
