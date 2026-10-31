---
name: wiki
description: 为代码仓库生成并维护项目 Wiki（项目文档、知识库、代码导读、架构说明、模块说明、开发指南），既供 Agent 按目录查阅，也供人阅读；Markdown 提交在仓库 docs/wiki/，以当前代码为准、关键结论附源码来源，目录与正文按项目语言生成。用户或 agent 均可独立调用。不处理飞书知识库（lark-wiki），也不是 zread CLI 的 .zread/wiki 产物；不修复代码、不发布。
user-invocable: true
---

# 项目 Wiki

为开发人员和编码 Agent 讲清项目如何工作、如何修改。产物是 `docs/wiki/` 下的 Markdown：`catalog.json` 是目录真源，`README.md` 是入口和导航，每页开头一行摘要、页尾列出来源。

## 任务入口

| 任务 | 做法 |
|---|---|
| 生成 | 按 `references/generate.md`：`scan` → 规划 `catalog.json` 并请用户确认 → 逐页生成 → 写 README 导航 → `check` |
| 阅读 | 先读 `README.md` 与 `catalog.json`，按 `summary` 选页；关键结论按页面来源回到代码核实。只读，不顺带修改 |
| 更新 | 读受影响页面全文和实际代码 diff，按 `references/writing.md` 的“修订”改原文；目录变化同步 catalog；最后 `check` |
| 检查 | `check` 报告链接、锚点、catalog 与文件一致性、摘要和语言问题；命令见 `references/tools.md` |

没有 `catalog.json` 的旧版 Wiki 继续按 `references/freshness.md` 与 `references/tools.md` 的旧流程维护；新结构的迁移在后续版本提供。

## 写作原则

1. **以代码为准**：追真实入口、调用方和配置生效链；文档与代码不一致时按实际执行路径写。测试代码不等于测试通过，部署脚本不等于已上线。
2. **关键结论附来源**：就近链接源码文件和行号，页尾来源与 catalog `sources` 一致。
3. **语言一致**：确定顺序为用户指定 > 已有 catalog > `scan` 建议 > 对话语言；用户指定的语言同时作用于 `language` 和 `pathLanguage`，除非另行指定路径语言。正文、标题、图中文字用 `language`，文件名用 `pathLanguage`，代码标识符和命令原样保留。派发子 Agent 时必须传入 `language`。
4. **按开发问题组织**：一页回答一类问题，不照搬目录，不用文件清单代替解释；推断就近标注。
5. **修订而非追加**：更新时改错误的原句，把新知识融入对应章节，不在末尾追加补丁段。

脚本只做扫描和机械检查，不调用模型；`check` 通过不证明正文语义正确。Wiki 任务只修改文档，不修改代码、部署或读取凭据。其他技能不调度本技能。
