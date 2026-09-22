---
name: worktree
description: 管理 git worktree 的专用技能。/worktree add <分支名> <目录> 从基础分支拉出新 worktree；/worktree remove <分支名> <目录> 删除 worktree（保留分支）。凡用户要求创建、删除、清理、恢复 worktree（工作树），或提到 "worktree add/remove"，一律使用本技能的 git worktree 流程，禁止改用内置 EnterWorktree 工具（其 .claude/worktrees/ 约定与本技能的目录命名约定冲突）。
argument-hint: "<add|remove> <分支名 (feature/0917)> <worktree目录 (../worktree/)>"
disable-model-invocation: true
---

# Worktree 管理

用 `git worktree` 命令管理 worktree：从基础分支拉出新的开发工作区，用完回收。所有操作只涉及 worktree 的挂载与拆除，不动分支、不 push、不 rebase。

> **基础分支**：默认 `dev`。若项目根存在 `.claude/agentforge-conventions.md`，以其 `base-branch` 字段为准；两者都没有时默认 `dev`，并在报告里说明用的是哪个。

## 调用格式

```
/worktree <add|remove> <分支名> <worktree目录>
```

| 参数 | 说明 | 示例 |
|------|------|------|
| 动作 | `add` 创建，`remove` 删除 | `add` |
| 分支名 | 目标分支，可含斜杠 | `feature/0917` |
| 目录 | worktree 存放目录，可为相对路径。开头若带 `@` 是文件引用语法，去掉即可 | `../worktree/` |

## 铁律

1. **当前分支必须是基础分支**，add 和 remove 都一样。先执行 `git branch --show-current`，不是基础分支就停下告知用户先切换分支，不要执行任何后续操作。worktree 一律从基础分支拉出，避免 feature 分支上再套 feature 分支。
2. remove **只删 worktree 目录，分支一律保留**。用户的工作成果都在分支上，删 worktree 不能波及分支。
3. 一切可能丢数据的参数（`--force` 等）必须先向用户确认，用户明确同意才能用。

## 路径与命名

worktree 落在 `<目录>/<仓库名>-<分支名>`，其中分支名里的 `/` 替换为 `-`：

```bash
repo=$(basename "$(git rev-parse --show-toplevel)")
slug=$(echo "feature/0917" | tr '/' '-')
# 例：仓库 myrepo + 分支 feature/0917 + 目录 ../worktree/
#  → ../worktree/myrepo-feature-0917
```

## add 流程

1. 校验当前分支是基础分支（见铁律 1）
2. 按上面的命名规则算出目标路径
3. 目标路径已存在 → 停下报告给用户（可能之前建过），不要覆盖
4. 分支不存在 → `git worktree add <路径> -b <分支名>`：以当前基础分支为起点创建新分支并挂载
5. 分支已存在（没挂在任何 worktree 上，比如之前 remove 过）→ `git worktree add <路径> <分支名>`：把旧分支挂回 worktree
   - 若 git 报 `already checked out`：该分支已挂在别的 worktree 上，把那个路径告诉用户即可，不要强行操作
   - 判断分支是否存在：`git show-ref --verify --quiet refs/heads/<分支名>`
6. `git worktree list` 确认注册成功
7. 报告：worktree 路径、分支名、基于基础分支的 commit 短 hash。提醒用户可另开终端 cd 进去工作，或在该目录下重启 claude

## remove 流程

1. 校验当前分支是 `dev`（见铁律 1）
2. 按命名规则算出目标路径
3. `git worktree list` 里找不到该路径 → 报告"不存在或已删除"，停
4. 检查未提交改动：`git -C <路径> status --short`。非空 → 把改动列给用户看并停下询问，默认不删
5. `git worktree remove <路径>`。若 git 因存在改动或锁文件拒绝，如实转述错误原因，问用户是否 `--force`，用户明确同意才加
6. 报告：worktree 已删除、分支 `<分支名>` 仍保留，之后想恢复随时再 add

## 禁止

- 不使用内置 EnterWorktree / ExitWorktree 工具——它们走 `.claude/worktrees/` 的另一套约定，与本技能的 `<目录>/<仓库>-<分支>` 命名不是一回事
- 不删除分支、不 push、不 pull、不 rebase
