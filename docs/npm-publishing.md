# npm 分发

AgentForge 通过 npm 分发给 DSH 用户。registry 安装按 semver 解析 `package.json`
的 `version`，所以**版本号是 DSH 侧真正的发版开关**——这是它与 git 安装的关键区别
（git 依赖钉的是 commit，`pnpm update` 会跟到分支最新提交，等于 push 即发布）。
机制细节见 [`releasing.md`](releasing.md)。

---

## 当前状态（2026-09-26）

⚠️ **包名待迁移，下面是未完成状态。**

| 项 | 值 |
|---|---|
| 仓库 `package.json` 的 `name` | `dsh-agentforge` |
| npm 上实际存在的包 | `dsh-agentforge@0.4.2`，**属 `lejugym` / `liuchang@lejurobot.com`** |
| 该包状态 | **已 deprecate**（unpublish 被拒，见下） |
| 计划中的包名 | `@<个人账号>/dsh-agentforge`（scoped） |

### 为什么会有 `lejugym`

首次发布时本机 `~/.npmrc` 里存的是**公司账号** `lejugym`（乐聚机器人）的 token，
于是 `dsh-agentforge@0.4.2` 发到了公司名下。开源插件不该挂在公司账号上。

### 为什么没能直接下架

```
npm unpublish dsh-agentforge --force
→ 403 Granular access tokens that bypass two-factor authentication may not perform this action.
```

本机 token 是「绕过 2FA 的细粒度令牌」，npm 已禁止这类令牌执行 unpublish 等破坏性操作。
`npm deprecate` **不受此限制**（已实测），所以旧包挂了废弃警告指向本仓库。

**彻底删除只能由 `lejugym` 账号本人在 npm 网站上操作**，或用带 2FA 的交互式登录执行。

---

## 待办：迁移到 scoped 包名

选 scoped 而不是等 24 小时复用 `dsh-agentforge`，有两个理由：

1. scoped 名**绕开 npm 的防误植检查**。`agentforge` 当初就是被这条拒掉的：
   `403 Package name too similar to existing package agent-forge`。
2. 归属清晰，一眼看出是个人项目而非公司资产。

### 步骤

**1. 注册个人 npm 账号**（https://www.npmjs.com/signup），记下用户名 `<USER>`。

**2. 建细粒度 token** —— https://www.npmjs.com/settings/`<USER>`/tokens
→ Generate New Token → Granular Access Token → Packages 权限 **Read and write**。

> ⚠️ **不要用 `npm login`**：那会覆盖 `~/.npmrc` 里的公司 token，影响公司的工作。
> 存到独立文件：

```bash
cat > ~/.npmrc-personal <<'EOF'
//registry.npmjs.org/:_authToken=npm_你的token
EOF
chmod 600 ~/.npmrc-personal
```

**3. 改包名三处**（必须一致，`doctor` 会校验后两处）：

| 文件 | 改什么 |
|---|---|
| `package.json` | `name` → `@<USER>/dsh-agentforge` |
| `cordis.patch.yml` | insert 的 `name` → `@<USER>/dsh-agentforge` |
| `src/index.js` | `export const name` → `@<USER>/dsh-agentforge` |

`id: agentforge`、技能 provider 名、工具名 `agentforge` **都不动**。

**4. 校验 + 发版**：

```bash
node tools/doctor.mjs                    # 必须 0 error 0 warn
node tools/release.mjs patch --push      # git 侧先发（npm 用独立 token，分开跑）
npm publish --userconfig ~/.npmrc-personal
```

`release.mjs` 的 `--publish` 走的是默认 `~/.npmrc`（公司 token），
**换 scoped 包名时不要用它**，手工用 `--userconfig` 发。

**5. 切换本机 profile**：

```bash
dsh plugin --profile web remove dsh-agentforge
dsh plugin --profile web add @<USER>/dsh-agentforge
# 然后重启 profile
```

**6. 同步文档**：README 的 DSH 安装章节、`docs/releasing.md` 的装法表格、
CHANGELOG，以及 awesome-dsh-plugin 的 PR #5910 评论。

---

## 发布前检查

- `package.json` 必须声明 `publishConfig.access = "public"`。
  **scoped 包默认是 restricted**，不声明会发布失败。
- `repository.url` 必须指回本仓库。`awesome-dsh-plugin` 的市场靠它把 npm 包和
  条目配对（`scripts/probe-npm.mjs`），对不上就不显示 npm 装法。
- 包的 `name` 会作为模块说明符出现在 `cordis.patch.yml` 的 insert 里，
  两者不一致插件就挂不上。

## 不要做的事

- **不要手工往 awesome-dsh-plugin 的条目 yml 里加 `npm:` 字段**——会被校验拒绝。
  npm 映射由 registry 自动采集。
- **不要为了改描述而 `npm publish` 同一个版本号**——npm 不可逆，
  同一版本号发出去就收不回来，只能发新版本。
