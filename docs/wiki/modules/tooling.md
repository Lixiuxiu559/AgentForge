# 仓库工具与校验

> 说明 doctor 的校验项、release 与 Qoder 打包脚本、CHANGELOG 提取工具及 DSH 桥接入口；不覆盖各宿主客户端的安装操作。

## 概述

`tools/` 下四个零依赖脚本，加上 DSH 桥接 `src/index.js`，构成仓库的机械校验与分发工具。它们都不调用模型、不联网；会改仓库文件的只有 `release.mjs`（版本号、CHANGELOG、提交与标签），`package-qoder.mjs` 只写 `dist/`。

| 工具 | 用途 | 写入 |
|---|---|---|
| [doctor.mjs](../../../tools/doctor.mjs) | 插件结构、清单、技能、DSH 适配校验 | 只读 |
| [release.mjs](../../../tools/release.mjs) | 同步四处版本号、CHANGELOG、提交、打标签 | 写入仓库 |
| [package-qoder.mjs](../../../tools/package-qoder.mjs) | 构建 Qoder ZIP | 写 `dist/qoder/` |
| [changelog-section.mjs](../../../tools/changelog-section.mjs) | 抽取 CHANGELOG 版本段作 Release 正文 | 只读 |
| [src/index.js](../../../src/index.js) | DSH 技能提供者 | 只读 |

## 核心流程

### doctor 的检查项

`node tools/doctor.mjs [root]` 以退出码 0/1 表示有无 error；warn 不影响退出码。

| 检查 | 关注点 | 位置 |
|---|---|---|
| 清单 | Claude Code 清单与 marketplace 存在、名称 kebab-case、市场声明插件 | [checkManifests](../../../tools/doctor.mjs#L82) |
| Codex | 插件名固定 `agentforge`、`skills: "./skills/"`、marketplace 指向 `./`、`architecture-scout` 只接受主动调用 | [checkCodexPlugin](../../../tools/doctor.mjs#L118) |
| 版本一致 | 四处清单版本同步 | [checkVersionSync](../../../tools/doctor.mjs#L196) |
| 组件布局 | `commands/agents/skills/hooks` 不能在 `.claude-plugin/` 内，必须有 `skills/` | [checkComponentLayout](../../../tools/doctor.mjs#L226) |
| 技能 | frontmatter 有 name/description、名字与目录一致、`references/` 引用存在、无嵌套 SKILL.md | [checkSkills](../../../tools/doctor.mjs#L255) |
| 硬编码路径 | 技能内不写死安装路径 | [checkHardcodedPaths](../../../tools/doctor.mjs#L291) |
| DSH 适配 | `dsh.bundle.patch` 存在、`main` 指向真实文件、`files` 含 `src`/`skills`/`cordis.patch.yml`、桥接导出 `apply` 且只依赖 `skills` | [checkDshAdaptation](../../../tools/doctor.mjs#L330) |
| 命名冲突 | 与 Claude Code 内置技能同名时警告 | [checkNaming](../../../tools/doctor.mjs#L409) |

`files` 白名单是最隐蔽的失败点：漏掉 `skills` 时 DSH 侧“装载成功但什么都没注册”，所以 doctor 把它当 error。

### Qoder 打包

`packageQoder` 在临时目录装配：复制 `skills/`，对每个 `SKILL.md` 去掉 `dsh-model-invocable` 行，把 `architecture-scout` 改写成 `disable-model-invocation: true` + `user-invocable: true`，剔除 `agents/openai.yaml`，再断言恰好十三个技能、复制 `LICENSE` 与 `docs/qoder.md` 作为 README，最后用系统 `zip` 压缩（[packageQoder](../../../tools/package-qoder.mjs#L66)）。

`qoderManifest` 先校验清单：名称、semver 版本、`skills: "./skills/"`、不声明 agents/commands/rules/hooks/mcpServers、版本与另外三处一致（[qoderManifest](../../../tools/package-qoder.mjs#L11)）。源文件全程只读。

### CHANGELOG 提取

发布工作流用 `node tools/changelog-section.mjs <x.y.z>` 把对应版本段作为 Release 正文；`[0.4.2]` 精确匹配，避免误中 `0.4.20`（[changelog-section.mjs](../../../tools/changelog-section.mjs#L34)）。找不到版本时退出码 1。

### DSH 桥接入口

`src/index.js` 的 `apply` 只注册技能提供者，技能的发现与加载见[系统架构](../architecture.md)的“DSH 桥接”一节；`parseFrontmatterFile` 只支持实际用到的 YAML 子集，不引依赖（[src/index.js](../../../src/index.js#L38)）。

## 关键实现

| 职责 | 位置 |
|---|---|
| 报告与退出码 | [report](../../../tools/doctor.mjs#L426) |
| 版本同步与打标签 | [release.mjs](../../../tools/release.mjs#L190) |
| Qoder 技能头部改写 | [qoderSkill](../../../tools/package-qoder.mjs#L26) |
| 桥接插件导出 | [apply](../../../src/index.js#L194) |

## 修改须知

- 新增技能后，`packageQoder` 的“恰好十三技能”断言与 `doctor` 的命名、Codex、DSH 检查会一起生效；同步更新断言与清单，不要只改一处。
- 改 `package.json` 的 `files` 会改变 DSH 安装结果，改完跑 `node tools/doctor.mjs`。
- 工具输出路径冲突时串行执行：覆盖率、构建与突变工具可能共享产物。

<details><summary>来源</summary>

- [tools/doctor.mjs](../../../tools/doctor.mjs)
- [tools/release.mjs](../../../tools/release.mjs)
- [tools/package-qoder.mjs](../../../tools/package-qoder.mjs)
- [tools/changelog-section.mjs](../../../tools/changelog-section.mjs)
- [src/index.js](../../../src/index.js)
- [package.json](../../../package.json)
- [cordis.patch.yml](../../../cordis.patch.yml)

</details>
