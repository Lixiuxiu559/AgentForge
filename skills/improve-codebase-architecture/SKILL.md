---
name: improve-codebase-architecture
description: 扫描代码库寻找深化机会，以可视化 HTML 报告呈现，然后对你选中的那个进行连珠炮式的追问。
disable-model-invocation: true
---

# 改进代码库架构

浮出架构摩擦，提出**深化机会**——把浅层模块变成深层模块的重构。目标是可测试性和 AI 可导航性。

这个命令*受*项目的领域模型启发，并建立在一套共享的设计词汇之上：

- 运行 `/codebase-design` 技能获取架构词汇（**module**、**interface**、**depth**、**seam**、**adapter**、**leverage**、**locality**）及其原则（删除测试、"接口就是测试面"、"一个 adapter = 假想 seam，两个 = 真实"）。在每条建议中精确使用这些术语——不要漂移到 "component"、"service"、"API" 或 "boundary"。
- `CONTEXT.md` 中的领域语言给好的 seam 起名字；`docs/adr/` 中的 ADR 记录了这个命令不该重新争议的决策。

## 流程

### 1. 探索

**扫描之前先圈定范围——YAGNI。** 深化一个模块的回报是让未来对它的修改更容易，所以要给代码库中近期变更过的部分额外权重。在看之前先决定*看哪里*：

- 如果用户指明了方向——一个模块、一个子系统、一个痛点——就采用它，跳过下面的推断。
- 否则，往回走一大段 commit 历史（`git log --oneline`）找代码库的热点——反复出现的文件和区域——让这些路径先抓住你的注意力。如果变更分散、没有明显热点，就扩大网。

先读项目的领域词汇（`CONTEXT.md`）和你所触及区域的任何 ADR。

然后生成一个子代理去走代码库。不要遵循僵硬的启发式——有机地探索，注意你在哪里体验到摩擦：

- 哪里理解一个概念需要在许多小模块之间来回跳？
- 哪些模块是**浅**的——接口几乎和实现一样复杂？
- 哪里纯粹为了可测试性抽出了函数，但真正的 bug 藏在它们被调用的方式里（没有 **locality**）？
- 哪里紧耦合的模块泄漏穿过它们的 seam？
- 代码库的哪些部分未测试，或难以通过当前接口测试？

对你怀疑是浅层的任何东西应用**删除测试**：删除它会把复杂性集中起来，还是只是挪个地方？"是的，会集中"正是你要的信号。

### 2. 以 HTML 报告呈现候选

把一个自包含的 HTML 文件写到操作系统临时目录，这样什么都不会落进仓库。从 `$TMPDIR` 解析临时目录，回退到 `/tmp`（Windows 上是 `%TEMP%`），写到 `<tmpdir>/architecture-review-<timestamp>.html`，这样每次运行都是新文件。为用户打开它——Linux 用 `xdg-open <path>`，macOS 用 `open <path>`，Windows 用 `start <path>`——并告诉他们绝对路径。

报告使用**通过 CDN 的 Tailwind** 做布局和样式，**通过 CDN 的 Mermaid** 画图——在图形/流程/序列能可靠传达结构的地方。混合使用 Mermaid 和手工 CSS/SVG 视觉——当关系是图状时（调用图、依赖、序列）用 Mermaid，当你想更编辑化时（体量图、剖面、折叠动画）用手工 div/SVG。每个候选配一个**前后对比可视化**。要可视化。

为每个候选渲染一张卡片：

- **Files**——涉及哪些文件/模块
- **Problem**——当前架构为什么造成摩擦
- **Solution**——用平实语言描述会改变什么
- **Benefits**——用 locality 和 leverage 解释，以及测试会如何改善
- **Before / After 图**——并排、手绘，展示浅层和深化
- **Recommendation strength**——`Strong`、`Worth exploring`、`Speculative` 之一，渲染成徽章

报告结尾加一个 **Top recommendation** 区块：你建议先做哪个候选、为什么。

**领域用 `CONTEXT.md` 词汇，架构用 `/codebase-design` 词汇。** 如果 `CONTEXT.md` 定义了 "Order"，就说 "the Order intake module"——不是 "the FooBarHandler"，也不是 "the Order service"。

**ADR 冲突**：如果一个候选与现有 ADR 矛盾，只在摩擦真实到值得重开 ADR 时才浮出它。在卡片里清楚标注（例如一个警告框：_"contradicts ADR-0007 — but worth reopening because…"_）。不要列出每个 ADR 禁止的理论性重构。

完整的 HTML 脚手架、图示模式与样式指南见 [HTML-REPORT.md](HTML-REPORT.md)。

先不要提出接口。文件写完后，问用户："你想探索哪一个？"

### 3. Grilling 循环

用户选定一个候选后，运行 `/grilling` 技能和他们一起走决策树——约束、依赖、深化后模块的形状、seam 后面坐什么、哪些测试存活。

- **想为深化后的模块探索替代接口？** 运行 `/codebase-design` 技能并使用它的 design-it-twice 并行子代理模式。
