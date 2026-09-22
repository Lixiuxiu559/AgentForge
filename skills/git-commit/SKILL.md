---
name: git-commit
description: |
  任何涉及 Git 提交的操作都必须使用本技能。触发场景包括但不限于：用户说"commit"、"提交"、
  "提交代码"、"git commit"、"生成commit message"、"帮我提交"、"写个提交信息"、
  "规范提交"、"commit一下"、"代码改完了"、"这个改动帮我提交"。
  本技能负责分析改动、生成符合项目规范的 commit message、检查禁止文件、执行提交。
  **重要**：即使用户没有明确说"commit"这个词，只要表达了"代码改动完成需要提交"的意图，就必须激活本技能。
model: haiku
---

# Git Commit Skill

当用户要求提交代码时，按以下流程执行。

**⚠️ 铁律：六步必须逐项执行完毕，严禁跳过任何一步。每步完成后在回复中标注 "✓ 第N步完成"。**

## 提交格式（先探测、再套用）

按优先级从高到低确定格式，不要写死：

1. **项目现有规范优先**：先看 `CONTRIBUTING.md` / `AGENTS.md` / `CLAUDE.md` / `.github/` 等处有无提交约定；没有就读 `git log -20 --oneline` 归纳实际风格
2. **本仓库默认**：`<type>(<版本号>)[<模块>]: <修改内容>`
3. **毫无线索时**：回退到 Conventional Commits，即 `<type>(<scope>): <description>`

- **type**：feat / fix / docs / style / refactor / perf / test / chore
- **版本号**：按顺序探测，取到即止；全部落空则**省略版本段**（格式退化为 `<type>[<模块>]: <内容>`）

  ```bash
  ROOT=$(git rev-parse --show-toplevel)
  grep -rhoE 'V[0-9]+\.[0-9]+\.[0-9]+' \
    "$ROOT/CLAUDE.md" "$ROOT/AGENTS.md" "$ROOT/CONTRIBUTING.md" \
    "$ROOT/VERSION" "$ROOT/package.json" "$ROOT/pom.xml" 2>/dev/null | head -1
  ```

- **功能模块**：从改动文件路径推断，用 `[模块名]` 包裹
- **修改内容**：一句中文动词开头，不超过 50 字符

**正确示例**：`feat(V3.2.0)[用户模块]: 添加用户管理功能`、`fix(V3.2.0)[认证模块]: 修复token刷新问题`

## 工作流程

### 第一步：分析改动

```bash
git diff --cached --name-only   # 暂存区
git diff --name-only             # 工作区
git log -3 --oneline             # 提交风格参考
```

**边界情况**：
| 情况 | 处理 |
|------|------|
| 暂存区为空，工作区有改动 | 列出文件，询问是否 `git add`，确认后 add |
| 暂存区和改动区均为空 | 提示"没有需要提交的改动"，结束 |
| 改动分属多个不相关的关注点 | 列出分组，询问"拆分提交"还是"一起提交" |

### 第二步：生成 commit message

套用上节探测出的格式——确定 type、版本段（若有）、模块、描述。展示给用户确认（可提供多个备选）。

### 第三步：Wiki 同步检查

先定位 wiki 校验脚本，**项目里没有就跳过本步**（不影响提交）：

```bash
ROOT=$(git rev-parse --show-toplevel)
SCRIPT=$(ls "$ROOT"/.claude/skills/wiki/scripts/wiki-check \
            "$ROOT"/.codex/skills/wiki/scripts/wiki-check \
            "$ROOT"/.agents/skills/wiki/scripts/wiki-check 2>/dev/null | head -1)
[ -n "$SCRIPT" ] && python3 "$SCRIPT" --json
```

调 wiki 技能做完整检查——机械 + 语义分析。

**结果处理**：

| 结果 | 处理 |
|------|------|
| `mechanical.passed = false` | 阻止提交，必须修复机械检查错误 |
| `materials.modules` 有非"未标记"模块 | 调 wiki 技能的 `references/how-to-review.md` 做语义分析 → 发现不一致 → 展示建议给用户 → 用户确认后写 wiki |
| 无变更 / 无脚本 | 跳过 |

**语义分析由 wiki 技能统一处理**，git-commit 只负责判断"要不要调"，具体怎么对比由 wiki 技能的 `references/how-to-review.md` 定义。

### 第四步：检查禁止文件

以下内容**不可提交**：
- `.env` 文件
- `node_modules/`
- `.jsp`、`.war`、`.sh`、`.exe` 文件

```bash
git diff --cached --name-only | grep -E "(^\.env$|node_modules|\.(jsp|war|sh|exe)$)"
```

### 第五步：执行提交

```bash
git commit -m "<message>"
```

### 第六步：提交后确认

```bash
git status
```

告知用户 commit hash 和分支状态。

## 执行检查清单

每次调用本技能时，必须按顺序输出以下清单，每完成一项打 ✓：

```
□ 第一步：分析改动（git diff --name-only + git log -3）
□ 第二步：生成 commit message（展示给用户确认）
□ 第三步：Wiki 同步检查（项目存在 wiki-check 脚本才执行）
□ 第四步：检查禁止文件（.env / node_modules / .jsp .war .sh .exe）
□ 第五步：执行提交（git commit）
□ 第六步：提交后确认（git status + git log）
```

**任何一步失败都必须停下来处理，不得跳过继续。**
