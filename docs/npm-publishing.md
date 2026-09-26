# npm 分发

> ## ⛔ 当前状态：已停用（2026-09-26）
>
> 决定**先不发 npm**——没有下载量可以接受。`.github/workflows/publish.yml`
> 的触发方式已从「tag 推送」改为「仅手动」，避免每次发版挂红叉。
>
> 本文件保留完整的方案与前置条件，将来要启用时照它走即可。
>
> **停用后的实际分发方式**：DSH 用户走 `github:` 安装（awesome 市场默认生成的就是
> 这个命令），而 `dshmarket` 对 github 安装的更新判断是
> **`钉住的 commit !== HEAD`**（`dshmarket/lib/updates.js`），
> 所以 **main 每推一次，市场就显示一次「有更新」**——即 push 即发布。
> 这是不发 npm 的直接代价，见 [`releasing.md`](releasing.md) 关于分支策略的讨论。

---

AgentForge 通过 npm 分发给 DSH 用户。registry 安装按 semver 解析 `package.json`
的 `version`，所以**版本号是 DSH 侧真正的发版开关**——这是它与 git 安装的关键区别
（git 依赖钉的是 commit，`pnpm update` 会跟到分支最新提交，等于 push 即发布）。
机制细节见 [`releasing.md`](releasing.md)。

**发布由 CI 完成，不在本机 `npm publish`。**

---

## 为什么不在本机发布

两个原因，第二个是硬的：

1. **凭据归属。** 本机 `~/.npmrc` 里是公司账号的 token，开源插件不该挂在公司账号上。
2. **npm 的 auth 是按 registry 存的，不是按账号。** 实测：

   ```
   同一个 registry 写两行不同 token  →  只有一行生效
   按 scope 配 @a:registry / @b:registry  →  两者指向同一 registry，
                                            token 键仍是 //registry.npmjs.org/:_authToken，
                                            照样只有一个
   ```

   所以两个 npmjs.com 账号**无法同时生效**，只能切来切去。而 `npm publish`
   不可逆——切错就是发错账号，收不回来。

把发布交给 CI 就绕开了整件事：CI 用 OIDC 换短时效凭据，**机器上不存在任何长期 token**，
也就不存在「切错账号」。

---

## 当前状态（2026-09-26）

⚠️ **包名待迁移，下面是未完成状态。**

| 项 | 值 |
|---|---|
| 仓库 `package.json` 的 `name` | `dsh-agentforge` |
| npm 上实际存在的包 | `dsh-agentforge@0.4.2`，**属 `lejugym` / `liuchang@lejurobot.com`** |
| 该包状态 | **已 deprecate**；unpublish 被拒（见下） |
| 计划中的包名 | `@<个人账号>/dsh-agentforge`（scoped） |

### 为什么删不掉那个包

```
npm unpublish dsh-agentforge --force
npm unpublish dsh-agentforge@0.4.2 --force
→ 403 Granular access tokens that bypass two-factor authentication may not perform this action.
```

本机 token 是**「绕过 2FA」的细粒度令牌**，npm 禁止这类令牌执行 unpublish。
这是政策，改 token 权限也绕不过。`npm deprecate` 不受限制（已实测），
所以旧包挂了废弃警告作为遮挡。

**彻底删除只能由 `lejugym` 账号本人操作**：

1. 用 `lejugym` 登录 <https://www.npmjs.com/login>
2. 打开 <https://www.npmjs.com/package/dsh-agentforge>
3. 右侧 **Settings** → 拉到底 → **Delete package** → 输包名 + OTP 确认

如果 `lejugym` 不是你的账号，得找账号主人（`liuchang@lejurobot.com`）。

---

## 发布流程（目标状态）

```bash
# 1. 先把 CHANGELOG 的 [Unreleased] 写清（release.mjs 会拒绝空段落）
# 2. 发版：同步 bump 两端版本 → 提交 → 打标签 → 推送
node tools/release.mjs patch --push

# 3. 剩下的自动完成：tag 推送触发 .github/workflows/publish.yml
```

`release.mjs` **不发布 npm**，它只负责 git 侧。npm 侧由
[`.github/workflows/publish.yml`](../.github/workflows/publish.yml) 接手：

| 步骤 | 作用 |
|---|---|
| tag 与 `package.json` 版本一致性 | 不一致就中止（手工打的标签会在这里被拦下） |
| `node tools/doctor.mjs` | 校验 `files` 白名单没漏掉 `skills/` `agents/` |
| `npm pack --dry-run` | 打印将发布的内容 |
| 该版本是否已发布 | **幂等**：已存在就跳过发布，重跑工作流不会红 |
| `npm publish` | OIDC 可信发布，自动附带 provenance |
| 创建 GitHub Release | 正文取自 CHANGELOG 对应段落 |

工作流只监听 tag、不提供手动触发——发布不可逆，入口越少越好。

### 供应链加固（与发布流程配套）

| 措施 | 位置 | 说明 |
|---|---|---|
| 第三方 action 钉 commit SHA | 两个 workflow | 不用可移动的 tag，防 tag 被指向恶意提交 |
| Dependabot 每周更新 pin | `.github/dependabot.yml` | **钉死不会自己更新，没有这个就是烂在原地**，拿不到安全修复 |
| 最小权限 | `publish.yml` | `contents: write`（建 Release）+ `id-token: write`（OIDC），其余不授 |
| 并发互斥 | `publish.yml` | 同一个 tag 只允许一个发布在跑，且不取消已开始的 |
| 幂等 | `publish.yml` | 重跑不会撞「版本已存在」 |
| provenance | OIDC 自带 | 无需 `--provenance` |

### 有意没做的（以及为什么）

- **私有 registry**：不适用——本项目就是要公开发布。
- **生产环境审批门**（GitHub Environment + required reviewer）：Coveo 那类公司用它卡生产发布，
  但单人项目是自己批自己，纯摩擦。要加的话在 `publish` job 上挂
  `environment: npm-publish` 并在仓库设置里配审批人。
- **分阶段 tag（alpha/beta → latest）**：单包项目用不上；真要做还得先让
  `release.mjs` 支持预发布版本号（目前它的 SEMVER 正则只接受 `x.y.z`）。
- **monorepo 拓扑发布**：不适用——单包仓库。
- **harden-runner**：收益边际，且要多钉一个第三方 action。不值得。


---

## 一次性引导：OIDC 发不了第一个版本

**这是本方案唯一的坑，必须先处理。**

可信发布者配置挂在**包自己的 npmjs.com 设置页**上，所以包必须先存在。
npm 官方与社区实践都确认：OIDC 无法完成首次发布。

参考实例（真实迁移 PR 的注释）：

> OIDC cannot publish a package's FIRST version (the package must already exist to host
> the trusted-publisher config), so v0.1.1 was bootstrapped with a one-time local
> `npm publish`; every release after is OIDC.
> —— [geocoordinates-rs#16](https://github.com/justin13888/geocoordinates-rs/pull/16)

### 引导步骤（不改本机 `~/.npmrc`）

**1. 建个人 npm 账号**，记下用户名 `<USER>`。
<https://www.npmjs.com/signup> —— ⚠️ 用户名永久不可改，且它决定 scoped 包的前缀。

**2. 改包名三处**（必须一致，`doctor` 会校验后两处）：

| 文件 | 改什么 |
|---|---|
| `package.json` | `name` → `@<USER>/dsh-agentforge` |
| `cordis.patch.yml` | insert 的 `name` → `@<USER>/dsh-agentforge` |
| `src/index.js` | `export const name` → `@<USER>/dsh-agentforge` |

`id: agentforge`、技能 provider 名、工具名 `agentforge` **都不动**。

**3. 用一次性 token 引导首次发布**（CI 内完成，不用本机）：

- 在 <https://www.npmjs.com/settings/`<USER>`/tokens> 建 **Granular Access Token**
  （Packages: Read and write）
- 存进仓库 secret：`gh secret set NPM_TOKEN --repo Lixiuxiu559/AgentForge`
- 临时给 `publish.yml` 的发布步骤加回：
  ```yaml
        - name: 发布
          run: npm publish
          env:
            NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
  ```
- 推一个 tag 触发，包即创建

**4. 配置可信发布者**：包的 Settings 页 → Trusted Publisher →
仓库 `Lixiuxiu559/AgentForge`、工作流 `publish.yml`

**5. 拆掉引导脚手架**：删掉 `NPM_TOKEN` secret 和那段 `env:`，
之后每次发版都走 OIDC，机器上不留任何长期凭据。

> 如果你更愿意跳过第 3 步，也可以在本机临时 `npm publish` 一次——
> 但那会往 `~/.npmrc` 写个人 token，正是本方案要避免的。

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
- **不要手工打 tag 发版**——版本号会与 tag 对不上，工作流会拦下，
  且 npm 不可逆。走 `node tools/release.mjs <bump> --push`。
- **不要把 npm token 写进仓库或 `.npmrc`**——目标状态是 CI 用 OIDC，
  本机不需要任何 npm 凭据。
