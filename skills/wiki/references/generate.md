# 生成 Wiki

从零生成，或按新目录重写一套 Wiki。四个阶段：扫描、规划目录、逐页生成、收尾检查。

## 1. 扫描

```bash
node <技能目录>/scripts/wiki.mjs scan [--root <项目根>] [--wiki docs/wiki]
```

输出文件数、编程语言分布、入口候选、目录体量、已有文档清单，以及 `language` 建议（`suggested`、`pathLanguage`、`evidence`）。扫描只读，不调用模型。`suggested` 为 `null` 时使用当前对话语言。

扫描结果只是线索。规划前还要读入口代码（manifest、main、路由、CLI）、README 和已有文档，弄清项目做什么、怎么运行、主链路经过哪些模块。

## 2. 规划目录

先确定语言，顺序取第一个有结论的：用户本次指定 > 已有 catalog > 扫描建议 > 对话语言。规则见 `writing.md` 的“语言”。

写 `<wiki>/catalog.json`：

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
| `id` | 稳定标识，ASCII，改标题不改 id |
| `path` | 相对 wiki 目录的 `.md` 路径，命名语言按 `pathLanguage`；`README.md` 是入口，不列入 pages |
| `summary` | 一句话，写明负责和不负责的范围，与页面开头的引用块一致 |
| `sources` | 项目相对路径，可以是目录；只列本页结论真正依赖的文件 |
| `children` | 可选，子页面的 `path` |
| `status` | 可选，`planned` 表示暂未生成 |

默认骨架，按项目实际裁剪，没有内容的不建：

| 分组 | 模板 | 内容 |
|---|---|---|
| 项目概览 | overview | 做什么、给谁用、技术栈、如何运行（通常写在 `README.md`） |
| 快速上手 | guide | 本地启动、测试、常用命令 |
| 系统架构 | architecture | 组件、数据流、外部依赖 |
| 核心模块 | module | 每个能力一页，按开发问题划分，不照搬目录 |
| 关键流程 | guide | 跨模块主链路，如请求生命周期、发布流程 |
| 部署与运维 | guide | 构建产物、环境配置、排障入口 |
| 开发指南 | guide | 约定、扩展点、测试方法 |

页面粒度：一页回答一类开发问题，通常对应 3～15 个来源文件。来源过多时拆页，过少时并入相邻页；`check` 会在 `coverage.catalog.oversized` 列出来源超过 15 个文件的页面（README 除外），作为拆页提示，不算问题。小项目可以只有 README 加三四页。

## 3. 确认目录

生成正文前，把目录展示给用户：分组与页面标题、每页摘要、文档语言与路径语言及其依据。用户确认或修改后再继续。用户明确要求一次完成时跳过确认。

已有 Wiki 但没有 catalog.json 时，先说明将按新结构重写，旧文件保留，不自动删除。

## 4. 逐页生成

每页按对应模板（`assets/pages/`）和 `writing.md` 编写：读该页 `sources` 的实际代码，追入口和调用方，写结论并就近链接源码。

宿主支持子 Agent 时可并行：每个子 Agent 领一个或几个页面，只写自己的文件。派发时传入：

- 项目根和 wiki 目录的绝对路径；
- 页面的 catalog 条目，以及相邻页面的标题与路径（用于互链）；
- `language`，子 Agent 不自行判断语言；
- 模板和 `writing.md` 的绝对路径。

宿主不支持时串行生成。大仓库可以分批：未生成的页面在 catalog 中标 `status: "planned"`，下次继续。

## 5. 收尾

1. 写 `README.md`：概览内容加完整导航，导航按 catalog 分组列出每页链接与摘要。
2. 运行检查：

```bash
node <技能目录>/scripts/wiki.mjs check [--root <项目根>] [--wiki docs/wiki]
```

处理 `missing-source`、`summary-mismatch`、`language-mismatch`、`broken-link`、`unreachable-page` 等问题后重新检查。检查只证明结构和链接，正文是否符合代码仍由生成者负责。

3. 交付：报告页面数、语言、未生成的 planned 页面，以及推断较多或来源不足的页面。
