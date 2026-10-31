# 生成 Wiki

从零生成，或按新目录重写一套 Wiki。

## 1. 扫描

```bash
node <技能目录>/scripts/wiki.mjs scan [--root <项目根>] [--wiki docs/wiki]
```

只读输出文件数、编程语言分布、入口候选、目录体量、已有文档和语言建议（`suggested`、`pathLanguage`、`evidence`）。扫描结果只是线索：规划前还要读入口代码（manifest、main、路由、CLI）、README 和已有文档，弄清项目做什么、怎么运行、主链路经过哪些模块。

## 2. 规划目录

先确定语言，两项各取第一个有结论的：

| 顺序 | `language` | `pathLanguage` |
|---|---|---|
| 1 | 用户指定的文档语言 | 用户指定的路径语言 |
| 2 | 已有 catalog | 用户指定的文档语言（“生成中文 Wiki”即得到中文路径） |
| 3 | 扫描 `suggested` | 已有 catalog |
| 4 | 对话语言 | 扫描 `pathLanguage` |

再写 `<wiki>/catalog.json`：

```json
{
  "version": 2,
  "title": "项目名",
  "language": "zh-CN",
  "pathLanguage": "zh-CN",
  "pages": [
    {
      "id": "order",
      "title": "订单模块",
      "path": "核心模块/订单.md",
      "summary": "负责下单、支付回调和状态流转；不负责库存扣减。",
      "sources": ["src/order", "src/payment/callback.ts"],
      "children": []
    }
  ]
}
```

| 字段 | 要求 |
|---|---|
| `id` | 稳定 ASCII 标识，改标题不改 id |
| `path` | 相对 wiki 目录的 `.md` 路径，按 `pathLanguage` 命名；`README.md` 不列入 pages |
| `summary` | 一句话写明负责与不负责的范围，与页面引用块一致 |
| `sources` | 项目相对路径，可以是目录；只列本页结论真正依赖的文件 |
| `children` | 可选，子页面的 `path` |
| `status` | 可选，`planned` 表示暂未生成 |

默认骨架，按项目裁剪，没有内容的不建：

| 分组 | 模板 | 内容 |
|---|---|---|
| 项目概览 | overview | 做什么、给谁用、技术栈、如何运行（写在 `README.md`） |
| 快速上手 | guide | 本地启动、测试、常用命令 |
| 系统架构 | architecture | 组件、数据流、外部依赖 |
| 核心模块 | module | 每个能力一页，按开发问题划分，不照搬目录 |
| 关键流程 | guide | 跨模块主链路，如请求生命周期、发布流程 |
| 部署与运维 | guide | 构建产物、环境配置、排障入口 |
| 开发指南 | guide | 约定、扩展点、测试方法 |

### 页面粒度

一页回答一类开发问题。页面数随项目规模增长，不为压缩目录把多个能力塞进一页，否则判定条件、错误码、上限和状态集合会被挤掉；来源过少的页面并入相邻页。

`check` 按页面宽度判定：`sources` 展开后的文件加正文链接到的文件，去重，不计 Markdown；README 除外；阈值固定。

| 宽度 | 结果 | 处理 |
|---|---|---|
| ≤ 15 | 通过 | — |
| 16～30 | 列入 `coverage.catalog.oversized` | 确认是否在讲多个能力；保留时在确认目录时说明理由 |
| > 30 | `page-too-broad`，退出码 1 | 必须拆：父页讲边界与主链路，子页（`children`）各讲一个能力；或把目录换成真正依赖的具体文件 |

写好 catalog 后先运行一次 `check`（忽略 `missing-page`、`missing-readme`），在确认目录前处理宽度。正文写完后宽度会因链接增加，收尾仍报 `page-too-broad` 时同样拆页，不靠删链接过关。

## 3. 确认目录

生成正文前向用户展示：分组、页面标题与摘要、两项语言及依据、保留的 `oversized` 页面及理由。用户确认后继续；用户明确要求一次完成时跳过。

- 已有旧 Wiki 而没有 catalog：说明将按新结构重写；旧文件保留，用户要求时才删除。
- `pathLanguage` 与已有页面路径的命名语言不同：列出将改名的页面和 Wiki 外引用这些路径的文件（如 `AGENTS.md`、`CLAUDE.md`、代码注释），确认后按新路径生成并同步入链。

## 4. 逐页生成

每页按 `assets/pages/` 对应模板和 `writing.md` 编写：读该页 `sources` 的实际代码，追入口和调用方，写结论并就近链接源码。

宿主支持子 Agent 时可并行，每个子 Agent 只写自己的页面。派发时传入项目根与 wiki 目录的绝对路径、页面的 catalog 条目、相邻页面的标题与路径、`language`，以及模板和 `writing.md` 的绝对路径。大仓库可以分批，未生成的页面标 `status: "planned"`。

## 5. 收尾

1. 写 `README.md`：概览加完整导航，按 catalog 分组列出每页链接与摘要。
2. 运行 `check`（命令与问题代码见 `tools.md`），处理全部问题后重跑至通过。
3. 交付：报告页面数、语言、planned 页面，以及推断较多或来源不足的页面。
