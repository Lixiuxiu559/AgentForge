# 发布流程

## 一次发版，两端同步

AgentForge 同时是 Claude Code 插件和 DeepSeek Harness 插件，所以有**两个版本号**，`release.mjs` 会**一起 bump**，始终保持一致：

| 文件 | 谁读它 | 作用 |
|---|---|---|
| `.claude-plugin/plugin.json` | Claude Code | **发版开关** —— 不 bump，CC 用户收不到更新 |
| `package.json` | DSH / npm | link 安装时读磁盘（版本号仅用于一致性）；**git 或 registry 安装时 pnpm 按 semver 解析，此时它才是开关** |

> ⚠️ **两者漂移会被 `doctor` 判为 error**，发版脚本第 3 步就会中止。
> 这是有意的：漂移会导致「发了一端、另一端还是旧版本号」。

## CC 侧的核心机制：`version` 就是发版开关

Claude Code 用 `.claude-plugin/plugin.json` 的 `version` 字段判断用户是否需要更新：

- **不 bump `version`** → 用户永远停留在旧版本，push 代码**没有任何影响**
- **bump `version`** → 用户执行 `/plugin update` 或自动更新时拿到新版本

所以日常开发可以随便 push，发版是一个**显式动作**。

> ⚠️ **不要同时在 `plugin.json` 和 `marketplace.json` 里设 `version`。**
> Claude Code 只读 `plugin.json` 的值，**且不报警告** —— marketplace 里写的会被静默忽略，
> 造成"明明改了版本号用户却没更新"的假象。

## DSH 侧的机制：没有独立的版本开关

`dsh plugin --profile <name> <args>` 是对 **pnpm 的透传**：在 profile 目录里跑 `pnpm <args>`，
然后按**已安装状态**（不是依赖 diff）reconcile `dsh.profile.bundles`。

| 安装方式 | 更新语义 |
|---|---|
| `dsh plugin --profile web add /abs/path` → `link:` | **直接读磁盘**，改动立即生效，版本号不参与 |
| `dsh plugin --profile web add git+https://...` | pnpm 按 semver 解析，需 bump `package.json` |
| registry 安装 | 同上 |

所以**本地开发用 link 安装时，DSH 侧不需要发版就能拿到最新代码**；只有分发给他人（git / registry）时版本号才起作用。

DSH 侧改动的生效条件见 `docs/architecture.md`：**新增 `agents/*.md` 必须重启 profile**
（`patchReload: live` 只监听用户 patch 文件，不会重新 `apply()`）；技能不受影响，每次重扫。

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
3. 跑 `tools/doctor.mjs` 校验（不通过则中止，**含两端版本一致性**）
4. 计算新版本号（若两端已漂移，会提示并以 `plugin.json` 为基准拉齐）
5. 检查目标 tag 是否已存在
6. **同步更新 `.claude-plugin/plugin.json` 与 `package.json` 的 `version`**
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

`release.mjs` 会自动做前五项，后两项需要人工确认：

- [x] 工作区干净
- [x] 在 `main` 分支
- [x] `tools/doctor.mjs` 通过（含两端版本一致性）
- [x] 目标 tag 不存在
- [x] 两端版本号会被同步 bump
- [ ] `CHANGELOG.md` 的 `Unreleased` 段写清了本次改动
- [ ] 本地实测过关键技能能正常加载（CC：`/plugin marketplace add ./` + 安装；DSH：`--dump-config` 看装配）

---

## CI：push 时校验，不发版

`.github/workflows/validate.yml` 在 push 和 PR 时运行：

- `node tools/doctor.mjs` —— 结构与资产校验 + DSH 适配校验
- JSON 清单合法性
- 脚本语法
- 版本号与 tag 一致性提示

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
| `doctor` 报「两端版本号不一致」 | `plugin.json` 与 `package.json` 漂移，用 `release.mjs` 发版会自动拉齐 |
| DSH 侧新增 agent 后没生效 | 只重载了插件没重启 profile —— `agentforge` 的工具描述与 enum 在 `apply()` 时固定 |
| DSH 侧改了技能没生效 | 技能每次重扫，通常应立即生效；若未生效检查 profile 是否真的挂载了 agentforge bundle |
