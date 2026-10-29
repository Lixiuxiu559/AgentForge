# 布局与模板

已有项目的目录、标题、元数据和人工内容优先，不为采用模板迁移全库。无约定时推荐docs/wiki；只创建需要的页面，模板由Agent按代码填充，脚本不生成知识。

## 文件和目录命名

先读项目明确的命名约定及现有文档路径，沿用其惯例语言、大小写和分隔风格，不把对话语言或正文语言直接当作文件命名语言。`modules`、`README.md`、`reviews.json`、`wiki.config.json` 保留固定名称；模块子目录及概念、规则、架构、部署、运维等文件/目录按项目惯例命名。已有Wiki路径及项目自定义入口/记录位置不自动迁移；没有稳定惯例时沿用现有名称，确需新增则与项目主要文档命名风格一致。

例如中文命名项目可用`核心概念.md`、`modules/订单/规则.md`、`系统架构/README.md`；英文命名项目沿用相应英文风格。下表的英文模板名属于技能内部资源，不是目标文件名约束，配置中的type标识仍使用英文。

## 默认布局

| preset | 最小布局 | 适用方式 |
|---|---|---|
| small | README.md、wiki.config.json | 少量概念合并在入口，需要时再拆主题 |
| modular | README.md、概念页、wiki.config.json、modules/<模块>/README.md | 按开发问题划模块；概念页按项目命名，规则/代码映射/依赖较多时再拆 |
| project | 保持现有结构 | 默认模式，只检查显式配置的约定 |

架构、部署和运维可独立成页、合并章节或链接已有手册；不是必须创建的目录。默认small/modular入口须经普通Markdown链接到达知识目录各页，纯文本路径和图片不算导航。

## 按需选择模板

| 类型 | 模板 | 知识重点 |
|---|---|---|
| 小入口 | [index-small.md](../assets/templates/index-small.md) | 用途、规则、代码依赖与导航 |
| 模块入口 | [index-modular.md](../assets/templates/index-modular.md) | 项目概览、导航、覆盖范围 |
| 公共概念 | [concepts.md](../assets/templates/concepts.md) | 术语及关系 |
| 模块 | [module.md](../assets/templates/module.md) | 职责、流程、条件与修改影响 |
| 规则 | [rules.md](../assets/templates/rules.md) | 当前实现规则、条件与边界 |
| 代码映射 | [code-map.md](../assets/templates/code-map.md) | 实现入口与职责对应 |
| 依赖 | [dependencies.md](../assets/templates/dependencies.md) | 上下游与实际接口 |
| 通用主题 | [guide.md](../assets/templates/guide.md) | 单一知识主题 |
| architecture | [architecture.md](../assets/templates/architecture.md) | 当前组件、交互与数据流 |
| deployment | [deployment.md](../assets/templates/deployment.md) | 构建/安装/发布、验证与回退 |
| environments | [environments.md](../assets/templates/environments.md) | 环境、配置差异及带时间的状态证据 |
| operations | [operations.md](../assets/templates/operations.md) | 日常诊断、故障与备份恢复 |
| troubleshooting | [troubleshooting.md](../assets/templates/troubleshooting.md) | 按症状排查与恢复 |

## 填写与兼容

替换全部占位符为真实知识、来源或具体未知，不复制示例路径/提交号。按 `references/content-verification.md` 核对正文；模板填完和结构通过不证明知识正确。

[结构schema](../assets/schema.json)是默认章节、字段及状态的唯一清单。保留其必需H2，可增加小节。文档信息填适用范围、事实状态、实际基线和核验时间；状态为草稿/部分核验/已核验，只有草稿允许时间“未核验”，其余为实际YYYY-MM-DD。未执行项目写在依据或操作旁，待确认项没有合格技术问题时写无。

新规则页使用当前实现规则/条件与边界；旧三章节和旧双章节继续兼容。environments额外有适用环境、观察时间、证据来源字段；这些字段不证明线上状态。

## 检查配置

路径相对于项目根；命令须显式传--config，工具不会自动发现。最小配置可用 `{"version":1,"modules":[],"structure":{"preset":"small"}}`，多模块改为modular。默认额外页按guide检查，modules下规则/映射/依赖按文件名选型；专用系统页须在documents显式声明type。

文件名不采用内置英文名称时，用documents的type声明用途，例如`{"path":"docs/wiki/核心概念.md","type":"concepts"}`、`{"path":"docs/wiki/modules/订单/规则.md","type":"rules"}`。modular已声明concepts类型时，以声明路径作为必需概念页；未声明则保留concepts.md兼容默认值。改用本地语言名称不会取消类型的内容、元数据和导航检查；相应链接和modules.sources/docs也应使用实际路径。脚本不自动猜语言或翻译文件名。

已有项目可声明自己的章节，也可对选定页启用模板类型：

```json
{
  "version": 1,
  "modules": [],
  "structure": {
    "preset": "project",
    "entry": "handbook/start.md",
    "documents": [
      {"path": "handbook/start.md", "requiredSections": ["范围", "导航"]},
      {"path": "handbook/runtime.md", "type": "environments"},
      {"path": "docs/architecture.md", "requiredSections": ["组件"]}
    ]
  }
}
```

显式type叠加该类型的共同/专用要求，requiredSections继续叠加项目要求。project未选型页及默认Wiki引用的外部未选型手册仅检查显式章节，不强加默认元数据。entry启用入口可达性检查；默认布局即使改entry也保留其必需文档。structure只约束格式，持续新鲜度还需modules来源映射，两者不会自动互相建立。
