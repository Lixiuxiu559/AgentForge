# 发布流程

## 核心机制：`version` 就是发版开关

Claude Code 用 `.claude-plugin/plugin.json` 的 `version` 字段判断用户是否需要更新：

- **不 bump `version`** → 用户永远停留在旧版本，push 代码**没有任何影响**
- **bump `version`** → 用户执行 `/plugin update` 或自动更新时拿到新版本

所以日常开发可以随便 push，发版是一个**显式动作**。

> ⚠️ **不要同时在 `plugin.json` 和 `marketplace.json` 里设 `version`。**
> Claude Code 只读 `plugin.json` 的值，**且不报警告** —— marketplace 里写的会被静默忽略，
> 造成"明明改了版本号用户却没更新"的假象。

---

## 日常开发：push 不 bump

```bash
git add -A
git commit -m "feat: ..."
git push
```

**用户侧无感知。** 不需要打标签，不需要改版本号。

CI 会在 push 时跑校验（见下），但**不会发版**。

---

## 发版：一条命令

```bash
node tools/release.mjs patch
git push --follow-tags
```

`release.mjs` 按顺序执行：

1. 检查工作区是否干净
2. 检查当前分支是否为 `main`
3. 跑 `tools/doctor.mjs` 校验（不通过则中止）
4. 计算新版本号
5. 检查目标 tag 是否已存在
6. 更新 `.claude-plugin/plugin.json` 的 `version`
7. 更新 `CHANGELOG.md`（把 `Unreleased` 转成正式版本 + 日期）
8. 提交 `chore(release): vX.Y.Z`
9. 打标签 `vX.Y.Z`

加 `--push` 可以连推送一起做：

```bash
node tools/release.mjs patch --push
```

加 `--dry-run` 只预览不落盘：

```bash
node tools/release.mjs patch --dry-run
```

---

## 版本号怎么定

语义化版本，但判据是**「对使用者是否破坏」**，不是代码改了多少。

| 类型 | 触发条件 | 示例 |
|---|---|---|
| **PATCH** | 措辞修正、脚本 bug 修复、文档、`references/` 内容补充 | `0.1.0` → `0.1.1` |
| **MINOR** | 新增技能、新增子 agent、新增语言支持、新增能力 | `0.1.1` → `0.2.0` |
| **MAJOR** | 重命名或删除技能/子 agent、改变现有行为契约 | `0.2.0` → `1.0.0` |

### 重命名是破坏性变更

使用者按名字调用能力：

```text
/agentforge:complexity-audit
```

技能或子 agent **一旦改名，旧名字立即失效**，用户的习惯、脚本、文档全部断裂。
所以：

- 重命名技能或 agent → **MAJOR**
- 删除技能或 agent → **MAJOR**
- 只改正文内容、不改名字 → PATCH

> 插件自身的 `name`（`agentforge`）改名更严重，需要 marketplace 的 `renames` 字段做迁移。
> 当前不计划改动。

---

## 发版前检查清单

`release.mjs` 会自动做前四项，后两项需要人工确认：

- [x] 工作区干净
- [x] 在 `main` 分支
- [x] `tools/doctor.mjs` 通过
- [x] 目标 tag 不存在
- [ ] `CHANGELOG.md` 的 `Unreleased` 段写清了本次改动
- [ ] 本地实测过关键技能能正常加载（`/plugin marketplace add ./` + 安装）

---

## CI：push 时校验，不发版

`.github/workflows/validate.yml` 在 push 和 PR 时运行：

- `node tools/doctor.mjs` —— 8 项结构与资产校验
- JSON 清单合法性

**CI 不碰版本号，不发版。** 它只保证 push 进去的东西结构是好的。

---

## 官方目录同步（若已提交到 claude-plugins-official）

通过官方目录审核后，**push 到 GitHub 会被 CI 自动同步并重新扫描，不需要重新提交表单**。

但同步的可见版本仍受 `version` 约束 —— 不 bump，用户还是拿不到。

---

## 常见错误

| 现象 | 原因 |
|---|---|
| 改了代码，用户说没更新 | 忘了 bump `version` |
| bump 了 `marketplace.json` 里的 version 但无效 | `plugin.json` 的值优先，且不报警告 |
| 发版后用户仍拿旧版 | 用户没执行 `/plugin update`；或自动更新被关闭 |
| tag 已存在导致发版失败 | 该版本已发过，换一个版本号 |
| 新增了技能但用户看不到 | 未发版；或技能 frontmatter 不合法（CI 应已拦住） |
