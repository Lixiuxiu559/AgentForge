# AgentForge 架构

## 技能作为方法真源

六个技能保存在 `skills/<name>/SKILL.md`，配套方法和脚本放在各自 `references/` 与 `scripts/`。不维护自定义 agent 定义，也不把同一套方法复制成宿主专用角色提示词。

技能包含任务边界、执行方法、派发条件、上下文传递与回报格式。主 Agent 根据任务选择方法，需要隔离或并行时调用宿主通用子 agent 工具。Skill 本身不提供执行引擎；没有宿主派发能力时只能在主上下文执行，并如实报告限制。

## 委派协议

1. 主 Agent 确定目标项目、范围、基线、依赖和验收条件。
2. 为独立任务构造自包含说明，传目标项目与技能资源的绝对路径；资源不可读时传必要方法全文。
3. 实际调用宿主通用派发工具，创建独立上下文。任务标签不对应注册的角色类型，不设置固定模型或工具白名单。
4. 子 agent 只执行所分配范围，不递归启动完整编排；返回完成、部分完成或失败，以及证据、实际验证和未验证项。
5. 主 Agent 等待结果、处理缺失与失败、检查集成，再汇总。调查只抽查关键证据，避免重新做一遍全部调查。

并发仅适用于无依赖且不会冲突的任务。独立上下文不等于独立文件系统；源码文件、构建目录、数据库和测试报告都需要明确所有权或互斥。没有并发名额时可串行委派，宿主没有派发能力时由主 Agent 串行执行。

评审三轴使用同一代码基线、不同检查方法，互不参考结论。审计只报告是行为约定，不是沙箱权限。覆盖率和突变工具可能生成临时产物，不能因为不提交修复就视为无副作用。

## Claude Code 装配

`.claude-plugin/plugin.json` 与 `marketplace.json` 提供分发元数据，技能由宿主发现。`architecture-scout` 在说明中限定用户主动调用；Claude Code 侧由模型遵循该约定。没有根级 `agents/` 注册资产。

## Codex 装配

`.codex-plugin/plugin.json` 指向同一份 `./skills/`；`.agents/plugins/marketplace.json` 把仓库根目录作为可安装插件源。这里只声明技能，不添加 MCP、app 或自定义子 agent。

`skills/architecture-scout/agents/openai.yaml` 是该技能的 Codex 调用策略文件，`allow_implicit_invocation: false` 保留仅用户主动调用的语义。这个 `agents/` 路径是技能元数据目录，不是子 agent 定义。

同一技能的 `dsh-model-invocable: false` 保留 DSH 的模型目录限制。Codex 插件校验器不接受 Claude Code 的 `disable-model-invocation: true`，所以共享 frontmatter 不再使用该字段。

Codex 安装后加载插件副本；修改仓库文件不会自动更新已安装副本。更新 marketplace/插件并开启新任务后再验证技能发现、reference 路径与实际委派行为。独立上下文和并行仍由当前 Codex 宿主提供。

## DSH 装配

`package.json` 声明 `dsh.bundle.patch`，`cordis.patch.yml` 加载 `src/index.js`。桥接代码只使用 Node 内置模块，不依赖 DSH 内部 npm 包。

- `name` 与 npm 包名 `dsh-agentforge` 一致。
- `inject = ['skills']`，`apply(ctx)` 只注册技能提供者。
- provider 名称为 `agentforge`；不注册同名工具。
- `list()` 每次扫描包根下的技能目录，返回元数据与调用策略。支持直接子目录的 `SKILL.md` 和顶层 Markdown，忽略隐藏项、嵌套技能及无效元数据。
- `get(candidate)` 按需读正文，设置绝对 `path` 与 `resourceBase`，保留调用策略。
- 兼容正文中的 `${CLAUDE_PLUGIN_ROOT}` 占位符；reference 文件以技能目录为基准解析，不假定目标项目包含插件资源。
- 包根从模块位置推导，与宿主工作目录无关。新增/删除/修改技能在下次读取时反映；宿主可能另有缓存。
- 注册生命周期由 Cordis 管理；桥接代码更新需要重启 profile。

通用子 agent 工具、上下文创建、并发额度和运行状态由宿主提供。AgentForge 不再做工具名映射、模型选择、persona 构造或 subagent provider 路由。

## 迁移

移除 `agents/*.md`、DSH `agentforge` 工具及其 `agent` 枚举参数。旧角色调用改为相应 Skill 加宿主通用派发；映射见 README。旧的 `config.toolName`、`config.provider`、`config.agents` 不再使用。

这是现有调用契约的移除，正式发布遵循仓库的破坏性变更规则。历史 CHANGELOG 和研究报告保留原时点事实；当前行为以本文件与技能为准。

## 验证边界

`tools/doctor.mjs` 验证三端结构、清单、版本、技能引用、发布资产与入口契约。Node 内置测试验证在仅有 skills 服务时加载 DSH 插件、动态扫描、按需加载、资源路径与 invocation 策略。CI 在 Node 22/24 上运行。

这些检查验证包内行为，不替代 Claude Code / DSH / 其他宿主的真实派发测试；不声称每个宿主都具备相同并发或上下文能力。
