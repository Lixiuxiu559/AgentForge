# 项目 A 现状诊断

**诊断对象**：`/Users/lixiuxiu/development_tool/projects/kuavo/worktree/kuavodatahubai-feature-0930-v3.4.0`
**诊断时间**：2026-09-22
**诊断方式**：`node tools/doctor.mjs <项目根>` + 人工核实

---

## 资产总览

| 目标端 | 技能数 | 子 agent | hook 脚本 | MCP 配置 | 说明 |
|---|---|---|---|---|---|
| `.claude/` | **34** | 4 | `sync-agent-docs.sh` | `.mcp.json` | 主战场，资产最全 |
| `.agents/` | **34** | — | `sync-agent-docs.sh` | `config.toml` | 与 `.claude/skills` 基本同步（仅 `__pycache__` 差异） |
| `.codex/` | **3** | — | `sync-agent-docs.sh` | `config.toml` | 仅 `wiki` / `release-notes` / `bump-frontend-version` |
| `.qoder/` | **22** | — | — | `settings.json` | **已严重滞后** |

`CLAUDE.md` 与 `AGENTS.md` 均为 4866 字节，由 hook 双向同步，当前一致。

---

## 🔴 红线问题（建议立即处理）

### R1. 明文生产密钥被 git 跟踪

`.mcp.json` **已入库**（`git ls-files` 确认跟踪），文件内含：

| 服务 | 泄露内容 |
|---|---|
| `aliyun-sls` | 阿里云 AccessKey ID `LTAI5tEY****************` + AccessKey Secret `SuzP2****************` |
| `ssh-mcp` | HTTP `Authorization: Bearer b02d705d****************` |

同一份 AK/SK 还出现在 `.codex/config.toml` 和 `.agents/config.toml` 的 `[mcp_servers.aliyun-sls.env]` 中，
并且 `.codex/config.toml` / `.agents/config.toml` 还额外含 `Basic azhzLWFkbWluOms4***` 形式的 k8s-mcp 凭据。

**影响**：任何能读到该仓库历史的人都能拿到阿里云与内网 MCP 的凭据。这三份文件都在 git 里，
即使现在删除，**历史提交中仍然存在**。

**处置建议**：
1. **先轮换密钥**（阿里云 AK/SK、ssh-mcp token、k8s-mcp Basic 凭据），再清理文件 —— 顺序不能反。
2. 配置改为环境变量引用，例如 `.mcp.json` 用 `"${ALIBABA_CLOUD_ACCESS_KEY_ID}"`，实际值放 `.env`（已 gitignore）。
3. `.mcp.json` / `config.toml` 加入 `.gitignore`，改为提交 `.mcp.json.example`。
4. 用 `git filter-repo` 或 BFG 清理历史（需与团队协调，会重写历史）。

> **DSH 侧特别注意**：DSH 在拉起 stdio MCP 子进程前会**清洗环境变量**，
> 凡名字匹配 `/KEY|PASSWORD|SECRET|TOKEN/i` 的继承变量一律丢弃。
> 所以 `ALIBABA_CLOUD_ACCESS_KEY_ID` / `_SECRET` 必须**显式写在 cordis 行的 `env:` 下**，
> 不能指望 `!!js process.env.X` 传递。生成器必须处理这个差异。

### R2. 6 个 hook 的 matcher 写法错误，永远不会触发

`.claude/settings.json` 中 6 个 `PostToolUse` hook 使用了**权限规则语法**作为 matcher：

```json
{ "matcher": "Edit(*application.yml)",  "hooks": [...] }   // ← 错误
{ "matcher": "Write(*gym-*-*.yaml*)",   "hooks": [...] }   // ← 错误
```

Claude Code 的 hook `matcher` 是**针对工具名的正则**，不是文件路径 glob。
`Edit(*application.yml)` 作为正则无法匹配工具名 `Edit`，因此这些「同步 K8s YAML / 多环境配置」的提醒
**从未生效过**。

**反证**：同一份配置里第一条 hook 写的是 `"matcher": "Write|Edit"` —— 这是正确写法；
`.codex/config.toml` 里写的也是正确的 `matcher = "^(Write|Edit)$"`。只有这 6 条写错了。

**修正方式**：matcher 改为 `"Edit|Write"`，在脚本内读取 stdin 的 `tool_input.file_path` 做路径判断：

```json
{ "matcher": "Edit|Write", "hooks": [{ "type": "command", "command": "bash \"${CLAUDE_PROJECT_DIR}/.claude/hooks/check-config-sync.sh\"" }] }
```

附带问题：这些条目里的 `"$comment"` 是**非标准键**，Claude Code 不识别（虽不报错，但也不该依赖）。

### R3. `qa` agent 引用了不存在的 MCP 服务

`.claude/agents/qa.md` 的 `tools` 白名单里引用了两个 **`.mcp.json` 中根本没有定义**的服务：

```
mcp__dbhub__execute_sql_dev       (4 处引用)
mcp__dbhub__search_objects_dev
mcp__redis-dev__get               (6 处引用)
mcp__redis-dev__hget / hgetall / scan_all_keys / set / hset
```

`.mcp.json` 实际只定义了 `k8s-mcp`、`db-mcp`、`aliyun-sls`、`ssh-mcp`。

**影响**：`qa` agent 的数据库与 Redis 验收能力**完全不可用**，且失败方式是静默的——
工具不存在时模型只会说"无法访问"，不会报配置错误。

**处置**：确认 `dbhub` / `redis-dev` 是否已下线、改名，或本应写在 `.mcp.json` 里但被遗漏。

---

## 🟡 一致性问题

### Y1. 四端技能漂移

`.qoder/skills` 缺 12 个技能：`banner-design`、`brand`、`bump-gym-cli-version`、`bump-server-version`、
`design`、`design-system`、`prototype`、`publish-gym-cli`、`slides`、`ui-styling`、`ui-ux-pro-max`、`worktree`。

5 个同名技能的 `SKILL.md` **内容已经分叉**：

| 技能 | 差异行数 | `.claude` | `.qoder` |
|---|---|---|---|
| `arch-spec` | 146 | 14542 B | 12097 B |
| `pm` | 147 | 6263 B | 6207 B |
| `arch-backend` | 142 | 11283 B | 10334 B |
| `arch-frontend` | 142 | 11654 B | 8880 B |
| `implement` | 58 | 4409 B | 1983 B |

`.codex/skills` 另有 `wiki` 技能与 `.claude` 侧内容不一致。

**`pm` 技能的漂移是语义级冲突**，不只是排版：

- `.claude` 版（新）：需求澄清用 `grilling` 追问达成共识 → **一次性落盘 PRD** → 等审批
- `.qoder` 版（旧）：**多轮对话模式**，每轮等用户确认后再进入下一轮

两版对「PRD 该怎么写」的定义互斥。如果两个 IDE 交替使用，agent 行为会不一致。

### Y2. hook 脚本自身三份拷贝、两个版本

```
.claude/hooks/sync-agent-docs.sh   md5 8fcf2059f8e8172ee75e855ebc84423d   ← 独一份
.agents/hooks/sync-agent-docs.sh   md5 5fdb350d83bc4d18052f58cb092a7a0b   ┐ 相同
.codex/hooks/sync-agent-docs.sh    md5 5fdb350d83bc4d18052f58cb092a7a0b   ┘
```

`.claude` 版本与其他两份不同 —— 脚本内容本身也漂移了，且没有任何机制保证它们一致。

### Y3. MCP 端点分叉

同一个 `k8s-mcp` / `db-mcp` 在两端指向**不同环境**：

| | `.mcp.json` | `.codex/config.toml` / `.agents/config.toml` |
|---|---|---|
| k8s-mcp | `https://ai-base.lejugym.com/k8s-mcp/` | `http://121.43.241.121/k8s-mcp/` |
| db-mcp | `https://ai-base.lejugym.com/db-mcp/` | `http://121.43.241.121/db-mcp/` |
| 鉴权 | 无 | `Basic azhzLWFkbWluOms4***` |

需确认是**有意为之**（不同工具走不同网关）还是**配置事故**。

### Y4. `database-query.md` 缺少 frontmatter

`.claude/skills/database-query.md` 是扁平文件且**没有 YAML frontmatter**（无 `name` / `description`）。

- 在 **DSH** 中：会被**静默丢弃**并只留一条警告 —— 模型无法区分"技能不存在"和"技能非法"。
- 在 **Claude Code** 中：同样无法被正确索引。

34 个技能中其余 33 个的 frontmatter 均合法。

---

## ✅ 已经做对的地方

1. **`.claude/skills` 与 `.agents/skills` 已实质同步**（34 vs 34，仅 `ui-ux-pro-max/scripts/__pycache__` 差异）——
   说明你已经找到了共享根的正确方向，只是靠手工维持。
2. **`CLAUDE.md` ↔ `AGENTS.md` 双向同步 hook 有效**，且 DSH 原生读两者并会去重，不会重复注入。
3. **`.claude/skills` 有 33/34 个 frontmatter 合法**，格式质量整体很高。
4. **`.codex/config.toml` 的 hook matcher 写法是正确的**（`^(Write|Edit)$`），可作为修正 `.claude` 侧的参照。

---

## 结论

项目 A 的 agent 资产**内容质量高，但缺少"唯一真源"和"一致性校验"**。
当前四端靠手工拷贝维持，已经出现语义级分叉和配置失效，且存在密钥入库的红线问题。

这正是 AgentForge 要解决的第一层问题：**先能度量（doctor），再收敛成一份源（core），再分发给各端（plugins）。**

---

## 附：复现方式

以上结论全部由体检脚本自动产出，可随时复现：

```bash
node tools/doctor.mjs /Users/lixiuxiu/development_tool/projects/kuavo/worktree/kuavodatahubai-feature-0930-v3.4.0
```

当前输出：**14 个 error，12 个 warn，退出码 1**。

| 检查域 | error | warn |
|---|---|---|
| `skills` | 3（`database-query.md` 三端均缺 frontmatter） | 0 |
| `hooks` | 6（matcher 语法错误） | 7（6 个 `$comment` + 1 个非标准键） |
| `agents` | 2（`dbhub` / `redis-dev` 未定义） | 0 |
| `drift` | 0 | 4（qoder 缺 12、qoder 分叉 5、codex 缺 31、codex 分叉 1） |
| `drift`（脚本） | 0 | 1（hook 脚本 2 个版本） |
| `secrets` | 3（三个文件明文凭据且入库） | 0 |

> 脚本已对两类误报做过修正并复验：
> ① `mcp__codegraph__*` 是**用户级** MCP 服务（定义在 `~/.dsh/profiles/web/cordis.patch.yml`），在项目里引用合法；
> ② `.agents/skills` 与 `.claude/skills` 实际一致，早期误报源于内容指纹混入了目录前缀。
