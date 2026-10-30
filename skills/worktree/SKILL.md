---
name: worktree
description: 创建和删除 Git worktree，目录固定在目标项目根的 worktree/ 下并保留分支层级。add 从本地或远端基线创建新分支；remove 移除工作树并保留分支。用户要求创建、删除 worktree 时使用，不负责恢复已有分支或推送。
user-invocable: true
argument-hint: "add <from分支> <新分支> | remove <分支>"
---

# Worktree 管理

```text
/agentforge:worktree add dev feature/login
/agentforge:worktree remove feature/login
```

add 接受 from、新分支两个参数；remove 接受一个分支参数，动作不可省略。不接受目录参数，目标固定为 `<项目主工作树根>/worktree/<分支>/`，如 `worktree/feature/login/`。

## 公共规则

- 用 `git -C "<目标项目目录>" worktree list --porcelain` 确定主工作树根 `$root`；在 linked worktree 中调用也使用该根，不使用技能安装目录或当前 shell 目录。裸仓库不支持。之后所有仓库命令都显式写 `git -C "$root"` 或 `git -C "$target"`，不依赖当前工作目录。
- 校验动作、参数数量及分支名：用 `git check-ref-format "refs/heads/$branch"`，拒绝以 `-` 开头的名称，不展开 checkout 简写。远端名来自仓库配置，同样视为不可信：必须精确出现在 `git -C "$root" remote` 的输出中，且不能以 `-` 开头、不能含空白或控制字符，否则停止并报告。命令参数安全传递，shell 变量始终引用，远端名放在 `--` 之后，防止被 Git 解析为选项。
- 目标必须在根 `worktree/` 内，目标和父路径不能经过符号链接、嵌入另一工作树或独立仓库。
- 旧 `.worktree/` 中的工作树不自动迁移或删除；remove仅核对新约定路径，旧路径另有登记时报告实际位置，不把同名目录当作目标。
- 使用原生 Git，不要求当前分支为 dev。不切换分支、不自动暂存、提交、stash、推送、删除分支或安装依赖。
- 检查失败就停止并报告实际状态；不把查询失败当作不存在，不自动覆盖、解锁、prune 或清理残留。强制删除必须先说明具体数据风险并获得用户对本次丢弃的明确同意。

## add

1. **选择来源**：询问 from 使用本地还是远端；对话已明确时不重复询问。默认远端为 origin，没有 origin 时使用唯一远端，存在多个则补问；选定后按公共规则校验远端名。无远端或无法查询就停止，即使 from 选择本地也要检查远端重名。
2. **锁定基线**：本地用 `git -C "$root" rev-parse --verify --end-of-options "refs/heads/$from^{commit}"` 解析；远端先获取指定分支，再解析远端跟踪引用，记录完整 OID。例如：
   ```bash
   git -C "$root" fetch --no-tags -- "$remote" "+refs/heads/$from:refs/remotes/$remote/$from"
   ```
   来源不存在或获取失败就停止，不改写本地 from，不回退到其他来源或旧缓存。
3. **检查冲突**：本地已有 `refs/heads/<new>`、目标路径已存在或已登记，都停止；已挂载时报告路径。用下列命令查询所选远端的精确引用，不依赖缓存：
   ```bash
   git -C "$root" ls-remote --exit-code --heads -- "$remote" "refs/heads/$new"
   ```
   核对返回 ref；退出码 0 为存在，停止；2 为无匹配；其他为查询失败，停止。此检查不预留远端分支名。
4. **准备目录**：确认 `worktree/` 下没有已跟踪文件，并被忽略；必要时在根 `.gitignore` 追加 `/worktree/`，保留原内容。通过路径检查后创建缺失父目录。
5. **创建并验证**：
   ```bash
   git -C "$root" worktree add -b "$new" -- "$target" "$base_oid"
   ```
   重新核对注册路径、实际分支、HEAD 等于基线 OID，以及目标被主工作树忽略。报告来源类型/远端、基线短 hash、新分支、完整路径及未提交的 `.gitignore` 改动。

## remove

remove 不查询远端，不询问 from，不修改忽略规则。

1. **核对身份**：按分支计算目标路径，精确匹配 worktree 登记；未登记则报告不存在，不能直接删同名目录。目录缺失、锁定、失效、detached HEAD，或登记分支与实际分支不一致时停止。记录分支提交 OID，并确认目标 HEAD 一致。
2. **检查数据**：
   ```bash
   git -C "$target" status --porcelain=v1 -z --untracked-files=all --ignored=matching --ignore-submodules=none
   ```
   按 NUL 分隔解析；任何暂存、未暂存、未跟踪、忽略内容或子模块变化都列出路径和状态并停止，等待用户处理，不输出敏感文件内容。**忽略文件也可能随正常删除丢失，保留分支不能保护这些数据。** 未推送的提交仍由本地分支保留，不要求先合并或推送。
3. **删除**：确认身份和状态未变化，在主工作树根执行：
   ```bash
   git -C "$root" worktree remove -- "$target"
   ```
   Git 拒绝时报告原因，不自动加 `--force` 或改用 `rm -rf`。
4. **验证**：目录和注册项均已消失，原分支仍存在且 OID 未变。报告移除路径、保留分支及短 hash；不清理空父目录或其他工作树。add 仍拒绝已有分支，不将其描述为恢复命令。
