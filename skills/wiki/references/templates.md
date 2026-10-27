# 默认骨架与文档模板

## 先选择项目约定

初始化前读取项目指令、现有文档入口、目录和少量代表文档。已有 Wiki 的目录、文件命名、术语和内容结构优先；仅为本次已授权范围补充知识，不将默认模板套到全库，不重命名或迁移现有目录，也不覆盖人工解释。

没有现成约定时选择下面的默认骨架。`docs/wiki/` 是推荐位置；用户或项目已指定其他路径时使用指定位置。模板提供内容骨架，知识由 Agent 根据项目证据填写，工具不会自动创建文件。

### 小型项目：small

适用于 CLI、库、技能仓库或只有少量概念的项目：

```text
docs/wiki/
├── README.md
└── wiki.config.json
```

从 [index-small.md](../assets/templates/index-small.md) 生成入口页。用途、规则与实现、代码及依赖可放在同一篇文档；无需为了满足形式拆出角色、权限或接口章节。阅读导航可以链接仓库已有说明、源码或测试；确实没有其他知识页面时写明单页范围。

需要拆出单独主题时使用 [guide.md](../assets/templates/guide.md)，并从入口页增加真实链接。默认检查会将额外 Markdown 文档作为 guide 检查。

### 多模块项目：modular

```text
docs/wiki/
├── README.md
├── concepts.md
├── wiki.config.json
└── modules/
    └── <模块名>/
        ├── README.md
        ├── rules.md           # 按需拆分
        ├── code-map.md        # 按需拆分
        └── dependencies.md    # 按需拆分
```

入口页使用 [index-modular.md](../assets/templates/index-modular.md)，公共概念使用 [concepts.md](../assets/templates/concepts.md)，模块入口使用 [module.md](../assets/templates/module.md)。每个模块至少有一篇 README；规则、代码映射和依赖可以保留在模块入口中，内容较多时再拆分：

| 文档类型 | 模板 | 填写重点 |
|---|---|---|
| 规则 | [rules.md](../assets/templates/rules.md) | 已确认规则及来源，与当前实现观察、冲突分别记录 |
| 代码映射 | [code-map.md](../assets/templates/code-map.md) | 真实实现入口、职责及其对应的概念，不仅罗列文件 |
| 依赖 | [dependencies.md](../assets/templates/dependencies.md) | 上下游、接口与契约、适用版本和未决依赖 |

拆分后为入口、概念及模块页面维护可传递的导航：根入口能经本地 Markdown 链接到达知识目录中的每篇文档。只有目录名称或纯文本路径不构成可检查的导航。无需每页都直接链接根目录，也不要求业务依赖无环。

## 填写模板

模板的共同字段和各类型必需章节以 [schema.json](../assets/schema.json) 为规范来源，确定性检查读取同一份定义。默认文档保留规定的二级标题，可以在其中新增三级标题或扩展其他章节。

1. 将所需模板内容写入目标项目中的相应文件；只创建实际需要的页面。
2. 用完整的项目事实、真实链接或明确的未知说明替换全部 `{{...}}`。占位符承载整段内容，不是需要保留的模板语法。资料不足时写“待确认：尚未找到该规则的批准依据”等具体缺口；不要空留表格或用示例路径冒充来源。
3. 填写适用范围、事实状态、核验基线与核验时间。基线可以是真实提交、版本、文档修订号或已记录的文件快照；资料不可得时明确写未确认。事实状态只能用草稿、部分核验或已核验；只有草稿允许核验时间为“未核验”，其他状态填实际核验的 `YYYY-MM-DD`。
4. 在“依据与核验”中列出实际使用的需求、决策、源码、测试等来源及核对范围。不能因为复制了模板、读取过文档或链接检查通过就将状态改为已核验；核验基线也不等于生产部署版本。
5. “待确认项”记录仍会影响理解或决策的问题；核查后确实没有开放问题时明确写“无已知待确认项”，不要留空或机械删除章节。

每个必需章节都应有实质内容。没有适用的权限、依赖或公式时可以说明不适用及原因，无需创造业务概念。模板检查能验证字段、章节、占位符和链接结构，不能证明来源真实、业务规则正确或部署状态有效，这些仍需 Agent 对照证据核实。

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

project 只按显式配置检查必需文件和章节，不强加默认元数据。配置 entry 时才启用从入口到知识目录各 Markdown 页面的导航检查；没有 entry 时不额外要求统一入口。修改配置前确认它反映已有项目约定，不为使检查通过而降低项目实际要求。
