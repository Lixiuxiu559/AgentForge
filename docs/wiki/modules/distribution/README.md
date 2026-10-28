# 分发与发布验证

## 文档信息

| 字段 | 内容 |
|---|---|
| 适用范围 | 三端装配、版本同步和仓库中的验证发布入口 |
| 事实状态 | 部分核验 |
| 核验基线 | 历史功能基线 3e5341d；本轮 ee58dfd 后开发工作区的来源与文档按复核指纹核验 |
| 核验时间 | 2026-10-27 |

## 用途与边界

Claude Code、Codex 和 DSH 使用同一份 skills 真源。两份插件清单与 package.json 的发布候选版本均为 0.11.0，新增能力记录在 CHANGELOG 的对应版本段落。本地版本准备、远端 Release 和用户已安装版本是不同状态，应分别核实。

README 与发布文档记录的宿主更新语义在本次只作仓库约定引用，没有用真实安装副本复测。npm 工作流在当前文件中仅支持手动触发，不能从存在 publish.yml 推断 registry 已发布。

## 主要流程

1. 开发者维护技能、清单、测试与 Unreleased，运行 doctor 和 npm test。项目快捷命令 tools/wiki-project.mjs 也暴露 wiki:mapping，固定本仓库根与配置；范围解释见 Wiki 工具模块。使用 Wiki 时先检查新鲜度，开发收尾保存真实复核声明，交付前运行 wiki:check 和 wiki:gate。
2. Codex/Claude Code 清单定位共用技能目录；DSH 通过包 main 与 bundle patch 装配 provider。
3. package.json 的 files 包含 skills，使技能 references、脚本与 assets 随包分发；项目自身 docs 不是必需运行资产。
4. release.mjs 要求干净工作区与 main 分支，运行 doctor，同步三处版本和 CHANGELOG，创建提交与标签；可显式选择推送。
5. PR 的 Wiki 检查 job 明确检出 head，分别运行结构检查与以 base/head 为范围的同步检查门；Git 树中的记录不能被工作区补写替代。
6. release.yml 在标签推送时负责 GitHub Release；publish.yml 是独立手动 npm 流程。旧验证页记载本地版本准备；本轮只核对清单与脚本，未重做发布或核查历史发布操作，后续远端动作以对应 Release 和流水线实际结果为准。

## 阅读导航

[宿主与发布依赖](dependencies.md)、[发布约定](../../../releasing.md)、[本地验证记录](../../verification.md)。

## 依据与核验

2026-10-27 核对 [项目包配置](../../../../package.json)、[发布脚本](../../../../tools/release.mjs)、[结构检查](../../../../tools/doctor.mjs)、[验证工作流](../../../../.github/workflows/validate.yml)、[Release 工作流](../../../../.github/workflows/release.yml) 和 [npm 工作流](../../../../.github/workflows/publish.yml)；doctor 已本机通过，发布路径仅静态阅读。

## 待确认项

未查询远端 CI、标签、GitHub Release、npm registry 或宿主安装副本，也未设置远端分支保护。PR 工作流可报告失败；若要求服务端禁止绕过，需将该检查设为必需状态。仓库文档中的历史分发状态不能替代当前外部服务核验。
