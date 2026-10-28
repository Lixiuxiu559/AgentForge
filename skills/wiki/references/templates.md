# 默认骨架与文档模板

## 先选择项目约定

初始化前读取项目指令、现有文档入口、目录和少量代表文档。已有 Wiki 的目录、文件命名、术语和内容结构优先；仅为本次已授权范围补充知识，不将默认模板套到全库，不重命名或迁移现有目录，也不覆盖人工解释。

交付程度、模块划分与映射审查见 `references/initialization.md`。模板提供默认信息位置，不决定业务真伪、项目角色或应当采用的审批流程。

没有现成约定时选择下面的默认骨架。`docs/wiki/` 是推荐位置；用户或项目已指定其他路径时使用指定位置。模板提供内容骨架，知识由 Agent 根据项目证据填写，工具不会自动创建文件。

### 小型项目：small

适用于 CLI、库、技能仓库或只有少量概念的项目：

```text
docs/wiki/
├── README.md
└── wiki.config.json
```

从 [index-small.md](../assets/templates/index-small.md) 生成入口页。用途、规则与实现、代码及依赖可放在同一篇文档；架构、安装/部署与运维知识也可合并为章节，或链接已核对的现有文档，在入口说明覆盖、缺口或不适用原因；无需为了满足形式拆出角色、权限或接口章节。阅读导航可以链接仓库已有说明、源码或测试；确实没有其他知识页面时写明单页范围。

需要拆出单独主题时使用 [guide.md](../assets/templates/guide.md)，并从入口页增加真实链接。默认检查会将额外 Markdown 文档作为 guide 检查；声明专用 type 后才启用对应契约。

### 多模块项目：modular

```text
docs/wiki/
├── README.md
├── concepts.md
├── wiki.config.json
├── architecture/                # 按需；已有架构文档优先链接复用
│   └── README.md
├── deployment/                  # 按需；已有安装/发布手册优先复用
│   ├── README.md
│   └── environments.md
├── operations/                  # 按需；已有 runbook 优先复用
│   ├── README.md
│   └── troubleshooting.md
└── modules/
    └── <模块名>/
        ├── README.md
        ├── rules.md             # 按需拆分
        ├── code-map.md          # 按需拆分
        └── dependencies.md      # 按需拆分
```

架构、部署环境、运维排障属于初始化应评估的知识面，但上面的对应目录和文件并非默认必需项。已有页面可保留原路径，在入口链接并交代覆盖情况；不适用时说明原因。

入口页使用 [index-modular.md](../assets/templates/index-modular.md)，公共概念使用 [concepts.md](../assets/templates/concepts.md)，模块入口使用 [module.md](../assets/templates/module.md)。每个模块至少有一篇 README；规则、代码映射和依赖可以保留在模块入口中，内容较多时再拆分：

| 文档类型 | 模板 | 填写重点 |
|---|---|---|
| 规则 | [rules.md](../assets/templates/rules.md) | 分别记录预期与约定、实现观察和运行验证，重要条目带来源、核验方式及适用范围 |
| 代码映射 | [code-map.md](../assets/templates/code-map.md) | 真实实现入口、职责及其对应的概念，不仅罗列文件 |
| 依赖 | [dependencies.md](../assets/templates/dependencies.md) | 上下游、接口与契约、适用版本和未决依赖 |

拆分后为入口、概念及模块页面维护可传递的导航：根入口能经本地 Markdown 链接到达知识目录中的每篇文档。只有目录名称或纯文本路径不构成可检查的导航。无需每页都直接链接根目录，也不要求业务依赖无环。

## 架构、部署与运维的按需模板

初始化评估这些知识是否已覆盖；不适用时在入口说明理由。沿用现有文档并链接优先，无约定且需要拆分时可采用：

```text
architecture/README.md        # architecture：系统边界、组件与数据流
deployment/README.md          # deployment：部署/安装方式、发布与回退
deployment/environments.md   # environments：各环境的声明与实际状态证据
operations/README.md          # operations：可观测性、故障与备份恢复
operations/troubleshooting.md # troubleshooting：按症状排查与恢复
```

路径相对于知识目录；这些路径不自动变成必需文件。目录中的 README.md 与模板文件名不同，按下面的对应关系选择：

| 知识类型 / type | 模板 | 填写重点 |
|---|---|---|
| architecture | [architecture.md](../assets/templates/architecture.md) | 系统边界、组件依赖、关键交互与数据流；区分设计与当前实现 |
| deployment | [deployment.md](../assets/templates/deployment.md) | 部署/安装前提、构建发布、验证回退及其限制 |
| environments | [environments.md](../assets/templates/environments.md) | 环境清单、状态证据和配置差异；逐条记录时间与适用版本 |
| operations | [operations.md](../assets/templates/operations.md) | 日常检查、日志/监控、故障处理、备份恢复及未验证边界 |
| troubleshooting | [troubleshooting.md](../assets/templates/troubleshooting.md) | 症状影响、排查步骤、预期观察、恢复与升级路径 |

五类模板以 schema 定义必需章节；文档须填真实依据或具体未知/不适用理由。环境页额外有“适用环境、观察时间、证据来源”字段，逐条状态仍应注明版本、时间和证据，不能把仓库清单当成线上观测。

新建专用页面时，在 structure.documents 显式声明 type 才启用专用检查；路径可由项目选择，small/modular 同样如此。已有自定义标题使用 project 模式的 requiredSections，省略 type，不附加默认元数据；默认 Wiki 引用的外部未选型手册也只检查其声明章节；不凭文件名自动更换旧页的检查规则。例如：

```json
{
  "version": 1,
  "modules": [],
  "structure": {
    "preset": "project",
    "documents": [
      {"path": "handbook/runtime.md", "type": "environments"},
      {"path": "docs/architecture.md", "requiredSections": ["系统组成", "数据流"]}
    ]
  }
}
```

模板类型和新鲜度映射分开配置：structure.documents 只规定文档怎么检查，不会自动把页面纳入 modules 的来源/文档指纹。需要持续检测时，还须将架构、环境和运维页面及其依据关联到适当模块；模块可以是系统知识领域，不必等于业务模块或目录。复用外部架构/发布文档时同样核对其映射，避免结构通过却漏检来源变化。

显式 type 接受本 schema 的全部文档类型，检查其共同字段、类型章节及额外字段；requiredSections 可叠加项目要求。project 中仅被选型的页面启用模板契约，未选型页面保持原样。字段存在不证明时间真实、证据有效或恢复可行，这些由 Agent 核实。

## 填写模板

模板的共同字段和各类型必需章节以 [schema.json](../assets/schema.json) 为规范来源，确定性检查读取同一份定义。默认文档保留规定的二级标题，可以在其中新增三级标题或扩展其他章节。

1. 将所需模板内容写入目标项目中的相应文件；只创建实际需要的页面。
2. 用完整的项目事实、真实链接或明确的未知说明替换全部 `{{...}}`。占位符承载整段内容，不是需要保留的模板语法。资料不足时写“待确认：尚未找到该规则的批准依据”等具体缺口；不要空留表格或用示例路径冒充来源。
3. 按 `references/knowledge-classification.md` 分类重要条目，再填写适用范围、事实状态、核验基线与核验时间。页面事实状态是查证概况，不能代替条目分类。基线可以是真实提交、版本、文档修订号或已记录的文件快照；资料不可得时明确写未确认。事实状态只能用草稿、部分核验或已核验；只有草稿允许核验时间为“未核验”，其他状态填实际核验的 `YYYY-MM-DD`。
4. 在“依据与核验”中列出实际使用的需求、决策、源码、测试等来源及核对范围。按 `references/content-verification.md` 检查结论未超出平台/环境/渠道证据，追踪路径等操作描述的实际生效链，反查本页来源映射并同步入口摘要；建议不标成项目约定。不能因为复制了模板、读取过文档或链接检查通过就将状态改为已核验；核验基线也不等于生产部署版本。
5. “待确认项”按 `references/knowledge-classification.md` 的准入规则，只列合理查证后仍影响当前必要结论、决策或操作的具体问题，交代影响、已有依据与下一步查证。已知边界放正文，未执行验证放“依据与核验”或相关操作旁，未来设想不自动进入待办。没有符合项时写“无已知待确认项”，不填免责声明凑章节，也不为减少问题删掉必要风险提示。

每个必需章节都应有实质内容。没有适用的权限、依赖或公式时可以说明不适用及原因，无需创造业务概念。模板检查能验证字段、章节、占位符和链接结构，不能证明来源真实、业务规则正确或部署状态有效，这些仍需 Agent 对照证据核实。

新规则页使用“预期与约定”“实现观察”“运行验证”。没有有效预期或实际运行证据时，在对应位置记录具体未知，不因标题需要而编造批准或执行。已有默认规则页的旧标题仅作结构兼容；维护时核查其内容分类，不把“已确认规则”四个字本身视为决策证据。

## 声明检查约定

采用默认骨架时，在目标项目保留配置以便后续生成与检查保持一致。推荐保存为知识目录内的 `wiki.config.json`，路径均相对于目标项目根；`modules` 仍用于可选的变更映射，允许空数组。

小型项目配置：

```json
{
  "version": 1,
  "modules": [],
  "structure": {
    "preset": "small"
  }
}
```

多模块项目使用相同结构，将 preset 改为 `modular`。两种默认骨架的入口均为所选知识目录的 README.md；可以通过 structure.entry 显式指定项目相对 Markdown 路径，但不会因此取消默认骨架的必需文档要求。

按实际项目和技能安装位置运行：

```bash
node /absolute/skill-directory/scripts/wiki.mjs check --root /absolute/project --wiki docs/wiki --config docs/wiki/wiki.config.json
```

后续维护和检查也应读取已保存的配置，并继续显式传入 `--config`；工具不会自动发现配置。省略配置时只执行基础项目模式检查，不能据此宣称已符合所选默认结构。

先检查新文档是否符合选择的约定，再核对修改 diff、来源及事实。存在格式问题时局部修正；不要通过删除未知说明、编造来源或改写业务规则来取得检查通过。

### 已有项目：project

未配置 structure 时默认使用 project，保留原有链接与路径检查，不要求默认目录、章节或元数据。不要仅为了运行工具而创建配置。

项目希望机器检查既有约定时，可显式声明必需文档和二级章节；不需要将旧文档迁移成默认模板。例如已有 `handbook` 目录：

```json
{
  "version": 1,
  "modules": [],
  "structure": {
    "preset": "project",
    "entry": "handbook/start.md",
    "documents": [
      {
        "path": "handbook/start.md",
        "requiredSections": ["范围", "导航"]
      },
      {
        "path": "handbook/api.md",
        "requiredSections": ["接口约定", "来源"]
      }
    ]
  }
}
```

project 未声明 type 时只按显式配置检查必需文件和章节，不强加默认元数据；主动声明 type 的页面才接受相应模板契约。配置 entry 时才启用从入口到知识目录各 Markdown 页面的导航检查；没有 entry 时不额外要求统一入口。修改配置前确认它反映已有项目约定，不为使检查通过而降低项目实际要求。
