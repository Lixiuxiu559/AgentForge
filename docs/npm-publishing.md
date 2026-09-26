# npm 分发与账号管理

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
| 该包状态 | **已 deprecate**；unpublish 被拒（见下） |
| 计划中的包名 | `@<个人账号>/dsh-agentforge`（scoped） |

---

## 一、删除公司名下的包（必须人工，agent 做不了）

`npm unpublish` 被 npm 政策拦住，整包和单版本都试过：

```
npm unpublish dsh-agentforge --force
npm unpublish dsh-agentforge@0.4.2 --force
→ 403 Granular access tokens that bypass two-factor authentication may not perform this action.
  https://gh.io/npm-gat-bypass2fa-deprecation
```

本机 `~/.npmrc` 里的 token 是**「绕过 2FA」的细粒度令牌**。npm 已禁止这类令牌执行
unpublish 等破坏性操作——这是政策，不是权限配置问题，改 token 权限也绕不过。
`npm deprecate` **不在限制范围内**（已实测），所以旧包挂了废弃警告作为临时遮挡。

### 路线 1：npm 网站（推荐）

1. 用 `lejugym` 登录 <https://www.npmjs.com/login>
2. 打开 <https://www.npmjs.com/package/dsh-agentforge>
3. 页面右侧 **Settings** → 拉到底 → **Delete package**
4. 按提示输入包名确认，并完成 2FA（OTP）

### 路线 2：命令行交互式登录

```bash
cp ~/.npmrc ~/.npmrc.company.bak     # 先备份公司 token
npm login                            # 交互式，输入 lejugym 的用户名 / 密码 / OTP
npm unpublish dsh-agentforge --force
cp ~/.npmrc.company.bak ~/.npmrc     # 用完还原
```

> **如果 `lejugym` 不是你的账号**，这两条路都走不通，得找账号主人
> （`liuchang@lejurobot.com`）操作。在那之前废弃警告就是唯一的遮挡。

---

## 二、注册 npm 账号

1. <https://www.npmjs.com/signup>
2. 填 **Username / Email / Password**，勾选同意条款
3. 去邮箱点验证链接
4. 建议立刻开启 **2FA**：<https://www.npmjs.com/settings/`<用户名>`/account>
   （Two-Factor Authentication → Enable）

⚠️ **用户名是永久的，注册后不能改。** 想清楚再定。
它同时决定你 scoped 包的 scope：用户名 `lixiuxiu559` → 包名 `@lixiuxiu559/xxx`。

> 名字被占用只能换。`agentforge` 这类通用词大概率已被占，但 scoped 包不受影响——
> 只要 scope（用户名）是你的，`@你的名字/任何名字` 都可用。

---

## 三、登录 npm

```bash
npm login              # 默认走浏览器授权（--auth-type=web）
npm whoami             # 验证身份
```

老式 TTY 流程：`npm login --auth-type=legacy`，然后输入用户名 / 密码 / OTP。

⚠️ **`npm login` 默认写 `~/.npmrc`，会覆盖里面已有的 token。**
这台机器的 `~/.npmrc` 存的是公司 token，直接 `npm login` 会把公司登录顶掉。

所以登录个人账号时，指定独立文件：

```bash
npm login --userconfig ~/.npmrc-personal
npm whoami  --userconfig ~/.npmrc-personal
```

### 或者用 Access Token（更适合多账号 / 自动化）

1. <https://www.npmjs.com/settings/`<用户名>`/tokens> → **Generate New Token**
2. 选 **Granular Access Token**
3. **Packages** 权限选 **Read and write**；**Expiration** 按需
4. 复制 token（**只显示一次**），写进独立文件：

```bash
cat > ~/.npmrc-personal <<'EOF'
//registry.npmjs.org/:_authToken=npm_你的token
EOF
chmod 600 ~/.npmrc-personal
```

> **「Bypass 2FA」这个选项要留意**：勾了它，命令行发布不用每次输 OTP，很方便；
> 但代价正是我们刚踩到的——**该 token 永远无法 unpublish**，要删包只能去网站。
> 想保留删包能力就别勾，代价是每次发布要输 OTP。

---

## 四、一台电脑上切换多个 npm 账号

npm 的配置优先级（高 → 低），**已实测**：

| 优先级 | 来源 | 实测结果 |
|---|---|---|
| 1 | CLI flag `--userconfig <file>` | ✅ 压过环境变量与所有 npmrc |
| 2 | 环境变量 `NPM_CONFIG_USERCONFIG` / `npm_config_userconfig` | ✅ 生效，但若环境里已预设小写形式，大写形式会被压住 |
| 3 | **项目级** `./.npmrc`（当前目录） | ✅ 覆盖用户级 |
| 4 | **用户级** `~/.npmrc`（或 `--userconfig` 指向的文件） | 默认 |
| 5 | 全局 `<prefix>/etc/npmrc` | — |

### 方案 A：`--userconfig`（推荐）

每条命令显式指定用哪份凭据，互不干扰：

```bash
npm whoami                                # → lejugym（公司）
npm whoami --userconfig ~/.npmrc-personal # → 你的个人账号

npm publish --userconfig ~/.npmrc-personal
```

**不会修改 `~/.npmrc`**，公司 token 原封不动。这是本项目采用的方案。

### 方案 B：项目级 `./.npmrc`（按目录自动切）

在项目根放一个 `.npmrc`，在该目录下所有 npm 命令自动用它：

```bash
cd ~/my-personal-project
cat > .npmrc <<'EOF'
//registry.npmjs.org/:_authToken=npm_你的token
EOF
npm whoami      # → 你的个人账号
cd ~            # 离开目录即恢复
```

⚠️ **必须加进 `.gitignore`**，否则 token 会被提交进仓库。

### 方案 C：环境变量（会话级）

```bash
export NPM_CONFIG_USERCONFIG=~/.npmrc-personal
npm whoami      # → 个人账号
unset NPM_CONFIG_USERCONFIG
```

适合「这个终端窗口接下来都发个人包」的场景。

### 不推荐：`npm login` / `npm logout` 反复切

两个命令都直接改 `~/.npmrc`，切来切去很容易忘记当前是谁，
而且 `npm logout` 会把公司 token 一起清掉。

### 自检

任何操作前先确认身份，避免发错账号：

```bash
npm whoami --userconfig ~/.npmrc-personal
```

---

## 五、待办：迁移到 scoped 包名

选 scoped 而不是等 24 小时复用 `dsh-agentforge`，有两个理由：

1. scoped 名**绕开 npm 的防误植检查**。`agentforge` 当初就是被这条拒掉的：
   `403 Package name too similar to existing package agent-forge`。
2. 归属清晰，一眼看出是个人项目而非公司资产。

### 步骤

**1. 按上面第二、三节拿到个人账号与独立 token 文件。**

**2. 改包名三处**（必须一致，`doctor` 会校验后两处）：

| 文件 | 改什么 |
|---|---|
| `package.json` | `name` → `@<USER>/dsh-agentforge` |
| `cordis.patch.yml` | insert 的 `name` → `@<USER>/dsh-agentforge` |
| `src/index.js` | `export const name` → `@<USER>/dsh-agentforge` |

`id: agentforge`、技能 provider 名、工具名 `agentforge` **都不动**。

**3. 校验 + 发布**：

```bash
node tools/doctor.mjs                                   # 必须 0 error 0 warn
node tools/release.mjs patch --push                     # git 侧先发
npm publish --userconfig ~/.npmrc-personal              # npm 侧手工发
```

> **换 scoped 名时不要用 `release.mjs --publish`**：它走默认 `~/.npmrc`（公司 token）。

**4. 切换本机 profile**：

```bash
dsh plugin --profile web remove dsh-agentforge
dsh plugin --profile web add @<USER>/dsh-agentforge
# 然后重启 profile
```

**5. 同步文档**：README 的 DSH 安装章节、`releasing.md` 的装法表格、CHANGELOG，
以及 awesome-dsh-plugin 的 PR #5910 评论。

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
