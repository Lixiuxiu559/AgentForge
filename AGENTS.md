# AgentForge 项目知识维护

- 项目知识入口是 `docs/wiki/README.md`，约定保存在 `docs/wiki/wiki.config.json`。Wiki 为理解项目提供背景；需求、源码和实际验证仍按各自证据核实。
- 引用 Wiki 作决策前，运行 `npm run wiki:freshness -- --module <模块ID>`；跨模块阅读可省略模块参数。`stale`、`unknown` 或 `blocked` 不能表述为当前已确认事实，应读取相关来源核实，并说明缺口。
- 关联来源包括源码、规则文档、配置和测试。开发收尾时检查实际 diff 与受影响 Wiki，按授权范围更新文档或明确记录“无需更新”的理由；规则冲突未解决时记录 `blocked`，不改写规则掩盖问题。
- 完成复核后才运行 `npm run wiki:review -- --module <模块ID> --decision <结论> --reason <具体依据> --reviewer <实际执行者> --evidence '["项目相对路径"]'`。结论为 updated、no-change 或 blocked。该命令只保存复核记录，不代替语义核实；禁止为了过门而批量刷新记录。
- 交付前运行 `npm run wiki:check` 和 `npm run wiki:gate`。后者默认检查工作区；暂存内容使用 `-- --scope staged`。先暂存源码、Wiki 与配置，再按 staged 范围复核，最后暂存复核记录，避免工作区新记录掩盖待提交的旧内容。
- 仓库存在 `.codegraph/` 时，理解或定位代码优先使用 CodeGraph；没有时使用项目现有搜索工具，不自动建立索引。
