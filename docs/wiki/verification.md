# 本次生成验证与复验

## 文档信息

| 字段 | 内容 |
|---|---|
| 适用范围 | AgentForge 自用 Wiki 的模板、新鲜度复核、候选隔离与机械检查 |
| 事实状态 | 部分核验 |
| 核验基线 | 功能基线 3e5341d；发布元数据与来源、文档内容按项目复核记录核验 |
| 核验时间 | 2026-10-27 |

## 内容

本页记录功能基线 3e5341d 及 v0.9.0 发布准备阶段的本地核验，来源和文档另以内容指纹追溯。所有命令从仓库根执行；此页不自动追踪后续远端发布与 CI 状态。

### 已执行证据

| 验证 | 实际结果与范围 |
|---|---|
| npm test | 本机 Node v24.15.0，本轮 56/56 通过；含 provider 2 项、Wiki 基础 17 项、模板 15 项、新鲜度 22 项 |
| node tools/doctor.mjs | 三端清单、版本、技能资源和 DSH 装配结构通过 |
| 本次 Wiki 生成 | 沿用 modular 骨架的四模块与按需拆分页，本轮增加新鲜度指南，并同步相关知识和架构说明 |
| 配置驱动的 Wiki 检查 | passed；11 篇 Markdown、102 个链接和 11 篇结构检查，入口导航全部可达，无覆盖限制；语义自动检查仍为 not_run |
| 新鲜度与工作区同步 | 本轮 gate 检查所有已配置模块的复核快照与变更映射；初次未建立记录时为 unknown，显式复核后为 passed，unmapped 为空 |
| PR YAML | 使用本机 Ruby YAML 解析器读取并核对 job、完整历史及 range 命令；远端工作流未执行 |
| 发布包内容 | npm pack dry-run 确认包含 freshness、snapshot、协议与模板资产；未发布 |

### 项目配置与命令

[wiki.config.json](wiki.config.json) 选择 modular，并声明四模块的源码与文档映射。相对路径均基于仓库根，后续检查必须继续显式传入配置。

```bash
node skills/wiki/scripts/wiki.mjs check --root "$PWD" --wiki docs/wiki --config docs/wiki/wiki.config.json
npm run wiki:freshness
npm run wiki:gate
```

check 检查目录、必需 H2、元数据状态和日历日期、未替换占位符、文件链接与入口可达性。freshness 检查来源与知识指纹，gate 再核对所选候选的变化覆盖。检查暂存内容时使用 scope staged，分支比较使用 scope range 及明确 base；按实际范围读取配置、记录和内容。成功采集或通过检查均不等于文档语义已自动审查。

### 负向验证方法

本次已在完整项目的隔离临时副本执行以下场景，结束后清理副本，真实 Wiki 未被破坏：

| 输入变化 | 实际结果 |
|---|---|
| 删除 concepts.md | issues，包含 missing-structure-document |
| 删除技能方法模块 README | issues，包含 missing-structure-document |
| 核验基线残留行内代码占位符 | issues，包含 unresolved-placeholder |
| 删除适用范围字段 | issues，包含 missing-document-field |
| 核验日期改为 2026-02-30 | issues，包含 invalid-verification-date |
| 新增完整但未导航的主题页 | issues，包含 unreachable-document |
| 新建沿用英文标题和 Scope 章节的 project 知识目录 | passed，没有强加默认元数据或模块目录 |
| 删除该 project 配置声明的 Scope 章节 | issues，包含 missing-section |

这些负向场景均以退出码 1 结束；兼容场景退出码 0。现有自动回归另验证了空章节借用附录正文及图片充当导航会被拒绝。

### 新鲜度闭环的实际故障演练

2026-10-27 在隔离 Git 副本上执行；只复制真实仓库的 Git 可见工作区文件，避免把原本忽略的 Finder 元数据当成新来源。副本的所有源码与文档指纹最初与项目记录一致。随后实际修改 provider 源码、写复核记录、暂存和提交，结果如下：

| 场景 | 实际结果 |
|---|---|
| 相同 Git 可见内容在隔离仓库保持 fresh | passed |
| 无未处理变化时 gate 通过 | passed |
| 来源变更后读取检查 stale | issues |
| 未复核来源变更被 gate 拦截 | issues |
| 有依据 no-change 复核后恢复通过且知识页未改 | passed |
| 未映射新文件不能通过 | partial |
| blocked 声明持续阻断 | issues |
| 工作区补记录不能掩盖不同暂存来源 | issues |
| 暂存复核记录尚未加入索引时仍拦截 | issues |
| 暂存复核记录后索引候选通过 | passed |
| 已复核提交树的 range gate 通过 | passed |
| 工作区新记录不能掩盖旧提交树 | issues |
| 复核记录进入新提交后 range gate 恢复通过 | passed |

no-change 恢复时对 provider 知识页计算哈希，确认文档没有被强行改动。blocked 是明确标注的隔离模拟，并不表示真实 provider 存在该冲突。索引与提交树演练直接生成候选提交，证明工作区新记录无法替代旧候选。副本已清理，可通过新鲜度回归中的对应 Git fixture 重复验证。

### 结果边界

checker 的 coverage.semantic 为 not_run。review 记录是执行者的明确复核声明；项目复核记录见配置 freshness.records，不自动证明业务语义。本文的部分核验来自本次人工阅读源码与实际工具执行；机器通过不能证明来源真实性、业务正确性、已发布或三端已安装。后续变更后应按实际范围重验，不自动刷新所有页面的核验日期。

## 依据与核验

来源为 [provider 测试](../../tests/skill-provider.test.mjs)、[Wiki 基础回归](../../tests/wiki.test.mjs)、[模板回归](../../tests/wiki-templates.test.mjs)、[doctor](../../tools/doctor.mjs)、[新鲜度回归](../../tests/wiki-freshness.test.mjs) 与 [检查协议](../../skills/wiki/references/tools.md)；本轮 npm test、doctor、YAML 解析、打包预览以及真实 Wiki 正向检查和隔离故障验证均已执行。功能实现和项目 Wiki 已在 3e5341d 提交；本页记录的是发布准备阶段的本地证据，不将其当作远端 CI 或 Release 成功的证明。

## 待确认项

三端宿主完整行为、Node 22 的本次执行以及远端 CI 结果未核实；skill-creator 的独立 quick_validate 因运行环境缺少 PyYAML 未完成，没有计作通过；无复杂度或突变分析报告，不据此宣称代码质量已全面证明。
