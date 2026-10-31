---
name: wiki
description: 为代码仓库生成并维护项目 Wiki（项目文档、知识库、代码导读、架构说明、模块说明、开发指南），既供 Agent 按目录查阅，也供人阅读；Markdown 提交在仓库 docs/wiki/，以当前代码为准、关键结论附源码来源，目录与正文按项目语言生成。用户或 agent 均可独立调用。不处理飞书知识库（lark-wiki），也不是 zread CLI 的 .zread/wiki 产物；不修复代码、不发布。
user-invocable: true
---

# 项目 Wiki

为开发人员和编码 Agent 讲清项目如何工作、如何修改。产物在 `docs/wiki/`：`catalog.json` 是目录真源，`README.md` 是入口，每页开头一行摘要、页尾列出来源。

| 任务 | 做法 |
|---|---|
| 生成 | 按 `references/generate.md`：`scan` → 规划 catalog 并请用户确认 → 逐页生成 → README 导航 → `check` |
| 阅读 | 读 `README.md` 与 `catalog.json`，按 `summary` 选页，关键结论回到代码核实；只读 |
| 更新 | 读受影响页面全文和实际代码 diff，按 `references/writing.md` 的“修订”改原文，目录变化同步 catalog，最后 `check` |
| 检查 | `check`，命令与结果见 `references/tools.md` |

写作规则在 `references/writing.md`：以代码为准、关键结论附源码行号、语言统一、修订而非追加。派发子 Agent 时必须传入 `language`。

`check` 只做机械检查，通过不证明正文正确。Wiki 任务只改文档，不改代码、不部署、不读凭据；其他技能不调度本技能。

没有 `catalog.json` 的旧版 Wiki（`wiki.config.json` 结构）不再支持：按“生成”重新生成；旧文件是否删除由用户决定。
