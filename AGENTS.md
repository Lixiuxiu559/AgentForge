# AgentForge 项目知识维护

- 项目知识入口是 `docs/wiki/README.md`。Wiki 为理解项目提供背景；需求、源码和实际验证仍按各自证据核实。
- 引用 Wiki 作决策前，按页面列出的来源回到代码核实；Wiki 只提供背景，不替代源码与验证。
- 代码行为变更后同步受影响的 Wiki 页面并运行 `node skills/wiki/scripts/wiki.mjs check`；目录或页面增减时同步 `docs/wiki/catalog.json` 与 `README.md` 导航。
- 仓库存在 `.codegraph/` 时，理解或定位代码优先使用 CodeGraph；没有时使用项目现有搜索工具，不自动建立索引。
