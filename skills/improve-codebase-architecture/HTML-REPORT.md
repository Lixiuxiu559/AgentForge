# HTML 报告格式

架构审查渲染为操作系统临时目录中一个自包含的 HTML 文件。Tailwind 和 Mermaid 都来自 CDN。Mermaid 可靠地处理图状图示；手工 div 和内联 SVG 处理更编辑化的视觉（体量图、剖面、交叉引用）。混合使用两者——不要什么都靠 Mermaid，会显得千篇一律。

## 脚手架

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Architecture review — {{repo name}}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script type="module">
      import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
      mermaid.initialize({ startOnLoad: true, theme: "neutral", securityLevel: "loose" });
    </script>
    <style>
      /* 为 Tailwind 覆盖不干净的地方加一小层自定义：
         虚线 seam 线、手绘感箭头等。 */
      .seam { stroke-dasharray: 4 4; }
      .leak { stroke: #dc2626; }
      .deep { background: linear-gradient(135deg, #0f172a, #1e293b); }
    </style>
  </head>
  <body class="bg-stone-50 text-slate-900 font-sans">
    <main class="max-w-5xl mx-auto px-6 py-12 space-y-12">
      <header>...</header>
      <section id="candidates" class="space-y-10">...</section>
      <section id="top-recommendation">...</section>
    </main>
  </body>
</html>
```

## 头部

仓库名、日期，和一条紧凑的图例：实线框 = 模块，虚线 = seam，红色箭头 = 泄漏，深色粗框 = 深层模块。不要引言段落——直接进入候选。

## 候选卡片

图示承担重量。散文稀疏、平实，使用（`/codebase-design` 技能的）词汇，不绕弯。

每个候选是一个 `<article>`：

- **Title**——简短，命名这次深化（例如 "Collapse the Order intake pipeline"）。
- **徽章行**——推荐强度（`Strong` = 翠绿，`Worth exploring` = 琥珀，`Speculative` = 石板灰），加一个依赖类别标签（`in-process`、`local-substitutable`、`ports & adapters`、`mock`）。
- **Files**——等宽列表，`font-mono text-sm`。
- **Before / After 图**——核心。两列并排。见下面的模式。
- **Problem**——一句话。什么在痛。
- **Solution**——一句话。什么会变。
- **Wins**——要点，每条 ≤6 个词。例如 "Tests hit one interface"、"Pricing logic stops leaking"、"Delete 4 shallow wrappers"。
- **ADR 提示框**（如果适用）——一行，琥珀色框。

不要解释段落。如果一张图需要一段话才能看懂，重画这张图。

## 图示模式

挑选适合候选的模式。混合使用。不要让每张图看起来一样——变化本身就是要点之一。

### Mermaid 图（依赖 / 调用流的主力）

当要点是 "X 调 Y 调 Z，看看这团乱麻" 时用 Mermaid `flowchart` 或 `graph`。包进 Tailwind 风格卡片，避免突兀。用 classDef 把泄漏边涂红、把深层模块涂深色。序列图适合 "before：6 次往返；after：1 次"。

```html
<div class="rounded-lg border border-slate-200 bg-white p-4">
  <pre class="mermaid">
    flowchart LR
      A[OrderHandler] --> B[OrderValidator]
      B --> C[OrderRepo]
      C -.leak.-> D[PricingClient]
      classDef leak stroke:#dc2626,stroke-width:2px;
      class C,D leak
  </pre>
</div>
```

### 手工盒子与箭头（Mermaid 布局跟你对着干时）

模块做成带边框和标签的 `<div>`。箭头做成内联 SVG `<line>` 或 `<path>`，绝对定位在 relative 容器上。当你想让 "after" 图呈现为一个粗边框深层模块、内部灰掉时用这个——Mermaid 渲染不出那种重量感。

### 剖面（适合分层的浅层）

堆叠水平带（`h-12 border-l-4`）展示一次调用穿过的层。Before：6 个薄层，每个什么都不做。After：1 个粗带，标注合并后的职责。

### 体量图（适合 "接口和实现一样宽"）

每个模块两个矩形——一个表示接口表面积，一个表示实现。Before：接口矩形几乎和实现矩形一样高（浅）。After：接口矩形矮，实现矩形高（深）。

### 调用图折叠

Before：函数调用树渲染为嵌套盒子。After：同一棵树折叠成一个盒子，现在内部的调用在它里面淡显。

## 样式指南

- 偏编辑化，不是企业仪表盘。慷慨留白。标题可选衬线字体（`font-serif` 与 stone/slate 很配）。
- 色彩节制：一个强调色（翠绿或靛蓝）加泄漏的红色和警告的琥珀色。
- 图示保持 ~320px 高，让前后对比舒适并排，无需滚动。
- 图示内的模块标签用 `text-xs uppercase tracking-wider`——它们读起来应该是示意图，不是 UI。
- 唯一的脚本是 Tailwind CDN 和 Mermaid ESM import。报告其余部分是静态的——没有应用代码，除了 Mermaid 自身的渲染没有交互。

## Top recommendation 区块

一张更大的卡片。候选名、一句为什么、锚点链接到它的卡片。就这些。

## 语气

平实英语，简洁——但架构名词和动词直接来自 `/codebase-design` 技能。简洁不是漂移的借口。

**精确使用：** module、interface、implementation、depth、deep、shallow、seam、adapter、leverage、locality。

**绝不替换：** component、service、unit（代替 module）· API、signature（代替 interface）· boundary（代替 seam）· layer、wrapper（代替 module，当你想说的是 module 时）。

**符合风格的措辞：**

- "Order intake module is shallow — interface nearly matches the implementation."
- "Pricing leaks across the seam."
- "Deepen: one interface, one place to test."
- "Two adapters justify the seam: HTTP in prod, in-memory in tests."

**Wins 要点用词汇表术语命名收益：** *"locality: bugs concentrate in one module"*、*"leverage: one interface, N call sites"*、*"interface shrinks; implementation absorbs the wrappers"*。不要写 *"easier to maintain"* 或 *"cleaner code"*——这些词不在词汇表里，挣不到它们的位置。

不要对冲、不要清嗓子、不要 "it's worth noting that…"。如果一个句子能变成要点，就变成要点。如果一个要点能砍掉，就砍掉。如果一个词不在 `/codebase-design` 词汇表里，先找一个在里面的，再发明新的。
